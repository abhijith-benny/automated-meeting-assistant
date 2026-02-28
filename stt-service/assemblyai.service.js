/**
 * AssemblyAI Service
 * Handles transcription and summarization via AssemblyAI cloud API.
 *
 * Uses the assemblyai SDK for:
 *   - Audio upload + transcription
 *   - LeMUR-powered structured summarization
 */

const { AssemblyAI } = require("assemblyai");

const ASSEMBLYAI_TIMEOUT_MS = Number(process.env.ASSEMBLYAI_TIMEOUT_MS) || 600_000; // 10 min

let client;

/**
 * Lazily initialise the AssemblyAI client.
 * Throws if ASSEMBLYAI_API_KEY is not set.
 */
function getClient() {
	if (client) return client;

	const apiKey = process.env.ASSEMBLYAI_API_KEY;
	if (!apiKey) {
		throw new Error("Missing ASSEMBLYAI_API_KEY environment variable.");
	}

	client = new AssemblyAI({ apiKey });
	return client;
}

/**
 * Detect credit-exhaustion or authentication errors from AssemblyAI
 * so the orchestrator can decide to fall back immediately.
 */
function isCreditOrAuthError(error) {
	const msg = (error?.message || "").toLowerCase();
	const status = error?.status || error?.statusCode || error?.response?.status;

	if (status === 401 || status === 402 || status === 403) return true;
	if (/insufficient|credit|quota|limit|payment|unauthorized|forbidden/i.test(msg)) return true;

	return false;
}

// ─── Transcription ──────────────────────────────────────────────────────────

/**
 * Transcribe an audio file via AssemblyAI.
 *
 * @param {string} audioFilePath  Absolute path to the audio file on disk.
 * @returns {Promise<{ transcriptId: string, text: string }>}
 */
async function transcribe(audioFilePath) {
	const aai = getClient();

	console.info("[AssemblyAI] Starting transcription:", audioFilePath);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ASSEMBLYAI_TIMEOUT_MS);

	try {
		const transcript = await aai.transcripts.transcribe({
			audio: audioFilePath,
			speech_models: ["universal-2"],
		});

		if (transcript.status === "error") {
			const err = new Error(
				`AssemblyAI transcription failed: ${transcript.error || "unknown error"}`,
			);
			err.assemblyStatus = transcript.status;
			throw err;
		}

		const text = transcript.text || "";

		console.info(
			"[AssemblyAI] Transcription complete | id=%s | length=%d",
			transcript.id,
			text.length,
		);

		return { transcriptId: transcript.id, text };
	} finally {
		clearTimeout(timer);
	}
}

// ─── Summarization (LeMUR) ─────────────────────────────────────────────────

const LEMUR_PROMPT = `You are a meeting-transcript processor. Analyze the transcript and return ONLY valid JSON with the EXACT structure below.

EXTRACTION RULES:
1. cleaned_transcript — Full transcript with grammar / punctuation corrected. Preserve all original content, speaker labels, and meaning.
2. summary — Detailed, comprehensive summary covering ALL major topics, discussions, decisions, conclusions, timelines, and milestones. Be thorough; do NOT truncate.
3. action_items — EVERY task, action item, scheduled work, milestone, or request mentioned.
   • task: concise description of what needs to be done.
   • responsible: person/team exactly as mentioned, or "" if not stated.
   • deadline: date exactly as stated if explicitly linked to the task, or "" if none.

OUTPUT (only valid JSON, no markdown):
{"cleaned_transcript":"","summary":"","action_items":[{"task":"","responsible":"","deadline":""}]}`;

/**
 * Summarize an already-completed AssemblyAI transcript using LeMUR.
 *
 * @param {string} transcriptId  The AssemblyAI transcript ID.
 * @returns {Promise<object>}  Parsed { cleaned_transcript, summary, action_items }
 */
async function summarize(transcriptId) {
	const aai = getClient();

	console.info("[AssemblyAI] Requesting LeMUR summary for transcript:", transcriptId);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ASSEMBLYAI_TIMEOUT_MS);

	try {
		const { response: rawResponse } = await aai.lemur.task({
			transcript_ids: [transcriptId],
			prompt: LEMUR_PROMPT,
			final_model: "anthropic/claude-3-5-sonnet",
		});

		console.info("[AssemblyAI] LeMUR response received | length=%d", rawResponse?.length || 0);

		return parseLemurResponse(rawResponse);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Parse the raw LeMUR text into structured JSON.
 * Handles markdown-fenced code blocks and bare JSON.
 */
function parseLemurResponse(raw) {
	if (typeof raw !== "string" || !raw.trim()) {
		throw new Error("AssemblyAI LeMUR returned empty response.");
	}

	let text = raw.trim();

	// Strip markdown code fences if present
	text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

	try {
		return JSON.parse(text);
	} catch (_err) {
		// Try to extract the outermost JSON object
		const first = text.indexOf("{");
		const last = text.lastIndexOf("}");
		if (first >= 0 && last > first) {
			return JSON.parse(text.slice(first, last + 1));
		}
		throw new Error("AssemblyAI LeMUR response was not valid JSON.");
	}
}

module.exports = {
	transcribe,
	summarize,
	isCreditOrAuthError,
};
