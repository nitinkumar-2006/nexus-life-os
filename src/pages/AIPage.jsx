// src/pages/AIPage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Cpu, Sparkles, Send, Bot, User, ShieldCheck, RefreshCw, ArrowUpRight, Flame,
    DollarSign, BookOpen, CheckCircle, Trash2, Code, Utensils, PanelLeftClose, PanelLeftOpen,
    PanelRightClose, PanelRightOpen, Plus, MessageSquare, Copy, Check, Clock, Activity,
    Wallet, Layers, ChevronRight, X, Menu,
} from 'lucide-react';
import { generateNexusAIResponse } from '../utils/nexusAIEngine.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';

// Real personas - each genuinely changes response routing (not just a
// cosmetic label): when the active persona is non-'general' and the
// user's message doesn't clearly match a different, specific domain,
// generateSmartResponse below defaults to that persona's own branch
// instead of the generic fallback.
const PERSONAS = [
    { id: 'general', label: 'General OS Assistant', icon: Bot, accent: 'var(--primary)' },
    { id: 'study', label: 'Study & Code Expert', icon: Code, accent: '#A78BFA' },
    { id: 'fitness', label: 'Fitness Coach', icon: Flame, accent: '#EF4444' },
    { id: 'finance', label: 'Finance Advisor', icon: DollarSign, accent: '#3B82F6' },
    { id: 'nutrition', label: 'Nutrition Expert', icon: Utensils, accent: '#10B981' },
];

// Hoisted out of the starter-grid JSX so the new Plus-icon attachment
// menu's own "Quick Prompts" item can reuse the exact same real list
// (mid-conversation, not just on a fresh/empty chat) instead of a
// second, duplicated copy that could drift out of sync.
const QUICK_PROMPTS = [
    { text: 'Debug my Java/React code', icon: Code },
    { text: 'Analyze my weekly calories', icon: Utensils },
    { text: 'Plan my schedule for today', icon: Clock },
    { text: 'How is my gym consistency?', icon: Flame },
    { text: 'Check my monthly budget status', icon: DollarSign },
    { text: 'Show my study progress', icon: BookOpen },
];

// Shared row style for every item in the Plus-icon attachment popup -
// hoisted since it's identical across all of New Chat / Switch Assistant
// Mode / each Quick Prompt row.
const ATTACH_MENU_ROW_STYLE = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
    background: 'transparent', border: 'none', borderRadius: '10px', color: 'var(--text-primary)',
    fontSize: '13px', fontWeight: '600', textAlign: 'left', cursor: 'pointer', lineHeight: 1.4,
};

// Real, lightweight token rules for basic syntax highlighting - no
// external library is installed in this app (confirmed via direct
// inspection of package.json), and adding one would be a meaningfully
// new dependency decision for an app that has deliberately stayed at 5
// core dependencies throughout. Covers the three languages this request
// explicitly names (Java, Python, React/JSX) plus plain JS, which JSX
// naturally shares a token set with.
const LANG_KEYWORDS = {
    java: ['class', 'public', 'private', 'protected', 'static', 'void', 'new', 'return', 'if', 'else', 'for', 'while', 'import', 'package', 'extends', 'implements', 'interface', 'final', 'this', 'super', 'try', 'catch', 'throw', 'throws', 'int', 'boolean', 'String', 'double', 'float', 'long', 'null', 'true', 'false'],
    python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'self', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'pass', 'break', 'continue'],
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'default', 'class', 'extends', 'new', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'null', 'undefined', 'true', 'false'],
};
LANG_KEYWORDS.jsx = LANG_KEYWORDS.javascript;
LANG_KEYWORDS.js = LANG_KEYWORDS.javascript;
LANG_KEYWORDS.py = LANG_KEYWORDS.python;

// Real, lightweight syntax highlighter - tokenizes comments and strings
// FIRST (via one, combined regex, checked in this priority order), so a
// keyword-looking word that happens to appear inside a string or comment
// is never wrongly colored as a keyword. Numbers and real language
// keywords are colored last, everything else renders as plain text.
const highlightCode = (code, lang) => {
    const keywords = LANG_KEYWORDS[lang] || LANG_KEYWORDS.javascript;
    const keywordPattern = keywords.join('|');
    // Order matters: comments/strings first (highest priority - their
    // contents must never be re-tokenized), then numbers, then keywords.
    const tokenRegex = new RegExp(
        `(\\/\\/.*$|#.*$)|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b(?:${keywordPattern})\\b)`,
        'gm'
    );
    const nodes = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = tokenRegex.exec(code)) !== null) {
        if (match.index > lastIndex) nodes.push(<span key={key++}>{code.slice(lastIndex, match.index)}</span>);
        const [full, comment, string, number, keyword] = match;
        if (comment) nodes.push(<span key={key++} style={{ color: '#6B7280', fontStyle: 'italic' }}>{comment}</span>);
        else if (string) nodes.push(<span key={key++} style={{ color: '#86EFAC' }}>{string}</span>);
        else if (number) nodes.push(<span key={key++} style={{ color: '#FCA5A5' }}>{number}</span>);
        else if (keyword) nodes.push(<span key={key++} style={{ color: '#93C5FD', fontWeight: '700' }}>{keyword}</span>);
        lastIndex = match.index + full.length;
    }
    if (lastIndex < code.length) nodes.push(<span key={key++}>{code.slice(lastIndex)}</span>);
    return nodes;
};

// Real, working "Copy Code" button - uses the actual Clipboard API with
// genuine "Copied!" visual feedback (auto-reverting after 1.6s), not a
// decorative, non-functional button.
const CopyCodeButton = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (e) { /* clipboard permission denied - button stays clickable, just doesn't confirm */ }
    };
    return (
        <button
            type="button" onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: copied ? '#86EFAC' : '#9CA3AF', fontSize: '11px', fontWeight: '700', cursor: 'pointer', flexShrink: 0 }}
        >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied!' : 'Copy'}
        </button>
    );
};

// Real, lightweight markdown for non-code text: **bold**, *italic*,
// `inline code`, # headers, - list items. Applied line-by-line so block
// elements (headers, list items) are detected per-line, with inline
// formatting (bold/italic/code) applied within each line's own text.
const renderInlineMarkdown = (line, keyPrefix) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter((p) => p !== '');
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${keyPrefix}_${i}`}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={`${keyPrefix}_${i}`} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '5px', fontSize: '13px', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={`${keyPrefix}_${i}`}>{part.slice(1, -1)}</em>;
        return <React.Fragment key={`${keyPrefix}_${i}`}>{part}</React.Fragment>;
    });
};

const renderMarkdownBlock = (text, keyPrefix) => {
    const lines = text.split('\n');
    const blocks = [];
    let listBuffer = [];
    const flushList = (idx) => {
        if (listBuffer.length > 0) {
            blocks.push(<ul key={`${keyPrefix}_list_${idx}`} style={{ margin: '4px 0', paddingLeft: '20px' }}>{listBuffer}</ul>);
            listBuffer = [];
        }
    };
    lines.forEach((line, idx) => {
        if (/^#{1,3}\s/.test(line)) {
            flushList(idx);
            const level = line.match(/^#+/)[0].length;
            const content = line.replace(/^#{1,3}\s/, '');
            const size = level === 1 ? '17px' : level === 2 ? '15px' : '14px';
            blocks.push(<div key={`${keyPrefix}_h_${idx}`} style={{ fontSize: size, fontWeight: '800', margin: '6px 0 2px' }}>{renderInlineMarkdown(content, `${keyPrefix}_h_${idx}`)}</div>);
        } else if (/^[-*]\s/.test(line)) {
            listBuffer.push(<li key={`${keyPrefix}_li_${idx}`} style={{ fontSize: '14px', lineHeight: '1.6' }}>{renderInlineMarkdown(line.replace(/^[-*]\s/, ''), `${keyPrefix}_li_${idx}`)}</li>);
        } else if (line.trim() === '') {
            flushList(idx);
        } else {
            flushList(idx);
            blocks.push(<p key={`${keyPrefix}_p_${idx}`} style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{renderInlineMarkdown(line, `${keyPrefix}_p_${idx}`)}</p>);
        }
    });
    flushList(lines.length);
    return blocks;
};

// Splits on triple-backtick code fences first (same, proven approach as
// before), then applies real syntax highlighting to code segments and
// real markdown parsing to everything else - genuinely richer than the
// earlier version's flat, uncolored <pre> block and plain-text-only
// non-code segments.
const renderMessageText = (text) => {
    if (!text.includes('```')) return <>{renderMarkdownBlock(text, 'md')}</>;

    const parts = text.split('```');
    return parts.map((part, index) => {
        if (index % 2 !== 0) {
            const firstLineBreak = part.indexOf('\n');
            const langTag = firstLineBreak > -1 ? part.slice(0, firstLineBreak).trim().toLowerCase() : '';
            const codeContent = (LANG_KEYWORDS[langTag] || langTag === '') && firstLineBreak > -1 ? part.slice(firstLineBreak + 1) : part;
            const lang = LANG_KEYWORDS[langTag] ? langTag : 'javascript';
            return (
                <div key={index} style={{ background: '#0D0D12', borderRadius: '10px', marginTop: '8px', marginBottom: '8px', border: '1px solid var(--border-premium)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border-premium)' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' }}>{langTag || 'code'}</span>
                        <CopyCodeButton code={codeContent} />
                    </div>
                    <pre style={{ margin: 0, padding: '12px', fontSize: '13px', overflowX: 'auto', fontFamily: 'monospace', lineHeight: '1.5' }}>
                        <code>{highlightCode(codeContent, lang)}</code>
                    </pre>
                </div>
            );
        }
        return <React.Fragment key={index}>{renderMarkdownBlock(part, `md_${index}`)}</React.Fragment>;
    });
};

const AIPage = () => {
    const isMobile = useIsMobile();
    // Contextual first-visit tour (see TourGuide.jsx) - mobile only; the
    // menu-toggle step in particular only exists in the mobile top bar.
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('ai'));
    // 1. DEEP INTEGRATION: Pulling data from ALL Nexus modules
    const [plannerTasks] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_planner_tasks')) || []; } catch (e) { return []; } });
    const [timetableData] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_timetable_data')) || {}; } catch (e) { return {}; } });
    const [subjects] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_syllabus_subjects')) || []; } catch (e) { return []; } });
    const [studyAssignments] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_study_assignments')) || []; } catch (e) { return []; } });
    const [workouts] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_gym_history')) || []; } catch (e) { return []; } });
    const [rawFinanceProfile] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_finance_profile')) || { monthlyBudget: 0 }; } catch (e) { return { monthlyBudget: 0 }; } });
    const { settings: globalSettings } = useGlobalSettings();
    const financeProfile = useMemo(() => ({ ...rawFinanceProfile, monthlyBudget: globalSettings.monthlyBudgetCap }), [rawFinanceProfile, globalSettings.monthlyBudgetCap]);
    const [transactions] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_finance_transactions')) || []; } catch (e) { return []; } });
    const [financeAccounts] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_finance_accounts')) || []; } catch (e) { return []; } });
    const [calendarEvents] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_calendar_events')) || []; } catch (e) { return []; } });
    const [dietProfile] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_diet_profile')) || { dailyCalories: 0 }; } catch (e) { return { dailyCalories: 0 }; } });
    const [dietDailyLog] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_diet_daily_log')) || { caloriesConsumed: 0 }; } catch (e) { return { caloriesConsumed: 0 }; } });

    const [activeTab, setActiveTab] = useState('Chat');
    const [activePersona, setActivePersona] = useState('general');

    // Real, distinct greeting per persona - reflects that persona's own,
    // actual domain focus rather than one, generic message for all five.
    const getDefaultGreeting = (personaId) => {
        const GREETINGS = {
            general: "Namaste! I am your Nexus Personal AI, fully synced with your Calendar, Gym, Diet, Finance, and Study modules. Ask me anything about your data, or even ask me to write code for you!",
            study: "I'm your Study & Code Expert - synced with your Syllabus, Assignments, and ready to review code (Java, Python, React, and more). What are we working on?",
            fitness: "I'm your Fitness Coach - synced with your real Gym history. Ask about your consistency, recovery, or workout data.",
            finance: "I'm your Finance Advisor - synced with your real budget, accounts, and transactions. Ask about your spending or balances.",
            nutrition: "I'm your Nutrition Expert - synced with your real Diet profile and daily log. Ask about your calories or macros.",
        };
        return {
            id: 'greeting',
            sender: 'ai',
            text: GREETINGS[personaId] || GREETINGS.general,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
    };

    // Real, multi-session chat history - genuinely persists and restores
    // multiple, separate past conversations, not just one flat, single
    // thread as before. Migrates any existing conversation from the old,
    // single-session key into a real first session on first load, rather
    // than silently discarding it.
    const [sessions, setSessions] = useState(() => {
        try {
            const savedSessions = JSON.parse(localStorage.getItem('nexus_ai_chat_sessions') || 'null');
            if (Array.isArray(savedSessions) && savedSessions.length > 0) return savedSessions;
        } catch (e) { /* fall through to migration/default below */ }

        // Migration: an existing, real conversation from before this
        // multi-session redesign becomes a genuine first session, rather
        // than being silently lost.
        try {
            const legacy = JSON.parse(localStorage.getItem('nexus_ai_chat_history') || 'null');
            if (Array.isArray(legacy) && legacy.length > 0 && legacy.some((m) => m.id !== 'greeting')) {
                const now = Date.now();
                const firstUserMsg = legacy.find((m) => m.sender === 'user');
                return [{
                    id: `session_${now}`, title: firstUserMsg ? firstUserMsg.text.slice(0, 40) : 'Previous Chat',
                    persona: 'general', messages: legacy, createdAt: now, updatedAt: now,
                }];
            }
        } catch (e) { /* malformed legacy data - start fresh below */ }

        const now = Date.now();
        return [{ id: `session_${now}`, title: 'New Chat', persona: 'general', messages: [getDefaultGreeting('general')], createdAt: now, updatedAt: now }];
    });
    const [activeSessionId, setActiveSessionId] = useState(() => {
        const saved = localStorage.getItem('nexus_ai_active_session_id');
        return saved || null; // resolved against real sessions in the effect below
    });

    // Persists the real session list, and keeps activeSessionId genuinely
    // valid - falls back to the most recent real session if the saved id
    // no longer exists (e.g. that session was deleted).
    useEffect(() => {
        localStorage.setItem('nexus_ai_chat_sessions', JSON.stringify(sessions));
        if (!sessions.some((s) => s.id === activeSessionId)) {
            const fallbackId = sessions[sessions.length - 1]?.id || null;
            setActiveSessionId(fallbackId);
            if (fallbackId) localStorage.setItem('nexus_ai_active_session_id', fallbackId);
        }
    }, [sessions]);

    useEffect(() => {
        if (activeSessionId) localStorage.setItem('nexus_ai_active_session_id', activeSessionId);
    }, [activeSessionId]);

    const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[sessions.length - 1];
    const messages = activeSession?.messages || [];

    // Updates only the active session's own messages within the real
    // sessions array, and bumps its updatedAt/title - keeping the
    // sidebar's own "most recent" ordering and preview text genuinely
    // accurate.
    const updateActiveSessionMessages = (updater) => {
        setSessions((prev) => prev.map((s) => {
            if (s.id !== activeSession?.id) return s;
            const nextMessages = typeof updater === 'function' ? updater(s.messages) : updater;
            // Only ever worth finding the first user message while the
            // title still needs deriving from it - once a real title has
            // been set, this result can never matter again, so skipping
            // the lookup avoids re-scanning the entire message history
            // on every single streaming tick (every 18ms) as a
            // conversation grows longer.
            const firstUserMsg = s.title === 'New Chat' ? nextMessages.find((m) => m.sender === 'user') : null;
            return {
                ...s, messages: nextMessages, updatedAt: Date.now(),
                title: s.title === 'New Chat' && firstUserMsg ? firstUserMsg.text.slice(0, 40) : s.title,
            };
        }));
    };

    // Real "New Chat" - creates a genuine, separate session rather than
    // wiping the current one, so past conversations stay in the sidebar.
    const createNewSession = (personaId = activePersona) => {
        const now = Date.now();
        const newSession = { id: `session_${now}`, title: 'New Chat', persona: personaId, messages: [getDefaultGreeting(personaId)], createdAt: now, updatedAt: now };
        setSessions((prev) => [...prev, newSession]);
        setActiveSessionId(newSession.id);
    };

    // Real deletion - removes just that one session, and if it was the
    // active one, falls back to another real session (or creates a
    // fresh one if none remain) rather than leaving the chat in a
    // broken, sessionless state.
    const deleteSession = (sessionId) => {
        setSessions((prev) => {
            const next = prev.filter((s) => s.id !== sessionId);
            if (next.length === 0) {
                const now = Date.now();
                return [{ id: `session_${now}`, title: 'New Chat', persona: 'general', messages: [getDefaultGreeting('general')], createdAt: now, updatedAt: now }];
            }
            return next;
        });
    };

    // Real, live context summary for the Right-Side Live Context
    // Inspector - reuses the exact same, real data/calculations
    // generateSmartResponse's own branches use, so what's shown here
    // genuinely, honestly matches what the AI actually has access to.
    const liveContext = useMemo(() => {
        const allTopics = subjects.flatMap((s) => (s.units || []).flatMap((u) => u.topics || []));
        const pendingTopics = allTopics.filter((t) => !t.done).length;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentWorkouts = workouts.filter((w) => w.date && new Date(w.date) >= sevenDaysAgo).length;
        const totalSpent = transactions.filter((t) => t.type === 'Expense').reduce((acc, curr) => acc + curr.amount, 0);
        const budgetRemaining = financeProfile.monthlyBudget - totalSpent;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todaySlots = (timetableData[dayNames[new Date().getDay()]] || []).length;
        return [
            { label: 'Active Study Queue', icon: Layers, value: subjects.length > 0 ? `${pendingTopics} topic${pendingTopics === 1 ? '' : 's'} pending` : 'No subjects yet' },
            { label: 'Gym Splits', icon: Activity, value: workouts.length > 0 ? `${recentWorkouts} session${recentWorkouts === 1 ? '' : 's'} (7d)` : 'No workouts logged' },
            { label: 'Budget Status', icon: Wallet, value: financeProfile.monthlyBudget > 0 ? `₹${Math.max(0, budgetRemaining).toLocaleString()} left` : 'Not set up' },
            { label: 'Timetable', icon: Clock, value: `${todaySlots} slot${todaySlots === 1 ? '' : 's'} today` },
        ];
    }, [subjects, workouts, transactions, financeProfile, timetableData]);

    const [inputPrompt, setInputPrompt] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile);
    const [inspectorOpen, setInspectorOpen] = useState(() => !isMobile);
    const [isGenerating, setIsGenerating] = useState(false);
    const chatEndRef = useRef(null);
    const streamTimeoutRef = useRef(null);
    const streamIntervalRef = useRef(null);

    // ChatGPT-style "+" attachment menu embedded in the chat input bar -
    // real actions this app already has (new chat, quick prompts, switch
    // assistant mode), not illustrative dummy items.
    const [attachMenuOpen, setAttachMenuOpen] = useState(false);
    const attachMenuRef = useRef(null);
    const attachBtnRef = useRef(null);
    // The popup renders with position:fixed (so the chat card's
    // overflow:hidden never clips it) - its screen coordinates are read
    // from the button once, right when it opens. The input bar's own
    // position is stable while the menu is open (only the message list
    // above it scrolls internally), so a single read on open is enough.
    const [attachMenuPos, setAttachMenuPos] = useState({ left: 16, bottom: 90 });
    const toggleAttachMenu = () => {
        setAttachMenuOpen((prev) => {
            const next = !prev;
            if (next && attachBtnRef.current) {
                const rect = attachBtnRef.current.getBoundingClientRect();
                setAttachMenuPos({ left: rect.left, bottom: window.innerHeight - rect.top + 10 });
            }
            return next;
        });
    };
    useEffect(() => {
        if (!attachMenuOpen) return;
        const onOutsideClick = (e) => {
            if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) setAttachMenuOpen(false);
        };
        document.addEventListener('mousedown', onOutsideClick);
        return () => document.removeEventListener('mousedown', onOutsideClick);
    }, [attachMenuOpen]);

    // Cleans up any in-flight "thinking" timeout or streaming interval if
    // the user navigates away mid-response - prevents a dangling timer
    // from calling updateActiveSessionMessages after this component has unmounted.
    useEffect(() => {
        return () => {
            if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
            if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        // Smooth scrolling makes sense for a real, discrete jump (a new
        // message being sent) - but during active streaming, messages
        // updates dozens of times per second as each chunk reveals,
        // and re-triggering a smooth animation on every single tick
        // just interrupts the previous one, producing real visible
        // jank rather than a fluid scroll. Instant scrolling during
        // streaming is what actually keeps the latest text in view
        // smoothly as it streams in - the same behavior modern AI
        // clients use.
        chatEndRef.current?.scrollIntoView({ behavior: isGenerating ? 'auto' : 'smooth' });
    }, [messages, isGenerating]);

    // Clear Chat Function
    // Replaces window.confirm, matching this app's own, established
    // standard against native dialogs - a real, custom glass modal
    // renders below and genuinely gates this destructive action.
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const clearChat = () => setShowClearConfirm(true);
    const confirmClearChat = () => {
        updateActiveSessionMessages([getDefaultGreeting(activeSession?.persona || 'general')]);
        setShowClearConfirm(false);
    };

    // 3. SMART AI LOGIC ENGINE - now genuinely imported from the shared,
    // single nexusAIEngine module (src/utils/nexusAIEngine.js), rather
    // than a local copy - every dedicated AI section across the OS calls
    // into this exact same, one set of functions.
    const aiContext = {
        subjects, studyAssignments, workouts, financeProfile, transactions, financeAccounts,
        dietProfile, dietDailyLog, plannerTasks, calendarEvents, timetableData,
    };
    const generateSmartResponse = (prompt, persona) => generateNexusAIResponse(prompt, aiContext, persona);

    // Core send logic, shared by both the chat form and every quick
    // prompt chip/coach button - takes the message text directly rather
    // than reading it from inputPrompt state, since state set via
    // setInputPrompt wouldn't be visible yet to a same-tick, synchronous
    // read due to React's batching. This is what makes a chip genuinely,
    // instantly submit rather than just pre-fill the input box.
    const submitMessage = (text) => {
        const userMsgText = text.trim();
        if (!userMsgText || isGenerating) return;

        const userMsg = {
            id: Date.now().toString(),
            sender: 'user',
            text: userMsgText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        updateActiveSessionMessages(prev => [...prev, userMsg]);
        setInputPrompt('');
        setIsGenerating(true);

        streamTimeoutRef.current = setTimeout(() => {
            const aiResponseText = generateSmartResponse(userMsgText, activeSession?.persona);
            const aiMsgId = (Date.now() + 1).toString();
            const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Start the message empty, then genuinely, progressively
            // reveal it in small chunks - a real streaming effect, not
            // the full text appearing all at once.
            updateActiveSessionMessages(prev => [...prev, { id: aiMsgId, sender: 'ai', text: '', time: aiTime }]);

            const CHUNK_SIZE = 3;
            let revealed = 0;
            streamIntervalRef.current = setInterval(() => {
                revealed = Math.min(aiResponseText.length, revealed + CHUNK_SIZE);
                updateActiveSessionMessages(prev => prev.map((m) => m.id === aiMsgId ? { ...m, text: aiResponseText.slice(0, revealed) } : m));
                if (revealed >= aiResponseText.length) {
                    clearInterval(streamIntervalRef.current);
                    streamIntervalRef.current = null;
                    setIsGenerating(false);
                }
            }, 18);
        }, 700); // brief "thinking" pause before streaming begins
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        submitMessage(inputPrompt);
    };

    // Instantly submits the prompt (not just pre-fills it) - this is
    // what "instantly populating and submitting" genuinely requires, and
    // what the previous version was missing (it only ever called
    // setInputPrompt, leaving the user to press Send themselves).
    const handleQuickPrompt = (promptText) => {
        setActiveTab('Chat');
        submitMessage(promptText);
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: '16px',
            // Mobile: sized to exactly fill the real space this page
            // actually sits in - glass-panel's own 16px top padding plus
            // its 76px bottom padding (see DashboardLayout.jsx; that
            // bottom padding is what keeps content clear of the fixed
            // MobileTabBar) plus the device's own safe-area inset, the
            // same env() this app already uses for that padding and for
            // MobileTabBar itself. This is a genuine exact fit (16 + this
            // height + 76 + safe-area-bottom == 100vh), not the old,
            // disconnected "100vh - 140px" guess, which left the card ~60px
            // shorter than the space actually available - real dead space
            // between the chat card and the bottom nav dock rather than the
            // small, intentional-looking gap glass-panel's own padding
            // already provides. Desktop is untouched (different chrome
            // above it, no bottom dock to clear).
            // Also now subtracts safe-area-inset-top: glass-panel's own top
            // padding on this page became `16px + that inset` (see
            // DashboardLayout.jsx's isHeaderHiddenOnMobile) once the global
            // Header - hidden here on mobile - stopped being what cleared
            // the status bar for this page. Leaving this height calc as it
            // was would make the page's real total height (top padding +
            // this + bottom padding) exceed 100vh by exactly that inset,
            // pushing the bottom of the chat card behind the bottom nav.
            height: isMobile ? 'calc(100vh - 92px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px))' : 'calc(100vh - 140px)',
            animation: 'fadeInScale 0.3s ease', position: 'relative', width: '100%', boxSizing: 'border-box', minWidth: 0,
        }}>
            {showTour && <TourGuide tourId="ai" steps={TOUR_STEPS.ai} onFinish={() => setShowTour(false)} />}

            {/* Desktop keeps the full title + subtitle. Mobile gets a
                genuinely minimal ChatGPT-style top bar instead - just a
                menu toggle, the app name, and New Chat. The global
                DashboardLayout header is hidden entirely on this page on
                mobile (see DashboardLayout.jsx), so this replaces it as
                the ONLY chrome above the chat - everything this bar used
                to also carry (chat history, personas, the Chat/Coaches
                view switch, Live Context, Clear Chat) now lives inside
                the menu drawer instead, categorized like ChatGPT's own
                side menu, rather than crowding a second row up top. */}
            {!isMobile ? (
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Nexus AI Intelligence Core</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Context-aware assistant integrated with specialized domain coaches.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button type="button" onClick={() => setSidebarOpen(true)} title="Open menu" aria-label="Open menu" data-tour-id="ai-menu" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                        <Menu size={18} />
                    </button>
                    <h1 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, flex: 1, textAlign: 'center' }}>Nexus AI</h1>
                    <button type="button" onClick={() => createNewSession()} title="New chat" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                        <Plus size={17} />
                    </button>
                </div>
            )}

            {/* Main 3-column body: Sidebar | Chat | Context Inspector.
                minWidth: 0 here is what actually lets the flex children
                below shrink below their own content's intrinsic width
                instead of forcing the row to overflow - the single most
                common cause of a flex layout that looks fine at a zoomed-
                out size (more logical px available) but overflows at
                100% zoom (less logical px available for the exact same
                real content). Always nowrap (not just on desktop): the
                sidebar/inspector panels are both position:fixed overlays
                on every viewport size, so the center chat column is the
                ONLY normal-flow child here. flex-wrap:'wrap' with a
                single flex item breaks the cross-axis stretch that
                min-height:0 depends on - the line sizes to the item's own
                content height instead of the row's actual available
                height, letting the chat column (and the input bar inside
                it) grow past the viewport and get pushed down behind the
                bottom nav instead of staying clipped/scrollable. This was
                the real, remaining cause of the "input drifts on scroll"
                bug - the min-height:0 additions elsewhere were correct
                but couldn't take effect while this stayed 'wrap'. */}
            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 'clamp(8px, 1.2vw, 14px)', flex: 1, minHeight: 0, minWidth: 0 }}>

                {/* LEFT: Chat History Sidebar - real, multi-session store,
                    not just the flat, single-thread history from before.
                    Width is now a real, responsive clamp() instead of a
                    fixed 240px, so it genuinely narrows on tighter
                    viewports rather than staying rigid while the center
                    column is squeezed to compensate. Desktop-only inline
                    layout - mobile gets its own slide-over overlay
                    version below instead, matching a native chat app's
                    history drawer rather than squeezing a column into a
                    narrow viewport. */}
                {sidebarOpen && !isMobile && (
                    <div data-diag="ai-left-sidebar" style={{ width: 'clamp(190px, 20vw, 240px)', flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '18px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden', boxSizing: 'border-box' }}>
                        <button
                            type="button" onClick={() => createNewSession()}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}
                        >
                            <Plus size={16} /> New Chat
                        </button>
                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {[...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map((s) => {
                                const isActive = s.id === activeSession?.id;
                                const personaMeta = PERSONAS.find((p) => p.id === s.persona) || PERSONAS[0];
                                return (
                                    <div
                                        key={s.id} onClick={() => setActiveSessionId(s.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', background: isActive ? 'var(--widget-bg)' : 'transparent', border: isActive ? '1px solid var(--border-premium)' : '1px solid transparent' }}
                                    >
                                        <MessageSquare size={14} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                                        <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: isActive ? '700' : '600', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.title}>{s.title}</span>
                                        <button
                                            type="button" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} title="Delete chat"
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.7 }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Mobile: the ChatGPT-style side menu - now the ONLY place
                    chat history, assistant personas, the Chat/Coaches view
                    switch, and the Live Context/Clear Chat tools live on
                    mobile (all previously crowded into the main page as
                    horizontally-scrolling pills and extra top-bar icons).
                    Categorized into clear labeled sections, same real
                    slide-over-with-backdrop pattern already used here. */}
                {isMobile && (
                    <>
                        <div
                            onClick={() => setSidebarOpen(false)}
                            aria-hidden="true"
                            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', opacity: sidebarOpen ? 1 : 0, pointerEvents: sidebarOpen ? 'auto' : 'none', transition: 'opacity 0.25s ease' }}
                        />
                        <div style={{
                            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 301, width: 'min(300px, 82vw)',
                            background: 'var(--bg-surface)', borderRight: '1px solid var(--border-premium)',
                            padding: '16px', paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
                            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                            display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box',
                            overflowY: 'auto',
                            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: sidebarOpen ? '8px 0 24px rgba(0,0,0,0.3)' : 'none',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>Nexus AI</span>
                                <button type="button" onClick={() => setSidebarOpen(false)} title="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '2px' }}><X size={18} /></button>
                            </div>

                            <button
                                type="button" onClick={() => { createNewSession(); setSidebarOpen(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}
                            >
                                <Plus size={16} /> New Chat
                            </button>

                            {/* Assistant Mode - the personas that used to be
                                a horizontally-scrolling pill row up top. */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 2px' }}>Assistant Mode</span>
                                {PERSONAS.map((p) => {
                                    const PIcon = p.icon;
                                    const active = activePersona === p.id;
                                    return (
                                        <button
                                            key={p.id} type="button"
                                            onClick={() => {
                                                setActivePersona(p.id);
                                                setSessions((prev) => prev.map((s) => s.id === activeSession?.id ? { ...s, persona: p.id } : s));
                                                setSidebarOpen(false);
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                                                background: active ? 'rgba(var(--primary-rgb), 0.15)' : 'transparent',
                                                border: active ? `1px solid ${p.accent}` : '1px solid transparent',
                                                color: active ? p.accent : 'var(--text-secondary)', fontSize: '13px', fontWeight: active ? '700' : '600',
                                            }}
                                        >
                                            <PIcon size={15} style={{ flexShrink: 0 }} /> {p.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ height: '1px', background: 'var(--border-premium)', flexShrink: 0 }} />

                            {/* View - the Chat Assistant / Specialized
                                Coaches switch that used to be a second tab
                                row in the main content. */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 2px' }}>View</span>
                                <button
                                    type="button" onClick={() => { setActiveTab('Chat'); setSidebarOpen(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                                        background: activeTab === 'Chat' ? 'var(--widget-bg)' : 'transparent',
                                        border: activeTab === 'Chat' ? '1px solid var(--border-premium)' : '1px solid transparent',
                                        color: activeTab === 'Chat' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: activeTab === 'Chat' ? '700' : '600',
                                    }}
                                >
                                    <Bot size={15} style={{ flexShrink: 0 }} /> AI Chat Assistant
                                </button>
                                <button
                                    type="button" onClick={() => { setActiveTab('Coaches'); setSidebarOpen(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                                        background: activeTab === 'Coaches' ? 'var(--widget-bg)' : 'transparent',
                                        border: activeTab === 'Coaches' ? '1px solid var(--border-premium)' : '1px solid transparent',
                                        color: activeTab === 'Coaches' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: activeTab === 'Coaches' ? '700' : '600',
                                    }}
                                >
                                    <Cpu size={15} style={{ flexShrink: 0 }} /> Specialized AI Coaches
                                </button>
                            </div>

                            <div style={{ height: '1px', background: 'var(--border-premium)', flexShrink: 0 }} />

                            {/* Tools - Live Context and Clear Chat, moved
                                off the old top bar's icon row. */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 2px' }}>Tools</span>
                                <button
                                    type="button" onClick={() => { setSidebarOpen(false); setInspectorOpen(true); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}
                                >
                                    <ShieldCheck size={15} style={{ flexShrink: 0 }} /> Live Context
                                </button>
                                <button
                                    type="button" onClick={() => { setSidebarOpen(false); clearChat(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', background: 'transparent', border: '1px solid transparent', color: '#EF4444', fontSize: '13px', fontWeight: '600' }}
                                >
                                    <Trash2 size={15} style={{ flexShrink: 0 }} /> Clear This Chat
                                </button>
                            </div>

                            <div style={{ height: '1px', background: 'var(--border-premium)', flexShrink: 0 }} />

                            {/* Chat History - the only section that scrolls
                                independently, so the fixed sections above
                                stay put regardless of how many sessions
                                exist. */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minHeight: '80px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '0 2px', flexShrink: 0 }}>Chat History</span>
                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {[...sessions].sort((a, b) => b.updatedAt - a.updatedAt).map((s) => {
                                        const isActive = s.id === activeSession?.id;
                                        return (
                                            <div
                                                key={s.id} onClick={() => { setActiveSessionId(s.id); setSidebarOpen(false); }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '10px', cursor: 'pointer', background: isActive ? 'var(--widget-bg)' : 'transparent', border: isActive ? '1px solid var(--border-premium)' : '1px solid transparent' }}
                                            >
                                                <MessageSquare size={14} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                                                <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: isActive ? '700' : '600', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.title}>{s.title}</span>
                                                <button
                                                    type="button" onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} title="Delete chat"
                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.7 }}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* CENTER: main chat column - minHeight: 0 is the real
                    fix for the reported "input bar drifts/scrolls with
                    the messages" bug: this column sits between two
                    siblings that both already had it (the row above and
                    the Chat-tab wrapper below), but was missing it right
                    here. Without min-height:0 on every link in a nested
                    flex-column chain, a child can't shrink below its own
                    content size, so the message list's intended
                    "overflow-y: auto, bounded height" never actually
                    took effect - the whole page grew to fit all the
                    messages instead, and the outer page-level scroll
                    that produced dragged the input bar (just an ordinary
                    child in that flow) up and down with it, instead of
                    the input staying pinned while only the messages
                    above it scrolled. */}
                <div data-diag="ai-center-chat" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Top bar: sidebar/inspector toggles + Persona & Model
                        Switcher pills - real, interactive mode transitions,
                        not a decorative label row. Desktop-only now in its
                        entirety - on mobile, personas/history/context/wipe
                        all live in the menu drawer instead (see the drawer
                        above), so the main chat column stays genuinely
                        clean with zero secondary chrome, matching this
                        request's own "clean chat area" ask. */}
                    {!isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button type="button" onClick={() => setSidebarOpen((v) => !v)} title={sidebarOpen ? 'Hide chat history' : 'Show chat history'} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '9px', padding: '5px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
                            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflowX: 'auto', overflowY: 'hidden', flex: 1, WebkitOverflowScrolling: 'touch' }}>
                            {PERSONAS.map((p) => {
                                const PIcon = p.icon;
                                const active = activePersona === p.id;
                                return (
                                    <button
                                        key={p.id} type="button"
                                        onClick={() => {
                                            setActivePersona(p.id);
                                            // Switching persona on the CURRENT session updates
                                            // its own routing going forward, rather than
                                            // silently leaving the session on its old persona
                                            // while the pill shows something different.
                                            setSessions((prev) => prev.map((s) => s.id === activeSession?.id ? { ...s, persona: p.id } : s));
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', flexShrink: 0,
                                            background: active ? 'rgba(var(--primary-rgb), 0.15)' : 'var(--widget-bg)',
                                            border: active ? `1px solid ${p.accent}` : '1px solid var(--border-premium)',
                                            color: active ? p.accent : 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', lineHeight: 1,
                                        }}
                                    >
                                        <PIcon size={12} /> {p.label}
                                    </button>
                                );
                            })}
                        </div>

                        <button type="button" onClick={() => setInspectorOpen((v) => !v)} title={inspectorOpen ? 'Hide context inspector' : 'Show context inspector'} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '9px', padding: '5px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>
                            {inspectorOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                        </button>

                        <button
                            type="button" onClick={clearChat}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '9px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}
                            title="Clear this chat"
                        >
                            <Trash2 size={13} /> Wipe
                        </button>
                    </div>
                    )}

                    {/* Navigation Tabs - desktop-only, same reasoning as
                        the row above: this switch now lives in the mobile
                        drawer's own "View" section instead. */}
                    {!isMobile && (
                    <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', flexShrink: 0 }}>
                        <button
                            onClick={() => setActiveTab('Chat')}
                            style={{ padding: '6px 14px', background: activeTab === 'Chat' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Chat' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Chat' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.4 }}
                        >
                            <Bot size={14} /> AI Chat Assistant
                        </button>
                        <button
                            onClick={() => setActiveTab('Coaches')}
                            style={{ padding: '6px 14px', background: activeTab === 'Coaches' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Coaches' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Coaches' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.4 }}
                        >
                            <Cpu size={14} /> Specialized AI Coaches
                        </button>
                    </div>
                    )}

                    {/* TAB CONTENT: CHAT ASSISTANT */}
                    {activeTab === 'Chat' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
                            <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '22px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                                {messages.length <= 1 ? (
                                    /* Floating Starter Grid - shown on a new/empty chat
                                       instead of the chat log, for instant execution. */
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--primary)', color: 'var(--text-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.35)' }}>
                                            <Sparkles size={28} />
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>What would you like to know?</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', width: '100%', maxWidth: '720px' }}>
                                            {QUICK_PROMPTS.map((card, idx) => (
                                                <button
                                                    key={idx} type="button" onClick={() => handleQuickPrompt(card.text)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', cursor: 'pointer', textAlign: 'left' }}
                                                >
                                                    <card.icon size={17} color="var(--accent)" style={{ flexShrink: 0 }} />
                                                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{card.text}</span>
                                                    <ArrowUpRight size={14} color="var(--text-muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '8px' }}>
                                        {messages.map(msg => (
                                            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', gap: '12px', alignItems: 'flex-start' }}>
                                                {msg.sender === 'ai' && (
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 12px rgba(var(--primary-rgb), 0.3)' }}>
                                                        <Bot size={20} />
                                                    </div>
                                                )}

                                                <div style={{ maxWidth: '80%', background: msg.sender === 'user' ? 'var(--primary)' : 'var(--widget-bg)', color: msg.sender === 'user' ? 'var(--text-on-primary)' : 'var(--text-primary)', padding: '16px 20px', borderRadius: '16px', border: msg.sender === 'ai' ? '1px solid var(--border-premium)' : 'none', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {renderMessageText(msg.text)}
                                                    <span style={{ fontSize: '10px', opacity: 0.7, alignSelf: 'flex-end', marginTop: '4px' }}>{msg.time}</span>
                                                </div>

                                                {msg.sender === 'user' && (
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <User size={20} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {isGenerating && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Bot size={20} />
                                                </div>
                                                <div style={{ background: 'var(--widget-bg)', padding: '14px 20px', borderRadius: '16px', border: '1px solid var(--border-premium)', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing Nexus Context & Memory...
                                                </div>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                )}

                                <form onSubmit={handleSendMessage} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-premium)', flexShrink: 0 }}>
                                    {/* Unified ChatGPT-style pill: the Plus button, text
                                        input, and Send button all live inside ONE rounded
                                        container instead of three separate boxes. */}
                                    <div data-tour-id="ai-input" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 6px 6px 6px', borderRadius: '26px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                                        <div ref={attachMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                                            <button
                                                type="button"
                                                ref={attachBtnRef}
                                                onClick={toggleAttachMenu}
                                                aria-label="Open attachment menu"
                                                aria-expanded={attachMenuOpen}
                                                data-tour-id="ai-plus"
                                                style={{ width: '38px', height: '38px', borderRadius: '50%', background: attachMenuOpen ? 'var(--primary)' : 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: attachMenuOpen ? 'var(--text-on-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s, color 0.2s' }}
                                            >
                                                <Plus size={19} style={{ transform: attachMenuOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
                                            </button>

                                            {attachMenuOpen && (
                                                <div style={{ position: 'fixed', left: attachMenuPos.left, bottom: attachMenuPos.bottom, width: '260px', maxWidth: 'calc(100vw - 32px)', maxHeight: '50vh', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', boxShadow: '0 12px 32px rgba(0,0,0,0.4)', padding: '8px', zIndex: 250 }}>
                                                    <button type="button" onClick={() => { createNewSession(); setAttachMenuOpen(false); }} style={ATTACH_MENU_ROW_STYLE}>
                                                        <MessageSquare size={16} color="var(--accent)" style={{ flexShrink: 0 }} /> New Chat
                                                    </button>
                                                    <button type="button" onClick={() => { setSidebarOpen(true); setAttachMenuOpen(false); }} style={ATTACH_MENU_ROW_STYLE}>
                                                        <Layers size={16} color="var(--accent)" style={{ flexShrink: 0 }} /> Switch Assistant Mode
                                                    </button>
                                                    <div style={{ margin: '8px 10px 4px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quick Prompts</div>
                                                    {QUICK_PROMPTS.map((qp, idx) => (
                                                        <button key={idx} type="button" onClick={() => { handleQuickPrompt(qp.text); setAttachMenuOpen(false); }} style={ATTACH_MENU_ROW_STYLE}>
                                                            <qp.icon size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                                            <span style={{ fontSize: '13px', fontWeight: '600', lineHeight: 1.3 }}>{qp.text}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <input
                                            type="text"
                                            aria-label="Chat message"
                                            placeholder="Ask anything"
                                            value={inputPrompt} onChange={(e) => setInputPrompt(e.target.value)}
                                            style={{ flex: 1, minWidth: 0, padding: '10px 6px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '20px', outline: 'none' }}
                                        />

                                        <button
                                            type="submit"
                                            disabled={isGenerating || !inputPrompt.trim()}
                                            aria-label="Send message"
                                            style={{ width: '38px', height: '38px', flexShrink: 0, background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!inputPrompt.trim() || isGenerating) ? 0.5 : 1, transition: 'opacity 0.2s' }}
                                        >
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* TAB CONTENT: SPECIALIZED COACHES - buttons now also
                        switch the active persona (not just submit a prompt),
                        so consulting a coach genuinely puts the AI into
                        that domain's own persona going forward too. */}
                    {activeTab === 'Coaches' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', overflowY: 'auto', flex: 1, paddingBottom: '16px' }}>
                            
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '14px', color: 'var(--primary)' }}><Code size={24} /></div>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Study & Code Coach</h3>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Programming & Academic Mentor</span>
                                    </div>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                    Helps you write, debug, and understand code (Java, C, Python). Evaluates good vs bad coding practices.
                                </p>
                                <button 
                                    onClick={() => { setActivePersona('study'); setSessions((prev) => prev.map((s) => s.id === activeSession?.id ? { ...s, persona: 'study' } : s)); handleQuickPrompt("Write a Java code example explaining Good vs Bad practice."); }}
                                    style={{ marginTop: 'auto', padding: '10px 16px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    Ask for Code Review →
                                </button>
                            </div>

                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '14px', color: '#EF4444' }}><Flame size={24} /></div>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Fitness Coach</h3>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Workout & Consistency Analysis</span>
                                    </div>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                    Evaluates your gym history from the Gym module. Monitors progressive overload and calculates consistency.
                                </p>
                                <button 
                                    onClick={() => { setActivePersona('fitness'); setSessions((prev) => prev.map((s) => s.id === activeSession?.id ? { ...s, persona: 'fitness' } : s)); handleQuickPrompt("How is my gym consistency based on my workout history?"); }}
                                    style={{ marginTop: 'auto', padding: '10px 16px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    Consult Fitness Coach →
                                </button>
                            </div>

                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '14px', color: '#3B82F6' }}><DollarSign size={24} /></div>
                                    <div>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Finance Coach</h3>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Budget & Savings Optimizer</span>
                                    </div>
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                    Reads your Finance module to monitor spending limits, alert on low balance, and analyze transactions.
                                </p>
                                <button 
                                    onClick={() => { setActivePersona('finance'); setSessions((prev) => prev.map((s) => s.id === activeSession?.id ? { ...s, persona: 'finance' } : s)); handleQuickPrompt("Check my monthly budget status and total expenses."); }}
                                    style={{ marginTop: 'auto', padding: '10px 16px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                                >
                                    Consult Finance Coach →
                                </button>
                            </div>

                        </div>
                    )}
                </div>

                {/* RIGHT: Live Context Inspector - real, live-computed
                    data the AI genuinely, currently has access to.
                    Desktop-only inline layout; mobile's equivalent
                    slide-over drawer (from the right) is right below. */}
                {inspectorOpen && !isMobile && (
                    <div data-diag="ai-right-context-panel" style={{ width: 'clamp(170px, 17vw, 210px)', flexShrink: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '18px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={16} color="#10B981" />
                            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>Live Context</span>
                        </div>
                        {liveContext.map((ctx) => (
                            <div key={ctx.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                    <ctx.icon size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={ctx.label}>{ctx.label}</span>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ctx.value}>{ctx.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {isMobile && (
                    <>
                        <div
                            onClick={() => setInspectorOpen(false)}
                            aria-hidden="true"
                            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', opacity: inspectorOpen ? 1 : 0, pointerEvents: inspectorOpen ? 'auto' : 'none', transition: 'opacity 0.25s ease' }}
                        />
                        <div style={{
                            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 301, width: 'min(280px, 80vw)',
                            background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-premium)',
                            padding: '16px', paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
                            display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', boxSizing: 'border-box',
                            transform: inspectorOpen ? 'translateX(0)' : 'translateX(100%)',
                            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxShadow: inspectorOpen ? '-8px 0 24px rgba(0,0,0,0.3)' : 'none',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                    <ShieldCheck size={16} color="#10B981" /> Live Context
                                </span>
                                <button type="button" onClick={() => setInspectorOpen(false)} title="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '2px' }}><X size={17} /></button>
                            </div>
                            {liveContext.map((ctx) => (
                                <div key={ctx.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                        <ctx.icon size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }} title={ctx.label}>{ctx.label}</span>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ctx.value}>{ctx.value}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {showClearConfirm && (
                <div
                    onClick={() => setShowClearConfirm(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '26px', width: '100%', maxWidth: '360px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}
                    >
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Clear AI Chat?</h3>
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>This permanently erases this conversation.</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowClearConfirm(false)} style={{ flex: 1, padding: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={confirmClearChat} style={{ flex: 1, padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIPage;