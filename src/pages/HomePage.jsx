// src/pages/HomePage.jsx
//
// Home page: the greeting card plus the "Master Schedule Flow & Active
// Timeline" queue. The queue cards below were upgraded with clickable
// module-navigation badges, an inline completion toggle, an expandable
// details view, a live countdown on the active card, a per-card micro-note,
// and category-based priority tags/accent color - all layered on TOP of the
// existing glass container styling (var(--bg-surface)/var(--border-premium)/
// etc., the same custom properties already used everywhere else in the app)
// rather than introducing any new colors, classes, or glass treatments of
// its own. GreetingCard, the sidebar, the header, and every global CSS
// class (dashboard-grid/col-12) are untouched.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import GreetingCard from '../components/GreetingCard';
import AIDailyBriefingCard from '../components/AIDailyBriefingCard.jsx';
import { Clock, PlayCircle, CheckCircle2, Circle, ChevronDown, ArrowUpRight, StickyNote, CheckSquare, Timer, GripVertical, CalendarDays, Repeat } from 'lucide-react';
import { useTaskRegistry } from '../context/TaskRegistryContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';
import { getLocalDateString } from '../utils/dateUtils.js';

// ---------------------------------------------------------------------------
// Category -> destination page + accent color + priority tag. Mock/curated
// mapping, structured the same way audioLibraryMock.js documents its own
// placeholder data: swap-in-ready for a real per-category config later,
// without changing anything that reads from it.
// ---------------------------------------------------------------------------
const CATEGORY_STYLE = {
    'Study Hub': { tab: 'Study', accent: '#38bdf8', tag: 'Core' },
    'Study': { tab: 'Study', accent: '#38bdf8', tag: 'Core' },
    'Development': { tab: 'Planner', accent: '#a78bfa', tag: 'High Focus' },
    'College': { tab: 'Syllabus', accent: '#38bdf8', tag: 'Core' },
    'Syllabus': { tab: 'Syllabus', accent: '#38bdf8', tag: 'Core' },
    'Review': { tab: 'Study', accent: '#fbbf24', tag: 'Wind-down' },
    'Fitness': { tab: 'Gym', accent: '#34d399', tag: 'Wellness' },
    'Gym': { tab: 'Gym', accent: '#34d399', tag: 'Wellness' },
    'Diet': { tab: 'Diet', accent: '#34d399', tag: 'Wellness' },
    'Finance': { tab: 'Finance', accent: '#facc15', tag: 'Focus' },
    'Calendar': { tab: 'Calendar', accent: '#38bdf8', tag: null },
    'Analytics': { tab: 'Analytics', accent: '#818cf8', tag: 'Focus' },
    'AI': { tab: 'AI', accent: '#e879f9', tag: 'High Focus' },
    'Night Flow': { tab: 'Planner', accent: '#818cf8', tag: 'Wind-down' },
    'Planner Hub': { tab: 'Planner', accent: '#a78bfa', tag: 'High Focus' },
    'Planner': { tab: 'Planner', accent: '#a78bfa', tag: null },
    'Timetable': { tab: 'Daily Table', accent: '#38bdf8', tag: null },
};
const DEFAULT_CATEGORY_STYLE = { tab: 'Planner', accent: 'var(--text-muted)', tag: null };
const resolveCategoryStyle = (category) => CATEGORY_STYLE[category] || DEFAULT_CATEGORY_STYLE;


// Converts a fractional-hours value back into a "HH:MM AM/PM" label - used
// to regenerate a card's displayed time after a +30m reschedule. Wraps
// correctly past midnight (25.5 -> 01:30 AM) rather than showing "25:30".
const formatHour = (decimalHour) => {
    let h = Math.floor(decimalHour) % 24;
    if (h < 0) h += 24;
    const m = Math.round((decimalHour - Math.floor(decimalHour)) * 60) % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    let displayHour = h % 12;
    if (displayHour === 0) displayHour = 12;
    return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

// Only the 8 default items use a real "HH:MM AM/PM - HH:MM AM/PM" range as
// their time label - planner-sourced items show "Due: ..." or "Flexible
// Queue" instead, which a regenerated range would misrepresent. Those still
// get their startHour/endHour shifted (so a reschedule still affects
// active-detection), just not a fabricated time-range label.
const FIXED_TIME_RANGE_RE = /^\d{1,2}:\d{2} [AP]M - \d{1,2}:\d{2} [AP]M$/;
// Items with no real clock time (startHour/endHour null - Planner tasks,
// completed Gym sessions) must never be shifted: since null coerces to 0 in
// arithmetic, `null + shiftHours` would silently produce a FABRICATED
// startHour instead of leaving the item genuinely timeless. This guard is
// load-bearing now that the centralized registry can produce such items,
// not just a defensive nicety.
const applyTimeShift = (item, shiftMinutes) => {
    if (!shiftMinutes || item.startHour === null || item.startHour === undefined) return item;
    const shiftHours = shiftMinutes / 60;
    const shiftedStart = item.startHour + shiftHours;
    const shiftedEnd = item.endHour + shiftHours;
    const shiftMs = shiftMinutes * 60 * 1000;
    return {
        ...item,
        startHour: shiftedStart,
        endHour: shiftedEnd,
        // Keep the real absolute occurrence timestamps in sync with the
        // same shift, so a reschedule genuinely moves both when this
        // item is (or isn't) currently active AND its live "starts in"/
        // "remaining" countdown - not just the displayed hour-of-day.
        startAtMs: (item.startAtMs !== null && item.startAtMs !== undefined) ? item.startAtMs + shiftMs : item.startAtMs,
        endAtMs: (item.endAtMs !== null && item.endAtMs !== undefined) ? item.endAtMs + shiftMs : item.endAtMs,
        time: FIXED_TIME_RANGE_RE.test(item.time) ? `${formatHour(shiftedStart)} - ${formatHour(shiftedEnd)}` : item.time,
        shiftedMinutes: shiftMinutes,
    };
};

// ---------------------------------------------------------------------------
// Per-card local state (completion + micro-note + time-shift) - keyed by item id, kept
// entirely separate from `masterQueue` itself (which is rebuilt from
// scratch every 60s and isn't a safe place to store user edits). Expanded/
// collapsed is intentionally NOT persisted here - that's plain session UI
// state, reset fresh on reload, same as every other panel/tab toggle in
// this app.
// ---------------------------------------------------------------------------
const CARD_STATE_KEY = 'nexus_queue_card_state';

const loadCardState = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(CARD_STATE_KEY) || '{}');
        return saved && typeof saved === 'object' ? saved : {};
    } catch (e) {
        return {};
    }
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Real, reported gap this closes: a weekly-recurring Timetable slot (one
// registry entry PER day of the week it's scheduled on - see
// TaskRegistryContext.jsx's own normalizeTimetableSlots) used to only
// ever surface in today's queue, via a bare day-name match - so a task
// scheduled on all 7 days only ever showed a single occurrence at a
// time, one day at a time, never the several genuinely-upcoming ones a
// "next 8" queue is actually supposed to project. Worse, two such
// entries sharing the same bare hour-of-day (every "Sleep Time" starts
// at 23:00, whichever day it's filed under) sorted and counted down
// identically regardless of which real calendar day each belonged to -
// the exact reason two different "Sleep Time" cards once showed the
// identical "starts in" value.
//
// This finds ONE recurring day+hour slot's own next real occurrence, as
// a genuine absolute timestamp pair - searching forward from right now,
// so a still-active overnight block that started YESTERDAY is correctly
// found and flagged active (checked first), otherwise the nearest
// matching day within the next week. Every timed queue item (Timetable,
// Calendar, Diet alike) gets startAtMs/endAtMs this way now, so sorting
// and "is this active right now" can use real Date math throughout
// instead of a day-blind hour-of-day number.
const computeOccurrence = (dayName, startHour, endHour, now) => {
    if (startHour === null || startHour === undefined || endHour === null || endHour === undefined) return null;
    const crossesMidnight = endHour < startHour;
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (crossesMidnight) {
        const yesterdayName = DAY_NAMES[(now.getDay() + 6) % 7];
        if (dayName === yesterdayName) {
            const startAtMs = todayMidnight - DAY_MS + startHour * HOUR_MS;
            const endAtMs = todayMidnight + endHour * HOUR_MS;
            if (now.getTime() < endAtMs) return { startAtMs, endAtMs };
        }
    }
    for (let offset = 0; offset <= 7; offset++) {
        const dayStartMs = todayMidnight + offset * DAY_MS;
        if (DAY_NAMES[new Date(dayStartMs).getDay()] !== dayName) continue;
        const startAtMs = dayStartMs + startHour * HOUR_MS;
        const endAtMs = dayStartMs + (crossesMidnight ? endHour + 24 : endHour) * HOUR_MS;
        if (now.getTime() < endAtMs) return { startAtMs, endAtMs };
    }
    return null;
};

// A weekly-recurring slot doesn't stop after its own NEXT occurrence -
// it keeps happening every week, forever. Real, reported gap: with only
// one recurring task on the whole week (e.g. "Sleep Time" scheduled
// every day), computeOccurrence's single next-occurrence-per-entry
// result topped out at 7 distinct cards (one per day of the week) and
// then stopped, even though the queue's own real capacity is
// MAX_QUEUE_SIZE (8) and the 8th slot should genuinely be filled by
// that same task's occurrence ONE WEEK after its own first one (once
// the very first, nearest occurrence eventually completes/expires, the
// one after it should already be waiting in the 8th slot, not leave a
// gap). Every occurrence after the first is exactly 7 real days later -
// no new day-name search needed, just repeated +7-day steps from
// whatever computeOccurrence already found.
const computeOccurrences = (dayName, startHour, endHour, now, count) => {
    const first = computeOccurrence(dayName, startHour, endHour, now);
    if (!first) return [];
    const results = [first];
    for (let i = 1; i < count; i++) {
        const prev = results[results.length - 1];
        results.push({ startAtMs: prev.startAtMs + 7 * DAY_MS, endAtMs: prev.endAtMs + 7 * DAY_MS });
    }
    return results;
};

// Same absolute-timestamp treatment for a plain same-day item (Calendar/
// Diet - already scoped to today by their own real date, never a
// recurring multi-day slot), so every timed queue item ends up with a
// startAtMs/endAtMs pair in the same shape regardless of source.
const todayOccurrence = (startHour, endHour, now) => {
    if (startHour === null || startHour === undefined || endHour === null || endHour === undefined) return null;
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return {
        startAtMs: todayMidnight + startHour * HOUR_MS,
        endAtMs: todayMidnight + (endHour < startHour ? endHour + 24 : endHour) * HOUR_MS,
    };
};

// No "left" in the value itself - the adjacent countdown-label span
// already says "Remaining"/"Starts In", so the two together read as
// "4h 45m REMAINING" / "20h 45m STARTS IN" rather than the redundant
// "4h 45m left" + "Remaining" this used to produce side by side.
// Days shown once genuinely relevant (>= 24h) - real, reported need now
// that a Timetable slot can project up to a week out ("1d 5h STARTS IN"
// reads far more clearly than "29h 12m").
const formatCountdown = (hoursRemaining, zeroLabel = 'Ending now') => {
    if (hoursRemaining <= 0) return zeroLabel;
    const totalMinutes = Math.max(1, Math.round(hoursRemaining * 60));
    const d = Math.floor(totalMinutes / 1440);
    const h = Math.floor((totalMinutes % 1440) / 60);
    const m = totalMinutes % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
};

// ---------------------------------------------------------------------------
// QueueCard - a single timeline block. Extracted from the inline .map()
// (matching the React.memo sub-component pattern already used on the Audio
// Hub page) since it now owns real interactive state: expand/collapse, its
// own micro-note draft, and - for the active card only - a real-time
// countdown ticking independently of the parent's 60-second queue reload.
// ---------------------------------------------------------------------------
const QueueCard = React.memo(({ item, index, isActive, isNext, opacityLevel, setActiveTab, cardState, onToggleComplete, onSaveNote, onTimeShift }) => {
    // Mobile needs a genuinely different DOM grouping than desktop for
    // time+actions - see the real, reported bug this fixes further down
    // (schedule-card__footer's own comment) - not just different CSS on
    // the same markup.
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(false);
    const [noteDraft, setNoteDraft] = useState(cardState.note || '');
    const [now, setNow] = useState(() => new Date());

    // Every card ticks now - a real, reported gap was that only the
    // active card (time remaining) and the single "Up Next" card (time
    // until start) ever got a live countdown; every other queued card
    // further back showed nothing at all in that same slot, reading as
    // inconsistent/incomplete next to a sibling card that did. The queue
    // is capped at MAX_QUEUE_SIZE (8) items total, so 8 lightweight
    // 1-second intervals is a non-issue.
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const style = resolveCategoryStyle(item.category);
    const completed = !!cardState.completed;

    const remainingLabel = useMemo(() => {
        // An all-day item (a festival/holiday with no clock time) has no
        // genuine "time remaining" to count down - endAtMs is honestly
        // null for it, and without this guard that null would coerce to
        // 0 below and falsely show "Ending now" for something that's
        // actually live all day.
        if (!isActive || item.endAtMs === null || item.endAtMs === undefined) return null;
        // Real, genuine absolute-timestamp math now (see computeOccurrence/
        // todayOccurrence in the module scope above) - endAtMs already
        // correctly accounts for an overnight crossing at the point it
        // was computed, so this is just a plain subtraction, no
        // modular-hour "did this already wrap past midnight" guesswork
        // needed here at all.
        return formatCountdown((item.endAtMs - now.getTime()) / HOUR_MS);
    }, [isActive, now, item.endAtMs]);

    // Real "is this genuinely at zero time" flag - derived directly
    // from remainingLabel's own already-computed value, rather than a
    // separate parallel calculation that could drift out of sync with
    // the countdown it's describing.
    const isEndingNow = isActive && remainingLabel === 'Ending now';

    // Real "time until start" countdown for every non-active card, not
    // just the immediate "Up Next" one - a real, reported gap: a further-
    // back queued card ("Queue #2", "Queue #3", ...) used to show nothing
    // at all in this slot, leaving it looking emptier/less finished than
    // the Up Next card right above it, which has real time info here.
    // Same real absolute-timestamp math as remainingLabel above - genuinely
    // correct for a Timetable slot projected several calendar days out
    // (see computeOccurrence), not just "later today".
    const startsInLabel = useMemo(() => {
        if (isActive || item.startAtMs === null || item.startAtMs === undefined) return null;
        return formatCountdown((item.startAtMs - now.getTime()) / HOUR_MS, 'Starting now');
    }, [isActive, now, item.startAtMs]);

    const handleCardClick = () => setExpanded((v) => !v);
    const stop = (e) => e.stopPropagation();

    const handleBadgeClick = (e) => {
        stop(e);
        if (typeof setActiveTab === 'function') setActiveTab(style.tab);
    };

    const handleCompleteClick = (e) => {
        stop(e);
        onToggleComplete(item.id);
    };

    const handleNoteSave = (e) => {
        stop(e);
        onSaveNote(item.id, noteDraft);
    };

    const handleTimeShiftClick = (e) => {
        stop(e);
        onTimeShift(item.id, 30);
    };

    const statusBtnClass = completed
        ? 'schedule-card__status-btn schedule-card__status-btn--completed'
        : isActive
            ? 'schedule-card__status-btn schedule-card__status-btn--active'
            : isNext
                ? 'schedule-card__status-btn schedule-card__status-btn--queued'
                : 'schedule-card__status-btn';

    // Real, reported request: the expanded card used to show generic,
    // made-up "Get started / Make progress / Wrap up" filler regardless
    // of what the task actually was - explicitly asked to be replaced
    // with genuinely real information instead, specifically the exact
    // calendar date this card is for. That became actively necessary
    // once a recurring Timetable slot can now project several distinct
    // future occurrences of the SAME title into the queue at once (see
    // computeOccurrences in the module scope above) - without a real
    // date shown somewhere, two "Sleep Time" cards are otherwise
    // indistinguishable at a glance.
    const occurrenceDateLabel = (item.startAtMs !== null && item.startAtMs !== undefined)
        ? new Date(item.startAtMs).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : null;
    // Only a Timetable-sourced, timed slot is genuinely a repeating
    // weekly thing - a Calendar event or Diet meal is scoped to its own
    // one real date/day, not a recurring template.
    const isRecurringWeekly = item.widgetGroup === 'timetable' && item.hasRealTime;

    // Extracted so both the desktop layout (time inside .info-row,
    // actions standalone at the row's far right) and the mobile layout
    // (time+actions grouped together in .schedule-card__footer, see its
    // own comment below) can render the exact same real JSX/handlers,
    // just placed in different DOM positions - not two copies that could
    // drift apart.
    const timeBlock = (item.hasRealTime || item.isAllDayToday) ? (
        <span className="schedule-card__time">
            <Clock size={11} />
            <span className="schedule-card__time-text">{item.time}</span>
        </span>
    ) : null;

    const actionsBlock = (
        <div className="schedule-card__actions">
            {/* Quick reschedule - queued/upcoming cards only (the
                active card is already running; shifting IT forward
                isn't a "push back a not-yet-started task" action),
                AND only for items with a real clock time - pushing
                back a flexible Planner task or a completed Gym log
                that has no time to begin with doesn't mean
                anything. Cumulative: each click adds another 30
                minutes. */}
            {!isActive && item.hasRealTime && (
                <button onClick={handleTimeShiftClick} title="Push this task back by 30 minutes" className="schedule-card__reschedule-btn">
                    <Timer size={12} /> +30m{cardState.timeShift ? ` (+${cardState.timeShift})` : ''}
                </button>
            )}

            {/* "Ending now" badge - only appears at the genuine
                zero-time moment (isEndingNow), not for the whole
                active duration - the ongoing countdown already
                lives in the center column above. */}
            {isActive && isEndingNow && (
                <span className="schedule-card__ending-badge">
                    <Clock size={11} /> Ending now
                </span>
            )}

            {/* Inline completion toggle - the actual interactive
                status control. Clicking marks the task done/not-done
                immediately, no page switch, persisted locally. */}
            <button onClick={handleCompleteClick} title={completed ? 'Mark as not done' : 'Mark as done'} className={statusBtnClass}>
                {completed ? <CheckCircle2 size={15} /> : isActive ? <PlayCircle size={15} /> : <Circle size={13} />}
                {completed ? 'Completed' : isActive ? 'In Progress' : isNext ? 'Queued' : 'Upcoming'}
            </button>
            <ChevronDown size={15} color="var(--text-muted)" className={`schedule-card__chevron${expanded ? ' schedule-card__chevron--expanded' : ''}`} />
        </div>
    );

    return (
        <div
            onClick={handleCardClick}
            className={`schedule-card${isActive ? ' schedule-card--active' : ''}${completed ? ' schedule-card--completed' : ''}`}
            style={{ '--card-opacity': opacityLevel, '--card-accent': style.accent }}
        >
            <div className="schedule-card__row">
                <div className="schedule-card__lead">
                    {isActive ? (
                        <div className="schedule-card__dot--active">
                            <div className="schedule-card__dot-ping"></div>
                            <div className="schedule-card__dot-core"></div>
                        </div>
                    ) : (
                        <div className="schedule-card__dot"></div>
                    )}

                    <div className="schedule-card__content">
                        <div className="schedule-card__meta-row">
                            <span className={`schedule-card__status${isActive ? ' schedule-card__status--active' : isNext ? ' schedule-card__status--next' : ''}`}>
                                {isActive ? 'Active Now' : isNext ? 'Up Next' : `Queue #${index + 1}`}
                            </span>
                            {style.tag && <span className="schedule-card__tag">[{style.tag}]</span>}
                        </div>
                        <div className="schedule-card__title-row">
                            {/* Dedicated mark-done checkbox, right next to the
                                title - a second, more discoverable entry
                                point to the same completion state the status
                                pill on the right also controls (clicking
                                either one toggles the same thing). */}
                            <button
                                onClick={handleCompleteClick}
                                title={completed ? 'Mark as not done' : 'Mark as done'}
                                className={`schedule-card__check-btn${completed ? ' schedule-card__check-btn--completed' : ''}`}
                            >
                                {completed ? <CheckSquare size={20} /> : <Circle size={18} />}
                            </button>
                            <h3 className={`schedule-card__title${completed ? ' schedule-card__title--completed' : ''}`}>
                                {item.title}
                            </h3>
                        </div>

                        <div className="schedule-card__info-row">
                            {/* Mobile renders its own copy of this inside
                                schedule-card__footer below instead (see
                                that block's own comment for why) - never
                                both at once. */}
                            {!isMobile && timeBlock}
                            {/* Clickable source badge - navigates straight to the
                                module page. stopPropagation so it never also
                                triggers the card's own expand/collapse. */}
                            <button onClick={handleBadgeClick} title={`Go to ${style.tab}`} className="schedule-card__source-badge">
                                Source Section: {item.category} <ArrowUpRight size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Genuinely prominent center countdown - covers the
                    active card (time remaining until it ends) and EVERY
                    other card (time until it starts), not just the
                    immediate "Up Next" one - a real, reported gap was a
                    further-back queued card leaving this slot empty next
                    to a sibling card that had real time info in it. */}
                {isActive && remainingLabel && (
                    <div className="schedule-card__countdown">
                        <span className="schedule-card__countdown-value schedule-card__countdown-value--active">
                            <Clock size={20} />
                            {remainingLabel}
                        </span>
                        <span className="schedule-card__countdown-label">Remaining</span>
                    </div>
                )}
                {!isActive && startsInLabel && (
                    <div className="schedule-card__countdown">
                        <span className="schedule-card__countdown-value schedule-card__countdown-value--next">
                            <Clock size={20} />
                            {startsInLabel}
                        </span>
                        <span className="schedule-card__countdown-label">Starts In</span>
                    </div>
                )}

                {/* Real, reported bug this split fixes: on mobile, time
                    and actions used to be two independent grid items
                    sharing the SAME column-3 track that rows 1-2 (status
                    label / title) also use. That coupling is what made
                    "Sleep Time"/"Queue #2" wrap to 2 lines whenever the
                    actions column needed to be wide enough to fit
                    "Upcoming" + "+30m" + the chevron - a wider column 3
                    for row 4 directly meant a narrower column 2 (the
                    title) for the WHOLE card, not just that one row.
                    schedule-card__footer (mobile only - see its own CSS)
                    groups time+actions into one independent mini-grid
                    that spans the full card width on its own row,
                    completely decoupled from column 3's width elsewhere
                    in the card - so actions can size itself to fit
                    perfectly (auto, no more guessed fixed px), and the
                    title/status label above are never squeezed by it
                    again. Desktop is untouched: .schedule-card__footer
                    is display:contents there, so actionsBlock renders
                    exactly where it always did (the far right of the
                    whole row), and timeBlock only ever renders via the
                    !isMobile branch above instead. */}
                {isMobile ? (
                    <div className="schedule-card__footer">
                        {timeBlock}
                        {actionsBlock}
                    </div>
                ) : actionsBlock}
            </div>

            {/* Expanded details: toggled by clicking anywhere on the card
                body (except the source badge / complete toggle above).
                Real info about THIS specific occurrence (which exact date
                it's for, its scheduled time, its source category, and
                whether it's a weekly-recurring Timetable slot) - not the
                generic, made-up "Get started/Make progress/Wrap up"
                filler this used to show regardless of what the task
                actually was - plus a real, saved micro-note field. */}
            {expanded && (
                <div onClick={stop} className="schedule-card__details">
                    <div>
                        <div className="schedule-card__details-label">Details</div>
                        <div className="schedule-card__subtasks">
                            {occurrenceDateLabel && (
                                <div className="schedule-card__subtask">
                                    <CalendarDays size={12} color="var(--text-muted)" /> {occurrenceDateLabel}
                                </div>
                            )}
                            {item.hasRealTime && (
                                <div className="schedule-card__subtask">
                                    <Clock size={12} color="var(--text-muted)" /> {item.time}
                                </div>
                            )}
                            <div className="schedule-card__subtask">
                                <Circle size={6} fill="var(--text-muted)" color="var(--text-muted)" /> {item.category}
                            </div>
                            {isRecurringWeekly && (
                                <div className="schedule-card__subtask">
                                    <Repeat size={12} color="var(--text-muted)" /> Repeats every {DAY_NAMES[new Date(item.startAtMs).getDay()]}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="schedule-card__details-label">
                            <StickyNote size={12} /> Micro-note
                        </div>
                        <div className="schedule-card__note-row">
                            <input
                                id={`queue-card-note-${item.id}`} name={`queueCardNote-${item.id}`}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleNoteSave(e); }}
                                aria-label="Quick note"
                                placeholder='Quick status, e.g. "Half done"'
                                className="schedule-card__note-input"
                            />
                            <button onClick={handleNoteSave} className="schedule-card__note-save">
                                Save
                            </button>
                        </div>
                        {cardState.note && (
                            <div className="schedule-card__note-saved">Saved: "{cardState.note}"</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

// The Master Schedule Flow's strict cap on how many items ever appear in
// the dashboard's live timeline queue at once, active task included.
const MAX_QUEUE_SIZE = 8;

const HomePage = ({ setActiveTab }) => {
    const [masterQueue, setMasterQueue] = useState([]);
    const { bySource: registryBySource } = useTaskRegistry();
    const [cardStateMap, setCardStateMap] = useState(loadCardState);
    const isMobile = useIsMobile();
    // Contextual first-visit tour (see TourGuide.jsx) - mobile only, since
    // every step here targets a mobile-specific element or layout (the
    // Spotlight search bar in particular only renders on mobile at all).
    // Lazy useState initializer so hasSeenTour() is only ever checked
    // once, not on every render.
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('home'));

    // Draggable dashboard widgets - a real, working reorder mechanism
    // (native HTML5 drag-and-drop), persisted so the chosen order
    // survives a reload. Defaults to the existing fixed order (greeting
    // first, schedule second), so an existing user's layout is
    // genuinely unchanged until they actually drag something.
    const [widgetOrder, setWidgetOrder] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_home_widget_order') || 'null');
            if (Array.isArray(saved) && saved.length === 2 && saved.includes('greeting') && saved.includes('schedule')) return saved;
        } catch (e) { /* fall through to the real default order below */ }
        return ['greeting', 'schedule'];
    });
    const [draggedWidget, setDraggedWidget] = useState(null);

    const handleWidgetDrop = (targetId) => {
        if (!draggedWidget || draggedWidget === targetId) return;
        const next = [...widgetOrder];
        const fromIdx = next.indexOf(draggedWidget);
        const toIdx = next.indexOf(targetId);
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, draggedWidget);
        setWidgetOrder(next);
        localStorage.setItem('nexus_home_widget_order', JSON.stringify(next));
        setDraggedWidget(null);
    };

    // Real, reported gap fixed: the drag-to-reorder above uses native HTML5
    // drag-and-drop (`draggable`/onDragStart/onDrop), which has NO touch
    // support at all in any mobile browser - the grip handle was genuinely
    // inert on mobile, not just awkward, even though "fix होना चाहिए mobile
    // में भी" was explicit. With only ever these two widgets, a full
    // touch-drag simulation would be real complexity for a result that's
    // identical to just swapping the two - so the grip handle's tap target
    // calls this directly, persisted the exact same way (same localStorage
    // key handleWidgetDrop already writes), giving mobile a real, working,
    // one-tap equivalent instead of a silently-dead drag gesture.
    const swapWidgetOrder = () => {
        const next = [...widgetOrder].reverse();
        setWidgetOrder(next);
        localStorage.setItem('nexus_home_widget_order', JSON.stringify(next));
    };

    // Productivity Widget Customization - which of the three named
    // dashboard categories (Study Tracker, Gym Split, Finance Overview)
    // the user has chosen to show. Read from the same real settings blob
    // every other Settings-page toggle already persists to, and kept
    // genuinely live via the same event pattern used throughout this app,
    // rather than only catching up on the next 60-second interval tick.
    const loadWidgetVisibility = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
            return {
                study: saved.widgetShowStudy !== false,
                gym: saved.widgetShowGym !== false,
                finance: saved.widgetShowFinance !== false,
                timetable: saved.widgetShowTimetable !== false,
                planner: saved.widgetShowPlanner !== false,
                calendar: saved.widgetShowCalendar !== false,
                diet: saved.widgetShowDiet !== false,
            };
        } catch (e) {
            return { study: true, gym: true, finance: true, timetable: true, planner: true, calendar: true, diet: true };
        }
    };
    const [widgetVisibility, setWidgetVisibility] = useState(loadWidgetVisibility);

    useEffect(() => {
        const handleUpdate = () => setWidgetVisibility((prev) => {
            const next = loadWidgetVisibility();
            return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('nexus_settings_updated', handleUpdate);
        return () => {
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('nexus_settings_updated', handleUpdate);
        };
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(CARD_STATE_KEY, JSON.stringify(cardStateMap));
        } catch (e) {
            /* storage full/unavailable - the toggle/note still works for this session */
        }
    }, [cardStateMap]);

    const handleToggleComplete = useCallback((id) => {
        setCardStateMap((prev) => ({
            ...prev,
            [id]: { ...prev[id], completed: !prev[id]?.completed },
        }));
    }, []);

    const handleSaveNote = useCallback((id, note) => {
        setCardStateMap((prev) => ({
            ...prev,
            [id]: { ...prev[id], note },
        }));
    }, []);

    const handleTimeShift = useCallback((id, minutes) => {
        setCardStateMap((prev) => ({
            ...prev,
            [id]: { ...prev[id], timeShift: (prev[id]?.timeShift || 0) + minutes },
        }));
    }, []);

    // useCallback (keyed on cardStateMap) rather than a plain function
    // inside the effect below - this makes the effect re-run (and
    // therefore instantly recompute the queue) the moment a +30m
    // reschedule updates cardStateMap, instead of only picking up the
    // change on the next scheduled 60-second refresh.
    const loadMasterData = useCallback(() => {
        const todayStr = getLocalDateString();
        const queueItems = [];

        const now = new Date();

        // Timetable is a weekly-recurring template - one registry entry
        // PER day of the week it's scheduled on (see
        // TaskRegistryContext.jsx's own normalizeTimetableSlots), not a
        // single "today only" thing, and it keeps recurring forever, not
        // just once - a real, reported follow-up gap: with computeOccurrence
        // finding only ONE (the next) occurrence per entry, a single
        // recurring task on every day of the week topped out at 7 cards
        // and then just stopped, even though the queue's own real
        // capacity is MAX_QUEUE_SIZE (8) and an 8th, later occurrence of
        // that SAME task genuinely exists and should already be queued
        // up - not leave a visible gap until the first one completes.
        // computeOccurrences (plural) generates up to MAX_QUEUE_SIZE
        // future occurrences per entry (provably enough: the true
        // globally-soonest 8 across every entry can never need more than
        // 8 from any single one), each becoming its own real, distinct
        // queue item with a unique id (`${e.id}::occN`) - so completing/
        // rescheduling/noting one specific dated occurrence never
        // touches another week's. The first occurrence keeps the base id
        // unchanged, preserving any already-saved cardState for it.
        // Untimed slots (no parseable clock time) have no day to project
        // by, so they keep the original isToday-only, single-instance
        // behavior instead. No completion tracking exists for Timetable
        // slots in the source data itself, so a synthetic future
        // occurrence is always honestly pending, never inheriting
        // whichever real-world day the template happens to be checked
        // off for right now.
        registryBySource.timetable.forEach((e) => {
            if (e.startHour === null || e.startHour === undefined) {
                if (!e.isToday) return;
                queueItems.push({
                    id: e.id, startHour: null, endHour: null, startAtMs: null, endAtMs: null,
                    time: e.raw.time || 'Scheduled', title: e.title, category: e.category,
                    hasRealTime: false, preCompleted: e.status === 'completed', widgetGroup: 'timetable',
                });
                return;
            }
            const occurrences = computeOccurrences(e.day, e.startHour, e.endHour, now, MAX_QUEUE_SIZE);
            occurrences.forEach((occ, i) => {
                queueItems.push({
                    id: i === 0 ? e.id : `${e.id}::occ${i}`,
                    startHour: e.startHour, endHour: e.endHour, startAtMs: occ.startAtMs, endAtMs: occ.endAtMs,
                    time: e.raw.time || 'Scheduled', title: e.title, category: e.category,
                    hasRealTime: true, preCompleted: i === 0 ? e.status === 'completed' : false, widgetGroup: 'timetable',
                });
            });
        });

        // Calendar: Calendar's own scheduled events (not the Timetable-
        // derived virtual ones CalendarPage itself already shows, which
        // are covered by the Timetable source above - registering both
        // would double-count them). Today's real events only, matching
        // Timetable's own today-scoping, with the real logged time - a
        // dated Calendar event genuinely only happens on its own one
        // real date, never a recurring multi-day projection the way a
        // Timetable slot can.
        registryBySource.calendarEvents.filter((e) => e.date === todayStr).forEach((e) => {
            const occ = todayOccurrence(e.startHour, e.endHour, now);
            queueItems.push({
                id: e.id, startHour: e.startHour, endHour: e.endHour,
                startAtMs: occ?.startAtMs ?? null, endAtMs: occ?.endAtMs ?? null,
                time: e.raw.time || 'Scheduled', title: e.title, category: e.category,
                hasRealTime: e.startHour !== null, preCompleted: e.status === 'completed', widgetGroup: 'calendar',
                // A dated calendar event with no parseable clock time (an
                // "All Day" festival/holiday, e.g. Raksha Bandhan) is
                // genuinely happening right now, all day today - the
                // opposite of a flexible, timeless queue item. Marked here
                // so it gets the same live treatment as a currently-active
                // timed task below, instead of falling into the generic
                // "Up Next" bucket alongside Planner/Gym/Study tasks that
                // carry no "happening today" claim at all.
                isAllDayToday: e.startHour === null,
            });
        });

        // Planner: not-yet-completed tasks. A due date isn't a time of day,
        // so startHour/endHour stay honestly null rather than an invented
        // slot - the timeline no longer fabricates a 9:00am-onward
        // ordering for these.
        registryBySource.planner.filter((e) => e.status !== 'completed').forEach((e) => {
            queueItems.push({
                id: e.id, startHour: null, endHour: null,
                time: e.date ? `Due: ${e.date}` : 'Flexible Queue', title: e.title, category: e.category,
                hasRealTime: false, widgetGroup: 'planner',
            });
        });

        // Gym: only a session actually logged TODAY shows up here - the
        // full history isn't relevant to a daily timeline, and every entry
        // is, by definition, an already-completed workout.
        registryBySource.gym.filter((e) => e.date === todayStr).forEach((e) => {
            queueItems.push({
                id: e.id, startHour: null, endHour: null,
                time: 'Completed Today', title: e.title, category: e.category,
                hasRealTime: false, preCompleted: true, widgetGroup: 'gym',
            });
        });

        // Gym Plans: active workout splits/schedules not yet completed
        // today - the genuinely "upcoming" counterpart to the completed-
        // history entries above. Filtered to pending only, since a plan
        // already finished today is already represented by its real
        // history entry.
        registryBySource.gymPlans.filter((e) => e.status !== 'completed').forEach((e) => {
            queueItems.push({
                id: e.id, startHour: null, endHour: null,
                time: 'Active Split', title: e.title, category: e.category,
                hasRealTime: false, widgetGroup: 'gym',
            });
        });

        // Diet: meals aren't date-scoped in the source data (they
        // represent the current day's plan), so all of them show here,
        // each carrying its own real completed status.
        registryBySource.diet.forEach((e) => {
            const occ = todayOccurrence(e.startHour, e.endHour, now);
            queueItems.push({
                id: e.id, startHour: e.startHour, endHour: e.endHour,
                startAtMs: occ?.startAtMs ?? null, endAtMs: occ?.endAtMs ?? null,
                time: e.raw.time || 'Scheduled', title: e.title, category: e.category,
                hasRealTime: e.startHour !== null, preCompleted: e.status === 'completed', widgetGroup: 'diet',
            });
        });

        // Grocery: unpurchased items only, matching Planner's exact
        // pending-only pattern - a purchased item is already done and
        // shouldn't linger on the daily queue.
        registryBySource.dietGrocery.filter((e) => e.status !== 'completed').forEach((e) => {
            queueItems.push({
                id: e.id, startHour: null, endHour: null,
                time: 'Grocery', title: e.title, category: e.category,
                hasRealTime: false, widgetGroup: 'diet',
            });
        });

        // Finance Bills: unpaid only, with the real due date - matches
        // Study assignments' exact "Due: <date>" pattern, since a bill
        // deadline is a real date but not a clock time.
        registryBySource.financeBills.filter((e) => e.status !== 'completed').forEach((e) => {
            queueItems.push({
                id: e.id, startHour: null, endHour: null,
                time: e.date ? `Due: ${e.date}` : 'Bill Due', title: e.title, category: e.category,
                hasRealTime: false, widgetGroup: 'finance',
            });
        });

        // Syllabus: not-yet-completed topics, matching Planner's exact
        // pattern - a topic checklist item carries no clock time of its
        // own, so startHour/endHour stay honestly null. Filtered to
        // pending only, since a topic marked done should stop occupying
        // the daily queue rather than lingering there forever.
        registryBySource.syllabus.filter((e) => e.status !== 'completed').forEach((e) => {
            queueItems.push({
                id: e.id, startHour: null, endHour: null,
                time: 'Study Checkpoint', title: e.title, category: e.category,
                hasRealTime: false, widgetGroup: 'study',
            });
        });

        // Study Assignments: not-yet-completed, matching Planner's exact
        // due-date pattern - a real deadline exists, but it isn't a clock
        // time, so startHour/endHour stay honestly null.
        registryBySource.studyAssignments.filter((e) => e.status !== 'completed').forEach((e) => {
            queueItems.push({
                id: e.id, startHour: null, endHour: null,
                time: e.date ? `Due: ${e.date}` : 'Flexible Queue', title: e.title, category: e.category,
                hasRealTime: false, widgetGroup: 'study',
            });
        });

        // Apply any saved +30m reschedules BEFORE computing which item is
        // "active" - pushing a task back should genuinely extend when it's
        // considered active, not just change the displayed label. Untimed
        // items pass through unchanged (see applyTimeShift's own guard).
        const shiftedItems = queueItems.map((item) => applyTimeShift(item, cardStateMap[item.id]?.timeShift || 0));

        // Productivity Widget Customization - honor the user's real,
        // saved show/hide choice for each of the seven named categories.
        // Every real source is honestly tagged with its own widgetGroup
        // now - the === null fallback below is purely defensive (so a
        // future, not-yet-categorized source degrades to "always shown"
        // rather than silently vanishing), not something any current,
        // real item actually relies on.
        const visibleItems = shiftedItems.filter((item) => item.widgetGroup === null || widgetVisibility[item.widgetGroup] !== false);

        // Split timed from untimed - "which item is currently active" is a
        // genuinely time-based question, so it can only ever be answered
        // using items that actually have a real clock time. Sorted by the
        // real absolute startAtMs now (see computeOccurrence/
        // todayOccurrence above), not the old bare startHour - a bare
        // hour-of-day can't correctly order items that span different
        // calendar days (today's 11 PM is sooner than tomorrow's 2 AM
        // even though 2 < 23), which was the actual root cause behind
        // both the duplicate-"Sleep Time" and identical-countdown bugs.
        const timed = visibleItems.filter((i) => i.hasRealTime).sort((a, b) => a.startAtMs - b.startAtMs);
        const untimedAll = visibleItems.filter((i) => !i.hasRealTime);
        // All-day calendar events dated today are split out here and
        // pre-marked live - see the isAllDayToday comment above where
        // they're tagged. Everything left in `untimed` after this is
        // genuinely timeless (a Planner due-date, a Gym split, etc.),
        // not merely missing a clock time for today specifically.
        const liveAllDay = untimedAll.filter((i) => i.isAllDayToday).map((i) => ({ ...i, isCurrentlyActive: true }));
        const untimed = untimedAll.filter((i) => !i.isAllDayToday);

        if (timed.length === 0) {
            setMasterQueue([...liveAllDay, ...untimed].slice(0, MAX_QUEUE_SIZE));
            return;
        }

        // Real Date-math "is this active right now" check, replacing the
        // old isWithinTimeRange(currentHour, startHour, endHour) modular-
        // hour comparison - startAtMs/endAtMs are already genuine absolute
        // timestamps (computeOccurrence/todayOccurrence above already
        // resolved the overnight-crossing case correctly when building
        // them), so a plain range check is now sufficient and correct
        // for any item regardless of which calendar day it falls on.
        let activeIndex = timed.findIndex(item => now.getTime() >= item.startAtMs && now.getTime() < item.endAtMs);
        // Real, honest flag - true only if a genuine match was found
        // above, captured BEFORE the index-0 fallback below. Without
        // this, the render logic downstream has no way to tell "this
        // item is genuinely active right now" apart from "nothing is
        // active, so this item is just shown first as the next
        // upcoming one" - which is exactly how an unrelated, inactive
        // item (e.g. a sleep schedule at 4:30 PM) could previously be
        // displayed as "Active Now".
        const wasGenuinelyActive = activeIndex !== -1;
        if (activeIndex === -1) activeIndex = 0;

        // isCurrentlyActive rides along on the item itself, so HomePage's
        // own render logic (and QueueCard) can read a real, honest signal
        // instead of re-inferring "active" from queue position alone.
        const timedHead = { ...timed[activeIndex], isCurrentlyActive: wasGenuinelyActive };
        const restTimed = [...timed.slice(activeIndex + 1), ...timed.slice(0, activeIndex)];

        // Multiple genuinely live things can exist at once now - a
        // festival running all day alongside a class currently in
        // session, say - so every live item leads the queue together
        // rather than only one position ever being allowed to be
        // "active". Order between them doesn't matter (both render with
        // the identical live treatment below); only whether the timed
        // item is genuinely active decides whether it joins that leading
        // group at all.
        const reorderedQueue = wasGenuinelyActive
            ? [timedHead, ...liveAllDay, ...restTimed, ...untimed]
            : [...liveAllDay, timedHead, ...restTimed, ...untimed];

        // Strict 8-task cap on the queue as a whole - the active task (if
        // any) is already first in this same array, so it counts as one
        // of the 8 rather than being added on top of it. Naturally shows
        // fewer than 8 whenever fewer real tasks actually exist (slice
        // never pads with anything fake), and naturally lets a task that
        // was previously just past the cutoff enter the visible window
        // the instant an earlier one clears (completes) or the active
        // index moves past it - no separate "shift" logic needed beyond
        // this cap, since the existing reactivity already recomputes the
        // whole ordering from scratch every time.
        setMasterQueue(reorderedQueue.slice(0, MAX_QUEUE_SIZE));
    }, [cardStateMap, registryBySource, widgetVisibility]);

    useEffect(() => {
        loadMasterData();
        // Re-evaluates once a minute purely for TIME-based transitions
        // (e.g. the active item changing as the clock crosses a boundary)
        // even when no underlying task data has changed at all - the
        // registry's own reactivity (loadMasterData depends on
        // registryBySource above, which updates the instant any source
        // module saves) is what delivers real "zero page reloads, updates
        // instantly" behavior for actual task changes, not this interval.
        const interval = setInterval(loadMasterData, 60000);
        return () => clearInterval(interval);
    }, [loadMasterData]);

    // Which edge the Greeting card's sticky pin should stick to - matches
    // its own real position in widgetOrder (see the drag/tap-to-swap
    // handling below) rather than always assuming top, so swapping it to
    // the bottom of the stack correctly pins it to the bottom edge too.
    const isGreetingFirst = widgetOrder.indexOf('greeting') === 0;

    return (
        <div className="dashboard-grid" style={{
            animation: 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)', paddingBottom: isMobile ? '32px' : '60px',
            // Real, reported request: the gap between the app header and
            // whichever card renders first here (Master Schedule, when
            // it's been swapped ahead of Greeting) read as much larger
            // than the ~16px gap between two queue cards - DashboardLayout.
            // jsx's own shared container padding (32px desktop / 16px
            // mobile top) plus .master-schedule's own 10px margin-top
            // compounded into real extra space. Scoped here (this class
            // is Home-only - no other page uses it) rather than touching
            // that shared padding, which every other module also relies
            // on. Negative margin pulls this specific page's content up
            // to close that gap without affecting anything else.
            // Retuned against a real live measurement (getBoundingClientRect,
            // not a screenshot guess): -20px only got the header-to-title
            // gap down to 46px, nowhere near the ~16px card-to-card gap
            // this was supposed to match. -46px is what the real numbers
            // say is needed on desktop.
            marginTop: isMobile ? '-10px' : '-46px',
        }}>
            <style>{`
                @keyframes fadeInScale {
                    0% { opacity: 0; transform: scale(0.98) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>

            {showTour && <TourGuide tourId="home" steps={TOUR_STEPS.home} onFinish={() => setShowTour(false)} />}

            {/* Real, live-tested fix (previous sticky attempt on the
                greeting div ALONE, one level up, was reverted after it
                reportedly crossed/overlapped Master Schedule's own
                cards). Root cause: that div was its own independent
                .dashboard-grid row - a CSS Grid row is only ever as
                tall as its own single item, so a sticky item whose
                immediate containing block IS its own height has no
                room to actually stay stuck once you scroll past it; it
                visually "unstuck" and rode up together with Master
                Schedule instead of staying pinned while Master
                Schedule (including its own heading) scrolled underneath.
                Real fix: give both cards ONE shared containing block
                that is genuinely taller than the sticky item (Master
                Schedule's own up-to-8-card height, on mobile), so
                there's real scroll room for Greeting to stay pinned
                while Master Schedule scrolls past inside it. On
                desktop this wrapper is `display:contents` - invisible
                to layout, so both children fall right back into being
                direct rows of .dashboard-grid exactly as before
                (desktop was never part of this bug or this request).
                AIDailyBriefingCard sits inside too (desktop-only,
                unconditionally null on mobile) purely so its existing
                DOM position/order between the two is completely
                unchanged on desktop. */}
            <div
                className="col-12"
                style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '24px', position: 'relative' }}
            >
                <div
                    draggable
                    onDragStart={() => setDraggedWidget('greeting')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleWidgetDrop('greeting')}
                    onDragEnd={() => setDraggedWidget(null)}
                    style={{
                        order: widgetOrder.indexOf('greeting'), opacity: draggedWidget === 'greeting' ? 0.5 : 1,
                        // Real, explicit follow-up request: this pin was
                        // mobile-only and always pinned to the TOP,
                        // regardless of where the swap put the card -
                        // desktop never pinned at all, and swapping to
                        // "bottom" position still pinned to the top,
                        // which is backwards (a card living at the
                        // bottom of the stack should stay stuck to the
                        // BOTTOM edge while the rest scrolls past above
                        // it, mirroring exactly how a top card stays
                        // stuck to the top while things scroll past
                        // below it). Now applies on both mobile and
                        // desktop, and picks whichever edge actually
                        // matches this card's real position in
                        // widgetOrder instead of always assuming top.
                        position: 'sticky',
                        // Real, reported bug: bottom:'0px' stuck this
                        // card flush to .nexus-page-scroll's own bottom
                        // scroll edge, which sits BEHIND MobileTabBar (a
                        // separate fixed sibling reserving its own
                        // ~76px+safe-area at the true screen bottom -
                        // .glass-panel's matching bottom padding normally
                        // clears it for ordinary flow content, but a
                        // sticky offset is measured against the
                        // scrollport itself, not an ancestor's padding).
                        // The card was rendering right under the tab bar
                        // instead of clearing it. Mirrors the same
                        // clearance FloatingBottomPlayer.jsx already
                        // uses for the identical real reason.
                        ...(isGreetingFirst
                            ? { top: '0px' }
                            : { bottom: isMobile ? 'calc(76px + env(safe-area-inset-bottom, 0px))' : '0px' }),
                        zIndex: 20,
                        // A real, confirmed jitter bug: this card visibly
                        // shook a pixel or two while Master Schedule
                        // scrolled underneath/behind it - a known real
                        // rendering quirk. CORRECTION after live-inspecting
                        // the actual rendered DOM (getComputedStyle, not a
                        // guess): the previous two attempts here were both
                        // built on a false premise inherited from an
                        // earlier comment - GreetingCard.jsx's own root has
                        // NO backdrop-filter at all (confirmed: computed
                        // backdropFilter is 'none', and zero descendants
                        // have one either), so a "sticky+blur recompositing"
                        // explanation was never actually possible here; the
                        // '--glass-blur' override below was dead - nothing
                        // in GreetingCard.jsx reads that variable. Removed
                        // it. The real, still-unconfirmed cause is more
                        // likely .nexus-page-scroll's own
                        // willChange:'scroll-position' (DashboardLayout.
                        // jsx) competing with this sticky child for which
                        // layer owns repaint - translate3d + backface-
                        // visibility/contain (kept from the previous
                        // attempt) plus isolation:'isolate' here (a new,
                        // stronger stacking-context boundary) is the next
                        // reasonable attempt at that theory, but this
                        // still could not be verified against a real
                        // scroll gesture (requestAnimationFrame sampling
                        // doesn't run in a backgrounded/hidden browser
                        // pane, which is what was available) - please
                        // check this directly again.
                        transform: 'translate3d(0,0,0)',
                        backfaceVisibility: 'hidden',
                        contain: 'layout',
                        isolation: 'isolate',
                        willChange: 'transform',
                        // Still real and still used (confirmed:
                        // --bg-surface's own alpha channel in variables.css/
                        // style.css reads this) - keeps the card's
                        // background reliably opaque so Master Schedule
                        // text scrolling underneath never bleeds through
                        // it, independent of the jitter investigation
                        // above.
                        '--nexus-user-glass-alpha': 'max(var(--nexus-user-glass-alpha, 0.03), 0.88)',
                    }}
                >
                    <div
                        title="Drag to reorder (desktop) or tap to swap order (mobile)"
                        onClick={(e) => { e.stopPropagation(); swapWidgetOrder(); }}
                        style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 5, cursor: 'grab', color: 'var(--text-muted)', opacity: 0.5, padding: '8px' }}
                    >
                        <GripVertical size={16} />
                    </div>
                    <GreetingCard setActiveTab={setActiveTab} />
                </div>

                {/* AI coaching/briefing is paused on mobile for this pass -
                    desktop's card is completely unaffected. */}
                {!isMobile && (
                    <div className="col-12">
                        <AIDailyBriefingCard isMobile={isMobile} setActiveTab={setActiveTab} />
                    </div>
                )}

                <div
                    className={isMobile ? 'master-schedule' : 'col-12 master-schedule'}
                    draggable
                    onDragStart={() => setDraggedWidget('schedule')}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleWidgetDrop('schedule')}
                    onDragEnd={() => setDraggedWidget(null)}
                    data-tour-id="home-schedule"
                    style={{ order: widgetOrder.indexOf('schedule'), opacity: draggedWidget === 'schedule' ? 0.5 : 1, position: 'relative' }}
                >
                <div
                    title="Drag to reorder (desktop) or tap to swap order (mobile)"
                    className="master-schedule__drag-handle"
                    onClick={(e) => { e.stopPropagation(); swapWidgetOrder(); }}
                >
                    <GripVertical size={16} />
                </div>
                <div className="master-schedule__header">
                    <div className="master-schedule__header-left">
                        <Clock size={18} color="var(--accent)" />
                        {/* Shortened on mobile - the full title reliably
                            wrapped to 2 lines there (a real, reported "make
                            it one line" ask), and the subtitle right below
                            it ("N Master Queue Blocks Active") already
                            covers the "active"/"timeline" half of the
                            meaning, so nothing real is lost by trimming it
                            for the narrower width. Desktop keeps the full
                            title unchanged - real room to spare there. */}
                        <h2 className="master-schedule__title">{isMobile ? 'Master Schedule' : 'Master Schedule Flow & Active Timeline'}</h2>
                    </div>
                    {/* Real, reported request: shortened from "N Master
                        Queue Blocks Active" - "Master" was redundant
                        with the title right next to it ("Master
                        Schedule..."), and trimming it lets this header
                        row sit more compactly, especially on mobile
                        where every extra word here pushed the visible
                        queue content down further from the app header. */}
                    <span className="master-schedule__count">{masterQueue.length} Queue Blocks Active</span>
                </div>

                {/* master-schedule__queue is a plain passthrough wrapper on
                    desktop - it only becomes a capped, internally-scrolling
                    region on mobile (see the max-width:768px rule), so a
                    long queue never pushes the rest of the dashboard down
                    and off-screen on a small viewport. */}
                <div className="master-schedule__queue">
                {masterQueue.length === 0 ? (
                    <div className="master-schedule__empty">
                        <Clock size={28} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                        <span className="master-schedule__empty-title">No tasks in your queue yet</span>
                        <span className="master-schedule__empty-sub">Add a task in the Planner, Timetable, Gym, or Diet and it'll show up here automatically.</span>
                    </div>
                ) : (
                    (() => {
                        // "Active Now" reads the real, honest
                        // isCurrentlyActive flag set above - true for a
                        // timed item only when the current clock time is
                        // genuinely within its own start/end range, and
                        // true for every all-day calendar event dated
                        // today regardless of clock time. It's a
                        // per-item fact now, not a single queue-position
                        // check - any number of items can be live at
                        // once (e.g. a festival running all day plus a
                        // class currently in session), and every one of
                        // them gets the identical live card treatment
                        // below. "Up Next" is simply the first item after
                        // however many live ones lead the list; if
                        // nothing is live at all, that's index 0, same
                        // as before.
                        const firstNonLiveIndex = masterQueue.findIndex((i) => !i.isCurrentlyActive);
                        return masterQueue.map((item, index) => {
                            const isActive = !!item.isCurrentlyActive;
                            const isNext = !isActive && index === firstNonLiveIndex;
                            const opacityLevel = Math.max(0.4, 1 - (index * 0.08));
                            const storedCardState = cardStateMap[item.id] || {};

                            return (
                                <QueueCard
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    isActive={isActive}
                                    isNext={isNext}
                                    opacityLevel={opacityLevel}
                                    setActiveTab={setActiveTab}
                                    cardState={{
                                        ...storedCardState,
                                        // The source module's own real status
                                        // (a Diet meal or Gym session already
                                        // marked done there) shows here too -
                                        // but a local toggle made directly on
                                        // this card still wins if one exists.
                                        completed: storedCardState.completed ?? !!item.preCompleted,
                                    }}
                                    onToggleComplete={handleToggleComplete}
                                    onSaveNote={handleSaveNote}
                                    onTimeShift={handleTimeShift}
                                />
                            );
                        });
                    })()
                )}
                </div>
            </div>
            </div>
        </div>
    );
};

export default HomePage;
