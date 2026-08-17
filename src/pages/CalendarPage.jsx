// src/pages/CalendarPage.jsx
import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, CheckCircle, Trash2, ChevronRight, ChevronLeft, ChevronDown, Sparkles, Bell, Cpu, ShieldCheck, Upload, Download, RefreshCw, Smartphone, X } from 'lucide-react';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { parseIcsToEvents, eventsToIcs, importIcsFromUrl } from '../utils/calendarSync.js';
import { isDeviceCalendarBridgeAvailable, importDeviceCalendarEvents } from '../utils/nativeCalendarBridge.js';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';

const CalendarPage = () => {
    const isMobile = useIsMobile();
    // Contextual first-visit tour (see TourGuide.jsx) - mobile only, same
    // scoping as every other page's own tour this pass.
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('calendar'));
    // FIXED: Zeroed out for 00% blank state
    const [events, setEvents] = useState(() => {
        const saved = localStorage.getItem('nexus_calendar_events');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return []; 
    });

    // Read-only mirror of the Timetable module's own data - CalendarPage
    // doesn't own this, TimetablePage does, so this is genuinely reactive
    // (not a one-time snapshot): kept live via the same 'storage' event
    // convention every source module in this app already dispatches on
    // its own changes, so an edit made on the Timetable page is reflected
    // here immediately if Calendar happens to be open at the same time.
    const [timetableData, setTimetableData] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_timetable_data') || '{}'); } catch (e) { return {}; }
    });
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_timetable_data') || '{}');
                setTimetableData((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    const [activeTab, setActiveTab] = useState('Agenda');

    // Calendar & Date States
    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [selectedDate, setSelectedDate] = useState(new Date()); 

    // Add Event Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({
        title: '',
        category: 'Study',
        date: selectedDate.toISOString().split('T')[0],
        time: '10:00 AM',
        priority: 'Medium',
        location: ''
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

    // Calendar Sync - real, file-based ICS import/export (see
    // utils/calendarSync.js) plus a best-effort remote feed URL fetch.
    // Imported events flow straight into the same `events` state/
    // persistence effect every manually-added event already uses, so
    // they're genuinely saved and show up in the month grid/agenda
    // immediately - not a separate, disconnected "preview".
    const icsFileInputRef = useRef(null);
    const [feedUrl, setFeedUrl] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [syncIsError, setSyncIsError] = useState(false);
    // Mobile-only: the whole "Calendar Sync" card (import/export/feed/
    // device) moves into this on-demand modal instead of always sitting
    // inline in the scroll, reached via a compact icon button in the
    // header action bar. Desktop keeps the card inline, unchanged.
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    // Mobile-only: lets the day's event list collapse out of the way so
    // the compact month grid isn't followed by a long always-open list -
    // defaults open since seeing today's schedule is the common case.
    const [isAgendaExpanded, setIsAgendaExpanded] = useState(true);

    useEffect(() => {
        if (!syncMessage) return undefined;
        const timeoutId = setTimeout(() => setSyncMessage(''), 6000);
        return () => clearTimeout(timeoutId);
    }, [syncMessage]);

    const handleIcsFileImport = async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            const text = await file.text();
            const imported = parseIcsToEvents(text);
            if (imported.length === 0) {
                setSyncIsError(true);
                setSyncMessage(`No parseable events found in "${file.name}".`);
                return;
            }
            setEvents((prev) => [...imported, ...prev]);
            setSyncIsError(false);
            setSyncMessage(`Imported ${imported.length} event${imported.length === 1 ? '' : 's'} from ${file.name}.`);
        } catch (err) {
            setSyncIsError(true);
            setSyncMessage('Could not read that file - make sure it is a valid .ics export.');
        }
    };

    const handleExportIcs = () => {
        if (events.length === 0) {
            setSyncIsError(true);
            setSyncMessage('Add at least one event before exporting.');
            return;
        }
        const icsContent = eventsToIcs(events);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nexus-schedule.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSyncIsError(false);
        setSyncMessage(`Exported ${events.length} event${events.length === 1 ? '' : 's'} as nexus-schedule.ics.`);
    };

    const handleFeedImport = async () => {
        if (!feedUrl.trim() || isSyncing) return;
        setIsSyncing(true);
        setSyncMessage('');
        try {
            const imported = await importIcsFromUrl(feedUrl.trim());
            if (imported.length === 0) {
                setSyncIsError(true);
                setSyncMessage('That feed loaded but had no parseable events.');
            } else {
                setEvents((prev) => [...imported, ...prev]);
                setSyncIsError(false);
                setSyncMessage(`Synced ${imported.length} event${imported.length === 1 ? '' : 's'} from the feed.`);
            }
        } catch (err) {
            // A genuine, common cause here is the feed's own server not
            // sending permissive CORS headers to this origin - real,
            // outside this app's control, not something to hide behind a
            // vague "something went wrong".
            setSyncIsError(true);
            setSyncMessage(`Couldn't fetch that feed (${err.message || 'network/CORS error'}). Try downloading the .ics file instead and importing it above.`);
        } finally {
            setIsSyncing(false);
        }
    };

    // Real device-calendar bridge (utils/nativeCalendarBridge.js) - only
    // ever reachable through the button below, which is itself only
    // rendered when isDeviceCalendarBridgeAvailable() is true (the
    // installed Android app, never a browser tab), so this never runs
    // against a plugin that genuinely isn't there. Same
    // isSyncing/syncMessage state and merge-into-`events` pattern as
    // handleFeedImport above, so all three import paths (file, feed,
    // device) read identically to the user.
    const handleDeviceCalendarImport = async () => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncMessage('');
        try {
            const imported = await importDeviceCalendarEvents();
            if (imported.length === 0) {
                setSyncIsError(true);
                setSyncMessage('No events found on your device calendar in the next 90 days.');
            } else {
                setEvents((prev) => [...imported, ...prev]);
                setSyncIsError(false);
                setSyncMessage(`Synced ${imported.length} event${imported.length === 1 ? '' : 's'} from your device calendar.`);
            }
        } catch (err) {
            setSyncIsError(true);
            setSyncMessage(err.message || 'Could not read the device calendar.');
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        localStorage.setItem('nexus_calendar_events', JSON.stringify(events));
        window.dispatchEvent(new Event('storage'));
    }, [events]);

    // CloudSyncContext's pullFromCloud (a factory-reset restore or sign-in
    // sync) writes directly to this same key and dispatches 'storage' -
    // without this listener, this component's own state would never
    // reflect cloud-restored events while this page happens to be
    // mounted. The equality guard prevents this component's own write
    // above from re-triggering itself in a loop.
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_calendar_events') || '[]');
                setEvents((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    const handleAddEvent = (e) => {
        e.preventDefault();
        if (!newEvent.title.trim()) return;

        const eventItem = {
            id: Date.now().toString(),
            title: toTitleCase(newEvent.title.trim()),
            category: toTitleCase(newEvent.category),
            date: newEvent.date,
            time: newEvent.time,
            priority: newEvent.priority,
            location: newEvent.location.trim() || 'Nexus Space',
            completed: false
        };

        setEvents([eventItem, ...events]);
        setIsAddModalOpen(false);
        setNewEvent({
            title: '',
            category: 'Study',
            date: selectedDate.toISOString().split('T')[0],
            time: '10:00 AM',
            priority: 'Medium',
            location: ''
        });
    };

    const toggleEventCompletion = (id) => {
        setEvents(events.map(ev => ev.id === id ? { ...ev, completed: !ev.completed } : ev));
    };

    const deleteEvent = (id) => {
        setEvents(events.filter(ev => ev.id !== id));
    };

    // Calendar Helper Functions
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const changeMonth = (offset) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
    };

    const handleDateClick = (day) => {
        setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    };

    const getCategoryColor = (category) => {
        switch (category) {
            case 'Study': return '#8B5CF6'; 
            case 'Fitness': return '#EF4444'; 
            case 'Nutrition': return '#10B981'; 
            case 'Productivity': return '#F59E0B'; 
            case 'Finance': return '#3B82F6'; 
            default: return '#A8A29E'; 
        }
    };

    // Parses a single "HH:MM AM/PM" clock time into a decimal hour, or
    // null if it doesn't cleanly match - a half-parsed time isn't
    // trustworthy enough to check for a real conflict against.
    const parseTimeToHour = (raw) => {
        if (!raw || typeof raw !== 'string') return null;
        const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return null;
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
        const period = match[3].toUpperCase();
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        return hour + minute / 60;
    };

    // Returns a real {start, end} window for an event. Timetable-derived
    // events already carry a genuine "start - end" range, so both real
    // ends are parsed directly. Calendar's own events only ever log a
    // single start time, so a 30-minute window is assumed around it -
    // the same documented convention already used for these events in
    // the dashboard registry, not a new invention.
    const getEventTimeRange = (ev) => {
        if (typeof ev.time === 'string' && ev.time.includes(' - ')) {
            const [startRaw, endRaw] = ev.time.split(' - ');
            const start = parseTimeToHour(startRaw);
            const end = parseTimeToHour(endRaw);
            return { start, end: (start !== null && end !== null) ? end : (start !== null ? start + 0.5 : null) };
        }
        const start = parseTimeToHour(ev.time);
        return { start, end: start !== null ? start + 0.5 : null };
    };

    // Real conflict detection - groups every real event (Calendar's own
    // plus every Timetable-derived one for today and the selected date,
    // the two real windows this page actually renders) by date, then
    // checks for genuine time-window overlaps within each date.
    // Replaces the old, always-shown "Zero Overlaps Detected" claim,
    // which was never actually computed and could easily have been false.
    const detectScheduleConflicts = () => {
        const now = new Date();
        const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const eventsByDate = {};
        events.forEach((ev) => {
            if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
            eventsByDate[ev.date].push(ev);
        });
        [todayDateStr, selectedDateStr].forEach((dateStr) => {
            getTimetableEventsForDate(dateStr).forEach((ev) => {
                if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
                if (!eventsByDate[dateStr].some((existing) => existing.id === ev.id)) eventsByDate[dateStr].push(ev);
            });
        });

        const conflicts = [];
        Object.entries(eventsByDate).forEach(([date, dayEvents]) => {
            const withRanges = dayEvents.map((ev) => ({ ...ev, range: getEventTimeRange(ev) })).filter((ev) => ev.range.start !== null);
            for (let i = 0; i < withRanges.length; i++) {
                for (let j = i + 1; j < withRanges.length; j++) {
                    const a = withRanges[i]; const b = withRanges[j];
                    if (a.range.start < b.range.end && b.range.start < a.range.end) {
                        conflicts.push({ date, a: a.title, b: b.title });
                    }
                }
            }
        });
        return conflicts;
    };

    const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    const today = new Date();

    // Maps a "YYYY-MM-DD" string to that date's real day-of-week name, then
    // to the Timetable module's own slots for that day - each becomes a
    // real, calendar-event-shaped object (not a placeholder), tagged
    // fromTimetable so the UI can show it as read-only here (it can only
    // genuinely be edited/deleted from the Timetable page itself, which
    // actually owns this data). Parses the date's own components directly
    // rather than via `new Date(dateStr)`, which treats a bare date string
    // as UTC midnight and can silently shift the resulting day-of-week by
    // one for anyone in a negative UTC offset timezone.
    const DAY_NAMES_BY_INDEX = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const getTimetableEventsForDate = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayName = DAY_NAMES_BY_INDEX[new Date(y, m - 1, d).getDay()];
        const slots = Array.isArray(timetableData[dayName]) ? timetableData[dayName] : [];
        return slots.map((slot, idx) => ({
            id: `timetable_${dateStr}_${idx}`,
            title: slot.title,
            category: slot.category,
            date: dateStr,
            time: slot.time,
            priority: 'Medium',
            location: '',
            completed: !!slot.completed,
            fromTimetable: true,
        }));
    };

    // Toggles completion for a timetable-derived event. CalendarPage
    // doesn't own this data (TimetablePage does), so this writes directly
    // to the real storage key and dispatches the same sync event every
    // source module in this app already uses - if TimetablePage happens
    // to be mounted elsewhere, its own inbound listener picks this up
    // immediately, exactly like any other cross-component change.
    const toggleTimetableEventCompletion = (ev) => {
        const [, dateStr, idxStr] = ev.id.match(/^timetable_(.+)_(\d+)$/) || [];
        if (!dateStr) return;
        const [y, m, d] = dateStr.split('-').map(Number);
        const dayName = DAY_NAMES_BY_INDEX[new Date(y, m - 1, d).getDay()];
        const idx = parseInt(idxStr, 10);
        try {
            const latest = JSON.parse(localStorage.getItem('nexus_timetable_data') || '{}');
            if (!Array.isArray(latest[dayName]) || !latest[dayName][idx]) return;
            latest[dayName] = latest[dayName].map((slot, i) => (i === idx ? { ...slot, completed: !slot.completed } : slot));
            localStorage.setItem('nexus_timetable_data', JSON.stringify(latest));
            window.dispatchEvent(new Event('storage'));
        } catch (e) { /* malformed data - nothing safe to update */ }
    };

    const filteredEvents = [...events, ...getTimetableEventsForDate(selectedDateStr)].filter(ev => {
        const matchesSearch = ev.title.toLowerCase().includes(searchQuery.toLowerCase()) || (ev.location || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategoryFilter === 'All' || ev.category === selectedCategoryFilter;
        const matchesDate = ev.date === selectedDateStr; 
        return matchesSearch && matchesCategory && matchesDate;
    });

    const completedCount = events.filter(e => e.completed).length;
    const totalCount = events.length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Real values for the AI Schedule Assistant tab - replaces the old
    // fabricated "Zero Overlaps Detected"/"Reminders Active" claims that
    // were never actually computed from real data.
    const scheduleConflicts = detectScheduleConflicts();
    const highPriorityCount = events.filter((e) => e.priority === 'High' && !e.completed).length;

    // Build Compact Calendar Grid
    const renderCalendarGrid = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        // Empty leading cells are real grid squares now too (not just
        // padding) so the month reads as one complete rectangular table
        // instead of numbers floating with blank space before them.
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} style={{ height: '34px', borderRadius: '8px', background: 'var(--surface-inset)', opacity: 0.35 }}></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

            const dayEvents = [...events, ...getTimetableEventsForDate(dateStr)].filter(ev => ev.date === dateStr).slice(0, 3);

            days.push(
                <div
                    key={d} onClick={() => handleDateClick(d)}
                    style={{
                        // Every real day cell gets its own background/border
                        // now (not just selected/today) so the grid reads as
                        // a structured table of cells, same idea as a real
                        // calendar app, rather than bare floating numbers.
                        // Height/gap shrunk from the previous 42px+6px so
                        // the full month takes noticeably less page space.
                        height: '34px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: isSelected ? 'var(--primary)' : isToday ? 'var(--widget-bg)' : 'var(--surface-inset)',
                        color: isSelected ? 'var(--text-on-primary)' : isToday ? 'var(--primary)' : 'var(--text-primary)',
                        border: isToday && !isSelected ? '1px solid var(--primary)' : '1px solid var(--border-premium)',
                        borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative'
                    }}
                >
                    <span style={{ fontSize: '12px', fontWeight: isSelected || isToday ? '800' : '600' }}>{d}</span>

                    {/* Compact Dots */}
                    <div style={{ display: 'flex', gap: '2px', position: 'absolute', bottom: '3px' }}>
                        {dayEvents.map((ev, idx) => (
                            <div key={idx} style={{ width: '3px', height: '3px', borderRadius: '50%', background: isSelected ? 'var(--surface-inset)' : getCategoryColor(ev.category) }}></div>
                        ))}
                    </div>
                </div>
            );
        }
        return days;
    };

    // Shared between the desktop-inline Calendar Sync card and the
    // mobile sync modal - one real implementation, two entry points,
    // so there's nothing to keep in sync between them by hand.
    const renderSyncPanelBody = () => (
        <>
            <input
                ref={icsFileInputRef} type="file" accept=".ics,text/calendar"
                onChange={handleIcsFileImport} style={{ display: 'none' }} aria-label="Import .ics calendar file"
            />
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    type="button" onClick={() => icsFileInputRef.current && icsFileInputRef.current.click()}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    <Upload size={13} /> Import .ics
                </button>
                <button
                    type="button" onClick={handleExportIcs}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                    <Download size={13} /> Export
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="calendarFeedUrl" style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>External Feed URL (optional)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                        id="calendarFeedUrl" type="url" value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)}
                        placeholder="https://.../calendar.ics"
                        style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                        type="button" onClick={handleFeedImport} disabled={!feedUrl.trim() || isSyncing}
                        style={{ flexShrink: 0, padding: '9px 14px', borderRadius: '9999px', border: 'none', background: feedUrl.trim() ? 'var(--primary)' : 'var(--surface-inset)', color: feedUrl.trim() ? 'var(--text-on-primary)' : 'var(--text-muted)', fontWeight: '700', fontSize: '12px', cursor: feedUrl.trim() && !isSyncing ? 'pointer' : 'default', fontFamily: 'inherit' }}
                    >
                        {isSyncing ? '...' : 'Sync'}
                    </button>
                </div>
            </div>

            {isDeviceCalendarBridgeAvailable() && (
                <button
                    type="button" onClick={handleDeviceCalendarImport} disabled={isSyncing}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: isSyncing ? 'default' : 'pointer', opacity: isSyncing ? 0.6 : 1, fontFamily: 'inherit' }}
                >
                    <Smartphone size={13} /> {isSyncing ? 'Syncing…' : 'Import from Device Calendar'}
                </button>
            )}

            {syncMessage && (
                <span style={{ fontSize: '11px', fontWeight: '600', color: syncIsError ? '#EF4444' : '#10B981', lineHeight: 1.4 }}>{syncMessage}</span>
            )}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {isDeviceCalendarBridgeAvailable()
                    ? 'Reads directly from your Android device\'s own calendar - local only, no cloud account involved. First tap will ask for calendar permission.'
                    : 'Native device calendar sync needs the installed Android app - file import/export above works fully here in the browser.'}
            </span>
        </>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            {showTour && <TourGuide tourId="calendar" steps={TOUR_STEPS.calendar} onFinish={() => setShowTour(false)} />}

            {/* Header Section - on mobile, a compact icon button opens the
                Calendar Sync panel in a modal instead of it sitting inline
                in the scroll (see isSyncModalOpen below), so this row
                becomes the whole "sync + add event" action bar. Desktop is
                untouched: no sync button here since the full Sync card
                already sits inline further down. */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '12px' : '16px' }}>
                <h1 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Calendar Hub</h1>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {isMobile && (
                        <button
                            type="button"
                            onClick={() => setIsSyncModalOpen(true)}
                            data-tour-id="calendar-sync"
                            aria-label="Calendar Sync"
                            title="Calendar Sync"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', flexShrink: 0, boxSizing: 'border-box', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', cursor: 'pointer' }}
                        >
                            <RefreshCw size={18} />
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setNewEvent(prev => ({...prev, date: selectedDateStr}));
                            setIsAddModalOpen(true);
                        }}
                        data-tour-id="calendar-add-event"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: isMobile ? '12px 18px' : '10px 20px', flex: isMobile ? 1 : 'none', width: isMobile ? 'auto' : 'auto', boxSizing: 'border-box', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer' }}
                    >
                        <Plus size={isMobile ? 16 : 18} /> Schedule Event
                    </button>
                </div>
            </div>

            {/* Quick Metrics - compact 3-column grid on mobile */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? '10px' : '16px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '12px 10px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '8px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)', flexShrink: 0, display: 'flex' }}><CalendarIcon size={isMobile ? 16 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{isMobile ? 'Events' : 'Total Events'}</span>
                        <h2 style={{ fontSize: isMobile ? '13px' : '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{totalCount}{isMobile ? '' : ' Scheduled'}</h2>
                    </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '12px 10px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '8px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#10B981', flexShrink: 0, display: 'flex' }}><CheckCircle size={isMobile ? 16 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{isMobile ? 'Done %' : 'Completion Rate'}</span>
                        <h2 style={{ fontSize: isMobile ? '13px' : '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{completionRate}%</h2>
                    </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '12px 10px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '8px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#3B82F6', flexShrink: 0, display: 'flex' }}><Sparkles size={isMobile ? 16 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>AI Assistant</span>
                        <h2 style={{ fontSize: isMobile ? '13px' : '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Active</h2>
                    </div>
                </div>
            </div>

            {/* Tabs - fade-masked horizontal scroll with taller mobile
                touch targets, matching Timetable/Study/Syllabus/Gym. */}
            <div style={{
                display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px',
                overflowX: 'auto',
                maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
            }}>
                <button onClick={() => setActiveTab('Agenda')} style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: activeTab === 'Agenda' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Agenda' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Agenda' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}>Agenda & Timeline</button>
                <button onClick={() => setActiveTab('AIAssistant')} style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: activeTab === 'AIAssistant' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'AIAssistant' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'AIAssistant' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}><Cpu size={14} /> AI Schedule Assistant</button>
            </div>

            {/* TAB CONTENT: AGENDA & CALENDAR */}
            {activeTab === 'Agenda' && (
                // Side-by-side on desktop, stacks full-width on mobile.
                <div style={{ display: 'flex', gap: isMobile ? '16px' : '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                    {/* LEFT COLUMN: Compact Calendar Widget + Sync card */}
                    <div style={{ flex: '1 1 320px', width: '100%', maxWidth: isMobile ? '100%' : '380px', display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px', boxSizing: 'border-box' }}>
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '18px' : '20px', padding: '16px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </h3>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => changeMonth(-1)} style={{ padding: '6px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '8px', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
                                    <button onClick={() => {setCurrentDate(new Date()); setSelectedDate(new Date());}} style={{ padding: '6px 10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '11px' }}>Today</button>
                                    <button onClick={() => changeMonth(1)} style={{ padding: '6px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '8px', cursor: 'pointer' }}><ChevronRight size={16} /></button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '2px' }}>
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                    <span key={day} style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>{day}</span>
                                ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                                {renderCalendarGrid()}
                            </div>
                        </div>

                        {/* Calendar Sync - real, file-based ICS import/export
                            plus a best-effort remote feed URL fetch (see
                            utils/calendarSync.js), plus a real native
                            device-calendar bridge (see
                            utils/nativeCalendarBridge.js) when running
                            inside the installed Android app. The device
                            button below is deliberately absent rather than
                            shown-then-erroring in a plain browser tab,
                            where the underlying plugin genuinely doesn't
                            exist. Desktop only inline - mobile reaches the
                            exact same controls through the compact header
                            icon button + modal below instead, so this card
                            doesn't sit permanently in the mobile scroll. */}
                        {!isMobile && (
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '16px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={15} color="var(--accent)" />
                                <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Calendar Sync</h3>
                            </div>
                            {renderSyncPanelBody()}
                        </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Timeline Details */}
                    <div style={{ flex: '2 1 500px', width: '100%', display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', minWidth: 0, boxSizing: 'border-box' }}>

                        {/* Filters - pill category row (fade-masked horizontal
                            scroll on mobile) + a search bar that stacks
                            full-width below it on mobile instead of a fixed
                            200px box that didn't fit. */}
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : '12px' }}>
                            <div style={{
                                display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px',
                                maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                                WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                            }}>
                                {['All', 'Study', 'Fitness', 'Finance'].map(cat => (
                                    <button key={cat} onClick={() => setSelectedCategoryFilter(cat)} style={{ padding: '7px 14px', background: selectedCategoryFilter === cat ? 'var(--primary)' : 'var(--widget-bg)', color: selectedCategoryFilter === cat ? 'var(--text-on-primary)' : 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{cat}</button>
                                ))}
                            </div>
                            <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
                                <input type="text" aria-label="Search events" placeholder="Search events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '9px 14px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: isMobile ? '100%' : '200px', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        {/* List - collapsible on mobile (tap the heading row)
                            so the day's events don't have to sit permanently
                            expanded right below the grid; always expanded on
                            desktop, unaffected by isAgendaExpanded. */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '18px' : '20px', padding: '16px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : '0' }}>
                                <div
                                    role={isMobile ? 'button' : undefined}
                                    tabIndex={isMobile ? 0 : undefined}
                                    aria-expanded={isMobile ? isAgendaExpanded : undefined}
                                    onClick={() => isMobile && setIsAgendaExpanded((v) => !v)}
                                    onKeyDown={(e) => { if (isMobile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setIsAgendaExpanded((v) => !v); } }}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', cursor: isMobile ? 'pointer' : 'default' }}
                                >
                                    <div>
                                        <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                            Schedule for {selectedDate.toLocaleString('default', { month: 'short', day: 'numeric' })}
                                        </h3>
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>{filteredEvents.length} events found</span>
                                    </div>
                                    {isMobile && (
                                        <ChevronDown size={18} color="var(--text-muted)" style={{ flexShrink: 0, transform: isAgendaExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                                    )}
                                </div>
                                <button
                                    onClick={() => { setNewEvent(prev => ({...prev, date: selectedDateStr})); setIsAddModalOpen(true); }}
                                    style={{ padding: '9px 16px', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box', background: 'var(--widget-bg)', color: 'var(--primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexShrink: 0 }}
                                >
                                    <Plus size={14} /> Add Here
                                </button>
                            </div>

                            {(!isMobile || isAgendaExpanded) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {filteredEvents.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: isMobile ? '32px 16px' : '40px 0', boxSizing: 'border-box', color: 'var(--text-muted)' }}>
                                        <CalendarIcon size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                                        <p style={{ fontSize: '14px' }}>No events scheduled for this day.</p>
                                    </div>
                                ) : (
                                    filteredEvents.map(ev => (
                                        <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: ev.completed ? 'rgba(16, 185, 129, 0.05)' : 'var(--widget-bg)', padding: isMobile ? '14px 16px' : '16px 20px', borderRadius: '14px', border: '1px solid var(--border-premium)', gap: '16px', flexWrap: 'wrap', boxSizing: 'border-box' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '16px', minWidth: 0 }}>
                                                <div onClick={() => (ev.fromTimetable ? toggleTimetableEventCompletion(ev) : toggleEventCompletion(ev.id))} style={{ cursor: 'pointer', color: ev.completed ? '#10B981' : 'var(--text-muted)', flexShrink: 0 }}>
                                                    {ev.completed ? <CheckCircle size={22} /> : <div style={{ width: '22px', height: '22px', border: '2px solid var(--text-muted)', borderRadius: '50%' }}></div>}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        <h4 style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '700', color: 'var(--text-primary)', textDecoration: 'none', opacity: ev.completed ? 0.7 : 1, margin: 0 }}>{ev.title}</h4>
                                                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', background: 'var(--surface-inset)', color: getCategoryColor(ev.category), borderRadius: '6px', border: '1px solid var(--border-premium)' }}>{ev.category}</span>
                                                        {ev.fromTimetable && (
                                                            <span title="Synced from the Daily Timetable - edit or delete it there" style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', background: 'var(--surface-inset)', color: 'var(--text-muted)', borderRadius: '6px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Clock size={10} /> From Timetable
                                                            </span>
                                                        )}
                                                        {ev.importedFromIcs && (
                                                            <span title="Imported from an external .ics calendar" style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', background: 'var(--surface-inset)', color: 'var(--accent)', borderRadius: '6px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <RefreshCw size={10} /> Synced
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        <span>⏰ {ev.time}</span>{ev.location && <><span>•</span><span>📍 {ev.location}</span></>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '6px', background: ev.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface-inset)', color: ev.priority === 'High' ? '#EF4444' : 'var(--text-secondary)' }}>
                                                    {ev.priority}
                                                </span>
                                                {!ev.fromTimetable && (
                                                    <button onClick={() => deleteEvent(ev.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: AI SCHEDULE ASSISTANT */}
            {activeTab === 'AIAssistant' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: isMobile ? '16px' : '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Sparkles size={isMobile ? 18 : 22} />
                            <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Schedule Briefing & Optimization</h3>
                        </div>
                        <p style={{ fontSize: isMobile ? '13px' : '14px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--widget-bg)', padding: isMobile ? '12px' : '16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            {events.length === 0
                                ? "Add some events to your calendar to receive AI-driven scheduling insights."
                                : scheduleConflicts.length > 0
                                    ? `Heads up - ${scheduleConflicts.length} real scheduling conflict${scheduleConflicts.length === 1 ? '' : 's'} detected: "${scheduleConflicts[0].a}" overlaps with "${scheduleConflicts[0].b}" on ${scheduleConflicts[0].date}. Consider rescheduling one of them.`
                                    : "Your schedule looks well-balanced! No time-overlap conflicts detected across your events. Ensure you leave adequate buffer time between tasks for hydration and rest."}
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: isMobile ? '10px' : '20px' }}>
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: isMobile ? '14px' : '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700', fontSize: isMobile ? '12px' : '14px' }}>
                                <ShieldCheck size={isMobile ? 15 : 18} color={scheduleConflicts.length > 0 ? '#EF4444' : '#10B981'} /> {isMobile ? 'Conflicts' : 'Schedule Conflict Status'}
                            </div>
                            <h2 style={{ fontSize: isMobile ? '15px' : '20px', fontWeight: '800', color: scheduleConflicts.length > 0 ? '#EF4444' : '#10B981' }}>
                                {scheduleConflicts.length > 0 ? `${scheduleConflicts.length} Overlap${scheduleConflicts.length === 1 ? '' : 's'}` : 'Zero Overlaps'}
                            </h2>
                            {!isMobile && (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {scheduleConflicts.length > 0 ? "Real time-window overlaps found between your events - see the briefing above." : "All events across modules are cleanly time-blocked."}
                                </span>
                            )}
                        </div>

                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: isMobile ? '14px' : '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700', fontSize: isMobile ? '12px' : '14px' }}>
                                <Bell size={isMobile ? 15 : 18} color="var(--primary)" /> High-Priority
                            </div>
                            <h2 style={{ fontSize: isMobile ? '15px' : '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{highPriorityCount} Upcoming</h2>
                            {!isMobile && (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{highPriorityCount > 0 ? "Marked High priority, not yet completed." : "No high-priority events pending right now."}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule New Event Modal */}
            {isAddModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%', boxShadow: 'var(--premium-shadow)' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Schedule New Event</h2>
                        
                        <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label htmlFor="eventTitle" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Event Title</label>
                                <input id="eventTitle" type="text" required autoFocus value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Machine Learning Revision" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="eventCategory" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Category</label>
                                    <select id="eventCategory" value={newEvent.category} onChange={(e) => setNewEvent({...newEvent, category: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        <option value="Study" style={{ background: 'var(--surface-inset)' }}>Study</option><option value="Fitness" style={{ background: 'var(--surface-inset)' }}>Fitness</option><option value="Nutrition" style={{ background: 'var(--surface-inset)' }}>Nutrition</option><option value="Productivity" style={{ background: 'var(--surface-inset)' }}>Productivity</option><option value="Finance" style={{ background: 'var(--surface-inset)' }}>Finance</option><option value="Personal" style={{ background: 'var(--surface-inset)' }}>Personal</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="eventPriority" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Priority</label>
                                    <select id="eventPriority" value={newEvent.priority} onChange={(e) => setNewEvent({...newEvent, priority: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        <option value="High" style={{ background: 'var(--surface-inset)' }}>High</option><option value="Medium" style={{ background: 'var(--surface-inset)' }}>Medium</option><option value="Low" style={{ background: 'var(--surface-inset)' }}>Low</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="eventDate" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Date</label>
                                    <input id="eventDate" type="date" required value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', colorScheme: 'dark' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="eventTime" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Time Slot</label>
                                    <input id="eventTime" type="text" required value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} placeholder="04:00 PM" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="eventLocation" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Location / Venue</label>
                                <input id="eventLocation" type="text" value={newEvent.location} onChange={(e) => setNewEvent({...newEvent, location: e.target.value})} placeholder="e.g. College Lab 2" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Mobile Calendar Sync modal - the exact same controls the
                desktop inline card renders, reached from the compact
                header icon button instead of sitting in the scroll. */}
            {isMobile && isSyncModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setIsSyncModalOpen(false)}>
                    <div
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '20px', width: '100%', maxHeight: '85vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '12px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={16} color="var(--accent)" />
                                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Calendar Sync</h3>
                            </div>
                            <button type="button" onClick={() => setIsSyncModalOpen(false)} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                        </div>
                        {renderSyncPanelBody()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPage;