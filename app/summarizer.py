"""LLM-based meeting transcript summarization module (Ollama)."""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Dict

import requests

from app.config import (
    MAX_RETRIES,
    MIN_TRANSCRIPT_LENGTH,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT_S,
    OLLAMA_URL,
)

logger = logging.getLogger(__name__)


# ── Prompt ───────────────────────────────────────────────────────────────────

_PROMPT_TEMPLATE = """\
You are an assistant for meeting post-processing.

Task:
1) Clean minor transcription errors while preserving original meaning.
2) Produce a concise meeting summary.
3) Extract action items.
4) Extract deadlines and dates mentioned.
5) Extract responsible person names when available.

Return strictly valid JSON only. Do not include markdown, code fences, comments, or any extra text.
Include a cleaned transcript of the meeting under the key 'cleaned_transcript'.
Use exactly this schema:
{{
  "cleaned_transcript": "string",
  "summary": "string",
  "action_items": [
    {{
      "task": "string",
      "responsible": "string",
      "deadline": "string"
    }}
  ],
  "important_dates": ["string"]
}}

Rules:
- If a value is unknown, use an empty string for fields or an empty array for lists.
- Keep summary concise (3-6 sentences max).
- action_items must be an array, even if empty.
- important_dates must contain date/deadline references mentioned in the transcript.

Transcript:
{transcript}"""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _preprocess(text: str) -> str:
    """Normalize whitespace and remove duplicate adjacent words."""
    if not text:
        return ""
    out = re.sub(r"\s+", " ", text).strip()
    out = re.sub(r"\b(\w+)(\s+\1\b)+", r"\1", out, flags=re.IGNORECASE)
    out = re.sub(r"\s+([?.!,;:])", r"\1", out)
    return out


def _parse_llm_json(raw: str) -> Dict[str, Any]:
    """Extract and parse JSON from the model response."""
    if not raw or not raw.strip():
        raise ValueError("LLM returned an empty response.")
    trimmed = raw.strip()
    try:
        return json.loads(trimmed)
    except json.JSONDecodeError:
        first = trimmed.find("{")
        last = trimmed.rfind("}")
        if first >= 0 and last > first:
            return json.loads(trimmed[first : last + 1])
        raise ValueError("LLM response was not valid JSON.")


def _normalize(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure the parsed result conforms to the expected schema."""
    return {
        "cleaned_transcript": parsed.get("cleaned_transcript", "") or "",
        "summary": parsed.get("summary", "") or "",
        "action_items": [
            {
                "task": item.get("task", "") or "",
                "responsible": item.get("responsible", "") or "",
                "deadline": item.get("deadline", "") or "",
            }
            for item in (parsed.get("action_items") or [])
            if isinstance(item, dict)
        ],
        "important_dates": [
            str(d) for d in (parsed.get("important_dates") or [])
        ],
    }


# ── Public API ───────────────────────────────────────────────────────────────

def summarize(
    transcript: str,
    *,
    ollama_url: str | None = None,
    ollama_model: str | None = None,
    timeout_s: int | None = None,
    max_retries: int | None = None,
) -> Dict[str, Any]:
    """Send a transcript to the Ollama LLM and return a structured summary.

    Returns
    -------
    dict
        Keys: ``cleaned_transcript``, ``summary``, ``action_items``,
        ``important_dates``.
    """
    if not isinstance(transcript, str) or not transcript.strip():
        raise ValueError("transcript must be a non-empty string.")

    cleaned = _preprocess(transcript)
    if len(cleaned) < MIN_TRANSCRIPT_LENGTH:
        raise ValueError(
            f"Transcript too short ({len(cleaned)} chars); "
            f"minimum is {MIN_TRANSCRIPT_LENGTH}."
        )

    url = ollama_url or OLLAMA_URL
    model = ollama_model or OLLAMA_MODEL
    timeout = timeout_s or OLLAMA_TIMEOUT_S
    retries = max_retries if max_retries is not None else MAX_RETRIES

    prompt = _PROMPT_TEMPLATE.format(transcript=cleaned)
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        logger.info(
            "Summarization attempt %d/%d | model=%s | transcript_len=%d",
            attempt, retries, model, len(cleaned),
        )
        start = time.perf_counter()
        try:
            resp = requests.post(
                url,
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
                timeout=timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            raw_text = data.get("response", "")
            parsed = _parse_llm_json(raw_text)
            result = _normalize(parsed)
            elapsed = time.perf_counter() - start
            logger.info("Summarization done in %.2f s", elapsed)
            return result

        except requests.exceptions.Timeout:
            last_error = TimeoutError(
                f"Ollama request timed out after {timeout}s (attempt {attempt})."
            )
        except Exception as exc:
            last_error = RuntimeError(
                f"Summarization failed (attempt {attempt}): {exc}"
            )

        logger.warning("Attempt %d failed: %s", attempt, last_error)

    raise last_error  # type: ignore[misc]
