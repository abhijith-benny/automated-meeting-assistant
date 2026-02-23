const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'mistral';
const REQUEST_TIMEOUT_MS = 180000;

function buildPrompt(transcriptText) {
	return `You are an assistant for meeting post-processing.

Task:
1) Clean minor transcription errors while preserving original meaning.
2) Produce a concise meeting summary.
3) Extract action items.
4) Extract deadlines and dates mentioned.
5) Extract responsible person names when available.

Return strictly valid JSON only. Do not include markdown, code fences, comments, or any extra text.
Include a cleaned transcript of the meeting under the key 'cleaned_transcript'.
Use exactly this schema:
{
	"cleaned_transcript": "string",
	"summary": "string",
	"action_items": [
		{
			"task": "string",
			"responsible": "string",
			"deadline": "string"
		}
	],
	"important_dates": ["string"]
}

Rules:
- If a value is unknown, use an empty string for fields or an empty array for lists.
- Keep summary concise (3-6 sentences max).
- action_items must be an array, even if empty.
- important_dates must contain date/deadline references mentioned in the transcript.

Transcript:
${transcriptText}`;
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

function normalizeResult(parsed) {
	const normalized = {
		cleaned_transcript: typeof parsed.cleaned_transcript === 'string' ? parsed.cleaned_transcript : '',
		summary: typeof parsed.summary === 'string' ? parsed.summary : '',
		action_items: Array.isArray(parsed.action_items)
			? parsed.action_items.map((item) => ({
					task: typeof item?.task === 'string' ? item.task : '',
					responsible: typeof item?.responsible === 'string' ? item.responsible : '',
					deadline: typeof item?.deadline === 'string' ? item.deadline : '',
				}))
			: [],
		important_dates: Array.isArray(parsed.important_dates)
			? parsed.important_dates.map((d) => (typeof d === 'string' ? d : String(d ?? '')))
			: [],
	};

	return normalized;
}

async function summarizeTranscript(transcriptText) {
	if (typeof transcriptText !== 'string' || !transcriptText.trim()) {
		throw new Error('transcriptText must be a non-empty string.');
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(OLLAMA_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			signal: controller.signal,
			body: JSON.stringify({
				model: OLLAMA_MODEL,
				prompt: buildPrompt(transcriptText),
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
		return normalizeResult(parsed);
	} catch (error) {
		if (error?.name === 'AbortError') {
			throw new Error(`Ollama request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
		}
		throw new Error(`Failed to summarize transcript: ${error?.message || String(error)}`);
	} finally {
		clearTimeout(timeout);
	}
}

module.exports = { summarizeTranscript };
