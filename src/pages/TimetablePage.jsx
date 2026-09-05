// src/pages/TimetablePage.jsx
import { useState, useEffect, useRef } from 'react';
import { Clock, BookOpen, Dumbbell, Apple, Cpu, CheckCircle, Calendar, Plus, Trash2, DollarSign, Copy, X, Circle, GraduationCap, FileText, CheckSquare, Activity, BarChart3, Sparkles, RotateCcw, ClipboardList, Hourglass, Eraser, Pencil, Save } from 'lucide-react';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';

// Subtle, macOS-inspired category colors - used as a left accent + icon
// tint per entry so a category is instantly identifiable at a glance,
// without needing to read the label text first.
const CATEGORY_COLORS = {
    Study: '#3B82F6',
    College: '#EC4899',
    Syllabus: '#8B5CF6',
    Planner: '#14B8A6',
    Fitness: '#EF4444',
    Gym: '#DC2626',
    Diet: '#F59E0B',
    Finance: '#10B981',
    Calendar: '#0EA5E9',
    Analytics: '#6366F1',
    AI: '#D946EF',
    Development: '#A855F7',
    Review: '#06B6D4',
};
const getCategoryColor = (cat) => CATEGORY_COLORS[cat] || 'var(--accent)';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Real duration in minutes for a slot's own stored "08:00 AM - 09:30 AM"
// string - used for the new Scheduled Hours stat below. Handles a real,
// already-supported case elsewhere on this page (an overnight slot like
// "10:00 PM - 12:30 AM" crossing midnight, where the raw end-minutes
// value is numerically smaller than start) by adding a full day back in
// exactly when that happens, rather than returning a nonsensical
// negative duration.
const slotDurationMinutes = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return 0;
    const parts = timeString.split('-').map((p) => p.trim());
    if (parts.length !== 2) return 0;
    const toMinutes = (raw) => {
        const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (!match) return null;
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const period = match[3].toUpperCase();
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        return hour * 60 + minute;
    };
    const startMin = toMinutes(parts[0]);
    const endMin = toMinutes(parts[1]);
    if (startMin === null || endMin === null) return 0;
    return endMin >= startMin ? endMin - startMin : (1440 - startMin) + endMin;
};

const formatDurationLabel = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
};

const TimetablePage = () => {
    const isMobile = useIsMobile();
    // Mobile-only, real-first-visit-only tour - same pattern as every
    // other page's tour (see FinancePage.jsx/CalendarPage.jsx).
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('dailytable'));
    const [selectedDay, setSelectedDay] = useState('Monday');
    
    // Initial default or loaded from localStorage
    const [timetableData, setTimetableData] = useState(() => {
        const saved = localStorage.getItem('nexus_timetable_data');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { /* fallback */ }
        }
        return {
            'Monday': [], 'Tuesday': [], 'Wednesday': [], 'Thursday': [], 'Friday': [], 'Saturday': [], 'Sunday': []
        };
    });

    // Form inputs for adding manual slots - structured AM/PM time pickers
    // instead of a single free-text field, so the resulting time string is
    // always well-formed (no typos like "9:0 AM" or missing AM/PM).
    const [startHour, setStartHour] = useState('08');
    const [startMinute, setStartMinute] = useState('00');
    const [startPeriod, setStartPeriod] = useState('AM');
    const [endHour, setEndHour] = useState('09');
    const [endMinute, setEndMinute] = useState('00');
    const [endPeriod, setEndPeriod] = useState('AM');
    const [timeError, setTimeError] = useState('');
    const [titleInput, setTitleInput] = useState('');
    const [categoryInput, setCategoryInput] = useState('Study');
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [customCategory, setCustomCategory] = useState('');
    // A real, focused modal (matching Planner Hub's own "+ New Task"
    // pattern) instead of the add-entry form sitting permanently open
    // and expanded on the page at all times - a real, reported
    // complaint that this page read as "wide open" next to Planner's
    // own compact trigger-button-then-modal flow.
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isClearDayConfirmOpen, setIsClearDayConfirmOpen] = useState(false);
    // null while adding a fresh entry; the entry's own index within
    // currentSchedule while editing an existing one - the single flag the
    // shared modal below branches on for its title/submit label and for
    // whether handleAddSlot appends a new slot or updates one in place.
    const [editingIndex, setEditingIndex] = useState(null);

    useEffect(() => {
        localStorage.setItem('nexus_timetable_data', JSON.stringify(timetableData));
        window.dispatchEvent(new Event('storage'));
    }, [timetableData]);

    // CloudSyncContext's pullFromCloud (a factory-reset restore or sign-in
    // sync) writes directly to this same key and dispatches 'storage' -
    // without this listener, this component's own state would never
    // reflect a cloud-restored timetable while this page happens to be
    // mounted, even though the data is genuinely saved. The equality
    // guard prevents this component's own write above from re-triggering
    // itself in a loop.
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

    // Converts a 12-hour hour+period pair to a 0-23 hour, matching the
    // exact same conversion TaskRegistryContext.jsx's parseClockTime uses,
    // so a slot created here is guaranteed to parse identically to how
    // the dashboard's registry will read it back later.
    const to24Hour = (hour12, period) => {
        let hour = parseInt(hour12, 10);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        return hour;
    };

    const handleAddSlot = (e) => {
        e.preventDefault();
        setTimeError('');
        if (!titleInput.trim()) return;

        const startTotalMinutes = to24Hour(startHour, startPeriod) * 60 + parseInt(startMinute, 10);
        const endTotalMinutes = to24Hour(endHour, endPeriod) * 60 + parseInt(endMinute, 10);
        // A genuine overnight range (e.g. 8:30 PM -> 12:30 AM) naturally has
        // an end-minutes value smaller than its own start-minutes value,
        // since both are just "minutes since midnight" on their own
        // respective day - that's expected and valid, not an error. Only a
        // truly equal start/end (a real, zero-duration slot) is genuinely
        // invalid; crossing midnight is a real, supported case handled
        // consistently by every downstream reader (crossesMidnight below,
        // and the Master Schedule's own active-status check on HomePage).
        if (endTotalMinutes === startTotalMinutes) {
            setTimeError('End time must be different from start time.');
            return;
        }

        const timeString = `${startHour}:${startMinute} ${startPeriod} - ${endHour}:${endMinute} ${endPeriod}`;
        const resolvedCategory = toTitleCase(isCustomCategory ? (customCategory.trim() || 'Custom') : categoryInput);
        const resolvedTitle = toTitleCase(titleInput.trim());

        if (editingIndex !== null) {
            // Editing an existing slot in place - keeps its own `completed`
            // flag untouched, only the fields the form actually exposes
            // (time/title/category) are overwritten.
            setTimetableData(prev => ({
                ...prev,
                [selectedDay]: prev[selectedDay].map((slot, idx) =>
                    idx === editingIndex ? { ...slot, time: timeString, title: resolvedTitle, category: resolvedCategory } : slot
                )
            }));
        } else {
            const newSlot = {
                time: timeString,
                title: resolvedTitle,
                category: resolvedCategory,
                completed: false,
            };
            setTimetableData(prev => ({
                ...prev,
                [selectedDay]: [...(prev[selectedDay] || []), newSlot]
            }));
        }

        setTitleInput('');
        setIsCustomCategory(false);
        setCustomCategory('');
        setEditingIndex(null);
        setIsAddModalOpen(false);
    };

    // Opens the shared Add/Edit modal fresh for a brand-new entry - resets
    // every field to its default so a previous Add or a cancelled Edit
    // never leaves stale values behind for the next "New Entry" click.
    const openAddModal = () => {
        setEditingIndex(null);
        setStartHour('08'); setStartMinute('00'); setStartPeriod('AM');
        setEndHour('09'); setEndMinute('00'); setEndPeriod('AM');
        setTitleInput(''); setCategoryInput('Study'); setIsCustomCategory(false); setCustomCategory('');
        setTimeError('');
        setIsAddModalOpen(true);
    };

    const KNOWN_CATEGORIES = ['Study', 'College', 'Syllabus', 'Planner', 'Fitness', 'Gym', 'Diet', 'Finance', 'Calendar', 'Analytics', 'AI', 'Development', 'Review'];

    // Opens the same modal pre-filled with an existing slot's own real
    // values - parses its stored "08:00 AM - 09:00 AM" time string back
    // into the individual hour/minute/period selects it was originally
    // built from, so editing round-trips exactly rather than resetting to
    // defaults.
    const openEditModal = (index) => {
        const slot = currentSchedule[index];
        if (!slot) return;
        const match = (slot.time || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
            setStartHour(match[1].padStart(2, '0'));
            setStartMinute(match[2]);
            setStartPeriod(match[3].toUpperCase());
            setEndHour(match[4].padStart(2, '0'));
            setEndMinute(match[5]);
            setEndPeriod(match[6].toUpperCase());
        }
        if (KNOWN_CATEGORIES.includes(slot.category)) {
            setIsCustomCategory(false);
            setCategoryInput(slot.category);
        } else {
            setIsCustomCategory(true);
            setCustomCategory(slot.category || '');
        }
        setTitleInput(slot.title || '');
        setTimeError('');
        setEditingIndex(index);
        setIsAddModalOpen(true);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setEditingIndex(null);
        setTimeError('');
    };

    // Real bulk-clear for the selected day - previously the only way to
    // empty a day was deleting every entry one at a time, a real gap
    // once a day actually has several slots in it.
    const handleClearDay = () => {
        setTimetableData((prev) => ({ ...prev, [selectedDay]: [] }));
        setIsClearDayConfirmOpen(false);
    };

    const handleDeleteSlot = (indexToDelete) => {
        setTimetableData(prev => ({
            ...prev,
            [selectedDay]: prev[selectedDay].filter((_, idx) => idx !== indexToDelete)
        }));
    };

    // Real completion tracking - toggles a single slot's own completed
    // flag. No strikethrough involved anywhere; the checked/unchecked
    // visual state is communicated entirely through the checkbox icon
    // itself plus a subtle opacity shift on the row, matching the
    // project-wide zero-strikethrough rule.
    const toggleSlotComplete = (index) => {
        setTimetableData(prev => ({
            ...prev,
            [selectedDay]: prev[selectedDay].map((slot, idx) =>
                idx === index ? { ...slot, completed: !slot.completed } : slot
            )
        }));
    };

    const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
    const [duplicateTargetDays, setDuplicateTargetDays] = useState([]);
    const duplicateRef = useRef(null);

    // Matches the exact click-outside-to-close pattern header.jsx's own
    // popovers already use - without this, the popover would stay stuck
    // open until the small X button or the toggle button itself was
    // clicked, unlike every other floating panel in this app. Escape-to-
    // close added to match the same convention PinVerifyModal/
    // QuickNotesModal already follow elsewhere, which this popover never
    // had. Scoped to only listen while actually open.
    useEffect(() => {
        if (!isDuplicateOpen) return undefined;
        const handleClickOutside = (e) => {
            if (duplicateRef.current && !duplicateRef.current.contains(e.target)) {
                setIsDuplicateOpen(false);
            }
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') setIsDuplicateOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isDuplicateOpen]);

    const toggleDuplicateTarget = (day) => {
        setDuplicateTargetDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    };

    // Batch duplicate: copies the CURRENTLY selected day's entire routine
    // onto each checked target day, replacing whatever that day already
    // had - each destination gets its own fresh copies (new object
    // references, not shared ones) so editing one day's slots afterward
    // can never accidentally mutate another day's.
    const handleDuplicateToDays = () => {
        if (duplicateTargetDays.length === 0) return;
        const sourceSlots = currentSchedule;
        if (sourceSlots.length === 0) {
            // The source day's last slot could have been deleted while
            // this popover was already open - the toggle button's own
            // disabled check doesn't re-fire in that case, so this guard
            // is what actually prevents silently wiping the target days'
            // existing entries with nothing.
            setIsDuplicateOpen(false);
            setDuplicateTargetDays([]);
            return;
        }
        setTimetableData((prev) => {
            const next = { ...prev };
            duplicateTargetDays.forEach((day) => {
                next[day] = sourceSlots.map((slot) => ({ ...slot }));
            });
            return next;
        });
        setIsDuplicateOpen(false);
        setDuplicateTargetDays([]);
    };

    const currentSchedule = timetableData[selectedDay] || [];
    // Real, computed stats for the selected day - genuinely derived from
    // this same schedule data, not decorative placeholders (matching
    // Planner Hub's own real Total Tasks/Completion Rate/High Priority
    // stat row, per explicit request for something similar here).
    const completedCount = currentSchedule.filter((s) => s.completed).length;
    const totalScheduledMinutes = currentSchedule.reduce((sum, s) => sum + slotDurationMinutes(s.time), 0);

    const getCategoryIcon = (cat) => {
        switch(cat) {
            case 'Study': return <BookOpen size={16} />;
            case 'College': return <GraduationCap size={16} />;
            case 'Syllabus': return <FileText size={16} />;
            case 'Planner': return <CheckSquare size={16} />;
            case 'Fitness': return <Dumbbell size={16} />;
            case 'Gym': return <Activity size={16} />;
            case 'Diet': return <Apple size={16} />;
            case 'Finance': return <DollarSign size={16} />;
            case 'Calendar': return <Calendar size={16} />;
            case 'Analytics': return <BarChart3 size={16} />;
            case 'AI': return <Sparkles size={16} />;
            case 'Development': return <Cpu size={16} />;
            case 'Review': return <RotateCcw size={16} />;
            default: return <CheckCircle size={16} />;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {showTour && <TourGuide tourId="dailytable" steps={TOUR_STEPS.dailytable} onFinish={() => setShowTour(false)} />}
            <h1 style={{ fontSize: isMobile ? '20px' : '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>Daily Table & Manual Planner</h1>

            {/* Real, computed stats for the selected day - mirrors Planner
                Hub's own stat row (Total Tasks/Completion Rate/High
                Priority), genuinely derived from this same schedule data. */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '16px' }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '14px' : '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: isMobile ? '0.01em' : '0.05em', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <ClipboardList size={13} style={{ flexShrink: 0 }} /> {isMobile ? 'Entries' : `${selectedDay} Entries`}
                    </span>
                    <span style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{currentSchedule.length}</span>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '14px' : '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: isMobile ? '0.01em' : '0.05em', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <CheckCircle size={13} style={{ flexShrink: 0 }} /> Completed
                    </span>
                    <span style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: 'var(--success)' }}>
                        {completedCount}<span style={{ fontSize: isMobile ? '13px' : '15px', color: 'var(--text-muted)', fontWeight: '700' }}>/{currentSchedule.length}</span>
                    </span>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '14px' : '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: isMobile ? '0.01em' : '0.05em', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                        <Hourglass size={13} style={{ flexShrink: 0 }} /> Scheduled
                    </span>
                    <span style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '800', color: 'var(--text-primary)' }}>{totalScheduledMinutes > 0 ? formatDurationLabel(totalScheduledMinutes) : '--'}</span>
                </div>
            </div>

            {/* Day Selector Tabs - single, always-scrollable row. "Copy to
                Other Days" used to share this row and forced mobile into a
                second stacked row just to fit its own full-width button;
                it now lives inside the form below, right above the time
                picker, so this row stays one line on every viewport. */}
            <div data-tour-id="dailytable-days" style={{
                display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px',
                maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
            }}>
                {DAYS.map(day => (
                    <button
                        key={day}
                        onClick={() => { setSelectedDay(day); setIsDuplicateOpen(false); setDuplicateTargetDays([]); }}
                        style={{
                            padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '700',
                            cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap', flexShrink: 0,
                            background: selectedDay === day ? 'var(--primary)' : 'var(--bg-surface)',
                            color: selectedDay === day ? 'var(--text-on-primary)' : 'var(--text-primary)',
                            border: '1px solid var(--border-premium)'
                        }}
                    >
                        {day}
                    </button>
                ))}
            </div>

            {/* Add-entry form - now a real, focused modal (matching Planner
                Hub's own "+ New Task" flow) triggered from the schedule-
                list header below, instead of sitting permanently open and
                expanded on the page - a real, reported complaint that this
                page read as "wide open" next to Planner's own compact
                trigger-button-then-modal pattern. Same mobile bottom-sheet/
                desktop centered-dialog treatment as Planner's modal. */}
            {isAddModalOpen && (
            <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1000 }}
                onClick={closeAddModal}
            >
            <form
                onSubmit={handleAddSlot} onClick={(e) => e.stopPropagation()} className="nexus-glass-modal"
                style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)',
                    borderRadius: isMobile ? '24px 24px 0 0' : '24px',
                    padding: isMobile ? '20px 16px calc(20px + env(safe-area-inset-bottom, 0px)) 16px' : '24px',
                    width: '100%', maxWidth: isMobile ? '100%' : '520px',
                    maxHeight: isMobile ? '88vh' : 'none', overflowY: isMobile ? 'auto' : 'visible',
                    boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
                    gap: isMobile ? '14px' : '16px', boxShadow: 'var(--premium-shadow)',
                    animation: isMobile ? 'nexusSheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                }}
            >
                {isMobile && (
                    <div style={{ width: '40px', height: '4px', borderRadius: '4px', background: 'var(--border-premium)', margin: '-8px auto 0 auto', flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{editingIndex !== null ? `Edit Entry for ${selectedDay}` : `New Entry for ${selectedDay}`}</span>

                    <div ref={duplicateRef} style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={() => setIsDuplicateOpen((v) => !v)}
                            disabled={currentSchedule.length === 0}
                            title={currentSchedule.length === 0 ? `${selectedDay} has no entries to copy yet` : `Copy ${selectedDay}'s routine to other days`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9999px',
                                background: 'var(--widget-bg)', color: currentSchedule.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                                border: '1px solid var(--border-premium)', fontWeight: '700', fontSize: '12px',
                                cursor: currentSchedule.length === 0 ? 'default' : 'pointer', opacity: currentSchedule.length === 0 ? 0.6 : 1,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <Copy size={13} /> Copy to Other Days
                        </button>

                        {isDuplicateOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: '260px',
                                background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px',
                                padding: '18px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '12px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>Copy {selectedDay} to:</span>
                                    <button type="button" onClick={() => { setIsDuplicateOpen(false); setDuplicateTargetDays([]); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {DAYS.filter((d) => d !== selectedDay).map((day) => (
                                        <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0' }}>
                                            <input
                                                type="checkbox"
                                                checked={duplicateTargetDays.includes(day)}
                                                onChange={() => toggleDuplicateTarget(day)}
                                                style={{ accentColor: 'var(--primary)', width: '15px', height: '15px', cursor: 'pointer' }}
                                            />
                                            {day}
                                        </label>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDuplicateToDays}
                                    disabled={duplicateTargetDays.length === 0}
                                    style={{
                                        padding: '10px', borderRadius: '10px', background: duplicateTargetDays.length === 0 ? 'var(--widget-bg)' : 'var(--primary)',
                                        color: duplicateTargetDays.length === 0 ? 'var(--text-muted)' : 'var(--text-on-primary)',
                                        border: duplicateTargetDays.length === 0 ? '1px solid var(--border-premium)' : 'none',
                                        fontWeight: '700', fontSize: '13px', cursor: duplicateTargetDays.length === 0 ? 'default' : 'pointer',
                                    }}
                                >
                                    Copy to {duplicateTargetDays.length || 0} day{duplicateTargetDays.length === 1 ? '' : 's'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Start/End Time - compact 2-column grid on every viewport,
                    instead of each time picker stacking as its own
                    full-width row. */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '8px' : '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Start Time</label>
                        <div style={{ display: 'flex', gap: isMobile ? '4px' : '6px' }}>
                            <select aria-label="Start hour" value={startHour} onChange={(e) => setStartHour(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: isMobile ? '10px 2px' : '12px 4px', color: 'var(--text-primary)', fontSize: isMobile ? '12px' : '14px', outline: 'none', cursor: 'pointer' }}>
                                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((h) => (
                                    <option key={h} value={h} style={{ background: 'var(--surface-inset)' }}>{h}</option>
                                ))}
                            </select>
                            <select aria-label="Start minute" value={startMinute} onChange={(e) => setStartMinute(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: isMobile ? '10px 2px' : '12px 4px', color: 'var(--text-primary)', fontSize: isMobile ? '12px' : '14px', outline: 'none', cursor: 'pointer' }}>
                                {['00', '15', '30', '45'].map((m) => (
                                    <option key={m} value={m} style={{ background: 'var(--surface-inset)' }}>{m}</option>
                                ))}
                            </select>
                            <select aria-label="Start AM or PM" value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: isMobile ? '10px 2px' : '12px 4px', color: 'var(--text-primary)', fontSize: isMobile ? '12px' : '14px', outline: 'none', cursor: 'pointer' }}>
                                <option value="AM" style={{ background: 'var(--surface-inset)' }}>AM</option>
                                <option value="PM" style={{ background: 'var(--surface-inset)' }}>PM</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>End Time</label>
                        <div style={{ display: 'flex', gap: isMobile ? '4px' : '6px' }}>
                            <select aria-label="End hour" value={endHour} onChange={(e) => setEndHour(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: `1px solid ${timeError ? '#EF4444' : 'var(--border-premium)'}`, borderRadius: '10px', padding: isMobile ? '10px 2px' : '12px 4px', color: 'var(--text-primary)', fontSize: isMobile ? '12px' : '14px', outline: 'none', cursor: 'pointer' }}>
                                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((h) => (
                                    <option key={h} value={h} style={{ background: 'var(--surface-inset)' }}>{h}</option>
                                ))}
                            </select>
                            <select aria-label="End minute" value={endMinute} onChange={(e) => setEndMinute(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: `1px solid ${timeError ? '#EF4444' : 'var(--border-premium)'}`, borderRadius: '10px', padding: isMobile ? '10px 2px' : '12px 4px', color: 'var(--text-primary)', fontSize: isMobile ? '12px' : '14px', outline: 'none', cursor: 'pointer' }}>
                                {['00', '15', '30', '45'].map((m) => (
                                    <option key={m} value={m} style={{ background: 'var(--surface-inset)' }}>{m}</option>
                                ))}
                            </select>
                            <select aria-label="End AM or PM" value={endPeriod} onChange={(e) => setEndPeriod(e.target.value)} style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: `1px solid ${timeError ? '#EF4444' : 'var(--border-premium)'}`, borderRadius: '10px', padding: isMobile ? '10px 2px' : '12px 4px', color: 'var(--text-primary)', fontSize: isMobile ? '12px' : '14px', outline: 'none', cursor: 'pointer' }}>
                                <option value="AM" style={{ background: 'var(--surface-inset)' }}>AM</option>
                                <option value="PM" style={{ background: 'var(--surface-inset)' }}>PM</option>
                            </select>
                        </div>
                    </div>
                </div>
                {timeError && <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600', marginTop: '-8px' }}>{timeError}</span>}

                {/* Title + Category - sleek, glassmorphism-consistent inputs */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="timetableTaskTitle" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Task / Activity Title</label>
                        <input
                            id="timetableTaskTitle"
                            type="text"
                            placeholder="e.g. Java Programming Core Study"
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', padding: '13px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="timetableCategory" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Category</label>
                        <select
                            id="timetableCategory"
                            value={isCustomCategory ? '__custom__' : categoryInput}
                            onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                    setIsCustomCategory(true);
                                } else {
                                    setIsCustomCategory(false);
                                    setCategoryInput(e.target.value);
                                }
                            }}
                            style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', padding: '13px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                        >
                            <option value="Study" style={{background: 'var(--surface-inset)'}}>Study</option>
                            <option value="College" style={{background: 'var(--surface-inset)'}}>College</option>
                            <option value="Syllabus" style={{background: 'var(--surface-inset)'}}>Syllabus</option>
                            <option value="Planner" style={{background: 'var(--surface-inset)'}}>Planner</option>
                            <option value="Fitness" style={{background: 'var(--surface-inset)'}}>Fitness</option>
                            <option value="Gym" style={{background: 'var(--surface-inset)'}}>Gym</option>
                            <option value="Diet" style={{background: 'var(--surface-inset)'}}>Diet</option>
                            <option value="Finance" style={{background: 'var(--surface-inset)'}}>Finance</option>
                            <option value="Calendar" style={{background: 'var(--surface-inset)'}}>Calendar</option>
                            <option value="Analytics" style={{background: 'var(--surface-inset)'}}>Analytics</option>
                            <option value="AI" style={{background: 'var(--surface-inset)'}}>AI</option>
                            <option value="Development" style={{background: 'var(--surface-inset)'}}>Development</option>
                            <option value="Review" style={{background: 'var(--surface-inset)'}}>Review</option>
                            <option value="__custom__" style={{background: 'var(--surface-inset)'}}>+ Custom tag...</option>
                        </select>
                        {isCustomCategory && (
                            <input
                                type="text"
                                aria-label="Custom category tag"
                                autoFocus
                                placeholder="#Hackathon, #Trip, or any tag"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                            />
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                    <button
                        type="button"
                        onClick={closeAddModal}
                        style={{ padding: '12px 20px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '12px 24px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none',
                            borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer',
                        }}
                    >
                        {editingIndex !== null ? <><Save size={18} /> Save Changes</> : <><Plus size={18} /> Add Entry</>}
                    </button>
                </div>
            </form>
            </div>
            )}

            {/* Timetable Slots List - one continuous divided list instead of
                separately shadowed/rounded cards per entry, so consecutive
                slots read as a single elegant schedule with zero wasted
                spacing between them. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', paddingLeft: '4px', margin: 0 }}>
                        Schedule for {selectedDay} ({currentSchedule.length} {currentSchedule.length === 1 ? 'Entry' : 'Entries'})
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {currentSchedule.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setIsClearDayConfirmOpen(true)}
                                title={`Clear all of ${selectedDay}'s entries`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '9999px',
                                    background: 'var(--widget-bg)', color: '#EF4444', border: '1px solid var(--border-premium)',
                                    fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                            >
                                <Eraser size={13} /> {isMobile ? 'Clear' : 'Clear Day'}
                            </button>
                        )}
                        <button
                            type="button"
                            data-tour-id="dailytable-add"
                            onClick={openAddModal}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '9999px',
                                background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none',
                                fontWeight: '800', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                        >
                            <Plus size={14} /> New Entry
                        </button>
                    </div>
                </div>

                {currentSchedule.length > 0 ? (
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', boxShadow: 'var(--premium-shadow)', overflow: 'hidden' }}>
                        {currentSchedule.map((slot, index) => {
                            const accentColor = getCategoryColor(slot.category);
                            const isLast = index === currentSchedule.length - 1;
                            return (
                                <div key={index} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                    flexWrap: isMobile ? 'wrap' : 'nowrap',
                                    padding: isMobile ? '12px 14px' : '14px 20px',
                                    borderBottom: isLast ? 'none' : '1px solid var(--border-premium)',
                                    transition: 'opacity 0.2s ease', opacity: slot.completed ? 0.55 : 1,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto' }}>
                                        <button
                                            type="button"
                                            onClick={() => toggleSlotComplete(index)}
                                            title={slot.completed ? 'Mark as not done' : 'Mark as done'}
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, flexShrink: 0 }}
                                        >
                                            {slot.completed
                                                ? <CheckCircle size={20} color="var(--success)" />
                                                : <Circle size={20} color="var(--text-muted)" />}
                                        </button>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '10px', background: `${accentColor}22`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor, flexShrink: 0
                                        }}>
                                            {getCategoryIcon(slot.category)}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <span style={{ fontSize: '10px', fontWeight: '700', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {slot.category}
                                            </span>
                                            <h4 style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '700', color: 'var(--text-primary)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={slot.title}>
                                                {slot.title}
                                            </h4>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                                            background: 'var(--widget-bg)', border: '1px solid var(--border-premium)',
                                            borderRadius: '9999px', fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap',
                                        }}>
                                            <Clock size={13} color="var(--accent)" />
                                            {slot.time}
                                        </div>

                                        <button
                                            onClick={() => openEditModal(index)}
                                            title="Edit Entry"
                                            style={{
                                                background: 'transparent', border: 'none', borderRadius: '8px',
                                                padding: '6px', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.85,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s',
                                            }}
                                        >
                                            <Pencil size={16} />
                                        </button>

                                        <button
                                            onClick={() => handleDeleteSlot(index)}
                                            title="Delete Entry"
                                            style={{
                                                background: 'transparent', border: 'none', borderRadius: '8px',
                                                padding: '6px', color: '#EF4444', cursor: 'pointer', opacity: 0.85,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s',
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border-premium)', fontSize: '13px' }}>
                        No timetable entries added for {selectedDay} yet. Tap "New Entry" above to add your first one.
                    </div>
                )}
            </div>

            {/* Clear Day confirmation - a real, custom glass modal instead
                of a native window.confirm(), matching every other
                destructive confirmation in this app (Planner's own task
                delete, the AI page's Clear Chat). */}
            {isClearDayConfirmOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setIsClearDayConfirmOpen(false)}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '360px', boxShadow: 'var(--premium-shadow)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'center' }}
                    >
                        <div>
                            <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Clear {selectedDay}'s Schedule?</h3>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>This removes all {currentSchedule.length} {currentSchedule.length === 1 ? 'entry' : 'entries'} for {selectedDay}. This can't be undone.</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" onClick={() => setIsClearDayConfirmOpen(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleClearDay} style={{ flex: 1, padding: '12px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimetablePage;