// src/utils/calendarSync.js
//
// Real, genuinely-functional calendar interoperability. File-based ICS
// (iCalendar, RFC 5545) import/export work entirely client-side with zero
// backend, so they're built here as full, real features - not a stub.
// A live external feed URL import is also real (a genuine fetch + parse),
// but many calendar providers' feed URLs don't send permissive CORS
// headers to arbitrary origins, so that path can legitimately fail for
// reasons entirely outside this app's control - callers are expected to
// surface that failure honestly (see CalendarPage.jsx's own handling)
// rather than silently swallow it or pretend it worked.
//
// Native device calendar sync (reading the OS's own Calendar/Contacts
// store) has no browser API for a plain web app - it genuinely requires
// a native app wrapper (Capacitor/Cordova) or a platform-specific
// integration. Deliberately not faked here; the UI card that uses this
// module says so plainly instead of pretending to support it.

// Un-folds ICS's line-folding (RFC 5545 section 3.1): a continuation line
// starts with a single space or tab and should be appended to the
// previous physical line, not treated as its own property.
const unfoldIcsLines = (raw) => {
    const rawLines = raw.split(/\r\n|\n|\r/);
    const lines = [];
    rawLines.forEach((line) => {
        if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
            lines[lines.length - 1] += line.slice(1);
        } else {
            lines.push(line);
        }
    });
    return lines;
};

// Handles the DTSTART formats every mainstream calendar export
// (Google/Outlook/Apple) actually produces: YYYYMMDD (all-day),
// YYYYMMDDTHHMMSS, and YYYYMMDDTHHMMSSZ (UTC). Returns null for anything
// else rather than guessing.
const parseIcsDate = (value) => {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/);
    if (!match) return null;
    const [, y, mo, d, h, mi] = match;
    const date = `${y}-${mo}-${d}`;
    if (h === undefined) return { date, time: 'All Day', allDay: true };
    const hour = parseInt(h, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return { date, time: `${String(hour12).padStart(2, '0')}:${mi} ${period}`, allDay: false };
};

const unescapeIcsText = (value) => value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');

// Lowercase, alphanumerics-only slug - used only as a fallback dedup key
// component when a VEVENT has no UID (see below), not for display.
const slugify = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Parses raw .ics text into Nexus's own calendar event shape - real
// VEVENT blocks only, every other ICS component (VTODO, VALARM, etc.) is
// ignored since this app only has a concept of calendar events. Returns
// [] rather than throwing for genuinely unparseable input, since a
// partial/malformed file shouldn't crash the whole import - whatever
// valid VEVENT blocks it did find are still returned.
//
// The id is deliberately stable across re-parses of the same input
// instead of random: UID is ICS's own real, standard stable identifier
// (RFC 5545) so it's used directly when present; when a feed genuinely
// omits it, a composite key (date + title + time, the same fields the
// user actually sees) stands in. Either way, re-importing byte-identical
// content twice produces the same ids both times, which is what lets
// mergeImportedEvents below recognize "this is the same event again"
// instead of always inserting a fresh duplicate.
export const parseIcsToEvents = (icsText) => {
    if (!icsText || typeof icsText !== 'string') return [];
    const lines = unfoldIcsLines(icsText);
    const events = [];
    let current = null;

    lines.forEach((line) => {
        if (line.startsWith('BEGIN:VEVENT')) { current = {}; return; }
        if (line.startsWith('END:VEVENT')) {
            if (current && current.title && current.dtstart) {
                const parsed = parseIcsDate(current.dtstart);
                if (parsed) {
                    const stableId = current.uid
                        ? `ics_${current.uid}`
                        : `ics_${parsed.date}_${slugify(current.title)}_${slugify(parsed.time)}`;
                    events.push({
                        id: stableId,
                        title: current.title,
                        category: 'Personal',
                        date: parsed.date,
                        time: parsed.time,
                        priority: 'Medium',
                        location: current.location || '',
                        completed: false,
                        importedFromIcs: true,
                    });
                }
            }
            current = null;
            return;
        }
        if (!current) return;
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) return;
        const rawKey = line.slice(0, colonIdx);
        const value = line.slice(colonIdx + 1).trim();
        // Strips ;PARAM=... suffixes (e.g. "DTSTART;TZID=America/New_York")
        // down to the bare property name - params beyond the value itself
        // aren't needed for the fields this app actually tracks.
        const key = rawKey.split(';')[0].toUpperCase();
        if (key === 'SUMMARY') current.title = unescapeIcsText(value);
        else if (key === 'DTSTART') current.dtstart = value;
        else if (key === 'LOCATION') current.location = unescapeIcsText(value);
        else if (key === 'UID') current.uid = value;
    });

    return events;
};

// Real "clear-before-sync + id-based merge" - shared by every import path
// (ics file, ics feed, device calendar) in CalendarPage.jsx so there's one
// real implementation instead of three hand-copies of the same logic.
//
// Scope is deliberately per-source, not global: only previously-imported
// events carrying this exact sourceFlagKey (e.g. 'importedFromIcs' or
// 'importedFromDevice') are cleared before the fresh batch is written.
// Manually-added events, and events imported from a *different* source,
// are untouched - re-syncing your device calendar should never silently
// delete an unrelated .ics file you imported yesterday.
//
// A matched id (same event, seen again) carries its `completed` flag
// forward from the old copy onto the new one, so a re-sync can't silently
// un-complete something the user already checked off - every other field
// refreshes from the newly-fetched data, which is the actual "update, not
// recreate" behavior.
export const mergeImportedEvents = (prevEvents, importedBatch, sourceFlagKey) => {
    // Defensive: a malformed feed/device response could itself contain the
    // same id twice - de-duplicate the incoming batch first so a single
    // sync run can't seed its own duplicates.
    const dedupedIncoming = Array.from(
        importedBatch.reduce((map, ev) => map.set(ev.id, ev), new Map()).values()
    );

    const staleSameSource = new Map(
        prevEvents.filter((ev) => ev[sourceFlagKey] === true).map((ev) => [ev.id, ev])
    );
    const kept = prevEvents.filter((ev) => ev[sourceFlagKey] !== true);

    const refreshed = dedupedIncoming.map((ev) => {
        const previous = staleSameSource.get(ev.id);
        return previous ? { ...ev, completed: previous.completed } : ev;
    });

    return [...refreshed, ...kept];
};

const escapeIcsText = (value) => String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

// "04:00 PM" -> "160000" (ICS's own bare HHMMSS time format).
const to24HourIcsTime = (timeStr) => {
    const match = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '000000';
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}${minute}00`;
};

// Generates a real, valid minimal .ics file from Nexus's own events, so a
// user's real schedule can be imported into any other standard calendar
// app (Google/Outlook/Apple) that accepts iCalendar files - the other
// direction of the same interoperability parseIcsToEvents provides.
export const eventsToIcs = (events) => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nexus OS//Calendar Export//EN'];
    events.forEach((ev) => {
        const dateDigits = (ev.date || '').replace(/-/g, '');
        if (!dateDigits) return;
        const timeDigits = ev.time && ev.time !== 'All Day' ? to24HourIcsTime(ev.time) : '000000';
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${ev.id || Date.now()}@nexus-os`);
        lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
        lines.push(`DTSTART:${dateDigits}T${timeDigits}`);
        if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
        lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
};

// Best-effort remote feed import - a genuine fetch + parse, not a fake
// "connected" state. Deliberately lets a network/CORS failure propagate
// as a real thrown error rather than swallowing it, since the calling UI
// needs the real reason to show something honest instead of a generic
// "sync failed".
export const importIcsFromUrl = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const text = await response.text();
    return parseIcsToEvents(text);
};
