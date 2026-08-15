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
import { Clock, PlayCircle, CheckCircle2, Circle, ChevronDown, ArrowUpRight, StickyNote, CheckSquare, Timer, GripVertical } from 'lucide-react';
import { useTaskRegistry } from '../context/TaskRegistryContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';

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

// A couple of short, generic, category-flavored placeholder sub-tasks shown
// in the expanded card view - real per-task sub-tasks would come from
// wherever `item` itself is eventually sourced from (planner tasks already
// have real titles/dates; the static default items are demo content, same
// as the rest of this mock schedule).
const SUBTASK_LIBRARY = {
    'Study Hub': ['Review core concepts', 'Work through practice problems', 'Note down open questions'],
    'Study': ['Review core concepts', 'Work through practice problems', 'Note down open questions'],
    'Development': ['Pull latest changes', 'Implement + test the next unit', 'Push and update the task tracker'],
    'College': ['Skim today\u2019s reading', 'Attend/rewatch the session', 'Write a 3-line summary'],
    'Review': ['Re-read yesterday\u2019s notes', 'Spot-check weak areas', 'Plan tomorrow\u2019s focus'],
    'Fitness': ['Warm up', 'Main set', 'Cool down + stretch'],
    'Diet': ['Log the meal', 'Check hydration for the day', 'Prep next meal if needed'],
    'Night Flow': ['Tidy up the desk', 'Quick journal line', 'Screens off'],
};
const DEFAULT_SUBTASKS = ['Get started', 'Make progress', 'Wrap up'];
const getSubtasks = (category) => SUBTASK_LIBRARY[category] || DEFAULT_SUBTASKS;

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
    return {
        ...item,
        startHour: shiftedStart,
        endHour: shiftedEnd,
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

// Formats a fractional-hours "time remaining" value the way a live
// countdown reads naturally: hours+minutes while there's more than an hour
// left, just minutes under that, and a clear "Ending now" right at zero
// (never a confusing "0h 0m").
// Real, overnight-aware "is currentHour within this range" check - a
// plain current >= start && current < end can never match a range that
// crosses midnight (e.g. 8:30 PM -> 12:30 AM, stored as
// startHour=20.5/endHour=0.5), since no value can be both >= 20.5 and
// < 0.5 at the same time. When start > end, the range genuinely
// crosses midnight, so current is within it if it's either after start
// (the late-night portion, e.g. 11 PM) or before end (the early-
// morning portion after actual midnight, e.g. 2 AM) - an OR, not an
// AND, since these are two disjoint clock-time segments of one single
// overnight block, not a range a single value must satisfy both ends
// of at once.
const isWithinTimeRange = (currentHour, startHour, endHour) => {
    if (startHour <= endHour) return currentHour >= startHour && currentHour < endHour;
    return currentHour >= startHour || currentHour < endHour;
};

const formatCountdown = (hoursRemaining, zeroLabel = 'Ending now') => {
    if (hoursRemaining <= 0) return zeroLabel;
    const totalMinutes = Math.max(1, Math.round(hoursRemaining * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h <= 0) return `${m}m left`;
    return `${h}h ${m}m left`;
};

// ---------------------------------------------------------------------------
// QueueCard - a single timeline block. Extracted from the inline .map()
// (matching the React.memo sub-component pattern already used on the Audio
// Hub page) since it now owns real interactive state: expand/collapse, its
// own micro-note draft, and - for the active card only - a real-time
// countdown ticking independently of the parent's 60-second queue reload.
// ---------------------------------------------------------------------------
const QueueCard = React.memo(({ item, index, isActive, isNext, opacityLevel, setActiveTab, cardState, onToggleComplete, onSaveNote, onTimeShift, isMobile }) => {
    const [expanded, setExpanded] = useState(false);
    const [noteDraft, setNoteDraft] = useState(cardState.note || '');
    const [now, setNow] = useState(() => new Date());

    // Active AND upcoming (isNext) cards tick - active needs a live
    // "time remaining until end" countdown, upcoming needs a live "time
    // until start" one. Queued cards further back have no live
    // countdown to show (only the very next item's own start time is
    // meaningfully imminent), so there's no reason to run a timer for
    // them.
    useEffect(() => {
        if (!isActive && !isNext) return undefined;
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, [isActive, isNext]);

    const style = resolveCategoryStyle(item.category);
    const completed = !!cardState.completed;

    const remainingLabel = useMemo(() => {
        if (!isActive) return null;
        const nowHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
        // Real overnight adjustment - when this active item's own end
        // time has already wrapped past midnight (endHour is numerically
        // smaller than the current clock time, and the block is
        // genuinely an overnight one), the end is actually on the next
        // calendar day, so a full 24 hours is added back before
        // subtracting - otherwise this would compute a large negative
        // number and incorrectly show "Ending now" for an item that may
        // have only just started.
        const effectiveEndHour = (item.endHour < item.startHour && item.endHour <= nowHours) ? item.endHour + 24 : item.endHour;
        return formatCountdown(effectiveEndHour - nowHours);
    }, [isActive, now, item.endHour, item.startHour]);

    // Real "is this genuinely at zero time" flag - derived directly
    // from remainingLabel's own already-computed value, rather than a
    // separate parallel calculation that could drift out of sync with
    // the countdown it's describing.
    const isEndingNow = isActive && remainingLabel === 'Ending now';

    // Real "time until start" countdown for the upcoming (isNext) card -
    // the other half of this request's own "until the task ends or
    // starts" ask. Mirrors remainingLabel's own overnight-aware
    // adjustment: this app's own queue reordering only ever places an
    // item with a numerically-smaller startHour after the active/
    // reference item when it genuinely starts on the next calendar day,
    // so that same day-wraparound adjustment applies here too.
    const startsInLabel = useMemo(() => {
        if (!isNext || item.startHour === null || item.startHour === undefined) return null;
        const nowHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
        const effectiveStartHour = item.startHour <= nowHours ? item.startHour + 24 : item.startHour;
        return formatCountdown(effectiveStartHour - nowHours, 'Starting now');
    }, [isNext, now, item.startHour]);

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

    return (
        <div
            onClick={handleCardClick}
            style={{
                background: isActive ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border-premium)',
                display: 'flex', flexDirection: 'column',
                padding: isMobile ? (isActive ? '18px 16px' : '14px 16px') : (isActive ? '22px 26px' : '16px 26px'),
                borderRadius: '18px', opacity: opacityLevel,
                boxShadow: isActive ? 'var(--premium-shadow)' : 'none',
                transition: 'all 0.3s ease',
                position: 'relative', zIndex: 1,
                cursor: 'pointer',
            }}
        >
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '14px' : '18px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minWidth: 0, flex: '1 1 auto' }}>
                    {isActive ? (
                        <div style={{ position: 'relative', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ position: 'absolute', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--success)', opacity: 0.6, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}></div>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)' }}></div>
                        </div>
                    ) : (
                        // Clean solid white dot for every non-active card -
                        // no per-category tinting, no glow. var(--text-primary)
                        // rather than a literal white for the same theme-
                        // safety reason as the title below: it resolves to
                        // solid white in this dark/dynamic view without
                        // going invisible on a light theme's pale glass.
                        <div style={{
                            width: '12px', height: '12px', borderRadius: '50%', marginLeft: '3px', flexShrink: 0,
                            background: 'var(--text-primary)',
                        }}></div>
                    )}

                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                        {/* Header row - now genuinely decluttered per this
                            request's own restructuring ask: only the
                            status label and category tag live here. The
                            time range moved to its own row below, and the
                            countdown moved to the new center column /
                            the "Ending now" badge near the action button
                            on the right. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px', color: isActive ? 'var(--success)' : isNext ? 'var(--accent)' : 'var(--text-muted)', fontWeight: '800' }}>
                                {isActive ? 'Active Now' : isNext ? 'Up Next' : `Queue #${index + 1}`}
                            </span>
                            {style.tag && (
                                <span style={{
                                    fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', letterSpacing: '0.5px',
                                    background: 'var(--widget-bg)', border: '1px solid var(--border-premium)',
                                    borderRadius: '20px', padding: '2px 8px',
                                }}>
                                    [{style.tag}]
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            {/* Dedicated mark-done checkbox, right next to the
                                title - a second, more discoverable entry
                                point to the same completion state the status
                                pill on the right also controls (clicking
                                either one toggles the same thing). */}
                            <button
                                onClick={handleCompleteClick}
                                title={completed ? 'Mark as not done' : 'Mark as done'}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '22px', height: '22px', padding: 0, flexShrink: 0,
                                    background: 'transparent', border: 'none', cursor: 'pointer', color: completed ? 'var(--success)' : 'var(--text-muted)',
                                }}
                            >
                                {completed ? <CheckSquare size={20} /> : <Circle size={18} />}
                            </button>
                            {/* High-contrast title: var(--text-primary) is
                                this theme's own "maximum contrast" text
                                token - it resolves to solid white in this
                                dark/dynamic view, which is exactly the crisp
                                look being asked for, but (unlike a literal
                                hardcoded white) stays correct on the
                                theme(s) where dark text sits on light glass
                                instead of going invisible there. No
                                text-shadow now either - that soft drop-
                                shadow was what read as "blurry" against a
                                perfectly crisp title; removed entirely. */}
                            <h3 style={{
                                fontSize: isActive ? (isMobile ? '19px' : '24px') : '17px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '0.2px', margin: 0,
                                textDecoration: 'none', opacity: completed ? 0.6 : 1,
                            }}>
                                {item.title}
                            </h3>
                        </div>

                        {/* Structured time-range row, directly beneath the
                            title - relocated here per this request's own
                            "beneath the status or next to the title" ask,
                            paired with the source badge so both pieces of
                            "when and where this came from" context sit
                            together, rather than crowding the header row
                            above. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {item.hasRealTime && (
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', background: 'var(--primary-muted)', padding: '2px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Clock size={11} /> {item.time}
                                </span>
                            )}
                            {/* Clickable source badge - navigates straight to the
                                module page. stopPropagation so it never also
                                triggers the card's own expand/collapse. */}
                            <button
                                onClick={handleBadgeClick}
                                title={`Go to ${style.tab}`}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--widget-bg)',
                                    border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '3px 10px 3px 12px',
                                    cursor: 'pointer', fontFamily: 'inherit',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-premium)'; }}
                            >
                                Source Section: {item.category} <ArrowUpRight size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Genuinely prominent center countdown - covers both the
                    active card (time remaining until it ends) and the
                    upcoming card (time until it starts), per this
                    request's own explicit "until the task ends or
                    starts" ask. Queued cards further back show nothing
                    here - only the very next item's own start time is
                    meaningfully imminent enough to warrant a live
                    countdown. */}
                {isActive && remainingLabel && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 8px', textAlign: 'center' }}>
                        {/* fontSize 24px + fontVariantNumeric: tabular-nums
                            genuinely matches GreetingCard's own live clock
                            styling (the "header/sleep time text" this
                            request specifically points to), including a
                            matching Clock icon for the same visual family. */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: 'var(--success)', letterSpacing: '0.5px', lineHeight: '1', fontVariantNumeric: 'tabular-nums' }}>
                            <Clock size={isMobile ? 17 : 20} />
                            {remainingLabel}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', marginTop: '5px' }}>
                            Remaining
                        </span>
                    </div>
                )}
                {isNext && startsInLabel && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 8px', textAlign: 'center' }}>
                        {/* var(--accent) - the same blue this card already
                            uses for its own "Up Next" header label above,
                            so the countdown's own color reinforces which
                            state (active vs upcoming) is being shown. */}
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: isMobile ? '20px' : '24px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '0.5px', lineHeight: '1', fontVariantNumeric: 'tabular-nums' }}>
                            <Clock size={isMobile ? 17 : 20} />
                            {startsInLabel}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700', marginTop: '5px' }}>
                            Starts In
                        </span>
                    </div>
                )}

                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
                    background: 'var(--widget-bg)', border: '1px solid var(--border-premium)',
                    borderRadius: '16px', padding: '6px 8px', flexWrap: isMobile ? 'wrap' : 'nowrap',
                }}>
                    {/* Quick reschedule - queued/upcoming cards only (the
                        active card is already running; shifting IT forward
                        isn't a "push back a not-yet-started task" action),
                        AND only for items with a real clock time - pushing
                        back a flexible Planner task or a completed Gym log
                        that has no time to begin with doesn't mean
                        anything. Cumulative: each click adds another 30
                        minutes. */}
                    {!isActive && item.hasRealTime && (
                        <button
                            onClick={handleTimeShiftClick}
                            title="Push this task back by 30 minutes"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px',
                                background: 'transparent', color: 'var(--text-secondary)',
                                border: '1px solid var(--border-premium)', borderRadius: '20px',
                                fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-premium)'; }}
                        >
                            <Timer size={12} /> +30m{cardState.timeShift ? ` (+${cardState.timeShift})` : ''}
                        </button>
                    )}

                    {/* "Ending now" badge - relocated here, directly beside
                        the "In Progress" action button, per this request's
                        own explicit restructuring ask. Only appears at the
                        genuine zero-time moment (isEndingNow), not for the
                        whole active duration - the ongoing countdown
                        already lives in the new center column above. */}
                    {isActive && isEndingNow && (
                        <span style={{
                            fontSize: '11px', fontWeight: '800', color: '#F59E0B',
                            background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '20px', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '4px',
                            animation: 'pulse 2s ease-in-out infinite',
                        }}>
                            <Clock size={11} /> Ending now
                        </span>
                    )}

                    {/* Inline completion toggle - the actual interactive
                        status control. Clicking marks the task done/not-done
                        immediately, no page switch, persisted locally. */}
                    <button
                        onClick={handleCompleteClick}
                        title={completed ? 'Mark as not done' : 'Mark as done'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px',
                            background: completed ? 'rgba(16, 185, 129, 0.15)' : isActive ? 'rgba(16, 185, 129, 0.15)' : isNext ? 'var(--primary-muted)' : 'transparent',
                            color: completed || isActive ? 'var(--success)' : isNext ? 'var(--text-primary)' : 'var(--text-muted)',
                            border: completed || isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-premium)',
                            borderRadius: '20px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        {completed ? <CheckCircle2 size={15} /> : isActive ? <PlayCircle size={15} /> : <Circle size={13} />}
                        {completed ? 'Completed' : isActive ? 'In Progress' : isNext ? 'Queued' : 'Upcoming'}
                    </button>
                    <ChevronDown size={15} color="var(--text-muted)" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                </div>
            </div>

            {/* Expanded details: toggled by clicking anywhere on the card
                body (except the source badge / complete toggle above).
                Sub-tasks are lightweight, category-flavored placeholder
                content - same mock-data approach the rest of this schedule
                already uses - plus a real, saved micro-note field. */}
            {expanded && (
                <div
                    onClick={stop}
                    style={{
                        marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-premium)',
                        display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'default',
                    }}
                >
                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '8px' }}>Sub-tasks</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {getSubtasks(item.category).map((sub, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    <Circle size={6} fill="var(--text-muted)" color="var(--text-muted)" /> {sub}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <StickyNote size={12} /> Micro-note
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleNoteSave(e); }}
                                aria-label="Quick note"
                                placeholder='Quick status, e.g. "Half done"'
                                style={{
                                    flex: 1, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px',
                                    padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                                }}
                            />
                            <button
                                onClick={handleNoteSave}
                                style={{
                                    background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '10px',
                                    padding: '0 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                                }}
                            >
                                Save
                            </button>
                        </div>
                        {cardState.note && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Saved: "{cardState.note}"</div>
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
        const todayStr = new Date().toISOString().split('T')[0];
        const queueItems = [];

        // Timetable is a weekly-recurring template, not date-specific -
        // only TODAY's slots belong in a daily timeline. No completion
        // tracking exists for these in the source data, so they're always
        // pending.
        registryBySource.timetable.filter((e) => e.isToday).forEach((e) => {
            queueItems.push({
                id: e.id, startHour: e.startHour, endHour: e.endHour,
                time: e.raw.time || 'Scheduled', title: e.title, category: e.category,
                hasRealTime: e.startHour !== null, preCompleted: e.status === 'completed', widgetGroup: 'timetable',
            });
        });

        // Calendar: Calendar's own scheduled events (not the Timetable-
        // derived virtual ones CalendarPage itself already shows, which
        // are covered by the Timetable source above - registering both
        // would double-count them). Today's real events only, matching
        // Timetable's own today-scoping, with the real logged time.
        registryBySource.calendarEvents.filter((e) => e.date === todayStr).forEach((e) => {
            queueItems.push({
                id: e.id, startHour: e.startHour, endHour: e.endHour,
                time: e.raw.time || 'Scheduled', title: e.title, category: e.category,
                hasRealTime: e.startHour !== null, preCompleted: e.status === 'completed', widgetGroup: 'calendar',
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
            queueItems.push({
                id: e.id, startHour: e.startHour, endHour: e.endHour,
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
        // using items that actually have a real clock time.
        const timed = visibleItems.filter((i) => i.hasRealTime).sort((a, b) => a.startHour - b.startHour);
        const untimed = visibleItems.filter((i) => !i.hasRealTime);

        if (timed.length === 0) {
            setMasterQueue(untimed.slice(0, MAX_QUEUE_SIZE));
            return;
        }

        const currentHour = new Date().getHours() + new Date().getMinutes() / 60;

        let activeIndex = timed.findIndex(item => isWithinTimeRange(currentHour, item.startHour, item.endHour));
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

        const reorderedQueue = [
            // isCurrentlyActive rides along on the item itself, so
            // HomePage's own render logic (and QueueCard) can read a
            // real, honest signal instead of re-inferring "active" from
            // queue position alone.
            { ...timed[activeIndex], isCurrentlyActive: wasGenuinelyActive },
            ...timed.slice(activeIndex + 1),
            ...timed.slice(0, activeIndex),
            ...untimed,
        ];

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

    return (
        <div className="dashboard-grid" style={{ animation: 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)', paddingBottom: isMobile ? '32px' : '60px' }}>
            <style>{`
                @keyframes fadeInScale {
                    0% { opacity: 0; transform: scale(0.98) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>

            <div
                className="col-12"
                draggable
                onDragStart={() => setDraggedWidget('greeting')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleWidgetDrop('greeting')}
                onDragEnd={() => setDraggedWidget(null)}
                style={{ order: widgetOrder.indexOf('greeting'), opacity: draggedWidget === 'greeting' ? 0.5 : 1, position: 'relative' }}
            >
                <div
                    title="Drag to reorder"
                    style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 5, cursor: 'grab', color: 'var(--text-muted)', opacity: 0.5, padding: '4px' }}
                >
                    <GripVertical size={16} />
                </div>
                <GreetingCard setActiveTab={setActiveTab} />
            </div>

            {/* AI coaching/briefing is paused on mobile for this pass -
                desktop's card is completely unaffected. */}
            {!isMobile && (
                <div className="col-12">
                    <AIDailyBriefingCard isMobile={isMobile} />
                </div>
            )}

            <div
                className="col-12"
                draggable
                onDragStart={() => setDraggedWidget('schedule')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleWidgetDrop('schedule')}
                onDragEnd={() => setDraggedWidget(null)}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px', order: widgetOrder.indexOf('schedule'), opacity: draggedWidget === 'schedule' ? 0.5 : 1, position: 'relative' }}
            >
                <div
                    title="Drag to reorder"
                    style={{ position: 'absolute', top: '0', right: '4px', zIndex: 5, cursor: 'grab', color: 'var(--text-muted)', opacity: 0.5, padding: '4px' }}
                >
                    <GripVertical size={16} />
                </div>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? '4px' : '0', paddingLeft: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={isMobile ? 16 : 18} color="var(--accent)" />
                        <h2 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>{isMobile ? 'Schedule & Timeline' : 'Master Schedule Flow & Active Timeline'}</h2>
                    </div>
                    <span style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-muted)' }}>{masterQueue.length} Master Queue Blocks Active</span>
                </div>

                {masterQueue.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        padding: '48px 24px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '18px',
                    }}>
                        <Clock size={28} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>No tasks in your queue yet</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Add a task in the Planner, Timetable, Gym, or Diet and it'll show up here automatically.</span>
                    </div>
                ) : (
                    (() => {
                        // Only a genuinely time-based item can ever be
                        // "Active Now" - reads the real, honest
                        // isCurrentlyActive flag set above (true only
                        // when the current clock time is genuinely
                        // within that item's own start/end range),
                        // rather than inferring activity from queue
                        // position alone. If the queue has no timed
                        // items at all (e.g. only flexible Planner
                        // tasks today), or the first timed item merely
                        // fell back to position 0 without a real match,
                        // nothing is time-active, and the first item is
                        // labeled "Up Next" instead rather than
                        // misleadingly "Active Now".
                        const hasTimedActiveItem = !!masterQueue[0]?.isCurrentlyActive;
                        return masterQueue.map((item, index) => {
                            const isActive = hasTimedActiveItem && index === 0;
                            const isNext = hasTimedActiveItem ? index === 1 : index === 0;
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
                                    isMobile={isMobile}
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
    );
};

export default HomePage;
