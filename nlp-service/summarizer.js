const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'phi';
const REQUEST_TIMEOUT_MS = 300000;
const MIN_TRANSCRIPT_LENGTH = 50; // characters

function preprocessTranscript(text) {
	if (typeof text !== 'string') return '';
	// Normalize whitespace
	let out = text.replace(/\s+/g, ' ').trim();
	// Remove repeated adjacent words (e.g., "the the" -> "the")
	out = out.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
	// Normalize multiple punctuation/space patterns left by speech errors
	out = out.replace(/\s+([?.!,;:])/g, '$1');
	return out;
}

function buildPrompt(transcriptText) {
	return `You are a meeting transcript processor. Analyze the transcript below and return ONLY valid JSON following the EXACT output rules.

EXTRACTION RULES:
1. cleaned_transcript: Full transcript with grammar and punctuation corrected. Preserve all original content, speaker labels, and meaning. Do not remove, summarize, or paraphrase any part.
2. summary: Write a detailed, comprehensive summary covering ALL major topics, discussions, decisions, conclusions, timelines, and milestones mentioned in the meeting. The summary MUST be thorough — there is NO sentence limit. It should be proportional to the meeting length and complexity. Do NOT truncate or abbreviate. Include every important point.
3. action_items: Extract EVERY task, action item, scheduled work, milestone, or request mentioned in the transcript. Be thorough — do not miss any. Apply these rules strictly:
   - task: Clearly describe what needs to be done in a concise sentence.
   - responsible: Name of the person or team responsible, exactly as mentioned. Use "" if not mentioned or ambiguous.
   - deadline: If a date or timeframe is explicitly and directly associated with this specific task in the transcript, include it exactly as stated. Use "" only if NO date is linked to the task. Every task that has a date mentioned alongside it MUST have that date as its deadline.
   - CRITICAL: A deadline must NEVER appear without a task. But if a task has a date mentioned with it (e.g., "complete X by March 5" or "X is scheduled for March 1"), that date IS the deadline for that task — do NOT leave it blank.

OUTPUT RULES:
- Return ONLY valid JSON. No markdown, no code fences, no explanations.
- Do not invent or assume any task, deadline, or responsible person not explicitly stated.
- If no action items exist, return "action_items": [].
- Do NOT include an "important_dates" field.

OUTPUT FORMAT:
{"cleaned_transcript": "","summary": "","action_items": [{"task": "","responsible": "","deadline": ""}]}

Transcript:
"""${transcriptText}"""`;
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

/**
 * Regex-based fallback: extract dates from transcript text.
 * Catches patterns like "February 26, 2026", "March 1, 2026", "Feb 29, 2026", "2026-03-05", etc.
 */
function extractDatesFromText(text) {
	if (!text) return [];
	const patterns = [
		// "February 26, 2026" / "March 1, 2026"
		/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/gi,
		// "Feb 26, 2026"
		/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/gi,
		// "2026-03-05" ISO dates
		/\d{4}-\d{2}-\d{2}/g,
		// "26/02/2026" or "02/26/2026"
		/\d{1,2}\/\d{1,2}\/\d{4}/g,
	];
	const found = new Set();
	for (const pattern of patterns) {
		const matches = text.match(pattern);
		if (matches) {
			for (const m of matches) {
				found.add(m.trim());
			}
		}
	}
	return [...found];
}

/**
 * Regex-based fallback: extract action-like sentences from transcript text.
 * Splits into sentences, then picks those with imperative / request language.
 */
function extractActionItemsFromText(text) {
	if (!text) return [];

	const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 15);

	// Match sentences with request/imperative language OR scheduling language
	const actionPattern =
		/\b(please\s|kindly\s|I\s+request|ensure\s+that|make\s+sure|finalize\s|upload\s|submit\s|prepare\s|targeting\s|scheduled\s|complete[d]?\s|targeting\s|is\s+to\s+be|will\s+be|needs?\s+to)/i;

	// Date extraction pattern — matches dates after common prepositions
	const datePattern =
		/(?:before|by|until|due|on|targeting|from|to|scheduled\s+(?:for|to\s+be\s+completed\s+by))\s+(?:.*?\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4})/i;

	const items = [];
	const seen = new Set();
	for (const sentence of sentences) {
		if (actionPattern.test(sentence) && !seen.has(sentence)) {
			seen.add(sentence);

			// Try to extract a deadline from the same sentence
			const dateMatch = sentence.match(datePattern);

			items.push({
				task: sentence.trim(),
				responsible: '',
				deadline: dateMatch ? dateMatch[1].trim() : '',
			});
		}
	}
	return items;
}

/**
 * Month name/abbreviation lookup.
 */
const MONTH_NAMES = {
	january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
	july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
	jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a date string into { day, month (0-based), year } or null.
 * Supported formats:
 *   - DD-MM-YYYY  (or DD/MM/YYYY)
 *   - YYYY-MM-DD  (ISO)
 *   - Month name formats (e.g., "September 3, 2026", "Sep 3, 2026")
 */
function parseDateParts(dateString) {
	if (typeof dateString !== 'string' || !dateString.trim()) return null;

	const s = dateString.trim();
	let day, month, year;

	// 1) Try "Month DD, YYYY" / "Mon DD, YYYY" (with optional ordinal suffix)
	const namedMatch = s.match(
		/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})$/
	);
	if (namedMatch) {
		const monthKey = namedMatch[1].toLowerCase();
		if (!(monthKey in MONTH_NAMES)) return null;
		month = MONTH_NAMES[monthKey];
		day = parseInt(namedMatch[2], 10);
		year = parseInt(namedMatch[3], 10);
	} else {
		// 2) Try YYYY-MM-DD
		const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
		if (isoMatch) {
			year = parseInt(isoMatch[1], 10);
			month = parseInt(isoMatch[2], 10) - 1;
			day = parseInt(isoMatch[3], 10);
		} else {
			// 3) Try DD-MM-YYYY  (or DD/MM/YYYY)
			const dMyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
			if (dMyMatch) {
				day = parseInt(dMyMatch[1], 10);
				month = parseInt(dMyMatch[2], 10) - 1;
				year = parseInt(dMyMatch[3], 10);
			} else {
				return null; // unrecognized format
			}
		}
	}

	return { day, month, year };
}

/**
 * Validate a date string.
 * Returns true only when the string represents a real calendar date
 * (correct leap-year handling, no JS auto-correction).
 */
function isValidDate(dateString) {
	const parts = parseDateParts(dateString);
	if (!parts) return false;

	const { day, month, year } = parts;
	const d = new Date(year, month, day);
	return (
		d.getFullYear() === year &&
		d.getMonth() === month &&
		d.getDate() === day
	);
}

/**
 * Full month names for formatting corrected dates.
 */
const MONTH_FULL_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Correct an invalid date by rolling it forward to the next valid date.
 * E.g. "February 29, 2006" (not a leap year) -> "March 1, 2006"
 * Returns the corrected date string in "Month D, YYYY" format,
 * or the original string if already valid, or '' if unparseable.
 */
function correctInvalidDate(dateString) {
	if (!dateString || typeof dateString !== 'string') return '';
	if (isValidDate(dateString)) return dateString;

	const parts = parseDateParts(dateString);
	if (!parts) return '';

	// Let JS auto-correct the date (e.g. Feb 29 non-leap -> Mar 1)
	const corrected = new Date(parts.year, parts.month, parts.day);
	if (isNaN(corrected.getTime())) return '';

	const correctedStr = `${MONTH_FULL_NAMES[corrected.getMonth()]} ${corrected.getDate()}, ${corrected.getFullYear()}`;
	console.info(`[NLP] Corrected invalid date: "${dateString.trim()}" → "${correctedStr}"`);
	return correctedStr;
}

/**
 * Regex to find date strings like "February 29, 2006" inside free text.
 */
const INLINE_DATE_REGEX = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/gi;

/**
 * Replace every invalid inline date in a text string with its corrected version.
 * E.g. "before February 29, 2006" -> "before March 1, 2006"
 */
function correctInlineDates(text) {
	if (typeof text !== 'string') return text;
	return text.replace(INLINE_DATE_REGEX, (match) => {
		if (isValidDate(match)) return match;
		const corrected = correctInvalidDate(match);
		return corrected || match;
	});
}

/**
 * Post-process NLP output: correct invalid deadlines in action_items,
 * fix invalid dates in task text and summary, and remove action items
 * that have a deadline but no task.
 */
function validateDates(result) {
	// --- Fix invalid dates in summary ---
	if (typeof result.summary === 'string') {
		result.summary = correctInlineDates(result.summary);
	}

	// --- Fix invalid dates in cleaned_transcript ---
	if (typeof result.cleaned_transcript === 'string') {
		result.cleaned_transcript = correctInlineDates(result.cleaned_transcript);
	}

	// --- action_items: correct deadlines and inline dates in task text ---
	if (Array.isArray(result.action_items)) {
		for (const item of result.action_items) {
			// Correct the deadline field
			if (item.deadline) {
				const corrected = correctInvalidDate(item.deadline);
				if (!corrected) {
					console.warn(`⚠ Unparseable deadline removed: ${item.deadline}`);
					item.deadline = '';
				} else {
					item.deadline = corrected;
				}
			}
			// Correct any invalid dates in the task text
			if (item.task) {
				item.task = correctInlineDates(item.task);
			}
		}
		// Remove entries that have a deadline but no actual task
		result.action_items = result.action_items.filter((item) => {
			if (item.deadline && (!item.task || !item.task.trim())) {
				console.warn(`⚠ Deadline without task removed: ${item.deadline}`);
				return false;
			}
			return true;
		});
	}

	return result;
}

function normalizeResult(parsed, originalTranscript) {
	const currentYear = new Date().getFullYear(); // e.g. 2026
	const currentYearStr = currentYear.toString();

	/**
	 * The STT model often mishears "2026" as "2006" (off by 20 years).
	 * Build a map of commonly misheard years to the current year.
	 * Also handle placeholder years like "????", "XXXX", "20XX".
	 */
	const MISHEARD_YEAR = currentYear - 20; // 2006 when currentYear is 2026

	function fixYear(str) {
		if (typeof str !== 'string') return str;
		return str
			.replace(/\?{2,4}/g, currentYearStr)
			.replace(/\bXXXX\b/gi, currentYearStr)
			.replace(/\b20XX\b/gi, currentYearStr)
			.replace(new RegExp(`\\b${MISHEARD_YEAR}\\b`, 'g'), currentYearStr);
	}

	const cleaned = typeof parsed.cleaned_transcript === 'string' && parsed.cleaned_transcript.length > 0
		? fixYear(parsed.cleaned_transcript)
		: originalTranscript || '';

	let summary = typeof parsed.summary === 'string' ? fixYear(parsed.summary) : '';

	// ── Fix summary: strip truncation markers and ensure completeness ──
	// Remove trailing "…" or "..." that indicate the LLM truncated the summary
	summary = summary.replace(/\s*[…]+\s*$/, '').replace(/\s*\.{3,}\s*$/, '').trim();

	// If summary is too short (truncated by LLM) or empty, rebuild from cleaned transcript
	const summaryMinSentences = 3;
	const summarySentences = summary.split(/(?<=[.!?])\s+/).filter((s) => s.length > 10);
	if (summarySentences.length < summaryMinSentences && originalTranscript) {
		console.info('[NLP] Summary too short or truncated – rebuilding from transcript');
		const transcriptSentences = originalTranscript
			.split(/(?<=[.!?])\s+/)
			.filter((s) => s.length > 10);
		summary = transcriptSentences.join(' ');
	}

	let actionItems = Array.isArray(parsed.action_items)
		? parsed.action_items.map((item) => ({
				task: fixYear(typeof item?.task === 'string' ? item.task : ''),
				responsible: typeof item?.responsible === 'string' ? item.responsible : '',
				deadline: fixYear(typeof item?.deadline === 'string' ? item.deadline : ''),
			}))
		: [];

	// ── Post-process: extract deadlines from task text if LLM left them blank ──
	const deadlineDatePattern =
		/(?:before|by|until|due|on|targeting|scheduled\s+(?:for|to\s+be\s+completed\s+by))\s+(?:.*?\s+)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})/i;
	for (const item of actionItems) {
		if (item.task && !item.deadline) {
			const match = item.task.match(deadlineDatePattern);
			if (match) {
				item.deadline = match[1].trim();
				console.info(`[NLP] Extracted missing deadline "${item.deadline}" from task text`);
			}
		}
	}

	// ── Fallback: extract action items if LLM missed them ──
	if (actionItems.length === 0 || actionItems.every((a) => !a.task)) {
		const regexActions = extractActionItemsFromText(originalTranscript);
		if (regexActions.length > 0) {
			console.info('[NLP] LLM returned no action items – using regex fallback');
			actionItems = regexActions;
		}
	}

	// ── Fallback: generate summary if LLM left it completely empty ──
	if (!summary.trim() && originalTranscript) {
		console.info('[NLP] LLM returned empty summary – using full transcript');
		const sentences = originalTranscript
			.split(/(?<=[.!?])\s+/)
			.filter((s) => s.length > 10);
		summary = sentences.join(' ');
	}

	const result = {
		cleaned_transcript: cleaned,
		summary,
		action_items: actionItems,
	};

	// Validate and clean dates before returning
	return validateDates(result);
}

async function summarizeTranscript(transcriptText) {
	if (typeof transcriptText !== 'string' || !transcriptText.trim()) {
		throw new Error('transcriptText must be a non-empty string.');
	}
	// Preprocess transcript
	const cleaned = preprocessTranscript(transcriptText);
	if (cleaned.length < MIN_TRANSCRIPT_LENGTH) {
		throw new Error('Transcript too short or poor quality.');
	}

	// Try once, then retry a single time on failure
	let lastError = null;
	for (let attempt = 1; attempt <= 2; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		try {
			console.info(`[NLP] Sending transcript to LLM (attempt ${attempt}) | length=${cleaned.length}`);
			const response = await fetch(OLLAMA_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({
					model: OLLAMA_MODEL,
					prompt: buildPrompt(cleaned),
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
			return normalizeResult(parsed, cleaned);
		} catch (error) {
			clearTimeout(timeout);
			if (error?.name === 'AbortError') {
				lastError = new Error(`Ollama request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
			} else {
				lastError = new Error(`Failed to summarize transcript: ${error?.message || String(error)}`);
			}
			console.warn(`[NLP] Summarization attempt ${attempt} failed: ${lastError.message}`);
			if (attempt === 2) {
				// graceful failure after retry
				throw lastError;
			}
			// otherwise loop to retry
		} finally {
			clearTimeout(timeout);
		}
	}
}

module.exports = { summarizeTranscript, isValidDate };
