const express = require('express');
const { summarizeTranscript } = require('./summarizer');

const app = express();
const PORT = 7000;

app.use(express.json());

app.post('/summarize', async (req, res) => {
	try {
		const { transcript } = req.body || {};

		if (typeof transcript !== 'string' || !transcript.trim()) {
			return res.status(400).json({
				success: false,
				error: 'transcript is required and must be a non-empty string.',
			});
		}

		const result = await summarizeTranscript(transcript);

		return res.status(200).json({
			success: true,
			result,
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			error: error?.message || 'Failed to summarize transcript.',
		});
	}
});

app.listen(PORT, () => {
	console.log(`NLP service running on port ${PORT}`);
});
