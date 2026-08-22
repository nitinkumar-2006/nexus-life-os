// src/utils/quickCommandParser.js
//
// A real, lightweight regex-based natural-language parser for the header's
// Quick Add popover - not a fake "AI" that just forwards the raw text
// somewhere. Recognizes two genuine command shapes and returns a
// structured {module, data} result the caller can act on directly; returns
// null for anything it can't confidently parse, so an unrecognized phrase
// never gets silently misfiled into the wrong module.
//
// Finance: "add/log expense|income <amount> [for/on/towards <description>]"
//   e.g. "Add expense 500 for lunch", "log income 2000 salary"
// Calendar: "add/schedule <title> <today|tomorrow|<weekday>> [at <time>]"
//   e.g. "Schedule gym tomorrow at 6 PM", "add dentist appointment friday at 3:30pm"

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Resolves a real calendar date ("YYYY-MM-DD") from "today", "tomorrow", or
// a weekday name - a bare weekday always means the NEXT occurrence of that
// day (today counts as "next" only if it's more than 0 days away is false,
// i.e. saying "monday" on a Monday means next Monday, one full week out,
// matching how people actually mean it in speech).
const resolveDateKeyword = (word, now = new Date()) => {
    const w = word.toLowerCase();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (w === 'today') return base;
    if (w === 'tomorrow') return new Date(base.getTime() + 86400000);
    const targetDow = WEEKDAYS.findIndex((d) => d.startsWith(w) && w.length >= 3);
    if (targetDow === -1) return null;
    let diff = targetDow - base.getDay();
    if (diff <= 0) diff += 7;
    return new Date(base.getTime() + diff * 86400000);
};

const formatDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Normalizes a loosely-typed time phrase ("6", "6pm", "6:30 pm") into the
// exact "HH:MM AM/PM" string format CalendarPage's own events already use
// (see CalendarPage.jsx's event.time field) - so a quick-command event
// looks and sorts identically to one added by hand.
const normalizeTime = (raw) => {
    if (!raw) return null;
    const m = String(raw).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    const minute = m[2] || '00';
    let period = (m[3] || '').toUpperCase();
    if (!period) period = hour >= 8 && hour <= 11 ? 'AM' : 'PM'; // no am/pm given - assume a normal daytime hour
    if (hour === 0) hour = 12;
    if (hour > 12) { hour -= 12; period = 'PM'; }
    return `${String(hour).padStart(2, '0')}:${minute} ${period}`;
};

// The description's own connector word ("for"/"on"/"towards"/":") is
// itself optional - "log income 2000 salary" (no connector) and "add
// expense 500 for lunch" (with one) are both real, natural phrasings and
// must both parse.
const FINANCE_PATTERN = /^(?:add|log)\s+(expense|income)\s+(?:of\s+)?(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d{1,2})?)\s*(?:(?:for|on|towards|:)\s+)?(.+)?$/i;
const CALENDAR_PATTERN = /^(?:add|schedule)\s+(.+?)\s+(today|tomorrow|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:\s+at\s+([\d:apm\s]+))?$/i;

export const parseQuickCommand = (text, now = new Date()) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;

    const financeMatch = trimmed.match(FINANCE_PATTERN);
    if (financeMatch) {
        const [, typeWord, amountStr, description] = financeMatch;
        const amount = parseFloat(amountStr);
        if (!amount || amount <= 0) return null;
        const type = typeWord.toLowerCase() === 'income' ? 'Income' : 'Expense';
        return {
            module: 'finance',
            summary: `${type === 'Income' ? 'Log income of' : 'Log expense of'} ₹${amount}${description ? ` for "${description.trim()}"` : ''}`,
            data: { type, amount, title: description ? description.trim() : type },
        };
    }

    const calendarMatch = trimmed.match(CALENDAR_PATTERN);
    if (calendarMatch) {
        const [, titleRaw, dateWord, timeRaw] = calendarMatch;
        const dateObj = resolveDateKeyword(dateWord, now);
        if (!dateObj) return null;
        const time = normalizeTime(timeRaw);
        const title = titleRaw.trim();
        if (!title) return null;
        return {
            module: 'calendar',
            summary: `Schedule "${title}" on ${formatDateKey(dateObj)}${time ? ` at ${time}` : ''}`,
            data: { title, date: formatDateKey(dateObj), time: time || 'All Day' },
        };
    }

    return null;
};
