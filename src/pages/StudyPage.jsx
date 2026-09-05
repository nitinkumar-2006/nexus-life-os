// src/pages/StudyPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Award, CheckCircle, Circle, Trash2, Pencil, Layers, Calendar, FileText, FileCode, HelpCircle, RefreshCw, Sparkles, Send, Clock, Download, Loader2, AlertTriangle, X, ChevronRight, Wand2 } from 'lucide-react';
import { useTaskRegistry } from '../context/TaskRegistryContext.jsx';
import { generateNexusAIResponse, hasKnownDomainMatch } from '../utils/nexusAIEngine.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { exportStudyReportCsv, exportStudyReportText } from '../utils/reportExport.js';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import GpaCalculator from '../components/GpaCalculator.jsx';
import { getLocalDateString } from '../utils/dateUtils.js';
import { generateStructuredJSON, readAiProviderSettings } from '../utils/aiProviderRouter.js';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';

const SYLLABUS_STORAGE_KEY = 'nexus_syllabus_subjects';
const SYLLABUS_JUMP_KEY = 'nexus_syllabus_jump_target';

const SEMESTER_ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th' };

// Same tolerant JSON parse every AI-structured-output consumer in this
// app uses (syllabusExtraction.js's own parseAndValidate): a provider
// occasionally wraps its JSON in a ```json fence despite being asked not
// to - one real, bounded fallback attempt to strip that before giving up.
const parseJsonArrayLoose = (rawText) => {
    try {
        return JSON.parse(rawText);
    } catch (e) {
        const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenced) {
            try { return JSON.parse(fenced[1]); } catch (e2) { return null; }
        }
        return null;
    }
};

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

// Shared subject-picker + "Generate with AI" bar - the exact same shape
// used by both the Flashcards tab and the Quizzes tab (pick a real
// subject, generate from its real tracked topics), so this one small
// component covers both instead of duplicating the picker/button/error
// markup twice.
const AiGenerateBar = ({ subjects, subjectValue, onSubjectChange, onGenerate, isGenerating, error, label, disabled }) => (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '14px 16px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px' }}>
        <Sparkles size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
        <select
            value={subjectValue} onChange={(e) => onSubjectChange(e.target.value)}
            aria-label="Subject to generate for" disabled={subjects.length === 0}
            style={{ padding: '8px 12px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600', outline: 'none' }}
        >
            {subjects.length === 0 && <option value="">No subjects yet</option>}
            {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <button
            type="button" onClick={onGenerate} disabled={disabled || isGenerating || !subjectValue}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '9999px', border: 'none', background: (disabled || isGenerating || !subjectValue) ? 'var(--surface-inset)' : 'var(--primary)', color: (disabled || isGenerating || !subjectValue) ? 'var(--text-muted)' : 'var(--text-on-primary)', fontWeight: '700', fontSize: '12px', cursor: (disabled || isGenerating || !subjectValue) ? 'default' : 'pointer', fontFamily: 'inherit' }}
        >
            {isGenerating ? <Loader2 size={14} style={{ animation: 'nexusStudySpin 0.8s linear infinite' }} /> : <Wand2 size={14} />}
            {isGenerating ? 'Generating…' : label}
        </button>
        {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', fontSize: '12px', color: '#EF4444' }}>
                <AlertTriangle size={12} /> {error}
            </div>
        )}
    </div>
);

const StudyPage = ({ setActiveTab }) => {
    const isMobile = useIsMobile();
    // Mobile-only, real-first-visit-only tour - same pattern as every
    // other page's tour (see FinancePage.jsx/CalendarPage.jsx).
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('study'));
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

    // Defaults to the user's own first real subject (falling back to
    // 'General', matching the dropdown's own no-subjects fallback option
    // below) rather than a hardcoded literal subject name - a fixed
    // string here would silently save a phantom subject that doesn't
    // exist in Syllabus for virtually every real user, since it was left
    // out of sync with the dropdown's actual option list.
    const defaultStudySubject = () => subjects[0]?.name || 'General';
    const [newAssignment, setNewAssignment] = useState({ title: '', subject: defaultStudySubject(), dueDate: '' });
    const [newNote, setNewNote] = useState({ title: '', subject: defaultStudySubject(), content: '' });
    const [newFlashcard, setNewFlashcard] = useState({ question: '', answer: '', subject: defaultStudySubject() });

    // null while the Universal Add Modal is adding a fresh item of that
    // type; holds the item's own real id while editing an existing one -
    // one flag per entity type since the three forms are independent even
    // though they share the same modal open/close state, matching the
    // pattern already established in TimetablePage.jsx's own
    // editingIndex.
    const [editingAssignmentId, setEditingAssignmentId] = useState(null);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingFlashcardId, setEditingFlashcardId] = useState(null);

    // --- AI generation state (Study Queue prioritization, Flashcards, Quizzes) ---
    // Live AI-key settings, same reactive read every other AI-integrated
    // page in this app uses (see aiProviderRouter.js's own header comment
    // for why this exact field set is now shared rather than duplicated).
    const [aiSettings, setAiSettings] = useState(readAiProviderSettings);
    useEffect(() => {
        const sync = () => setAiSettings(readAiProviderSettings());
        window.addEventListener('nexus_settings_updated', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('nexus_settings_updated', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    // AI-prioritized Daily Study Queue order - cached by date so it's a
    // real, explicit "Prioritize" action (not an automatic call on every
    // visit that would burn API quota for no reason). A stale cache from
    // a previous day is simply ignored (see orderedDailyQueue below), not
    // deleted - so yesterday's order is still there if the user reopens
    // this within the same day after a reload.
    const [aiQueueOrder, setAiQueueOrder] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_study_ai_queue') || 'null'); } catch (e) { return null; }
    });
    const [isPrioritizing, setIsPrioritizing] = useState(false);
    const [prioritizeError, setPrioritizeError] = useState('');

    const [quizzes, setQuizzes] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_study_quizzes') || '[]'); } catch (e) { return []; }
    });
    useEffect(() => { localStorage.setItem('nexus_study_quizzes', JSON.stringify(quizzes)); }, [quizzes]);

    const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
    const [flashcardGenError, setFlashcardGenError] = useState('');
    const [flashcardGenSubject, setFlashcardGenSubject] = useState('');

    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [quizGenError, setQuizGenError] = useState('');
    const [quizGenSubject, setQuizGenSubject] = useState('');

    // Taking a quiz - null when no quiz is currently open. answers[i] is
    // the selected option index for question i (or null if unanswered
    // yet); score is only set once every question has been answered.
    const [activeQuiz, setActiveQuiz] = useState(null);
    const [quizAnswers, setQuizAnswers] = useState([]);
    const [quizStep, setQuizStep] = useState(0);

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
            updatedAt: getLocalDateString(),
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

    // Handlers - each branches on its own editingXId: set means update that
    // real item in place (preserving fields the form doesn't touch, e.g.
    // status/flipped), null means append a brand-new item exactly as
    // before.
    const handleAddAssignment = (e) => {
        e.preventDefault();
        if (!newAssignment.title.trim()) return;
        if (editingAssignmentId !== null) {
            setAssignments(assignments.map(a => a.id === editingAssignmentId ? {
                ...a,
                title: toTitleCase(newAssignment.title.trim()),
                subject: newAssignment.subject,
                dueDate: newAssignment.dueDate || getLocalDateString(),
            } : a));
        } else {
            const assignmentItem = {
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                title: toTitleCase(newAssignment.title.trim()),
                subject: newAssignment.subject,
                dueDate: newAssignment.dueDate || getLocalDateString(),
                status: 'Pending'
            };
            setAssignments([assignmentItem, ...assignments]);
        }
        setIsAddModalOpen(false);
        setEditingAssignmentId(null);
        setNewAssignment({ title: '', subject: defaultStudySubject(), dueDate: '' });
    };

    const handleAddNote = (e) => {
        e.preventDefault();
        if (!newNote.title.trim()) return;
        if (editingNoteId !== null) {
            setNotes(notes.map(n => n.id === editingNoteId ? {
                ...n,
                title: toTitleCase(newNote.title.trim()),
                subject: newNote.subject,
                content: newNote.content,
                updatedAt: getLocalDateString(),
            } : n));
        } else {
            const noteItem = {
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                title: toTitleCase(newNote.title.trim()),
                subject: newNote.subject,
                content: newNote.content,
                updatedAt: getLocalDateString()
            };
            setNotes([noteItem, ...notes]);
        }
        setIsAddModalOpen(false);
        setEditingNoteId(null);
        setNewNote({ title: '', subject: defaultStudySubject(), content: '' });
    };

    const handleAddFlashcard = (e) => {
        e.preventDefault();
        if (!newFlashcard.question.trim() || !newFlashcard.answer.trim()) return;
        if (editingFlashcardId !== null) {
            setFlashcards(flashcards.map(f => f.id === editingFlashcardId ? {
                ...f,
                question: newFlashcard.question.trim(),
                answer: newFlashcard.answer.trim(),
                subject: newFlashcard.subject,
            } : f));
        } else {
            const flashcardItem = {
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                question: newFlashcard.question.trim(),
                answer: newFlashcard.answer.trim(),
                subject: newFlashcard.subject,
                flipped: false
            };
            setFlashcards([flashcardItem, ...flashcards]);
        }
        setIsAddModalOpen(false);
        setEditingFlashcardId(null);
        setNewFlashcard({ question: '', answer: '', subject: defaultStudySubject() });
    };

    // Opens the Universal Add Modal fresh for a brand-new item of that
    // type - resets its form to defaults and clears that type's editing id
    // so a previous Add or a cancelled Edit never leaves stale values
    // behind for the next click.
    const openAddAssignmentModal = () => {
        setEditingAssignmentId(null);
        setNewAssignment({ title: '', subject: defaultStudySubject(), dueDate: '' });
        setModalType('assignment');
        setIsAddModalOpen(true);
    };

    const openEditAssignmentModal = (item) => {
        setEditingAssignmentId(item.id);
        setNewAssignment({ title: item.title, subject: item.subject, dueDate: item.dueDate });
        setModalType('assignment');
        setIsAddModalOpen(true);
    };

    const openAddNoteModal = () => {
        setEditingNoteId(null);
        setNewNote({ title: '', subject: defaultStudySubject(), content: '' });
        setModalType('note');
        setIsAddModalOpen(true);
    };

    const openEditNoteModal = (note) => {
        setEditingNoteId(note.id);
        setNewNote({ title: note.title, subject: note.subject, content: note.content || '' });
        setModalType('note');
        setIsAddModalOpen(true);
    };

    const openAddFlashcardModal = () => {
        setEditingFlashcardId(null);
        setNewFlashcard({ question: '', answer: '', subject: defaultStudySubject() });
        setModalType('flashcard');
        setIsAddModalOpen(true);
    };

    const openEditFlashcardModal = (card) => {
        setEditingFlashcardId(card.id);
        setNewFlashcard({ question: card.question, answer: card.answer, subject: card.subject });
        setModalType('flashcard');
        setIsAddModalOpen(true);
    };

    // Used by every Cancel button in the Universal Add Modal - clears all
    // three editing ids unconditionally (only one form is ever visible at
    // a time based on modalType, so this is simpler than three separate
    // close handlers) so a cancelled edit never leaves stale state behind.
    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setEditingAssignmentId(null);
        setEditingNoteId(null);
        setEditingFlashcardId(null);
    };

    const toggleAssignmentStatus = (id) => {
        setAssignments(assignments.map(a => a.id === id ? { ...a, status: a.status === 'Completed' ? 'Pending' : 'Completed' } : a));
    };

    const deleteAssignment = (id) => setAssignments(assignments.filter(a => a.id !== id));
    const deleteNote = (id) => setNotes(notes.filter(n => n.id !== id));
    const deleteFlashcard = (id) => setFlashcards(flashcards.filter(f => f.id !== id));

    // --- AI Flashcard generation - real topics from Syllabus in, real Q/A
    // pairs out, appended into the exact same flashcards store/shape the
    // manual "New Flashcard" form already uses (zero new display code -
    // they just show up in the existing Flashcards tab). ---
    const generateFlashcardsForSubject = async (subjectName) => {
        const subject = subjects.find((s) => s.name === subjectName);
        const topicNames = (subject?.units || []).flatMap((u) => (u.topics || []).map((t) => t.name));
        if (topicNames.length === 0) {
            setFlashcardGenError('This subject has no tracked topics yet - add some in Syllabus first.');
            return;
        }
        setIsGeneratingFlashcards(true);
        setFlashcardGenError('');
        try {
            const promptText = `You are a study assistant. Create flashcards for a student studying "${subjectName}", covering these real topics:\n${topicNames.map((t) => `- ${t}`).join('\n')}\n\nReturn ONLY a JSON array, no other text, of 5-8 flashcards, one per real topic where possible, matching exactly this shape:\n[{"question": "<a real, specific question testing understanding of one topic>", "answer": "<a real, concise, correct answer>"}, ...]\n\nNever invent a topic that isn't in the list above.`;
            const raw = await generateStructuredJSON({ settings: aiSettings, promptText });
            const parsed = parseJsonArrayLoose(raw);
            if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('The AI did not return any flashcards.');
            const now = Date.now();
            const newCards = parsed
                .filter((c) => c && typeof c.question === 'string' && c.question.trim() && typeof c.answer === 'string' && c.answer.trim())
                .map((c, idx) => ({ id: `${now}_${idx}`, question: c.question.trim(), answer: c.answer.trim(), subject: subjectName }));
            if (newCards.length === 0) throw new Error('The AI did not return any readable flashcards.');
            setFlashcards((prev) => [...newCards, ...prev]);
        } catch (e) {
            setFlashcardGenError(e.message || 'Could not generate flashcards right now.');
        } finally {
            setIsGeneratingFlashcards(false);
        }
    };

    // --- AI Quiz generation - same real-topics-in pattern, a lean
    // multiple-choice quiz out. No existing quiz store to reuse (this is
    // a genuinely new, deliberately minimal feature - generate, take,
    // score; no editing or per-question history beyond that). ---
    const generateQuizForSubject = async (subjectName) => {
        const subject = subjects.find((s) => s.name === subjectName);
        const topicNames = (subject?.units || []).flatMap((u) => (u.topics || []).map((t) => t.name));
        if (topicNames.length === 0) {
            setQuizGenError('This subject has no tracked topics yet - add some in Syllabus first.');
            return;
        }
        setIsGeneratingQuiz(true);
        setQuizGenError('');
        try {
            const promptText = `You are a study assistant. Create a multiple-choice practice quiz for a student studying "${subjectName}", covering these real topics:\n${topicNames.map((t) => `- ${t}`).join('\n')}\n\nReturn ONLY a JSON array, no other text, of exactly 5 questions matching this shape:\n[{"question": "<a real, specific question>", "options": ["<option A>", "<option B>", "<option C>", "<option D>"], "correctIndex": <0-3, the index of the correct option>}, ...]\n\nNever invent a topic that isn't in the list above. Exactly 4 options per question, exactly one correct.`;
            const raw = await generateStructuredJSON({ settings: aiSettings, promptText });
            const parsed = parseJsonArrayLoose(raw);
            if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('The AI did not return a readable quiz.');
            const questions = parsed
                .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4)
                .map((q) => ({ question: q.question.trim(), options: q.options.map((o) => String(o)), correctIndex: q.correctIndex }));
            if (questions.length === 0) throw new Error('The AI did not return any valid questions.');
            const quiz = { id: Date.now().toString(), subject: subjectName, createdAt: getLocalDateString(), questions };
            setQuizzes((prev) => [quiz, ...prev]);
        } catch (e) {
            setQuizGenError(e.message || 'Could not generate a quiz right now.');
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const deleteQuiz = (id) => setQuizzes((prev) => prev.filter((q) => q.id !== id));

    const startQuiz = (quiz) => {
        setActiveQuiz(quiz);
        setQuizAnswers(new Array(quiz.questions.length).fill(null));
        setQuizStep(0);
    };
    const answerQuizQuestion = (optionIndex) => setQuizAnswers((prev) => prev.map((a, idx) => (idx === quizStep ? optionIndex : a)));
    const closeQuiz = () => { setActiveQuiz(null); setQuizAnswers([]); setQuizStep(0); };
    const quizScore = activeQuiz ? quizAnswers.filter((a, idx) => a === activeQuiz.questions[idx].correctIndex).length : 0;
    const quizAllAnswered = activeQuiz ? quizAnswers.every((a) => a !== null) : false;

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

    const todayStr = getLocalDateString();

    // Re-sorts the exact same dailyQueue above by an AI-computed priority
    // order when one exists AND is genuinely from today (a cached order
    // from a previous day is stale - exam proximity/pending work has
    // moved on, so it's ignored here rather than deleted outright, in
    // case the user reopens this later the same day after a reload).
    // Falls back to dailyQueue's own natural order when no fresh AI order
    // exists yet, or for any topic the AI's response didn't cover.
    const orderedDailyQueue = useMemo(() => {
        if (!aiQueueOrder || aiQueueOrder.generatedAt !== todayStr || !Array.isArray(aiQueueOrder.order)) return dailyQueue;
        const keyOf = (t) => `${t.subjectId}::${t.unitId}::${t.id}`;
        const rank = new Map(aiQueueOrder.order.map((key, idx) => [key, idx]));
        return [...dailyQueue].sort((a, b) => {
            const ra = rank.has(keyOf(a)) ? rank.get(keyOf(a)) : Infinity;
            const rb = rank.has(keyOf(b)) ? rank.get(keyOf(b)) : Infinity;
            return ra - rb;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dailyQueue, aiQueueOrder]);

    const isQueueAiPrioritized = !!aiQueueOrder && aiQueueOrder.generatedAt === todayStr;

    // Weighs the exact same pending topics (dailyQueue) against real exam
    // deadlines (assignments with type === 'Exam', from either manual
    // entry or syllabus-import extraction) - explicit action only, never
    // automatic on page load, so this never burns API quota just for
    // visiting the page.
    const handlePrioritizeQueue = async () => {
        if (dailyQueue.length === 0) return;
        setIsPrioritizing(true);
        setPrioritizeError('');
        try {
            const examDeadlines = assignments.filter((a) => a.type === 'Exam' && a.status !== 'Completed');
            const promptText = `You are a study planner. Given a student's pending topics and upcoming exam dates, return a prioritized daily study order (topics for subjects with a nearer exam should generally come first).\n\nPending topics (key | subject | topic):\n${dailyQueue.map((t) => `${t.subjectId}::${t.unitId}::${t.id} | ${t.subjectName} | ${t.name}`).join('\n')}\n\nUpcoming exams:\n${examDeadlines.length > 0 ? examDeadlines.map((a) => `${a.subject} - ${a.title} - ${a.dueDate}`).join('\n') : 'None known.'}\n\nToday's date: ${todayStr}\n\nReturn ONLY a JSON array, no other text, ordering ALL of the topic keys above from HIGHEST to LOWEST priority. Use each topic's exact key as given. Include every key exactly once. Shape: ["<key1>", "<key2>", ...]`;
            const raw = await generateStructuredJSON({ settings: aiSettings, promptText });
            const order = parseJsonArrayLoose(raw);
            if (!Array.isArray(order) || order.length === 0) throw new Error('The AI did not return a readable priority order.');
            const stored = { generatedAt: todayStr, order };
            localStorage.setItem('nexus_study_ai_queue', JSON.stringify(stored));
            setAiQueueOrder(stored);
        } catch (e) {
            setPrioritizeError(e.message || 'Could not prioritize the queue right now.');
        } finally {
            setIsPrioritizing(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            {showTour && <TourGuide tourId="study" steps={TOUR_STEPS.study} onFinish={() => setShowTour(false)} />}

            {/* Header Section - title and every action button share one
                row even on mobile (buttons drop to icon-only there)
                instead of the button group wrapping onto its own row
                below the title - the same real fix already applied to
                Finance Hub's header, mirrored here. */}
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: isMobile ? '8px' : '16px' }}>
                <h1 style={{ fontSize: isMobile ? '19px' : '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>Study Hub</h1>

                <div style={{ display: 'flex', gap: isMobile ? '6px' : '10px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                            title="Export Report"
                            onClick={() => setIsExportMenuOpen((v) => !v)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: isMobile ? '10px' : '10px 20px', boxSizing: 'border-box', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            <Download size={isMobile ? 16 : 18} /> {!isMobile && 'Export Report'}
                        </button>
                        {isExportMenuOpen && (
                            <>
                                <div onClick={() => setIsExportMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1199 }} />
                                <div style={{
                                    /* Right-anchored on every viewport now - the
                                       Export button always sits in the header's
                                       right-side action cluster (icon-only on
                                       mobile, same as desktop's own position
                                       relative to the screen edge), so a single
                                       anchor works everywhere; a mobile-only
                                       left:0 override used to be needed here
                                       back when this button sat near the LEFT
                                       edge of its own wrapped-onto-its-own-row
                                       header on narrow screens - that row no
                                       longer exists. */
                                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '230px', zIndex: 1200,
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

                    {internalTab !== 'Quizzes' && internalTab !== 'Calculator' && (
                        <button
                            data-tour-id="study-new"
                            title={internalTab === 'Subjects' ? 'Add Subject in Syllabus' : internalTab === 'Assignments' ? 'Add Assignment' : internalTab === 'Notes' ? 'New Note' : 'New Flashcard'}
                            onClick={() => {
                                if (internalTab === 'Subjects') { if (typeof setActiveTab === 'function') setActiveTab('Syllabus'); return; }
                                else if (internalTab === 'Assignments') openAddAssignmentModal();
                                else if (internalTab === 'Notes') openAddNoteModal();
                                else openAddFlashcardModal();
                                }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: isMobile ? '10px' : '10px 20px', flexShrink: 0, boxSizing: 'border-box', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                            <Plus size={isMobile ? 16 : 18} style={{ flexShrink: 0 }} />
                            {!isMobile && (internalTab === 'Subjects' ? 'Add Subject in Syllabus' : internalTab === 'Assignments' ? 'Add Assignment' : internalTab === 'Notes' ? 'New Note' : 'New Flashcard')}
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Metrics Overview Cards - a compact 2-column grid on
                mobile (instead of each card stacking full-width) so all
                four stats are glanceable without extra scrolling. Daily
                Study Queue's count joins the other three here as a real
                stat card; the actual interactive queue list further down
                is unchanged and still owns all the real toggle/jump
                functionality - this is just its at-a-glance count. */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? '10px' : '16px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '14px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '9px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)', flexShrink: 0, display: 'flex' }}><BookOpen size={isMobile ? 18 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Active Subjects</span>
                        <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{subjects.length}</h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '14px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '9px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#10B981', flexShrink: 0, display: 'flex' }}><Award size={isMobile ? 18 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Total Credits</span>
                        <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{totalCredits}{isMobile ? '' : ' Credits'}</h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '14px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '9px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#F59E0B', flexShrink: 0, display: 'flex' }}><FileText size={isMobile ? 18 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Pending Assignments</span>
                        <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{pendingAssignments}</h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '14px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '9px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--accent)', flexShrink: 0, display: 'flex' }}><Layers size={isMobile ? 18 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Daily Study Queue</span>
                        <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{dailyQueue.length}</h2>
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
            <div data-tour-id="study-queue" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--premium-shadow)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <Layers size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Daily Study Queue</h3>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', background: 'var(--surface-inset)', padding: '2px 10px', borderRadius: '20px' }}>
                        {dailyQueue.length}
                    </span>
                    {isQueueAiPrioritized && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', background: 'rgba(var(--primary-rgb), 0.12)', padding: '2px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Sparkles size={10} /> AI-prioritized
                        </span>
                    )}
                    {dailyQueue.length > 0 && (
                        <button
                            type="button" onClick={handlePrioritizeQueue} disabled={isPrioritizing}
                            title="Reorder using upcoming exam dates"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', padding: '6px 12px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--accent)', fontWeight: '700', fontSize: '11px', cursor: isPrioritizing ? 'default' : 'pointer', fontFamily: 'inherit', opacity: isPrioritizing ? 0.6 : 1 }}
                        >
                            {isPrioritizing ? <Loader2 size={12} style={{ animation: 'nexusStudySpin 0.8s linear infinite' }} /> : <Wand2 size={12} />}
                            {isPrioritizing ? 'Prioritizing…' : isQueueAiPrioritized ? 'Re-prioritize' : 'AI Prioritize'}
                        </button>
                    )}
                    <style>{'@keyframes nexusStudySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
                </div>

                {prioritizeError && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px' }}>
                        <AlertTriangle size={13} color="#EF4444" style={{ flexShrink: 0, marginTop: '1px' }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{prioritizeError}</span>
                    </div>
                )}

                {dailyQueue.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 4px', color: 'var(--text-muted)' }}>
                        <CheckCircle size={18} color="var(--success)" />
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>
                            {subjects.length === 0 ? 'Add a subject in Syllabus to start building your queue.' : "You're all caught up - every tracked topic is complete!"}
                        </span>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                        {orderedDailyQueue.map((topic) => (
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
                all 4 tabs, same placement convention as the queue above.
                Given an explicitly glassmorphic treatment (backdrop blur +
                a soft top-edge sheen) that works uniformly across all 4
                themes, not just Dynamic's own automatic glass system -
                --bg-surface is fully opaque under night/comfort/day, so a
                plain blur there would be invisible; the inset highlight is
                what reads as "glass" regardless of theme. */}
            <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px',
                padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px',
                boxShadow: 'var(--premium-shadow), inset 0 1px 0 rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Quick Doubt Solver</h3>
                </div>

                <form onSubmit={handleDoubtSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text" aria-label="Ask a question about your progress" value={doubtPrompt} onChange={(e) => setDoubtPrompt(e.target.value)}
                        // Real, measured mobile fix: the full placeholder is
                        // genuinely useful copy, but this field only has
                        // ~240px of width next to the "Ask" button on a
                        // phone - it was visibly cutting off mid-word
                        // ("...e.g. \"Ho") rather than showing a complete
                        // thought. Desktop keeps the full text (real room
                        // there); mobile gets a short version that still
                        // fits as one complete sentence.
                        placeholder={isMobile ? 'Ask about your progress...' : 'Ask about your progress, e.g. "How am I doing in Data Structures?" or "What\'s due soon?"'}
                        style={{ flex: 1, minWidth: 0, padding: '11px 16px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                    />
                    <button
                        type="submit" disabled={!doubtPrompt.trim()}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 18px', borderRadius: '9999px', border: 'none', background: doubtPrompt.trim() ? 'var(--primary)' : 'var(--widget-bg)', color: doubtPrompt.trim() ? 'var(--text-on-primary)' : 'var(--text-muted)', fontWeight: '700', fontSize: '13px', cursor: doubtPrompt.trim() ? 'pointer' : 'default', fontFamily: 'inherit', flexShrink: 0 }}
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

            {/* Navigation Tabs - fade-masked horizontal scroll (matching the
                same pattern already used for Timetable's day selector) so
                the row reads as an intentional scroller on mobile instead
                of just clipping mid-label, plus taller mobile padding for
                a real ~44px touch target. */}
            <div style={{
                display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px', overflowX: 'auto',
                maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
            }}>
                <button
                    onClick={() => setInternalTab('Subjects')}
                    style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: internalTab === 'Subjects' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Subjects' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Subjects' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                    Subjects Overview
                </button>
                <button
                    onClick={() => setInternalTab('Assignments')}
                    style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: internalTab === 'Assignments' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Assignments' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Assignments' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                    Assignments & Deadlines
                </button>
                <button
                    onClick={() => setInternalTab('Notes')}
                    style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: internalTab === 'Notes' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Notes' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Notes' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                    Notes & Knowledge Base
                </button>
                <button
                    onClick={() => setInternalTab('Flashcards')}
                    style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: internalTab === 'Flashcards' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Flashcards' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Flashcards' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                    Flashcards
                </button>
                <button
                    onClick={() => setInternalTab('Quizzes')}
                    style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: internalTab === 'Quizzes' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Quizzes' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Quizzes' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                    Quizzes
                </button>
                <button
                    onClick={() => setInternalTab('Calculator')}
                    style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: internalTab === 'Calculator' ? 'var(--widget-bg)' : 'transparent', color: internalTab === 'Calculator' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: internalTab === 'Calculator' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}
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
                        <div style={{ gridColumn: '1 / -1', padding: isMobile ? '32px 20px' : '40px', boxSizing: 'border-box', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
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
                        [...assignments]
                            .sort((a, b) => {
                                if (a.status === 'Completed' && b.status !== 'Completed') return 1;
                                if (a.status !== 'Completed' && b.status === 'Completed') return -1;
                                return (a.dueDate || '').localeCompare(b.dueDate || '');
                            })
                            .map(item => {
                                const isOverdue = item.status !== 'Completed' && item.dueDate && item.dueDate < todayStr;
                                const isExam = item.type === 'Exam';
                                return (
                            <div key={item.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: isMobile ? '14px 16px' : '16px 20px', borderRadius: '14px', border: isOverdue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-premium)', opacity: item.status === 'Completed' ? 0.6 : 1, gap: isMobile ? '12px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div onClick={() => toggleAssignmentStatus(item.id)} style={{ cursor: 'pointer', color: item.status === 'Completed' ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {item.status === 'Completed' ? <CheckCircle size={22} /> : <Circle size={22} />}
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none' }}>{item.title}</span>
                                            {item.type && (
                                                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '8px', color: isExam ? '#EF4444' : '#F59E0B', background: isExam ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', flexShrink: 0 }}>{item.type}</span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={12} /> {item.subject}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isOverdue ? '#EF4444' : '#F59E0B', fontWeight: isOverdue ? '800' : '400' }}>
                                                <Calendar size={12} /> {isOverdue ? 'Overdue - was due' : 'Due'}: {item.dueDate}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>
                                    <button type="button" onClick={() => openEditAssignmentModal(item)} title="Edit Assignment" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Pencil size={16} /></button>
                                    <button onClick={() => deleteAssignment(item.id)} title="Delete Assignment" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                </div>
                            </div>
                                );
                            })
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <button type="button" onClick={() => openEditNoteModal(note)} title="Edit Note" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Pencil size={16} /></button>
                                        <button onClick={() => deleteNote(note.id)} title="Delete Note" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </div>
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
                    <AiGenerateBar
                        subjects={subjects}
                        subjectValue={flashcardGenSubject || subjects[0]?.name || ''}
                        onSubjectChange={setFlashcardGenSubject}
                        onGenerate={() => generateFlashcardsForSubject(flashcardGenSubject || subjects[0]?.name)}
                        isGenerating={isGeneratingFlashcards}
                        error={flashcardGenError}
                        label="Generate with AI"
                        disabled={subjects.length === 0}
                    />
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); openEditFlashcardModal(card); }} title="Edit Flashcard" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Pencil size={16} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteFlashcard(card.id); }} title="Delete Flashcard" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </div>
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

            {/* TAB CONTENT: QUIZZES - a deliberately lean AI-generated
                practice quiz feature: generate (subject-scoped, real
                topics in), take one question at a time, see a real score
                at the end. No editing or per-attempt history beyond the
                score shown once. */}
            {internalTab === 'Quizzes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                    <AiGenerateBar
                        subjects={subjects}
                        subjectValue={quizGenSubject || subjects[0]?.name || ''}
                        onSubjectChange={setQuizGenSubject}
                        onGenerate={() => generateQuizForSubject(quizGenSubject || subjects[0]?.name)}
                        isGenerating={isGeneratingQuiz}
                        error={quizGenError}
                        label="Generate Quiz"
                        disabled={subjects.length === 0}
                    />
                    {quizzes.length > 0 ? (
                        quizzes.map((quiz) => (
                            <div key={quiz.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--premium-shadow)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>{quiz.subject}</span>
                                    <button type="button" onClick={() => deleteQuiz(quiz.id)} title="Delete Quiz" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>{quiz.questions.length} questions · {quiz.createdAt}</span>
                                <button
                                    type="button" onClick={() => startQuiz(quiz)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: 'var(--widget-bg)', color: 'var(--primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    <HelpCircle size={15} /> Take Quiz
                                </button>
                            </div>
                        ))
                    ) : (
                        <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                            <HelpCircle size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>No quizzes generated yet!</h3>
                        </div>
                    )}
                </div>
            )}

            {/* Take Quiz overlay - one question at a time, real score
                computed from real answers at the end. Matches the app's
                established centered-modal convention (see
                QuickNotesModal.jsx's own sub-modals). */}
            {activeQuiz && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1050, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={closeQuiz}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '440px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>{activeQuiz.subject} · Question {quizStep + 1} of {activeQuiz.questions.length}</span>
                            <button type="button" onClick={closeQuiz} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
                        </div>

                        {quizAllAnswered && quizStep === activeQuiz.questions.length - 1 && quizAnswers[quizStep] !== null ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '10px 0' }}>
                                <Award size={36} color="var(--primary)" />
                                <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{quizScore} / {activeQuiz.questions.length}</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>Quiz complete on {activeQuiz.subject}.</p>
                                <button type="button" onClick={closeQuiz} style={{ marginTop: '6px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
                            </div>
                        ) : (
                            <>
                                <p style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.4', margin: 0 }}>{activeQuiz.questions[quizStep].question}</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {activeQuiz.questions[quizStep].options.map((opt, idx) => (
                                        <button
                                            key={idx} type="button" onClick={() => answerQuizQuestion(idx)}
                                            style={{
                                                textAlign: 'left', padding: '11px 14px', borderRadius: '10px', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer',
                                                border: quizAnswers[quizStep] === idx ? '1px solid var(--primary)' : '1px solid var(--border-premium)',
                                                background: quizAnswers[quizStep] === idx ? 'rgba(var(--primary-rgb), 0.12)' : 'var(--widget-bg)',
                                                color: 'var(--text-primary)', fontWeight: quizAnswers[quizStep] === idx ? '700' : '500',
                                            }}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        type="button" onClick={() => setQuizStep((s) => Math.max(0, s - 1))} disabled={quizStep === 0}
                                        style={{ flex: 1, padding: '10px', background: 'var(--widget-bg)', color: quizStep === 0 ? 'var(--text-muted)' : 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: quizStep === 0 ? 'default' : 'pointer', fontFamily: 'inherit' }}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQuizStep((s) => Math.min(activeQuiz.questions.length - 1, s + 1))}
                                        disabled={quizAnswers[quizStep] === null}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', background: quizAnswers[quizStep] === null ? 'var(--widget-bg)' : 'var(--primary)', color: quizAnswers[quizStep] === null ? 'var(--text-muted)' : 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: quizAnswers[quizStep] === null ? 'default' : 'pointer', fontFamily: 'inherit' }}
                                    >
                                        {quizStep === activeQuiz.questions.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Universal Add Modal */}
            {isAddModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%', boxShadow: 'var(--premium-shadow)' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>
                            {modalType === 'assignment'
                                ? (editingAssignmentId !== null ? 'Edit Assignment' : 'Add New Assignment')
                                : modalType === 'note'
                                ? (editingNoteId !== null ? 'Edit Note' : 'Create New Note')
                                : (editingFlashcardId !== null ? 'Edit Flashcard' : 'Create New Flashcard')}
                        </h2>
                        
                        {modalType === 'assignment' ? (
                            <form onSubmit={handleAddAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label htmlFor="assignmentTitle" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Assignment Title</label>
                                    <input id="assignmentTitle" type="text" required autoFocus value={newAssignment.title} onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})} placeholder="e.g. Python Project Milestone 1" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div>
                                    <label htmlFor="assignmentSubject" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Subject</label>
                                    <select id="assignmentSubject" value={newAssignment.subject} onChange={(e) => setNewAssignment({...newAssignment, subject: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        {subjects.length > 0 ? subjects.map(sub => <option key={sub.id} value={sub.name} style={{ background: 'var(--surface-inset)' }}>{sub.name}</option>) : <option value="General" style={{ background: 'var(--surface-inset)' }}>General</option>}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="assignmentDueDate" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Due Date</label>
                                    <input id="assignmentDueDate" type="date" value={newAssignment.dueDate} onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer', colorScheme: 'dark' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button type="button" onClick={closeAddModal} style={{ flex: '1', padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                    <button type="submit" style={{ flex: '1', padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>{editingAssignmentId !== null ? 'Save Changes' : 'Save Assignment'}</button>
                                </div>
                            </form>
                        ) : modalType === 'note' ? (
                            <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label htmlFor="noteTitle" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Note Title</label>
                                    <input id="noteTitle" type="text" required autoFocus value={newNote.title} onChange={(e) => setNewNote({...newNote, title: e.target.value})} placeholder="e.g. Binary Search Trees Summary" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div>
                                    <label htmlFor="noteSubject" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Subject</label>
                                    <select id="noteSubject" value={newNote.subject} onChange={(e) => setNewNote({...newNote, subject: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        {subjects.length > 0 ? subjects.map(sub => <option key={sub.id} value={sub.name} style={{ background: 'var(--surface-inset)' }}>{sub.name}</option>) : <option value="General" style={{ background: 'var(--surface-inset)' }}>General</option>}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="noteContent" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Note Content</label>
                                    <textarea id="noteContent" rows="4" value={newNote.content} onChange={(e) => setNewNote({...newNote, content: e.target.value})} placeholder="Write your study notes or code logic here..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button type="button" onClick={closeAddModal} style={{ flex: '1', padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                    <button type="submit" style={{ flex: '1', padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>{editingNoteId !== null ? 'Save Changes' : 'Save Note'}</button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleAddFlashcard} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label htmlFor="flashcardSubject" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Subject</label>
                                    <select id="flashcardSubject" value={newFlashcard.subject} onChange={(e) => setNewFlashcard({...newFlashcard, subject: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        {subjects.length > 0 ? subjects.map(sub => <option key={sub.id} value={sub.name} style={{ background: 'var(--surface-inset)' }}>{sub.name}</option>) : <option value="General" style={{ background: 'var(--surface-inset)' }}>General</option>}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="flashcardQuestion" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Question (Front)</label>
                                    <input id="flashcardQuestion" type="text" required autoFocus value={newFlashcard.question} onChange={(e) => setNewFlashcard({...newFlashcard, question: e.target.value})} placeholder="e.g. What is a pointer in C?" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div>
                                    <label htmlFor="flashcardAnswer" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Answer (Back)</label>
                                    <textarea id="flashcardAnswer" rows="3" required value={newFlashcard.answer} onChange={(e) => setNewFlashcard({...newFlashcard, answer: e.target.value})} placeholder="e.g. A variable that stores the memory address of another variable." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button type="button" onClick={closeAddModal} style={{ flex: '1', padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                    <button type="submit" style={{ flex: '1', padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>{editingFlashcardId !== null ? 'Save Changes' : 'Save Flashcard'}</button>
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