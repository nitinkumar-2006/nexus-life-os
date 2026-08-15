// src/pages/CalendarPage.jsx
import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, CheckCircle, Tag, MapPin, AlertCircle, Filter, Check, Trash2, ChevronRight, ChevronLeft, Sparkles, Bell, Cpu, ShieldCheck } from 'lucide-react';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

const CalendarPage = () => {
    const isMobile = useIsMobile();
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

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} style={{ padding: '5px' }}></div>);
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
                        height: '42px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: isSelected ? 'var(--primary)' : isToday ? 'var(--widget-bg)' : 'transparent',
                        color: isSelected ? 'var(--text-on-primary)' : isToday ? 'var(--primary)' : 'var(--text-primary)',
                        border: isToday && !isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                        borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative'
                    }}
                >
                    <span style={{ fontSize: '14px', fontWeight: isSelected || isToday ? '800' : '600' }}>{d}</span>
                    
                    {/* Compact Dots */}
                    <div style={{ display: 'flex', gap: '2px', position: 'absolute', bottom: '4px' }}>
                        {dayEvents.map((ev, idx) => (
                            <div key={idx} style={{ width: '4px', height: '4px', borderRadius: '50%', background: isSelected ? 'var(--surface-inset)' : getCategoryColor(ev.category) }}></div>
                        ))}
                    </div>
                </div>
            );
        }
        return days;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Master Schedule Hub</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Coordinate studies, workouts, reminders, and AI schedule intelligence.</p>
                </div>
                
                <button 
                    onClick={() => {
                        setNewEvent(prev => ({...prev, date: selectedDateStr}));
                        setIsAddModalOpen(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                >
                    <Plus size={18} /> Schedule Event
                </button>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)' }}><CalendarIcon size={24} /></div>
                    <div><span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Total Events</span><h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{totalCount} Scheduled</h2></div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#10B981' }}><CheckCircle size={24} /></div>
                    <div><span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Completion Rate</span><h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{completionRate}%</h2></div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#3B82F6' }}><Sparkles size={24} /></div>
                    <div><span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>AI Assistant</span><h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>Active</h2></div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px' }}>
                <button onClick={() => setActiveTab('Agenda')} style={{ padding: '10px 16px', background: activeTab === 'Agenda' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Agenda' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Agenda' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Agenda & Timeline</button>
                <button onClick={() => setActiveTab('AIAssistant')} style={{ padding: '10px 16px', background: activeTab === 'AIAssistant' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'AIAssistant' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'AIAssistant' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}><Cpu size={14} /> AI Schedule Assistant</button>
            </div>

            {/* TAB CONTENT: AGENDA & CALENDAR */}
            {activeTab === 'Agenda' && (
                // NEW: Side-by-Side Flex Layout
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    
                    {/* LEFT COLUMN: Compact Calendar Widget */}
                    <div style={{ flex: '1 1 320px', maxWidth: '380px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '20px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '4px' }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <span key={day} style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>{day}</span>
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                            {renderCalendarGrid()}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Timeline Details */}
                    <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Filters */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {['All', 'Study', 'Fitness', 'Finance'].map(cat => (
                                    <button key={cat} onClick={() => setSelectedCategoryFilter(cat)} style={{ padding: '6px 12px', background: selectedCategoryFilter === cat ? 'var(--primary)' : 'var(--widget-bg)', color: selectedCategoryFilter === cat ? 'var(--text-on-primary)' : 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>{cat}</button>
                                ))}
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input type="text" placeholder="Search events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: '200px' }} />
                            </div>
                        </div>

                        {/* List */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                        Schedule for {selectedDate.toLocaleString('default', { month: 'short', day: 'numeric' })}
                                    </h3>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>{filteredEvents.length} events found</span>
                                </div>
                                {/* NEW: Integrated Add Button for specific date */}
                                <button 
                                    onClick={() => { setNewEvent(prev => ({...prev, date: selectedDateStr})); setIsAddModalOpen(true); }}
                                    style={{ padding: '8px 14px', background: 'var(--widget-bg)', color: 'var(--primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                    <Plus size={14} /> Add Here
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {filteredEvents.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                        <CalendarIcon size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                                        <p style={{ fontSize: '14px' }}>No events scheduled for this day.</p>
                                    </div>
                                ) : (
                                    filteredEvents.map(ev => (
                                        <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: ev.completed ? 'rgba(16, 185, 129, 0.05)' : 'var(--widget-bg)', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--border-premium)', gap: '16px', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div onClick={() => (ev.fromTimetable ? toggleTimetableEventCompletion(ev) : toggleEventCompletion(ev.id))} style={{ cursor: 'pointer', color: ev.completed ? '#10B981' : 'var(--text-muted)' }}>
                                                    {ev.completed ? <CheckCircle size={24} /> : <div style={{ width: '24px', height: '24px', border: '2px solid var(--text-muted)', borderRadius: '50%' }}></div>}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', textDecoration: 'none', opacity: ev.completed ? 0.7 : 1 }}>{ev.title}</h4>
                                                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', background: 'var(--surface-inset)', color: getCategoryColor(ev.category), borderRadius: '6px', border: '1px solid var(--border-premium)' }}>{ev.category}</span>
                                                        {ev.fromTimetable && (
                                                            <span title="Synced from the Daily Timetable - edit or delete it there" style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', background: 'var(--surface-inset)', color: 'var(--text-muted)', borderRadius: '6px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <Clock size={10} /> From Timetable
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        <span>⏰ {ev.time}</span>{ev.location && <><span>•</span><span>📍 {ev.location}</span></>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: AI SCHEDULE ASSISTANT */}
            {activeTab === 'AIAssistant' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Sparkles size={22} />
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Schedule Briefing & Optimization</h3>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--widget-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            {events.length === 0
                                ? "Add some events to your calendar to receive AI-driven scheduling insights."
                                : scheduleConflicts.length > 0
                                    ? `Heads up - ${scheduleConflicts.length} real scheduling conflict${scheduleConflicts.length === 1 ? '' : 's'} detected: "${scheduleConflicts[0].a}" overlaps with "${scheduleConflicts[0].b}" on ${scheduleConflicts[0].date}. Consider rescheduling one of them.`
                                    : "Your schedule looks well-balanced! No time-overlap conflicts detected across your events. Ensure you leave adequate buffer time between tasks for hydration and rest."}
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700' }}>
                                <ShieldCheck size={18} color={scheduleConflicts.length > 0 ? '#EF4444' : '#10B981'} /> Schedule Conflict Status
                            </div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', color: scheduleConflicts.length > 0 ? '#EF4444' : '#10B981' }}>
                                {scheduleConflicts.length > 0 ? `${scheduleConflicts.length} Overlap${scheduleConflicts.length === 1 ? '' : 's'} Detected` : 'Zero Overlaps Detected'}
                            </h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {scheduleConflicts.length > 0 ? "Real time-window overlaps found between your events - see the briefing above." : "All events across modules are cleanly time-blocked."}
                            </span>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700' }}>
                                <Bell size={18} color="var(--primary)" /> High-Priority Events
                            </div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{highPriorityCount} Upcoming</h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{highPriorityCount > 0 ? "Marked High priority, not yet completed." : "No high-priority events pending right now."}</span>
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
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Event Title</label>
                                <input type="text" required autoFocus value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Machine Learning Revision" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Category</label>
                                    <select value={newEvent.category} onChange={(e) => setNewEvent({...newEvent, category: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        <option value="Study" style={{ background: 'var(--surface-inset)' }}>Study</option><option value="Fitness" style={{ background: 'var(--surface-inset)' }}>Fitness</option><option value="Nutrition" style={{ background: 'var(--surface-inset)' }}>Nutrition</option><option value="Productivity" style={{ background: 'var(--surface-inset)' }}>Productivity</option><option value="Finance" style={{ background: 'var(--surface-inset)' }}>Finance</option><option value="Personal" style={{ background: 'var(--surface-inset)' }}>Personal</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Priority</label>
                                    <select value={newEvent.priority} onChange={(e) => setNewEvent({...newEvent, priority: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        <option value="High" style={{ background: 'var(--surface-inset)' }}>High</option><option value="Medium" style={{ background: 'var(--surface-inset)' }}>Medium</option><option value="Low" style={{ background: 'var(--surface-inset)' }}>Low</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Date</label>
                                    <input type="date" required value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', colorScheme: 'dark' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Time Slot</label>
                                    <input type="text" required value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} placeholder="04:00 PM" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Location / Venue</label>
                                <input type="text" value={newEvent.location} onChange={(e) => setNewEvent({...newEvent, location: e.target.value})} placeholder="e.g. College Lab 2" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarPage;