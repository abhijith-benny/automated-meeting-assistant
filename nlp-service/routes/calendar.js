/**
 * Express route to create Google Calendar events for action items.
 */
const express = require('express');
const router = express.Router();
const { createCalendarEvent } = require('../services/calendarService');

// POST /calendar  { action_items: [ ... ] }
router.post('/', async (req, res) => {
  try {
    const { action_items } = req.body || {};
    if (!Array.isArray(action_items)) {
      return res.status(400).json({ success: false, error: 'action_items must be an array' });
    }

    const results = [];
    for (const item of action_items) {
      // Only create events when calendar_event_date is set
      if (!item || !item.calendar_event_date) {
        results.push({ success: false, error: 'calendar_event_date missing', item });
        continue;
      }

      try {
        const created = await createCalendarEvent(item);
        results.push(created);
      } catch (err) {
        results.push({ success: false, error: err?.message || String(err) });
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error?.message || 'Failed to create calendar events' });
  }
});

module.exports = router;
