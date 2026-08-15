// src/pages/StudyPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Award, CheckCircle, Circle, Trash2, Layers, Calendar, FileText, FileCode, HelpCircle, RefreshCw, Sparkles, Send, Clock, Download } from 'lucide-react';
import { useTaskRegistry } from '../context/TaskRegistryContext.jsx';
import { generateNexusAIResponse, hasKnownDomainMatch } from '../utils/nexusAIEngine.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { exportStudyReportCsv, exportStudyReportText } from '../utils/reportExport.js';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import GpaCalculator from '../components/GpaCalculator.jsx';

const SYLLABUS_STORAGE_KEY = 'nexus_syllabus_subjects';
const SYLLABUS_JUMP_KEY = 'nexus_syllabus_jump_target';

const SEMESTER_ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th' };

// A real SVG progress ring - standard stroke-dasharray/dashoffset
// technique, sized to sit cleanly inside a compact subject card without
// crowding the rest of its content.
const ProgressRing = ({ percent, size = 64 }) => {
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--widget-bg)" strokeWidth={strokeWidth} />
            <circle
                cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--success)" strokeWidth={strokeWidth}
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
            <text
                x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                transform={`rotate(90 ${size / 2} ${size / 2})`}
                style={{ fontSize: '13px', fontWeight: '800', fill: 'var(--text-primary)' }}
            >
                {percent}%
            </text>
        </svg>
    );
};

const StudyPage = ({ setActiveTab }) => {
    const isMobile = useIsMobile();
    // Subjects genuinely come from the Syllabus module now, not a separate,
    // static nexus_study_subjects list - StudyPage's own subject.progress/
    // completedUnits fields never actually updated after creation (the
    // exact same kind of dummy data as the "Exam Readiness" metric fixed
    // in Part 1A), so they could never honestly power a real-time
    // progress ring. Syllabus's own units[].topics[].done is the only
    // place in the app where real, live progress actually exists.
    const [subjects, setSubjects] = useState(() => {
        try { return JSON.parse(localStorage.getItem(SYLLABUS_STORAGE_KEY) || '[]'); } catch (e) { return []; }
    });

    // StudyPage only reads this data now (Syllabus owns it) - this
    // guarded listener is what keeps it live, matching the exact
    // established convention used everywhere else in this app for a
    // read-only consumer of another module's data (e.g. CalendarPage's
    // mirror of Timetable).
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latest = JSON.parse(localStorage.getItem(SYLLABUS_STORAGE_KEY) || '[]');
                setSubjects((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    const [assignments, setAssignments] = useState(() => {
        const saved = localStorage.getItem('nexus_study_assignments');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return []; // FIXED: Removed dummy data
    });

    const [notes, setNotes] = useState(() => {
        const saved = localStorage.getItem('nexus_study_notes');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return []; // FIXED: Removed dummy data
    });

    const [flashcards, setFlashcards] = useState(() => {
        const saved = localStorage.getItem('nexus_study_flashcards');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return []; // FIXED: Removed dummy data
    });

    // Real, cross-module data - matching the same, established pattern
    // AIPage.jsx already uses. Without this, a genuine cross-domain
    // question asked within the Study module (e.g. "how's my gym
    // consistency?") would incorrectly report "you haven't logged any
    // workouts" even for a user who genuinely has real gym data, since
    // the shared engine would only ever see empty defaults for anything
    // not explicitly passed in here.
    const [workouts] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_gym_history')) || []; } catch (e) { return []; } });
    const [rawFinanceProfile] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_finance_profile')) || { monthlyBudget: 0 }; } catch (e) { return { monthlyBudget: 0 }; } });
    const { settings: globalSettings } = useGlobalSettings();
    const financeProfile = useMemo(() => ({ ...rawFinanceProfile, monthlyBudget: globalSettings.monthlyBudgetCap }), [rawFinanceProfile, globalSettings.monthlyBudgetCap]);
    const [transactions] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_finance_transactions')) || []; } catch (e) { return []; } });
    const [financeAccounts] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_finance_accounts')) || []; } catch (e) { return []; } });
    const [dietProfile] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_diet_profile')) || { dailyCalories: 0 }; } catch (e) { return { dailyCalories: 0 }; } });
    const [dietDailyLog] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_diet_daily_log')) || { caloriesConsumed: 0 }; } catch (e) { return { caloriesConsumed: 0 }; } });
    const [plannerTasks] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_planner_tasks')) || []; } catch (e) { return []; } });
    const [calendarEvents] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_calendar_events')) || []; } catch (e) { return []; } });
    const [timetableData] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_timetable_data')) || {}; } catch (e) { return {}; } });

    // Active Tab state ('Subjects', 'Assignments', 'Notes', 'Flashcards')
    // Renamed from activeTab/setActiveTab (its original name) to avoid
    // colliding with the setActiveTab prop this component now also
    // receives - that prop navigates between different PAGES, this state
    // switches between tabs WITHIN this one page. Two genuinely different
    // things that happened to share a name.
    const [internalTab, setInternalTab] = useState('Subjects');
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [modalType, setModalType] = useState('subject');
    
    const [newAssignment, setNewAssignment] = useState({ title: '', subject: 'Python Programming', dueDate: '' });
    const [newNote, setNewNote] = useState({ title: '', subject: 'Python Programming', content: '' });
    const [newFlashcard, setNewFlashcard] = useState({ question: '', answer: '', subject: 'Python Programming' });

    useEffect(() => {
        localStorage.setItem('nexus_study_assignments', JSON.stringify(assignments));
        window.dispatchEvent(new Event('storage'));
    }, [assignments]);

    // header.jsx's Quick Add feature writes directly to this same
    // nexus_study_assignments key, bypassing this component's own state
    // entirely - without this listener, a quick-added assignment would
    // never actually appear here until a full remount, even though it's
    // genuinely saved. The equality guard prevents this component's own
    // write above (which also dispatches 'storage') from re-triggering
    // itself in a loop.
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_study_assignments') || '[]');
                setAssignments((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    useEffect(() => {
        localStorage.setItem('nexus_study_notes', JSON.stringify(notes));
    }, [notes]);

    useEffect(() => {
        localStorage.setItem('nexus_study_flashcards', JSON.stringify(flashcards));
    }, [flashcards]);

    // setActiveTab only accepts a bare tab name, with no way to pass which
    // specific subject to open - this localStorage-based "jump target"
    // signal is what lets Syllabus know to auto-select the right semester
    // and open that exact subject's checklist the instant it mounts,
    // matching the same convention already used elsewhere in this app for
    // small cross-component signals (e.g. nexus_syllabus_selected_semester).
    // Toggles a topic's completion directly from the Daily Study Queue,
    // without needing to navigate away to Syllabus first. StudyPage
    // doesn't own this data - Syllabus does - so this writes directly to
    // the real storage key and dispatches the same sync event every
    // source module in this app already uses, matching the exact
    // established pattern from CalendarPage.jsx's own cross-module
    // toggle. Also updates local state immediately so the queue reflects
    // the change instantly, rather than waiting on the dispatched event's
    // own round-trip back through this component's inbound listener.
    const [doubtPrompt, setDoubtPrompt] = useState('');
    const [doubtResponse, setDoubtResponse] = useState(null); // null | { text, offerSaveNote, sourcePrompt }

    // A real, honest response engine - not a simulated "AI" that fabricates
    // explanations. When the question is genuinely about the user's own
    // data (a real subject they have, or their real deadlines), it
    // computes and returns a real, accurate answer. For anything else, it
    // says so honestly rather than inventing a plausible-sounding
    // explanation this app has no real way to generate - the exact
    // mistake the fabricated "AI Academic Mentor" content (removed in
    // Part 1A) made.
    const generateDoubtResponse = (prompt) => {
        const lower = prompt.toLowerCase();

        const matchedSubject = subjects.find((s) => lower.includes(s.name.toLowerCase()));
        if (matchedSubject) {
            const allTopics = (matchedSubject.units || []).flatMap((u) => u.topics || []);
            const doneCount = allTopics.filter((t) => t.done).length;
            const totalTopics = allTopics.length;
            if (totalTopics === 0) {
                return { text: `You haven't added any units or topics for ${matchedSubject.name} yet - head to Syllabus to start tracking it.`, offerSaveNote: false };
            }
            const percent = Math.round((doneCount / totalTopics) * 100);
            const pendingCount = totalTopics - doneCount;
            return {
                text: `You're at ${percent}% on ${matchedSubject.name} (${doneCount}/${totalTopics} topics done). ${pendingCount > 0 ? `${pendingCount} topic${pendingCount === 1 ? '' : 's'} still pending.` : 'Every topic is complete - great work!'}`,
                offerSaveNote: false,
            };
        }

        if (lower.includes('due') || lower.includes('deadline') || lower.includes('assignment')) {
            const pending = [...assignments].filter((a) => a.status !== 'Completed').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            if (pending.length === 0) return { text: "You don't have any pending assignments right now - you're all caught up!", offerSaveNote: false };
            const next = pending[0];
            return {
                text: `Your next deadline is "${next.title}" (${next.subject}), due ${next.dueDate}.${pending.length > 1 ? ` ${pending.length - 1} more pending after that.` : ''}`,
                offerSaveNote: false,
            };
        }

        // Genuinely connects to the shared, unified AI engine for any
        // real cross-domain question (gym/finance/nutrition/schedule/
        // code) this box can now actually, accurately answer using the
        // real, cross-module data read in above - checked via
        // hasKnownDomainMatch first, so a genuinely unanswerable
        // question still gets this box's own, more honest, specific
        // fallback below, rather than the shared engine's vaguer,
        // generic one silently overriding it.
        if (hasKnownDomainMatch(lower)) {
            const aiContext = { subjects, studyAssignments: assignments, workouts, financeProfile, transactions, financeAccounts, dietProfile, dietDailyLog, plannerTasks, calendarEvents, timetableData };
            return { text: generateNexusAIResponse(prompt, aiContext), offerSaveNote: false };
        }

        return {
            text: "I can't generate a full explanation for that yet - this box can only answer real questions about your own subjects, deadlines, gym, finance, nutrition, schedule, or code right now. Want to save this question as a note to research later?",
            offerSaveNote: true,
        };
    };

    const handleDoubtSubmit = (e) => {
        e.preventDefault();
        if (!doubtPrompt.trim()) return;
        const result = generateDoubtResponse(doubtPrompt.trim());
        setDoubtResponse({ ...result, sourcePrompt: doubtPrompt.trim() });
    };

    // Genuinely creates a real note (same shape as the real Notes tab's
    // own creation flow) - only happens when the user actually clicks
    // this, never automatically, so the response text above is never
    // claiming something that hasn't actually happened yet.
    const handleSaveDoubtAsNote = () => {
        if (!doubtResponse) return;
        const noteItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            title: doubtResponse.sourcePrompt,
            subject: subjects[0]?.name || 'General',
            content: '',
            updatedAt: new Date().toISOString().split('T')[0],
        };
        setNotes([noteItem, ...notes]);
        setDoubtResponse(null);
        setDoubtPrompt('');
    };

    const toggleTopicFromQueue = (subjectId, unitId, topicId) => {
        setSubjects((prev) => {
            const next = prev.map((s) => (s.id !== subjectId ? s : {
                ...s,
                units: s.units.map((u) => (u.id !== unitId ? u : {
                    ...u,
                    topics: u.topics.map((t) => (t.id !== topicId ? t : { ...t, done: !t.done })),
                })),
            }));
            try {
                localStorage.setItem(SYLLABUS_STORAGE_KEY, JSON.stringify(next));
                window.dispatchEvent(new Event('storage'));
            } catch (e) { /* if persistence fails, the in-memory toggle still shows correctly this session */ }
            return next;
        });
    };

    const handleJumpToSyllabus = (subject) => {
        try {
            localStorage.setItem(SYLLABUS_JUMP_KEY, JSON.stringify({ subjectId: subject.id, semester: subject.semester }));
        } catch (e) { /* if this fails, Syllabus just opens normally without auto-selecting */ }
        if (typeof setActiveTab === 'function') setActiveTab('Syllabus');
    };

    const toggleFlip = (id) => {
        setFlashcards(flashcards.map(f => f.id === id ? { ...f, flipped: !f.flipped } : f));
    };

    // Handlers
    const handleAddAssignment = (e) => {
        e.preventDefault();
        if (!newAssignment.title.trim()) return;
        const assignmentItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            title: toTitleCase(newAssignment.title.trim()),
            subject: newAssignment.subject,
            dueDate: newAssignment.dueDate || new Date().toISOString().split('T')[0],
            status: 'Pending'
        };
        setAssignments([assignmentItem, ...assignments]);
        setIsAddModalOpen(false);
        setNewAssignment({ title: '', subject: 'Python Programming', dueDate: '' });
    };

    const handleAddNote = (e) => {
        e.preventDefault();
        if (!newNote.title.trim()) return;
        const noteItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            title: toTitleCase(newNote.title.trim()),
            subject: newNote.subject,
            content: newNote.content,
            updatedAt: new Date().toISOString().split('T')[0]
        };
        setNotes([noteItem, ...notes]);
        setIsAddModalOpen(false);
        setNewNote({ title: '', subject: 'Python Programming', content: '' });
    };

    const handleAddFlashcard = (e) => {
        e.preventDefault();
        if (!newFlashcard.question.trim() || !newFlashcard.answer.trim()) return;
        const flashcardItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            question: newFlashcard.question.trim(),
            answer: newFlashcard.answer.trim(),
            subject: newFlashcard.subject,
            flipped: false
        };
        setFlashcards([flashcardItem, ...flashcards]);
        setIsAddModalOpen(false);
        setNewFlashcard({ question: '', answer: '', subject: 'Python Programming' });
    };

    const toggleAssignmentStatus = (id) => {
        setAssignments(assignments.map(a => a.id === id ? { ...a, status: a.status === 'Completed' ? 'Pending' : 'Completed' } : a));
    };

    const deleteAssignment = (id) => setAssignments(assignments.filter(a => a.id !== id));
    const deleteNote = (id) => setNotes(notes.filter(n => n.id !== id));
    const deleteFlashcard = (id) => setFlashcards(flashcards.filter(f => f.id !== id));

    const totalCredits = subjects.reduce((acc, curr) => acc + curr.credits, 0);
    const pendingAssignments = assignments.filter((a) => a.status !== 'Completed').length;

    // Unified connection to the Timetable - reuses the exact same shared
    // TaskRegistry source HomePage's own dashboard timeline already
    // relies on, rather than a separate, duplicate localStorage read.
    // Filtered to today's real, Study-category entries specifically,
    // since this is the Study Command Center - an unrelated Gym/
    // Personal-category slot genuinely belongs on the dashboard timeline,
    // not here.
    const { bySource: registryBySource } = useTaskRegistry();
    const todayStudySessions = registryBySource.timetable.filter((e) => e.isToday && e.category === 'Study');

    // A flat, real list of every pending topic across every subject/unit -
    // this is the actual "Daily Study Queue": no manual searching through
    // subjects required, since it's already flattened and ready to work
    // through. Each entry carries the ids/names needed to both toggle it
    // in place and jump straight to its real source in Syllabus.
    const dailyQueue = subjects.flatMap((subject) =>
        (subject.units || []).flatMap((unit) =>
            (unit.topics || [])
                .filter((topic) => !topic.done)
                .map((topic) => ({
                    ...topic,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    unitId: unit.id,
                    unitName: unit.name,
                    subjectSemester: subject.semester,
                }))
        )
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Study Command Center</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Manage your semester curriculum, assignments, notes, and flashcards.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsExportMenuOpen((v) => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                        >
                            <Download size={18} /> Export Report
                        </button>
                        {isExportMenuOpen && (
                            <>
                                <div onClick={() => setIsExportMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1199 }} />
                                <div style={{
                                    /* Right-anchored (the desktop value) puts this
                                       230px-wide menu's LEFT edge off-screen on
                                       mobile, since the Export Report button it
                                       hangs off sits near the left edge of its own
                                       wrapped header row, not the right - measured
                                       spilling ~80px past the viewport's left edge.
                                       Left-anchoring on mobile keeps it fully
                                       on-screen instead, since there's plenty of
                                       room to the button's right. */
                                    position: 'absolute', top: 'calc(100% + 8px)', right: isMobile ? 'auto' : 0, left: isMobile ? 0 : 'auto', width: '230px', zIndex: 1200,
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '4px',
                                }}>
                                    <button
                                        onClick={() => { exportStudyReportText(subjects, assignments, timetableData); setIsExportMenuOpen(false); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                        <FileText size={15} color="var(--accent)" /> Monthly Summary (.txt)
                                    </button>
                                    <button
                                        onClick={() => { exportStudyReportCsv(subjects, timetableData); setIsExportMenuOpen(false); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                        <Download size={15} color="var(--accent)" /> Syllabus Progress (.csv)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button 
                        onClick={() => { 
                            if (internalTab === 'Subjects') { if (typeof setActiveTab === 'function') setActiveTab('Syllabus'); return; }
                            else if (internalTab === 'Assignments') setModalType('assignment');
                            else if (internalTab === 'Notes') setModalType('note');
                            else setModalType('flashcard');
                            setIsAddModalOpen(true); 
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                        >
                        <Plus size={18} /> {internalTab === 'Subjects' ? 'Add Subject in Syllabus' : internalTab === 'Assignments' ? 'Add Assignment' : internalTab === 'Notes' ? 'New Note' : 'New Flashcard'}
                    </button>
                </div>
            </div>

            {/* Quick Metrics Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)' }}><BookOpen size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Active Subjects</span>
                        <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)' }}>{subjects.length}</h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#10B981' }}><Award size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Total Credits</span>
                        <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)' }}>{totalCredits} Credits</h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#F59E0B' }}><FileText size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Pending Assignments</span>
                        <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)' }}>{pendingAssignments}</h2>
                    </div>
                </div>
            </div>

            {/* Today's Study Sessions - a real, live, read-only mirror of
                today's Study-category Timetable entries. Matches the
                app's established convention for a cross-module mirror
                (e.g. CalendarPage's own read-only Timetable mirror) -
                edit/delete controls stay in the Timetable itself, this
                view only ever reflects it. */}
            {todayStudySessions.length > 0 && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--premium-shadow)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Clock size={18} color="var(--accent)" />
                        <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Today's Study Sessions</h3>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', background: 'var(--surface-inset)', padding: '2px 10px', borderRadius: '20px' }}>
                            {todayStudySessions.length}
                        </span>
                        <span title="Synced from the Daily Timetable - edit or delete it there" style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', background: 'var(--surface-inset)', color: 'var(--text-muted)', borderRadius: '6px', border: '1px solid var(--border-premium)', marginLeft: 'auto' }}>
                            From Timetable
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {todayStudySessions.map((session) => (
                            <div key={session.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                                <BookOpen size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {session.title}
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>
                                        {session.raw?.time || 'Scheduled today'}
                                    </span>
                                </div>
                                {session.status === 'completed' && <CheckCircle size={16} color="var(--success)" style={{ flexShrink: 0 }} />}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Daily Study Queue - persistent across all 4 tabs, matching
                the same placement convention as the stat cards above, since
                Part 1A locked this module to exactly 4 tabs (no room for a
                5th "Queue" tab) but this needs to stay visible regardless
                of which tab is active. */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--premium-shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Layers size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Daily Study Queue</h3>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', background: 'var(--surface-inset)', padding: '2px 10px', borderRadius: '20px' }}>
                        {dailyQueue.length}
                    </span>
                </div>

                {dailyQueue.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 4px', color: 'var(--text-muted)' }}>
                        <CheckCircle size={18} color="var(--success)" />
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>
                            {subjects.length === 0 ? 'Add a subject in Syllabus to start building your queue.' : "You're all caught up - every tracked topic is complete!"}
                        </span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                        {dailyQueue.map((topic) => (
                            <div key={`${topic.subjectId}_${topic.unitId}_${topic.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => toggleTopicFromQueue(topic.subjectId, topic.unitId, topic.id)}
                                    title="Mark as done"
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: 0, color: 'var(--text-muted)' }}
                                >
                                    <Circle size={19} />
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {topic.name}
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>
                                        {topic.subjectName} · {topic.unitName}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleJumpToSyllabus({ id: topic.subjectId, semester: topic.subjectSemester })}
                                    title="Jump to Syllabus"
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0, color: 'var(--primary)' }}
                                >
                                    <FileText size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* AI Study Assistant / Quick Doubt Solver - persistent across
                all 4 tabs, same placement convention as the queue above. */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--premium-shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Quick Doubt Solver</h3>
                </div>

                <form onSubmit={handleDoubtSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text" value={doubtPrompt} onChange={(e) => setDoubtPrompt(e.target.value)}
                        placeholder="Ask about your progress, e.g. &quot;How am I doing in Data Structures?&quot; or &quot;What's due soon?&quot;"
                        style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                    />
                    <button
                        type="submit" disabled={!doubtPrompt.trim()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 16px', borderRadius: '12px', border: 'none', background: doubtPrompt.trim() ? 'var(--primary)' : 'var(--widget-bg)', color: doubtPrompt.trim() ? 'var(--text-on-primary)' : 'var(--text-muted)', fontWeight: '700', fontSize: '13px', cursor: doubtPrompt.trim() ? 'pointer' : 'default', fontFamily: 'inherit', flexShrink: 0 }}
                    >
                        <Send size={15} /> Ask
                    </button>
                </form>

                {doubtResponse && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                        <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0 }}>{doubtResponse.text}</p>
                        {doubtResponse.offerSaveNote && (
                            <button
                                type="button" onClick={handleSaveDoubtAsNote}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--primary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                <FileCode size={13} /> Save as Note
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px', overflowX: 'auto' }}>
                <button 
                    onClick={() => setInternalTab('Subjects')}
                    style={{ padding: '10px 16px', background: internalTab === 'Subjects' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Subjects' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Subjects' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
                >
                    Subjects Overview
                </button>
                <button 
                    onClick={() => setInternalTab('Assignments')}
                    style={{ padding: '10px 16px', background: internalTab === 'Assignments' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Assignments' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Assignments' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
                >
                    Assignments & Deadlines
                </button>
                <button 
                    onClick={() => setInternalTab('Notes')}
                    style={{ padding: '10px 16px', background: internalTab === 'Notes' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Notes' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Notes' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
                >
                    Notes & Knowledge Base
                </button>
                <button 
                    onClick={() => setInternalTab('Flashcards')}
                    style={{ padding: '10px 16px', background: internalTab === 'Flashcards' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Flashcards' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Flashcards' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
                >
                    Flashcards
                </button>
                <button 
                    onClick={() => setInternalTab('Calculator')}
                    style={{ padding: '10px 16px', background: internalTab === 'Calculator' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Calculator' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Calculator' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
                >
                    CGPA & Attendance
                </button>
            </div>

            {/* TAB CONTENT: SUBJECTS */}
            {internalTab === 'Subjects' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {subjects.length > 0 ? subjects.map(subject => {
                        const allTopics = (subject.units || []).flatMap((u) => u.topics || []);
                        const doneCount = allTopics.filter((t) => t.done).length;
                        const totalTopics = allTopics.length;
                        const percent = totalTopics === 0 ? 0 : Math.round((doneCount / totalTopics) * 100);
                        return (
                            <div key={subject.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>
                                            {SEMESTER_ORDINAL[subject.semester] || subject.semester} Semester
                                        </span>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subject.name}</h3>
                                    </div>
                                    <ProgressRing percent={percent} />
                                </div>

                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Award size={14} /> {subject.credits} Credits</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Layers size={14} /> {(subject.units || []).length} Units</span>
                                </div>

                                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                                    {totalTopics === 0 ? 'No topics tracked yet' : `${doneCount}/${totalTopics} topics covered`}
                                </span>

                                <button
                                    onClick={() => handleJumpToSyllabus(subject)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: 'var(--widget-bg)', color: 'var(--primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s ease' }}
                                >
                                    <FileText size={15} /> Jump to Syllabus
                                </button>
                            </div>
                        );
                    }) : (
                        <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                            <BookOpen size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>No subjects added yet!</h3>
                            <span style={{ fontSize: '13px' }}>Add a subject in Syllabus to see it tracked here.</span>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: ASSIGNMENTS */}
            {internalTab === 'Assignments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {assignments.length > 0 ? (
                        assignments.map(item => (
                            <div key={item.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: isMobile ? '14px 16px' : '16px 20px', borderRadius: '14px', border: '1px solid var(--border-premium)', opacity: item.status === 'Completed' ? 0.6 : 1, gap: isMobile ? '12px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div onClick={() => toggleAssignmentStatus(item.id)} style={{ cursor: 'pointer', color: item.status === 'Completed' ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {item.status === 'Completed' ? <CheckCircle size={22} /> : <Circle size={22} />}
                                    </div>
                                    <div>
                                        <span style={{ display: 'block', fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none', marginBottom: '4px' }}>{item.title}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={12} /> {item.subject}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#F59E0B' }}><Calendar size={12} /> Due: {item.dueDate}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => deleteAssignment(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                            <FileText size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>No assignments pending!</h3>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: NOTES */}
            {internalTab === 'Notes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {notes.length > 0 ? (
                        notes.map(note => (
                            <div key={note.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--premium-shadow)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>
                                            {note.subject}
                                        </span>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '8px', overflowWrap: 'break-word' }}>{note.title}</h3>
                                    </div>
                                    <button onClick={() => deleteNote(note.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16} /></button>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', background: 'var(--widget-bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)' }}>
                                    {note.content || 'No additional content provided.'}
                                </p>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated: {note.updatedAt}</span>
                            </div>
                        ))
                    ) : (
                        <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                            <FileCode size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>No study notes saved yet!</h3>
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: FLASHCARDS */}
            {internalTab === 'Flashcards' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                    {flashcards.length > 0 ? (
                        flashcards.map(card => (
                            <div 
                                key={card.id} 
                                onClick={() => toggleFlip(card.id)}
                                style={{ 
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', 
                                    borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', 
                                    justifyContent: 'space-between', minHeight: '200px', cursor: 'pointer', 
                                    boxShadow: 'var(--premium-shadow)', transition: 'all 0.2s ease', position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>
                                        {card.subject}
                                    </span>
                                    <button onClick={(e) => { e.stopPropagation(); deleteFlashcard(card.id); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                </div>

                                <div style={{ margin: '20px 0', textAlign: 'center' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                                        {card.flipped ? '💡 ANSWER' : '❓ QUESTION'}
                                    </span>
                                    <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                                        {card.flipped ? card.answer : card.question}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    <RefreshCw size={12} /> Click card to flip
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                            <HelpCircle size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>No flashcards created yet!</h3>
                        </div>
                    )}
                </div>
            )}

            {/* Universal Add Modal */}
            {isAddModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%', boxShadow: 'var(--premium-shadow)' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>
                            {modalType === 'assignment' ? 'Add New Assignment' : modalType === 'note' ? 'Create New Note' : 'Create New Flashcard'}
                        </h2>
                        
                        {modalType === 'assignment' ? (
                            <form onSubmit={handleAddAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Assignment Title</label>
                                    <input type="text" required autoFocus value={newAssignment.title} onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})} placeholder="e.g. Python Project Milestone 1" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Subject</label>
                                    <select value={newAssignment.subject} onChange={(e) => setNewAssignment({...newAssignment, subject: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        {subjects.length > 0 ? subjects.map(sub => <option key={sub.id} value={sub.name} style={{ background: 'var(--surface-inset)' }}>{sub.name}</option>) : <option value="General" style={{ background: 'var(--surface-inset)' }}>General</option>}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Due Date</label>
                                    <input type="date" value={newAssignment.dueDate} onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer', colorScheme: 'dark' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ flex: '1', padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                    <button type="submit" style={{ flex: '1', padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save Assignment</button>
                                </div>
                            </form>
                        ) : modalType === 'note' ? (
                            <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Note Title</label>
                                    <input type="text" required autoFocus value={newNote.title} onChange={(e) => setNewNote({...newNote, title: e.target.value})} placeholder="e.g. Binary Search Trees Summary" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Subject</label>
                                    <select value={newNote.subject} onChange={(e) => setNewNote({...newNote, subject: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        {subjects.length > 0 ? subjects.map(sub => <option key={sub.id} value={sub.name} style={{ background: 'var(--surface-inset)' }}>{sub.name}</option>) : <option value="General" style={{ background: 'var(--surface-inset)' }}>General</option>}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Note Content</label>
                                    <textarea rows="4" value={newNote.content} onChange={(e) => setNewNote({...newNote, content: e.target.value})} placeholder="Write your study notes or code logic here..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ flex: '1', padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                    <button type="submit" style={{ flex: '1', padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save Note</button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleAddFlashcard} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Subject</label>
                                    <select value={newFlashcard.subject} onChange={(e) => setNewFlashcard({...newFlashcard, subject: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        {subjects.length > 0 ? subjects.map(sub => <option key={sub.id} value={sub.name} style={{ background: 'var(--surface-inset)' }}>{sub.name}</option>) : <option value="General" style={{ background: 'var(--surface-inset)' }}>General</option>}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Question (Front)</label>
                                    <input type="text" required autoFocus value={newFlashcard.question} onChange={(e) => setNewFlashcard({...newFlashcard, question: e.target.value})} placeholder="e.g. What is a pointer in C?" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Answer (Back)</label>
                                    <textarea rows="3" required value={newFlashcard.answer} onChange={(e) => setNewFlashcard({...newFlashcard, answer: e.target.value})} placeholder="e.g. A variable that stores the memory address of another variable." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ flex: '1', padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                    <button type="submit" style={{ flex: '1', padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save Flashcard</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CGPA & ATTENDANCE CALCULATOR */}
            {internalTab === 'Calculator' && <GpaCalculator />}
        </div>
    );
};

export default StudyPage;