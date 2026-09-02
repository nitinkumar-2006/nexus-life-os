// src/utils/dateUtils.js
//
// getLocalDateString(date) - the one correct way to turn a Date into a
// "YYYY-MM-DD" string anywhere in this app that means "today" (or any
// other calendar day) in the USER'S OWN LOCAL calendar, not UTC.
//
// The bug this fixes, confirmed live: `date.toISOString().split('T')[0]`
// was used all over this codebase (HomePage's Master Schedule "today"
// filter, TaskRegistryContext, Calendar's own date picker, gym/finance/
// study "log this as today" stamps, the activity heatmap, the daily AI
// briefing cache, ...) to get "today's date" as a string. toISOString()
// always converts to UTC first - for any user ahead of UTC (India, UTC+5:30,
// included), that means for the first several hours after local midnight,
// toISOString() still reports the PREVIOUS calendar day. A real user
// report: at 12:26 AM IST on the 29th, an all-day event dated "2026-08-28"
// (Raksha Bandhan) was still showing as "Active Now" on the Home page,
// because `new Date().toISOString().split('T')[0]` was still returning
// "2026-08-28" - it wouldn't have rolled over to "2026-08-29" until
// 5:30 AM IST. Every other write-site using this same pattern to stamp a
// new record's date (a gym session logged just after midnight, a bill's
// default due date, a Calendar event picked from the date grid) has the
// identical bug in the opposite direction: it silently saves the record
// under the WRONG (previous) calendar day.
export const getLocalDateString = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
