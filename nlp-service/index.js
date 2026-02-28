require('dotenv').config();
const express = require('express');
const { summarizeTranscript } = require('./summarizer');
const notionRoutes = require('./routes/notion');
const calendarRoutes = require('./routes/calendar');
const { createMeetingPage } = require('./services/notionService');
const { createCalendarEvent } = require('./services/calendarService');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(express.json());

// health
app.get('/', (req, res) => res.json({ success: true, service: 'nlp-service' }));

/**
 * After summarization, push meeting summary to Notion and
 * action item deadlines to Google Calendar.
 * Runs in the background — failures are logged but do not
 * affect the summarization response.
 */
async function pushToIntegrations(result) {
	const integrationResults = { notion: null, calendar: [] };

	// ── Push ONE meeting page to Notion ──
	if (result.summary && typeof result.summary === 'string' && result.summary.trim()) {
		try {
			const today = new Date().toISOString().slice(0, 10);
			const notionResult = await createMeetingPage({
				meeting_date: result.meeting_date || today,
				summary: result.summary,
			});
			integrationResults.notion = notionResult;
			console.info('[Integration] Notion push result:', JSON.stringify(notionResult));
		} catch (err) {
			console.warn('[Integration] Notion push failed:', err?.message || err);
		}
	}

	// ── Push action item deadlines to Google Calendar ──
	if (Array.isArray(result.action_items)) {
		for (const item of result.action_items) {
			if (item.deadline) {
				try {
					const calResult = await createCalendarEvent({
						calendar_event_title: item.task || 'Action item deadline',
						calendar_event_date: item.deadline,
					});
					integrationResults.calendar.push(calResult);
					console.info('[Integration] Calendar event created for deadline:', item.deadline, calResult);
				} catch (err) {
					console.warn(`[Integration] Calendar push failed for deadline "${item.deadline}":`, err?.message || err);
				}
			}
		}
	}

	return integrationResults;
}

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

		// Fire integration push in the background (don't block the response)
		pushToIntegrations(result).catch((err) =>
			console.warn('[Integration] Background push failed:', err?.message || err)
		);

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

/**
 * POST /integrations/ingest
 * Accepts a pre-built summary result and triggers Notion + Calendar push.
 * Used by the hybrid stt-service orchestrator so integrations fire
 * regardless of which pipeline produced the summary.
 */
app.post('/integrations/ingest', async (req, res) => {
	try {
		const result = req.body || {};

		if (!result.summary && !result.action_items) {
			return res.status(400).json({
				success: false,
				error: 'Request body must contain summary or action_items.',
			});
		}

		console.info('[Integration] Ingest received — pushing to Notion + Calendar…');

		// Fire in background, respond immediately
		pushToIntegrations(result).catch((err) =>
			console.warn('[Integration] Background push failed:', err?.message || err)
		);

		return res.status(200).json({ success: true });
	} catch (error) {
		console.error('[Integration] Ingest error:', error?.message || error);
		return res.status(500).json({
			success: false,
			error: error?.message || 'Integration ingest failed.',
		});
	}
});

// Register Notion and Calendar routes
app.use('/notion', notionRoutes);
app.use('/calendar', calendarRoutes);

app.listen(PORT, () => {
	console.log(`NLP service running on port ${PORT}`);
});
