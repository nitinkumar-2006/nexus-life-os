// src/pages/TimetablePage.jsx
import { useState, useEffect, useRef } from 'react';
import { Clock, BookOpen, Dumbbell, Apple, Cpu, CheckCircle, Calendar, Plus, Trash2, DollarSign, Copy, X, Circle, GraduationCap, FileText, CheckSquare, Activity, BarChart3, Sparkles, RotateCcw } from 'lucide-react';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

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

const TimetablePage = () => {
    const isMobile = useIsMobile();
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

        const newSlot = {
            time: timeString,
            title: toTitleCase(titleInput.trim()),
            category: resolvedCategory,
            completed: false,
        };

        setTimetableData(prev => ({
            ...prev,
            [selectedDay]: [...(prev[selectedDay] || []), newSlot]
        }));

        setTitleInput('');
        setIsCustomCategory(false);
        setCustomCategory('');
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
            <div>
                <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Daily Timetable & Manual Planner</h1>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Add, manage, and customize your routine manually according to your needs.</p>
            </div>

            {/* Day Selector Tabs + Batch Duplicate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{
                    display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', flex: 1, minWidth: 0,
                    maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                    WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                }}>
                    {DAYS.map(day => (
                        <button
                            key={day}
                            onClick={() => { setSelectedDay(day); setIsDuplicateOpen(false); setDuplicateTargetDays([]); }}
                            style={{
                                padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '700',
                                cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap',
                                background: selectedDay === day ? 'var(--primary)' : 'var(--bg-surface)',
                                color: selectedDay === day ? 'var(--text-on-primary)' : 'var(--text-primary)',
                                border: '1px solid var(--border-premium)'
                            }}
                        >
                            {day}
                        </button>
                    ))}
                </div>

                <div ref={duplicateRef} style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                        type="button"
                        onClick={() => setIsDuplicateOpen((v) => !v)}
                        disabled={currentSchedule.length === 0}
                        title={currentSchedule.length === 0 ? `${selectedDay} has no entries to copy yet` : `Copy ${selectedDay}'s routine to other days`}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px',
                            background: 'var(--widget-bg)', color: currentSchedule.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                            border: '1px solid var(--border-premium)', fontWeight: '700', fontSize: '14px',
                            cursor: currentSchedule.length === 0 ? 'default' : 'pointer', opacity: currentSchedule.length === 0 ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <Copy size={16} /> Copy to Other Days
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

            {/* Manual Add Form */}
            <form onSubmit={handleAddSlot} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-premium)',
                borderRadius: '16px', padding: isMobile ? '16px' : '24px', display: 'flex', flexWrap: 'wrap', gap: '10px',
                alignItems: 'flex-end', boxShadow: 'var(--premium-shadow)'
            }}>
                <div style={{ flex: isMobile ? '1 1 100%' : '0 1 240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Start Time</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <select aria-label="Start hour" value={startHour} onChange={(e) => setStartHour(e.target.value)} style={{ flex: 1, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: isMobile ? '14px 6px' : '12px 4px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                            {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((h) => (
                                <option key={h} value={h} style={{ background: 'var(--surface-inset)' }}>{h}</option>
                            ))}
                        </select>
                        <select aria-label="Start minute" value={startMinute} onChange={(e) => setStartMinute(e.target.value)} style={{ flex: 1, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: isMobile ? '14px 6px' : '12px 4px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                            {['00', '15', '30', '45'].map((m) => (
                                <option key={m} value={m} style={{ background: 'var(--surface-inset)' }}>{m}</option>
                            ))}
                        </select>
                        <select aria-label="Start AM or PM" value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)} style={{ flex: 1, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: isMobile ? '14px 6px' : '12px 4px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                            <option value="AM" style={{ background: 'var(--surface-inset)' }}>AM</option>
                            <option value="PM" style={{ background: 'var(--surface-inset)' }}>PM</option>
                        </select>
                    </div>
                </div>

                <div style={{ flex: isMobile ? '1 1 100%' : '0 1 240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>End Time</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <select aria-label="End hour" value={endHour} onChange={(e) => setEndHour(e.target.value)} style={{ flex: 1, background: 'var(--widget-bg)', border: `1px solid ${timeError ? '#EF4444' : 'var(--border-premium)'}`, borderRadius: '10px', padding: isMobile ? '14px 6px' : '12px 4px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                            {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((h) => (
                                <option key={h} value={h} style={{ background: 'var(--surface-inset)' }}>{h}</option>
                            ))}
                        </select>
                        <select aria-label="End minute" value={endMinute} onChange={(e) => setEndMinute(e.target.value)} style={{ flex: 1, background: 'var(--widget-bg)', border: `1px solid ${timeError ? '#EF4444' : 'var(--border-premium)'}`, borderRadius: '10px', padding: isMobile ? '14px 6px' : '12px 4px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                            {['00', '15', '30', '45'].map((m) => (
                                <option key={m} value={m} style={{ background: 'var(--surface-inset)' }}>{m}</option>
                            ))}
                        </select>
                        <select aria-label="End AM or PM" value={endPeriod} onChange={(e) => setEndPeriod(e.target.value)} style={{ flex: 1, background: 'var(--widget-bg)', border: `1px solid ${timeError ? '#EF4444' : 'var(--border-premium)'}`, borderRadius: '10px', padding: isMobile ? '14px 6px' : '12px 4px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                            <option value="AM" style={{ background: 'var(--surface-inset)' }}>AM</option>
                            <option value="PM" style={{ background: 'var(--surface-inset)' }}>PM</option>
                        </select>
                    </div>
                    {timeError && <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600' }}>{timeError}</span>}
                </div>

                <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="timetableTaskTitle" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Task / Activity Title</label>
                    <input
                        id="timetableTaskTitle"
                        type="text"
                        placeholder="e.g. Java Programming Core Study"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                    />
                </div>

                <div style={{ flex: '0 1 180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                        style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: '12px 16px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
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

                <div style={{ display: 'flex' }}>
                    <button 
                        type="submit"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                            background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none',
                            borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                            transition: 'opacity 0.2s'
                        }}
                    >
                        <Plus size={18} /> Add Entry
                    </button>
                </div>
            </form>

            {/* Timetable Slots List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', paddingLeft: '4px' }}>
                    Schedule for {selectedDay} ({currentSchedule.length} Entries)
                </h3>

                {currentSchedule.length > 0 ? (
                    currentSchedule.map((slot, index) => {
                        const accentColor = getCategoryColor(slot.category);
                        return (
                            <div key={index} style={{
                                background: 'var(--bg-surface)', borderTop: '1px solid var(--border-premium)',
                                borderRight: '1px solid var(--border-premium)', borderBottom: '1px solid var(--border-premium)',
                                borderLeft: `3px solid ${accentColor}`,
                                borderRadius: '16px', padding: isMobile ? '16px' : '20px 28px', display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between',
                                alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '14px' : '0',
                                boxShadow: 'var(--premium-shadow)',
                                transition: 'all 0.3s ease', opacity: slot.completed ? 0.6 : 1,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <button
                                        type="button"
                                        onClick={() => toggleSlotComplete(index)}
                                        title={slot.completed ? 'Mark as not done' : 'Mark as done'}
                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, flexShrink: 0 }}
                                    >
                                        {slot.completed
                                            ? <CheckCircle size={22} color="var(--success)" />
                                            : <Circle size={22} color="var(--text-muted)" />}
                                    </button>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px', background: `${accentColor}22`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor, flexShrink: 0
                                    }}>
                                        {getCategoryIcon(slot.category)}
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: accentColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            {slot.category}
                                        </span>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px', textDecoration: 'none' }}>
                                            {slot.title}
                                        </h3>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '16px' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                                        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)',
                                        borderRadius: '12px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)'
                                    }}>
                                        <Clock size={15} color="var(--accent)" />
                                        {slot.time}
                                    </div>

                                    <button
                                        onClick={() => handleDeleteSlot(index)}
                                        title="Delete Entry"
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                                            borderRadius: '10px', padding: isMobile ? '14px' : '10px', color: '#EF4444', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s'
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border-premium)' }}>
                        No timetable entries added for {selectedDay} yet. Use the form above to add your tasks manually!
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimetablePage;