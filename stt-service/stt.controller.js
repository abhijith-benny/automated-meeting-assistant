const { transcribeAudioFile: transcribeAudio } = require("./stt.service");
const { summarizeTranscript } = require("../nlp-service/summarizer");

async function transcribeMeetingController(req, res) {
	try {
		const { meetingId, audioFilePath } = req.body || {};

		if (!meetingId) {
			return res.status(400).json({
				success: false,
				error: "meetingId is required.",
			});
		}

		if (!audioFilePath || typeof audioFilePath !== "string") {
			return res.status(400).json({
				success: false,
				error: "audioFilePath is required and must be a string.",
			});
		}

		const transcript = await transcribeAudio(audioFilePath);
		let summary = null;
		let summaryError = null;

		try {
			summary = await summarizeTranscript(transcript);
		} catch (error) {
			summaryError = error?.message || "Failed to generate meeting summary.";
		}

		return res.status(200).json({
			success: true,
			transcript,
			summary,
			summaryError,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			error: error?.message || "Failed to transcribe audio.",
		});
	}
}

module.exports = {
	transcribeMeetingController,
};
