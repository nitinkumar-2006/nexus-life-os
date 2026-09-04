// src/pages/AIPage.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, Flame, DollarSign, Code, Utensils, Clock, Activity, Wallet, Layers } from 'lucide-react';
import { generateNexusAIResponse } from '../utils/nexusAIEngine.js';
import { streamGeminiResponse, GeminiApiError, resolveModelCandidates as resolveGeminiModels } from '../utils/geminiClient.js';
import { streamOpenAiResponse, OpenAiApiError } from '../utils/openaiClient.js';
import { streamGrokResponse, GrokApiError, resolveGrokModels, buildGrokImageContent } from '../utils/grokClient.js';
import { streamDeepseekResponse, DeepseekApiError, resolveDeepseekModels } from '../utils/deepseekClient.js';
import { TOOL_DEFINITIONS, executeToolCall } from '../utils/aiTools.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import AILayout from '../components/ai/AILayout.jsx';

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

// Real system instructions for the live Gemini API path (see
// streamGeminiResponse below) - one per persona, mirroring the same
// domain focus as PERSONAS/getDefaultGreeting, so switching persona
// genuinely changes how the live model behaves, not just which local
// canned-response branch would have been used.
const PERSONA_SYSTEM_PROMPTS = {
    general: "You are Nexus AI, the general-purpose assistant built into Nexus OS, a personal-operating-system app. Be concise, warm, and genuinely useful. Use the user's real data below directly when it's relevant instead of asking them to repeat it.",
    study: 'You are the Study & Code Expert inside Nexus OS. You help with studying, coursework, and reviewing or writing code (Java, Python, JavaScript/React, and more). Be precise, and use the real syllabus/assignment data below when relevant.',
    fitness: "You are the Fitness Coach inside Nexus OS. You help with workouts, training consistency, and recovery, grounded in the user's real gym history below.",
    finance: "You are the Finance Advisor inside Nexus OS. You help with budgeting and spending using the user's real accounts/transactions below. Reason only over the user's own real data and general budgeting practice - never give personalized investment/trading advice.",
    nutrition: "You are the Nutrition Expert inside Nexus OS. You help with calories, macros, and diet using the user's real diet log below.",
};

// Appended to the system prompt only for the Gemini path (see
// submitMessage below) - the only provider client in this app with
// real, wired-up function-calling support (see geminiClient.js's tools
// param and aiTools.js's TOOL_DEFINITIONS/executeToolCall). Explicitly
// asks for a real, conversational multi-turn gather-then-confirm flow
// rather than calling a tool the instant a title is mentioned, matching
// what was actually requested - the model asks for details one at a
// time, discusses them, and only calls the real tool once the user has
// clearly confirmed.
const TOOL_USAGE_SYSTEM_SUFFIX = `

You also have real tools to directly create things in the user's Nexus OS: a new Planner task, a new Finance transaction (which also updates the matching account's real balance), a logged Gym workout, a logged Diet meal, a new Study assignment, or a new Calendar event. Use them conversationally - ask for whatever details you genuinely need one at a time (not all at once), discuss or confirm details naturally if the user seems unsure, and only call a tool once the user has clearly confirmed they want it saved. After a tool call's result comes back, tell the user what happened in one short, natural sentence - don't just repeat the raw result, and if it failed, explain why in plain language.`;

// Real bug found live: Date.now() alone collides when two sessions are
// minted in the same millisecond (confirmed by rapid-clicking "New
// Chat" - two entries landed on the literal same `session_<ms>` id).
// Since every session list below is keyed by this id, a collision means
// duplicate React keys (a real "each child needs a unique key" case,
// not the usual harmless dev warning) and a delete on either row
// removing both at once via the `s.id !== sessionId` filter. A random
// suffix makes two calls in the same millisecond resolve to different
// ids without changing anything about how ids already look/sort.
const makeSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const AIPage = ({ setActiveTab: setAppActiveTab }) => {
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

    // Real AI provider key state (both Gemini and OpenAI) - read directly
    // from 'nexus_global_settings' (not via useGlobalSettings/
    // GlobalUserSettingsContext above, which only exposes its own small,
    // curated whitelist of genuinely-shared fields - monthlyBudgetCap,
    // waterGoal, currencySymbol, weightUnit, temperatureUnit - and never
    // re-exposes the raw settings object). Live-updated the same way
    // SettingsPage's own handleChange signals every other cross-component
    // listener: both 'nexus_settings_updated' AND the native 'storage'
    // event (the latter is what CloudSyncContext's own real-time
    // onSnapshot listener dispatches when a key arrives from another
    // device - see applyCloudData in CloudSyncContext.jsx).
    const readAiKeySettings = () => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
            return {
                geminiApiKey: saved.geminiApiKey || '', geminiApiKeyConfirmed: !!saved.geminiApiKeyConfirmed,
                openaiApiKey: saved.openaiApiKey || '', openaiApiKeyConfirmed: !!saved.openaiApiKeyConfirmed,
                grokApiKey: saved.grokApiKey || '', grokApiKeyConfirmed: !!saved.grokApiKeyConfirmed,
                deepseekApiKey: saved.deepseekApiKey || '', deepseekApiKeyConfirmed: !!saved.deepseekApiKeyConfirmed,
            };
        } catch (e) {
            return {
                geminiApiKey: '', geminiApiKeyConfirmed: false, openaiApiKey: '', openaiApiKeyConfirmed: false,
                grokApiKey: '', grokApiKeyConfirmed: false, deepseekApiKey: '', deepseekApiKeyConfirmed: false,
            };
        }
    };
    const [aiKeySettings, setAiKeySettings] = useState(readAiKeySettings);
    useEffect(() => {
        const syncAiKeySettings = () => setAiKeySettings(readAiKeySettings());
        window.addEventListener('nexus_settings_updated', syncAiKeySettings);
        window.addEventListener('storage', syncAiKeySettings);
        return () => {
            window.removeEventListener('nexus_settings_updated', syncAiKeySettings);
            window.removeEventListener('storage', syncAiKeySettings);
        };
    }, []);
    const [dietDailyLog] = useState(() => { try { return JSON.parse(localStorage.getItem('nexus_diet_daily_log')) || { caloriesConsumed: 0 }; } catch (e) { return { caloriesConsumed: 0 }; } });

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
        const newSession = { id: makeSessionId(), title: 'New Chat', persona: personaId, messages: [getDefaultGreeting(personaId)], createdAt: now, updatedAt: now };
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
                return [{ id: makeSessionId(), title: 'New Chat', persona: 'general', messages: [getDefaultGreeting('general')], createdAt: now, updatedAt: now }];
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
    const [isGenerating, setIsGenerating] = useState(false);
    const streamTimeoutRef = useRef(null);
    const streamIntervalRef = useRef(null);

    // Cleans up any in-flight "thinking" timeout or streaming interval if
    // the user navigates away mid-response - prevents a dangling timer
    // from calling updateActiveSessionMessages after this component has unmounted.
    useEffect(() => {
        return () => {
            if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
            if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
            if (aiAbortRef.current) aiAbortRef.current.abort();
        };
    }, []);

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

    // Real, confirmed keys - genuinely wired to the live APIs below, not
    // just read for the Settings page's own connection status.
    // *ApiKeyConfirmed only ever becomes true after SettingsPage's own
    // live key-validation succeeds (its geminiKeyStatus/openaiKeyStatus
    // effects), so this check alone is enough to trust the key is real
    // without re-validating it here.
    const {
        geminiApiKey, geminiApiKeyConfirmed, openaiApiKey, openaiApiKeyConfirmed,
        grokApiKey, grokApiKeyConfirmed, deepseekApiKey, deepseekApiKeyConfirmed,
    } = aiKeySettings;
    const geminiReady = geminiApiKeyConfirmed && !!geminiApiKey.trim();
    const openaiReady = openaiApiKeyConfirmed && !!openaiApiKey.trim();
    const grokReady = grokApiKeyConfirmed && !!grokApiKey.trim();
    const deepseekReady = deepseekApiKeyConfirmed && !!deepseekApiKey.trim();

    // Real, user-controlled provider switcher - persisted so the choice
    // sticks across reloads, not just a session default. Falls back
    // sensibly: if the user's saved preference is no longer usable (that
    // key got removed/invalidated) but another provider is ready, prefer
    // the first genuinely ready one over silently dropping to local mode.
    const [preferredProvider, setPreferredProvider] = useState(() => localStorage.getItem('nexus_ai_provider') || 'gemini');
    // Same real 'nexus_settings_updated' convention every other cross-
    // component setting in this app already dispatches on write (see
    // SettingsPage.jsx/VoiceAssistantSettings.jsx) - without this, a
    // provider switch here only reached other same-tab listeners (e.g.
    // ProfilePage's own Connections widget, GreetingCard's AI Mode
    // status) on the next unrelated 'storage' event or a reload, since
    // plain localStorage.setItem fires no event at all in the same tab.
    useEffect(() => {
        localStorage.setItem('nexus_ai_provider', preferredProvider);
        window.dispatchEvent(new Event('nexus_settings_updated'));
    }, [preferredProvider]);
    const READY_BY_PROVIDER = { gemini: geminiReady, openai: openaiReady, grok: grokReady, deepseek: deepseekReady };
    // 'local' is a real, explicit, always-selectable choice - not just
    // the automatic fallback for "no key configured yet". Before this,
    // there was no way to deliberately turn a configured, ready provider
    // OFF and use the local nexusAIEngine-only path instead - the
    // fallback below always preferred any ready provider over local,
    // with no way to override that. Checked first and unconditionally:
    // picking Local always wins, even while a real key is ready.
    //
    // A genuine string 'local' (never null) both when explicitly chosen
    // and when nothing is configured yet - collapsing both into the
    // same real id, rather than null, is what lets the provider picker
    // below correctly show the Local pill as the active one in either
    // case, honestly reflecting what's actually about to answer.
    const activeProvider = preferredProvider === 'local'
        ? 'local'
        : READY_BY_PROVIDER[preferredProvider]
        ? preferredProvider
        : (Object.keys(READY_BY_PROVIDER).find((id) => READY_BY_PROVIDER[id]) || 'local');

    // Per-provider model choice - a real arrow next to the active
    // provider's badge (see AIChatArea.jsx) opens a slide-down panel to
    // pick a specific model, matching Gemini's own real model-picker.
    // Persisted per-provider (not one shared value) since each provider's
    // model IDs are a disjoint namespace - switching provider must never
    // silently carry over a stale model id from a different one.
    const [modelByProvider, setModelByProvider] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_ai_model_by_provider') || '{}'); } catch (e) { return {}; }
    });
    useEffect(() => { localStorage.setItem('nexus_ai_model_by_provider', JSON.stringify(modelByProvider)); }, [modelByProvider]);
    const setModelForProvider = (providerId, modelId) => setModelByProvider((prev) => ({ ...prev, [providerId]: modelId }));

    // Real, live-discovered model lists for the model picker - each
    // provider's own client already knows how to ask its real API "what
    // models can this key use" (resolveModelCandidates/resolveGrokModels/
    // resolveDeepseekModels), so the picker's options come from the same
    // live source of truth the actual chat call itself uses, never a
    // separate guessed list that could drift out of sync with it.
    const [availableModels, setAvailableModels] = useState({});
    useEffect(() => {
        let cancelled = false;
        const loaders = [
            geminiReady && resolveGeminiModels(geminiApiKey).then((list) => { if (!cancelled) setAvailableModels((prev) => ({ ...prev, gemini: list })); }),
            grokReady && resolveGrokModels(grokApiKey).then((list) => { if (!cancelled) setAvailableModels((prev) => ({ ...prev, grok: list })); }),
            deepseekReady && resolveDeepseekModels(deepseekApiKey).then((list) => { if (!cancelled) setAvailableModels((prev) => ({ ...prev, deepseek: list })); }),
        ];
        Promise.all(loaders).catch(() => {});
        return () => { cancelled = true; };
    }, [geminiReady, geminiApiKey, grokReady, grokApiKey, deepseekReady, deepseekApiKey]);

    // Real grounding data for the live model - the exact same safe field
    // access nexusAIEngine.js's own response functions already use, just
    // formatted as plain text lines instead of prose, so Gemini answers
    // from genuine current Nexus data instead of generic knowledge alone.
    const buildContextSummary = () => {
        const allTopics = subjects.flatMap((s) => (s.units || []).flatMap((u) => u.topics || []));
        const doneTopics = allTopics.filter((t) => t.done).length;
        const pendingAssignments = studyAssignments.filter((a) => a.status !== 'Completed').length;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentWorkouts = workouts.filter((w) => w.date && new Date(w.date) >= sevenDaysAgo).length;
        const totalSpent = transactions.filter((t) => t.type === 'Expense').reduce((acc, curr) => acc + curr.amount, 0);
        const totalBalance = financeAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todaySlots = (timetableData[dayNames[new Date().getDay()]] || []).length;
        const pendingTasks = plannerTasks.filter((t) => !t.completed).length;
        return [
            `Study: ${subjects.length} subject(s) tracked, ${doneTopics}/${allTopics.length} topics completed, ${pendingAssignments} pending assignment(s).`,
            `Fitness: ${workouts.length} total workout(s) logged, ${recentWorkouts} in the last 7 days.`,
            `Finance: monthly budget ₹${financeProfile.monthlyBudget || 0}, ₹${totalSpent} spent so far, ${financeAccounts.length} account(s) totalling ₹${totalBalance}.`,
            `Nutrition: ${dietDailyLog.caloriesConsumed || 0}/${dietProfile.dailyCalories || 0} kcal logged today.`,
            `Schedule: ${todaySlots} timetable slot(s) today, ${calendarEvents.length} calendar event(s), ${pendingTasks} pending planner task(s).`,
        ].join('\n');
    };

    // Real multi-turn history (not just the latest message) - excludes
    // the synthetic greeting and any past error bubbles, neither of
    // which are real prior model turns. Gemini's own contents shape
    // (role: 'user'|'model', system instruction passed separately).
    // imagePart ({ mimeType, base64, kind }, optional): the exact same
    // inline_data shape the syllabus-OCR pipeline already sends Gemini
    // (see geminiClient.js's generateStructuredContent) - real, working
    // vision/document input, not a decorative attach button. Gemini's own
    // API genuinely accepts application/pdf as an inline_data mimeType
    // the same way it accepts image/*, so a PDF here is read by the live
    // model itself, not routed through any separate extraction step. Only
    // ever attached to the new turn, never rewritten into prior history.
    const buildGeminiContents = (priorMessages, newUserText, imagePart) => {
        const history = priorMessages
            .filter((m) => m.id !== 'greeting' && !m.isError && m.text)
            .map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
        const fallbackPrompt = imagePart?.kind === 'pdf' ? 'Summarize this document.' : 'Describe this image.';
        const newParts = [{ text: newUserText || fallbackPrompt }];
        if (imagePart) newParts.push({ inline_data: { mime_type: imagePart.mimeType, data: imagePart.base64 } });
        return [...history, { role: 'user', parts: newParts }];
    };

    // Same real history, OpenAI's own flat shape instead (role:
    // 'user'|'assistant', system instruction as the first message in the
    // same array rather than a separate field). imagePart (optional) is
    // only ever passed for Grok - see the runAIResponse call site - and
    // turns just the new user turn's content into a real multimodal
    // array (buildGrokImageContent) rather than a plain string; every
    // prior-history message stays plain text either way, which every
    // OpenAI-compatible endpoint accepts mixed like that.
    const buildOpenAiMessages = (systemInstruction, priorMessages, newUserText, imagePart) => {
        const history = priorMessages
            .filter((m) => m.id !== 'greeting' && !m.isError && m.text)
            .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
        const userContent = imagePart
            ? buildGrokImageContent(newUserText || 'Describe this image.', imagePart)
            : newUserText;
        return [{ role: 'system', content: systemInstruction }, ...history, { role: 'user', content: userContent }];
    };

    // Cancels an in-flight real AI stream (e.g. component unmount) -
    // mirrors the existing streamTimeoutRef/streamIntervalRef cleanup
    // pattern for the local-engine fake-stream path below. Shared by
    // both providers since only one stream is ever in flight at a time.
    const aiAbortRef = useRef(null);

    // Real file attachment (image or PDF), staged from the "+" menu's
    // Upload File item (see AIChatArea.jsx) and sent on the next message -
    // { mimeType, base64, previewUrl, name, kind: 'image' | 'pdf' }.
    // Enabled for whichever active provider genuinely has a live vision
    // path: Gemini (image + PDF, via inline_data - the same path the
    // syllabus-OCR feature uses) and Grok (image only, via the standard
    // OpenAI-style image_url content part - see buildOpenAiMessages/
    // buildGrokImageContent). DeepSeek's chat API has no image input at
    // all, and OpenAI's endpoint can't be reached from this browser at all
    // (CORS - see openaiClient.js), so the upload control itself stays
    // disabled for those two rather than silently dropping the file or
    // sending something the API can't actually read.
    const [pendingImage, setPendingImage] = useState(null);

    // The actual "ask the model and stream a reply" logic - pulled out of
    // submitMessage so regenerateResponse (the message toolbar's Retry
    // button) can call the exact same real generation path against an
    // already-existing user turn, instead of needing its own separate,
    // driftable copy of the whole provider-routing/tool-calling/local-
    // fallback block. priorMessages is real history that does NOT
    // include userMsgText's own turn yet (both callers snapshot it
    // themselves, in submitMessage's case before appending the new user
    // message, in regenerateResponse's case as everything up to and
    // including that turn's own user message).
    const runAIResponse = (priorMessages, userMsgText, imagePart) => {
        setIsGenerating(true);

        // Real, live provider path - only ever taken once at least one
        // key has actually, successfully validated AND the user hasn't
        // explicitly chosen Local (activeProvider is the string 'local'
        // in both of those other cases - see its own comment above). Any
        // failure here surfaces as a real, distinct error bubble (see
        // isError below) - it never silently falls back to the local
        // canned engine and pretends that was a live answer.
        if (activeProvider && activeProvider !== 'local') {
            const persona = activeSession?.persona || 'general';
            const systemInstruction = `${PERSONA_SYSTEM_PROMPTS[persona] || PERSONA_SYSTEM_PROMPTS.general}\n\nThe user's real, current Nexus OS data:\n${buildContextSummary()}${activeProvider === 'gemini' ? TOOL_USAGE_SYSTEM_SUFFIX : ''}`;
            const aiMsgId = (Date.now() + 1).toString();
            const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const controller = new AbortController();
            aiAbortRef.current = controller;

            // Fires as each real chunk arrives from whichever provider is
            // active - the message starts absent and is created on the
            // first real chunk, so the existing "Analyzing..." indicator
            // stays visible for the real network/thinking latency instead
            // of an empty bubble appearing immediately.
            const onChunk = (fullTextSoFar) => {
                updateActiveSessionMessages(prev => {
                    if (!prev.some((m) => m.id === aiMsgId)) return [...prev, { id: aiMsgId, sender: 'ai', text: fullTextSoFar, time: aiTime }];
                    return prev.map((m) => m.id === aiMsgId ? { ...m, text: fullTextSoFar } : m);
                });
            };

            // Real, two-hop function-calling flow (Gemini only - see
            // geminiClient.js/aiTools.js) - the model's first response can
            // either be plain text, or a real functionCall part asking to
            // create a Planner task / Finance transaction. When it does,
            // executeToolCall runs the actual local write BEFORE the model
            // ever gets to claim it worked, then a second call hands that
            // real result back to the model so its final reply genuinely
            // describes what happened, not what it assumes happened. Any
            // lead-in text from the first call (the model can legitimately
            // say something like "Sure, adding that now..." alongside the
            // function call) is prepended to the second call's own
            // progressive text rather than lost, since onChunk otherwise
            // replaces the message text with whichever single stream call
            // most recently fired it.
            const runGeminiTurn = async () => {
                const contents = buildGeminiContents(priorMessages, userMsgText, imagePart);
                const first = await streamGeminiResponse({
                    apiKey: geminiApiKey, systemInstruction, contents,
                    tools: [{ functionDeclarations: TOOL_DEFINITIONS }],
                    preferredModel: modelByProvider.gemini, signal: controller.signal, onChunk,
                });
                if (!first.functionCalls || first.functionCalls.length === 0) return first.text;

                const leadInText = first.text ? `${first.text} ` : '';
                const modelTurnParts = [
                    ...(first.text ? [{ text: first.text }] : []),
                    ...first.functionCalls.map((fc) => ({ functionCall: fc })),
                ];
                const functionResponseParts = first.functionCalls.map((fc) => ({
                    functionResponse: { name: fc.name, response: executeToolCall(fc.name, fc.args) },
                }));
                const second = await streamGeminiResponse({
                    apiKey: geminiApiKey, systemInstruction,
                    contents: [...contents, { role: 'model', parts: modelTurnParts }, { role: 'function', parts: functionResponseParts }],
                    preferredModel: modelByProvider.gemini, signal: controller.signal,
                    onChunk: (fullTextSoFar, newText) => onChunk(leadInText + fullTextSoFar, newText),
                });
                return leadInText + second.text;
            };

            const openAiShapedMessages = buildOpenAiMessages(systemInstruction, priorMessages, userMsgText, activeProvider === 'grok' ? imagePart : null);
            const streamPromise = activeProvider === 'gemini'
                ? runGeminiTurn()
                : activeProvider === 'grok'
                ? streamGrokResponse({ apiKey: grokApiKey, messages: openAiShapedMessages, preferredModel: modelByProvider.grok, signal: controller.signal, onChunk })
                : activeProvider === 'deepseek'
                ? streamDeepseekResponse({ apiKey: deepseekApiKey, messages: openAiShapedMessages, preferredModel: modelByProvider.deepseek, signal: controller.signal, onChunk })
                : streamOpenAiResponse({ apiKey: openaiApiKey, messages: openAiShapedMessages, signal: controller.signal, onChunk });

            streamPromise.then(() => {
                setIsGenerating(false);
                aiAbortRef.current = null;
            }).catch((err) => {
                // Real cancellation (unmount) - no error bubble needed, but
                // isGenerating must still reset here too. This was a real,
                // confirmed bug: the early return below used to skip both
                // resets, so any abort - including the one React's own
                // StrictMode triggers by deliberately mounting every
                // component twice in dev (mount, cleanup, remount, which
                // fires this exact effect's cleanup and aborts an in-flight
                // request if one was already running) - left isGenerating
                // stuck true forever, permanently disabling Send with no
                // way to recover short of a full page reload.
                if (err && err.name === 'AbortError') {
                    setIsGenerating(false);
                    aiAbortRef.current = null;
                    return;
                }
                const providerLabel = { gemini: 'Gemini', openai: 'ChatGPT', grok: 'Grok', deepseek: 'DeepSeek' }[activeProvider] || 'AI';
                const message = (err instanceof GeminiApiError || err instanceof OpenAiApiError || err instanceof GrokApiError || err instanceof DeepseekApiError)
                    ? err.message
                    : `Something went wrong talking to the ${providerLabel} API. Please try again.`;
                updateActiveSessionMessages(prev => {
                    const errMsg = { id: aiMsgId, sender: 'ai', text: message, time: aiTime, isError: true };
                    if (!prev.some((m) => m.id === aiMsgId)) return [...prev, errMsg];
                    return prev.map((m) => m.id === aiMsgId ? errMsg : m);
                });
                setIsGenerating(false);
                aiAbortRef.current = null;
            });
            return;
        }

        // No confirmed AI provider key yet - an honest local fallback:
        // real computed insights from the user's actual Nexus data via
        // nexusAIEngine, not a live model. Still genuinely useful, just
        // not what "live Gemini/ChatGPT" means - fake-streamed in small
        // chunks purely as a visual pace-matching effect, since the full
        // text here is already fully computed up front (unlike the real
        // provider paths above, which stream actual arriving tokens).
        streamTimeoutRef.current = setTimeout(() => {
            const aiResponseText = generateSmartResponse(userMsgText, activeSession?.persona);
            const aiMsgId = (Date.now() + 1).toString();
            const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

    // Core send logic, shared by both the chat form and every quick
    // prompt chip/coach button - takes the message text directly rather
    // than reading it from inputPrompt state, since state set via
    // setInputPrompt wouldn't be visible yet to a same-tick, synchronous
    // read due to React's batching. This is what makes a chip genuinely,
    // instantly submit rather than just pre-fill the input box.
    const submitMessage = (text) => {
        const userMsgText = text.trim();
        const imagePart = pendingImage;
        if ((!userMsgText && !imagePart) || isGenerating) return;

        const userMsg = {
            id: Date.now().toString(),
            sender: 'user',
            text: userMsgText,
            // A PDF has no real previewUrl (see AIChatArea.jsx's
            // handleFilePicked - only an image gets a cheap object URL),
            // so attachmentKind is the real signal an attachment exists at
            // all; imagePreview is only ever meaningful alongside it.
            imagePreview: imagePart?.previewUrl || null,
            attachmentKind: imagePart?.kind || null,
            attachmentName: imagePart?.name || null,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const priorMessages = messages; // real history, snapshotted before this new user turn is appended
        updateActiveSessionMessages(prev => [...prev, userMsg]);
        setInputPrompt('');
        setPendingImage(null);
        runAIResponse(priorMessages, userMsgText, imagePart);
    };

    // The message toolbar's Retry/regenerate button - finds the real user
    // turn that produced this AI message, drops the old AI response (and,
    // if it was an error bubble, the error along with it) from the actual
    // session history, and re-runs the exact same generation path fresh.
    // Never re-attaches the original turn's image/PDF (previewUrl is a
    // cheap, possibly already-revoked object URL by the time someone
    // clicks Retry, and Gemini's own base64 payload was never kept around
    // after that first send) - a plain-text regenerate of the same
    // prompt covers the real, common "the model's answer was bad, try
    // again" case without holding onto attachment payloads indefinitely
    // just for this.
    const regenerateResponse = (aiMsgId) => {
        if (isGenerating) return;
        const aiIndex = messages.findIndex((m) => m.id === aiMsgId);
        if (aiIndex === -1) return;
        let userIndex = aiIndex - 1;
        while (userIndex >= 0 && messages[userIndex].sender !== 'user') userIndex -= 1;
        if (userIndex < 0) return;
        const userMsgText = messages[userIndex].text;
        const priorMessages = messages.slice(0, userIndex + 1);
        updateActiveSessionMessages(() => messages.slice(0, aiIndex));
        runAIResponse(priorMessages, userMsgText, null);
    };

    // The message toolbar's "Branch in new chat" - a genuine new session
    // pre-seeded with a real copy of the conversation up to and including
    // the chosen message, so the branch keeps full context and can be
    // continued independently without touching the original chat at all.
    const branchChatAt = (messageId) => {
        const index = messages.findIndex((m) => m.id === messageId);
        if (index === -1) return;
        const branchedMessages = messages.slice(0, index + 1).map((m) => ({ ...m }));
        const now = Date.now();
        const firstUserMsg = branchedMessages.find((m) => m.sender === 'user');
        const newSession = {
            id: makeSessionId(),
            title: firstUserMsg ? `${firstUserMsg.text.slice(0, 34)} (branch)` : 'Branched Chat',
            persona: activeSession?.persona || 'general',
            messages: branchedMessages, createdAt: now, updatedAt: now,
        };
        setSessions((prev) => [...prev, newSession]);
        setActiveSessionId(newSession.id);
    };

    // A lightweight, purely-local "good response" mark on the message
    // itself - no feedback pipeline or analytics endpoint exists to send
    // this to, so it's a real, working toggle that persists with the rest
    // of that session's messages (same localStorage-backed sessions array
    // every other message field already rides along on) rather than a
    // decorative button that resets on reload.
    const toggleMessageLike = (msgId) => {
        updateActiveSessionMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, liked: !m.liked } : m)));
    };

    // Picking a coach in the sidebar switches the CURRENT session's own
    // persona/routing (same real behavior the old persona pills already
    // had) rather than silently starting a new chat and discarding
    // whatever conversation was in progress - switching who you're
    // talking to should never be a data-losing action.
    const handleSelectCoach = (personaId) => {
        setActivePersona(personaId);
        setSessions((prev) => prev.map((s) => (s.id === activeSession?.id ? { ...s, persona: personaId } : s)));
    };

    // Model list only ever populated for providers with a real, working
    // live-discovery client (see the availableModels effect above) -
    // ChatGPT deliberately has none here, since its chat endpoint is
    // CORS-blocked from a browser regardless of which model you'd pick
    // (see openaiClient.js), so a model picker for it would just be
    // another dead control pretending to work.
    // 'local' is always ready, unlike the four real API providers below -
    // it's the explicit "don't call any live model" choice (see
    // activeProvider above), always selectable regardless of whether any
    // key is configured, so turning AI off entirely is a real, one-click
    // option rather than only something that happens automatically when
    // no key exists yet.
    const providers = [
        { id: 'local', label: 'Local', ready: true, models: [], selectedModel: null },
        { id: 'gemini', label: 'Gemini', ready: geminiReady, models: availableModels.gemini || [], selectedModel: modelByProvider.gemini },
        { id: 'openai', label: 'ChatGPT', ready: openaiReady, models: [], selectedModel: null },
        { id: 'grok', label: 'Grok', ready: grokReady, models: availableModels.grok || [], selectedModel: modelByProvider.grok },
        { id: 'deepseek', label: 'DeepSeek', ready: deepseekReady, models: availableModels.deepseek || [], selectedModel: modelByProvider.deepseek },
    ];

    // DashboardLayout.jsx now gives this page's slot a real, plain flex-fill
    // parent (flex:1, minHeight:0, flex-column) with zero padding around it
    // specifically for the AI tab (isAIFullBleed), instead of the old fixed
    // .glass-panel padding every other module still gets. flex:1 + minHeight:0
    // here is the correct, robust way to claim "all of the real remaining
    // space" inside that chain - a hand-computed calc(100vh - Npx) would
    // silently drift out of sync the moment any ancestor's own chrome
    // height changes, exactly what made the old value fragile.
    return (
        <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', boxSizing: 'border-box', minWidth: 0, animation: 'fadeInScale 0.3s ease' }}>
            <AILayout
                coaches={PERSONAS}
                selectedCoachId={activePersona}
                onSelectCoach={handleSelectCoach}
                sessions={sessions}
                activeSessionId={activeSession?.id}
                onSelectSession={setActiveSessionId}
                onNewChat={() => createNewSession()}
                onDeleteSession={deleteSession}
                messages={messages}
                isGenerating={isGenerating}
                inputPrompt={inputPrompt}
                onInputChange={setInputPrompt}
                onSubmit={() => submitMessage(inputPrompt)}
                providers={providers}
                activeProviderId={activeProvider}
                onSelectProvider={setPreferredProvider}
                onSelectModel={setModelForProvider}
                pendingImage={pendingImage}
                onAttachImage={setPendingImage}
                liveContext={liveContext}
                onClearChat={clearChat}
                onRegenerateMessage={regenerateResponse}
                onBranchChat={branchChatAt}
                onToggleMessageLike={toggleMessageLike}
                showClearConfirm={showClearConfirm}
                onCancelClear={() => setShowClearConfirm(false)}
                onConfirmClear={confirmClearChat}
                showTour={showTour}
                onFinishTour={() => setShowTour(false)}
                onOpenSettings={typeof setAppActiveTab === 'function' ? () => {
                    // Actually land on API Integrations, not just Settings'
                    // default Account tab - see the matching read in
                    // SettingsPage.jsx's activeCategory initializer.
                    sessionStorage.setItem('nexus_settings_open_section', 'api');
                    setAppActiveTab('Settings');
                } : undefined}
            />
        </div>
    );
};

export default AIPage;

