const fs = require("fs");
const path = require("path");
const { transcribeAudioFile: transcribeAudio } = require("./stt.service");

function normalizeMeetingId(meetingId) {
	return String(meetingId).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
}

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
		const safeMeetingId = normalizeMeetingId(meetingId);
		const transcriptsDir = path.join(__dirname, "transcripts");
		const transcriptFilePath = path.join(transcriptsDir, `meeting_${safeMeetingId}.txt`);

		await fs.promises.mkdir(transcriptsDir, { recursive: true });
		await fs.promises.writeFile(transcriptFilePath, transcript, "utf8");

		return res.status(200).json({
			success: true,
			transcript,
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
