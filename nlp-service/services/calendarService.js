/**
 * Google Calendar service using googleapis
 * - Creates calendar events for action items that include a calendar_event_date
 */
const { google } = require('googleapis');
const {
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_CALENDAR_ID,
} = require('../config');

if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
  console.warn('Google Calendar credentials incomplete. Set GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID.');
}

// Create a JWT auth client using a service account
const auth = new google.auth.JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

/**
 * Helper to format a date string into start/end for Google Calendar.
 * If a time is provided, creates a 1-hour event. If only date provided, creates an all-day event.
 * @param {string} rawDate
 * @returns {{start:Object, end:Object}}
 */
function buildEventTimes(rawDate) {
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    // If time part is present (hours/minutes not zero), treat as datetime event
    const hasTime = /T|:\d{2}/.test(rawDate) || (parsed.getHours() !== 0 || parsed.getMinutes() !== 0);
    if (hasTime) {
      const start = parsed.toISOString();
      const end = new Date(parsed.getTime() + 60 * 60 * 1000).toISOString(); // default 1 hour
      return { start: { dateTime: start }, end: { dateTime: end } };
    }

    // All-day event using date only (YYYY-MM-DD)
    const yyyy = parsed.getUTCFullYear();
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    const startDate = `${yyyy}-${mm}-${dd}`;
    // Google Calendar all-day events are exclusive of the end day
    const next = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()+1));
    const yyyy2 = next.getUTCFullYear();
    const mm2 = String(next.getUTCMonth() + 1).padStart(2, '0');
    const dd2 = String(next.getUTCDate()).padStart(2, '0');
    const endDate = `${yyyy2}-${mm2}-${dd2}`;
    return { start: { date: startDate }, end: { date: endDate } };
  }

  return null;
}

/**
 * Create a Google Calendar event for an action item.
 * @param {Object} item
 * @returns {Object} - creation result
 */
async function createCalendarEvent(item = {}) {
  const { calendar_event_title, calendar_event_date } = item;
  if (!calendar_event_date) {
    return { success: false, error: 'No calendar_event_date provided' };
  }

  const times = buildEventTimes(calendar_event_date);
  if (!times) {
    return { success: false, error: 'Invalid calendar_event_date' };
  }

  const event = {
    summary: calendar_event_title || 'Meeting action item',
    ...times,
  };

  try {
    const response = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: event,
    });
    return { success: true, event: response.data };
  } catch (error) {
    const status = error?.response?.status || error?.code;
    const detail = error?.response?.data?.error?.message || error.message || String(error);
    console.error(`[Calendar] Event creation failed (status=${status}):`, detail);
    if (status === 404) {
      return {
        success: false,
        error: `Calendar not found or not shared with service account. Share your calendar (${GOOGLE_CALENDAR_ID}) with ${GOOGLE_CLIENT_EMAIL} and grant "Make changes to events" permission.`,
      };
    }
    return { success: false, error: detail };
  }
}

module.exports = {
  createCalendarEvent,
};
