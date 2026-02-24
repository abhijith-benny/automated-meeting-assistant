const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'phi';
const REQUEST_TIMEOUT_MS = 180000;
const MIN_TRANSCRIPT_LENGTH = 50; // characters

function preprocessTranscript(text) {
	if (typeof text !== 'string') return '';
	// Normalize whitespace
	let out = text.replace(/\s+/g, ' ').trim();
	// Remove repeated adjacent words (e.g., "the the" -> "the")
	out = out.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
	// Normalize multiple punctuation/space patterns left by speech errors
	out = out.replace(/\s+([?.!,;:])/g, '$1');
	return out;
}

function buildPrompt(transcriptText) {
	return `You are a meeting-notes assistant. Analyze the transcript below and return ONLY valid JSON.

IMPORTANT INSTRUCTIONS:
- Read the ENTIRE transcript carefully before answering.
- Extract ALL dates mentioned (e.g. "February 26, 2026", "March 1, 2026").
- Extract ALL action items / tasks / requests made by anyone.
- Write a summary that covers every topic discussed.
- Do NOT skip any information.

Return ONLY this JSON (no markdown, no code fences, no extra text):
{
  "cleaned_transcript": "<full corrected transcript preserving all original content>",
  "summary": "<3-6 sentence summary covering ALL topics, dates, and decisions>",
  "action_items": [
    {
      "task": "<what needs to be done>",
      "responsible": "<who should do it, or empty string if unknown>",
      "deadline": "<deadline if mentioned, or empty string>"
    }
  ],
  "important_dates": ["<every date/deadline mentioned in the transcript>"]
}

Rules:
- cleaned_transcript must contain the FULL transcript, not a shortened version.
- summary must NOT be empty. Summarize the key points in 3-6 sentences.
- important_dates must list EVERY date mentioned. Do not omit any.
- action_items must list EVERY task, request, or action mentioned.
- If a field is truly unknown, use "" for strings or [] for arrays.

Transcript:
"""${transcriptText}"""`;
}

function parseModelJson(rawText) {
	if (typeof rawText !== 'string' || !rawText.trim()) {
		throw new Error('Model returned an empty response.');
	}

	const trimmed = rawText.trim();

	try {
		return JSON.parse(trimmed);
	} catch (_err) {
		const firstBrace = trimmed.indexOf('{');
		const lastBrace = trimmed.lastIndexOf('}');
		if (firstBrace >= 0 && lastBrace > firstBrace) {
			const candidate = trimmed.slice(firstBrace, lastBrace + 1);
			return JSON.parse(candidate);
		}
		throw new Error('Model response was not valid JSON.');
	}
}

/**
 * Regex-based fallback: extract dates from transcript text.
 * Catches patterns like "February 26, 2026", "March 1, 2026", "Feb 29, 2026", "2026-03-05", etc.
 */
function extractDatesFromText(text) {
	if (!text) return [];
	const patterns = [
		// "February 26, 2026" / "March 1, 2026"
		/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/gi,
		// "Feb 26, 2026"
		/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/gi,
		// "2026-03-05" ISO dates
		/\d{4}-\d{2}-\d{2}/g,
		// "26/02/2026" or "02/26/2026"
		/\d{1,2}\/\d{1,2}\/\d{4}/g,
	];
	const found = new Set();
	for (const pattern of patterns) {
		const matches = text.match(pattern);
		if (matches) {
			for (const m of matches) {
				found.add(m.trim());
			}
		}
	}
	return [...found];
}

/**
 * Regex-based fallback: extract action-like sentences from transcript text.
 * Splits into sentences, then picks those with imperative / request language.
 */
function extractActionItemsFromText(text) {
	if (!text) return [];

	const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 15);

	// Only match sentences that contain request / imperative language
	const actionPattern =
		/\b(please\s|kindly\s|I\s+request|ensure\s+that|make\s+sure|finalize\s|upload\s|submit\s|prepare\s)/i;

	const items = [];
	const seen = new Set();
	for (const sentence of sentences) {
		if (actionPattern.test(sentence) && !seen.has(sentence)) {
			seen.add(sentence);

			// Try to extract a deadline from the same sentence
			const dateMatch = sentence.match(
				/(?:before|by|until|due|on)\s+(?:.*?\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4})/i
			);

			items.push({
				task: sentence.trim(),
				responsible: '',
				deadline: dateMatch ? dateMatch[1].trim() : '',
			});
		}
	}
	return items;
}

function normalizeResult(parsed, originalTranscript) {
	const cleaned = typeof parsed.cleaned_transcript === 'string' && parsed.cleaned_transcript.length > 0
		? parsed.cleaned_transcript
		: originalTranscript || '';

	let summary = typeof parsed.summary === 'string' ? parsed.summary : '';

	let actionItems = Array.isArray(parsed.action_items)
		? parsed.action_items.map((item) => ({
				task: typeof item?.task === 'string' ? item.task : '',
				responsible: typeof item?.responsible === 'string' ? item.responsible : '',
				deadline: typeof item?.deadline === 'string' ? item.deadline : '',
			}))
		: [];

	let importantDates = Array.isArray(parsed.important_dates)
		? parsed.important_dates.map((d) => (typeof d === 'string' ? d : String(d ?? '')))
		: [];

	// ── Fallback: extract dates from transcript if LLM missed them ──
	const regexDates = extractDatesFromText(originalTranscript);
	if (regexDates.length > 0 && importantDates.length === 0) {
		console.info('[NLP] LLM returned no dates – using regex fallback');
		importantDates = regexDates;
	} else if (regexDates.length > importantDates.length) {
		// Merge: add any regex-found dates not already covered by the LLM
		const existing = new Set(importantDates.map((d) => d.toLowerCase()));
		for (const rd of regexDates) {
			if (!existing.has(rd.toLowerCase())) {
				importantDates.push(rd);
			}
		}
	}

	// ── Fallback: extract action items if LLM missed them ──
	if (actionItems.length === 0 || actionItems.every((a) => !a.task)) {
		const regexActions = extractActionItemsFromText(originalTranscript);
		if (regexActions.length > 0) {
			console.info('[NLP] LLM returned no action items – using regex fallback');
			actionItems = regexActions;
		}
	}

	// ── Fallback: generate a basic summary if LLM left it empty ──
	if (!summary.trim() && originalTranscript) {
		console.info('[NLP] LLM returned empty summary – generating fallback');
		const sentences = originalTranscript
			.split(/(?<=[.!?])\s+/)
			.filter((s) => s.length > 10);
		summary = sentences.slice(0, 4).join(' ');
		if (sentences.length > 4) summary += ' …';
	}

	return {
		cleaned_transcript: cleaned,
		summary,
		action_items: actionItems,
		important_dates: importantDates,
	};
}

async function summarizeTranscript(transcriptText) {
	if (typeof transcriptText !== 'string' || !transcriptText.trim()) {
		throw new Error('transcriptText must be a non-empty string.');
	}
	// Preprocess transcript
	const cleaned = preprocessTranscript(transcriptText);
	if (cleaned.length < MIN_TRANSCRIPT_LENGTH) {
		throw new Error('Transcript too short or poor quality.');
	}

	// Try once, then retry a single time on failure
	let lastError = null;
	for (let attempt = 1; attempt <= 2; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			console.info(`[NLP] Sending transcript to LLM (attempt ${attempt}) | length=${cleaned.length}`);
			const response = await fetch(OLLAMA_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({
					model: OLLAMA_MODEL,
					prompt: buildPrompt(cleaned),
					stream: false,
					format: 'json',
				}),
			});

			if (!response.ok) {
				const errorBody = await response.text().catch(() => '');
				throw new Error(`Ollama request failed (${response.status}): ${errorBody || response.statusText}`);
			}

			const data = await response.json();
			if (!data || typeof data.response !== 'string') {
				throw new Error('Unexpected Ollama response shape: missing "response" text.');
			}

			const parsed = parseModelJson(data.response);
			return normalizeResult(parsed, cleaned);
		} catch (error) {
			clearTimeout(timeout);
			if (error?.name === 'AbortError') {
				lastError = new Error(`Ollama request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
			} else {
				lastError = new Error(`Failed to summarize transcript: ${error?.message || String(error)}`);
			}
			console.warn(`[NLP] Summarization attempt ${attempt} failed: ${lastError.message}`);
			if (attempt === 2) {
				// graceful failure after retry
				throw lastError;
			}
			// otherwise loop to retry
		} finally {
			clearTimeout(timeout);
		}
	}
}

module.exports = { summarizeTranscript };
