/**
 * Local Fallback Service
 * Handles transcription via local Whisper (local-stt-service)
 * and summarization via local Ollama (nlp-service/summarizer).
 */

const { summarizeTranscript } = require("../nlp-service/summarizer");

const LOCAL_STT_URL =
	process.env.LOCAL_STT_URL || "http://localhost:6000/transcribe";
const LOCAL_STT_TIMEOUT_MS =
	Number(process.env.LOCAL_STT_TIMEOUT_MS) || 600_000; // 10 min

// ─── Transcription (local Whisper) ──────────────────────────────────────────

/**
 * Transcribe audio via the local-stt-service (Whisper).
 *
 * @param {string} audioFilePath  Absolute path to the audio file.
 * @param {string} meetingId      Meeting identifier for the local service.
 * @returns {Promise<string>}     The transcript text.
 */
async function transcribe(audioFilePath, meetingId) {
	console.info("[Local] Starting Whisper transcription:", audioFilePath);

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), LOCAL_STT_TIMEOUT_MS);

	try {
		const response = await fetch(LOCAL_STT_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			signal: controller.signal,
			body: JSON.stringify({
				meetingId: meetingId || "meeting",
				audioFilePath,
			}),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			throw new Error(
				`local-stt-service responded ${response.status}: ${body || response.statusText}`,
			);
		}

		const data = await response.json();

		if (!data?.success) {
			throw new Error(
				data?.error || data?.detail || "local-stt-service returned unsuccessful response.",
			);
		}

		const text = (data.transcript || "").trim();
		console.info("[Local] Whisper transcription complete | length=%d", text.length);

		return text;
	} catch (error) {
		if (error?.name === "AbortError") {
			throw new Error(
				`Local Whisper transcription timed out after ${LOCAL_STT_TIMEOUT_MS}ms.`,
			);
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}

// ─── Summarization (Ollama) ─────────────────────────────────────────────────

/**
 * Summarize a transcript using the local Ollama model (via nlp-service module).
 *
 * @param {string} transcriptText
 * @returns {Promise<object>}  { cleaned_transcript, summary, action_items }
 */
async function summarize(transcriptText) {
	console.info("[Local] Starting Ollama summarization | length=%d", transcriptText.length);

	const result = await summarizeTranscript(transcriptText);

	console.info("[Local] Ollama summarization complete");
	return result;
}

module.exports = {
	transcribe,
	summarize,
};
