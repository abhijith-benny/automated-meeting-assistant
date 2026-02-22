const STT_ENDPOINT = process.env.STT_ENDPOINT || "http://127.0.0.1:6000/transcribe";
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_RETRIES = Number(process.env.STT_REQUEST_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.STT_RETRY_DELAY_MS || 2000);
const http = require("http");
const https = require("https");

function assertValidInput(meetingId, audioFilePath) {
	if (!meetingId || typeof meetingId !== "string") {
		throw new TypeError("meetingId must be a non-empty string.");
	}

	if (!audioFilePath || typeof audioFilePath !== "string") {
		throw new TypeError("audioFilePath must be a non-empty string.");
	}
}

async function triggerTranscription(meetingId, audioFilePath) {
	assertValidInput(meetingId, audioFilePath);

	console.info("[STT] Transcription request started", {
		meetingId,
		audioFilePath,
		endpoint: STT_ENDPOINT,
		retries: DEFAULT_RETRIES,
	});

	let lastError;
	for (let attempt = 1; attempt <= DEFAULT_RETRIES; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

		try {
			const payload = await sendTranscriptionRequest({
				meetingId,
				audioFilePath,
				controller,
			});

			console.info("[STT] Transcription request completed", {
				meetingId,
				transcriptLength: typeof payload.transcript === "string" ? payload.transcript.length : 0,
			});

			return payload;
		} catch (error) {
			lastError = error;
			const isAbort = error?.name === "AbortError";
			const retryable = isAbort || /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(String(error?.message || ""));

			console.warn(`[STT] Attempt ${attempt}/${DEFAULT_RETRIES} failed: ${error.message}`);
			if (!retryable || attempt === DEFAULT_RETRIES) {
				break;
			}

			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
		} finally {
			clearTimeout(timeout);
		}
	}

	if (lastError?.name === "AbortError") {
		throw new Error(`STT request timed out after ${DEFAULT_TIMEOUT_MS}ms.`);
	}

	throw new Error(`Failed to trigger transcription: ${lastError?.message || "Unknown error"}`);
}

async function sendTranscriptionRequest({ meetingId, audioFilePath, controller }) {
	const body = JSON.stringify({ meetingId, audioFilePath });

	try {
		const response = await fetch(STT_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
			signal: controller.signal,
		});

		const payload = await parseJsonResponse(response);
		if (!response.ok) {
			const detail = payload?.detail || payload?.error || response.statusText;
			throw new Error(`STT request failed with status ${response.status}: ${detail}`);
		}

		if (!payload || payload.success !== true) {
			const detail = payload?.error || payload?.detail || "Unknown STT server error.";
			throw new Error(`STT server returned unsuccessful response: ${detail}`);
		}

		return payload;
	} catch (error) {
		const message = String(error?.message || "").toLowerCase();
		const causeMessage = String(error?.cause?.message || "").toLowerCase();
		const shouldFallback = message.includes("fetch failed") || causeMessage.includes("bad port");

		if (!shouldFallback) {
			throw error;
		}

		console.warn("[STT] Native fetch failed, using direct HTTP fallback:", error.message);
		return sendViaDirectHttp(STT_ENDPOINT, body, controller.signal);
	}
}

async function parseJsonResponse(response) {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

function sendViaDirectHttp(endpoint, body, abortSignal) {
	return new Promise((resolve, reject) => {
		const url = new URL(endpoint);
		const client = url.protocol === "https:" ? https : http;

		const request = client.request(
			{
				protocol: url.protocol,
				hostname: url.hostname,
				port: url.port || (url.protocol === "https:" ? 443 : 80),
				path: `${url.pathname}${url.search}`,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(body),
				},
			},
			(response) => {
				let rawData = "";
				response.setEncoding("utf8");
				response.on("data", (chunk) => {
					rawData += chunk;
				});
				response.on("end", () => {
					let payload = null;
					try {
						payload = rawData ? JSON.parse(rawData) : null;
					} catch {
						payload = null;
					}

					if (response.statusCode < 200 || response.statusCode >= 300) {
						const detail = payload?.detail || payload?.error || `HTTP ${response.statusCode}`;
						reject(new Error(`STT request failed with status ${response.statusCode}: ${detail}`));
						return;
					}

					if (!payload || payload.success !== true) {
						const detail = payload?.error || payload?.detail || "Unknown STT server error.";
						reject(new Error(`STT server returned unsuccessful response: ${detail}`));
						return;
					}

					resolve(payload);
				});
			}
		);

		request.on("error", (err) => {
			reject(err);
		});

		if (abortSignal) {
			abortSignal.addEventListener("abort", () => {
				request.destroy(new Error("Request aborted"));
			});
		}

		request.write(body);
		request.end();
	});
}

module.exports = {
	triggerTranscription,
};
