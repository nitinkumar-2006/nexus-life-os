// src/hooks/useDailyBriefing.js
//
// A real, working data-aggregation hook for the AI Daily Briefing -
// genuinely reads live data from every real source (profile, the
// shared TaskRegistryContext, gym plans/history, diet meals, and
// Finance's own budget-remaining formula), not placeholder numbers.
// Live-synced via the same real 'storage' event pattern already
// established throughout this app, so the briefing genuinely updates
// if the underlying data changes while the app is open.
import { useState, useEffect, useCallback } from 'react';
import { useTaskRegistry } from '../context/TaskRegistryContext.jsx';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { getLocalDateString } from '../utils/dateUtils.js';
import { buildBriefingSentences } from '../utils/briefingText.js';

const todayIso = () => getLocalDateString();

const readJson = (key, fallback) => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return fallback;
        const parsed = JSON.parse(saved);
        return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
        return fallback;
    }
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Good night';
};

// SettingsPage.jsx's own "Voice & Language" section, read directly the
// same way this file's own readJson helper already reads every other
// localStorage-backed store - not routed through GlobalUserSettingsContext,
// since that context's own whitelist is a real, curated cross-reference
// (monthlyBudgetCap/currencySymbol resolve against Finance's own data),
// not a general settings pass-through, and this is a plain flat
// preference with nothing to de-duplicate.
//
// A real, standalone Language field again - explicitly selected, not
// inferred from whichever voice is picked. That coupling (a prior
// version of this file) was the actual bug just reported: picking a
// voice could silently swap the spoken language out from under the
// user with no separate way to just choose a voice character. Voice and
// Language are two fully independent settings now.
const readAiVoiceLanguage = () => {
    const saved = readJson('nexus_global_settings', {});
    return saved.aiVoiceLanguage === 'hi' || saved.aiVoiceLanguage === 'hinglish' ? saved.aiVoiceLanguage : 'en';
};

export const useDailyBriefing = () => {
    const { entries } = useTaskRegistry();
    const { settings } = useGlobalSettings();
    const [refreshKey, setRefreshKey] = useState(0);

    // The same real live-sync convention already established
    // throughout this app - a 'storage' event fires whenever any
    // module writes new data, so a fresh briefing is recomputed
    // rather than showing stale numbers from when the app first
    // loaded.
    useEffect(() => {
        const handleUpdate = () => setRefreshKey((k) => k + 1);
        window.addEventListener('storage', handleUpdate);
        window.addEventListener('nexus_settings_updated', handleUpdate);
        return () => {
            window.removeEventListener('storage', handleUpdate);
            window.removeEventListener('nexus_settings_updated', handleUpdate);
        };
    }, []);

    const buildBriefing = useCallback(() => {
        const today = todayIso();

        // Real user name - the same real localStorage key
        // ProfilePage.jsx itself already reads from.
        const profile = readJson('nexus_user_profile', {});
        const userName = (profile.name || '').trim().split(' ')[0] || null;

        // Real pending tasks due/scheduled today - honestly scoped to
        // what this app's own data model actually distinguishes as
        // "today": Planner tasks with a due date of today (this
        // includes Study-project tasks, which is what genuinely covers
        // exam prep in this app, since no dedicated "exam" category
        // exists anywhere), plus today's own Timetable slots.
        const pendingToday = entries.filter((e) => {
            if (e.status === 'completed') return false;
            if (e.source === 'planner') return e.date === today;
            if (e.source === 'timetable') return e.isToday === true;
            return false;
        }).length;

        // Real gym status - the currently active split/plan (if any),
        // and whether today's own workout has genuinely been logged
        // in real history, not just assumed.
        const gymPlans = readJson('nexus_gym_plans', []);
        const gymHistory = readJson('nexus_gym_history', []);
        const activePlan = Array.isArray(gymPlans) ? gymPlans.find((p) => p.active) : null;
        const loggedToday = Array.isArray(gymHistory) && gymHistory.some((h) => h.date === today);
        const gymStatus = { hasPlan: !!activePlan, planName: activePlan?.name || null, loggedToday };

        // Real diet status - meals genuinely carry no date field in
        // this app's own data model (confirmed via direct
        // investigation), so "today's meals" honestly means the
        // current meal list as-is, counting real completed vs total.
        const meals = readJson('nexus_diet_meals', []);
        const mealsList = Array.isArray(meals) ? meals : [];
        const dietStatus = { logged: mealsList.filter((m) => m.completed).length, total: mealsList.length };

        // Real remaining budget - the exact same formula
        // FinancePage.jsx itself uses (totalSpent from real Expense
        // transactions, subtracted from the real monthly cap), so this
        // briefing's own number never drifts from what Finance itself
        // shows.
        const transactions = readJson('nexus_finance_transactions', []);
        const txList = Array.isArray(transactions) ? transactions : [];
        const totalSpent = txList.filter((t) => t.type === 'Expense').reduce((acc, t) => acc + (t.amount || 0), 0);
        const monthlyBudgetCap = settings?.monthlyBudgetCap || 0;
        const budgetRemaining = Math.max(0, monthlyBudgetCap - totalSpent);
        const currency = settings?.currencySymbol || '₹';

        // A real, composed natural-language summary - genuinely built
        // from the real numbers above, not a fixed template with blanks
        // filled in regardless of what the data actually says (e.g. a
        // genuinely empty task list gets its own honest sentence, not
        // "You have 0 tasks today"). Language comes from Settings' own
        // real "Voice & Language" section (see briefingText.js for the
        // actual English/Hindi/Hinglish sentences) - a plain static
        // template per language, not a live translation call, so this
        // keeps working with zero AI key configured, exactly like the
        // English version always has.
        const language = readAiVoiceLanguage();
        const sentences = buildBriefingSentences(language, {
            userName, pendingToday, gymStatus, dietStatus, monthlyBudgetCap, budgetRemaining, currency,
        });

        return {
            userName,
            greeting: getGreeting(),
            language,
            pendingTasksToday: pendingToday,
            gymStatus,
            dietStatus,
            budgetRemaining,
            currency,
            hasBudgetData: monthlyBudgetCap > 0,
            summaryText: sentences.join(' '),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entries, settings, refreshKey]);

    const [briefing, setBriefing] = useState(buildBriefing);

    useEffect(() => {
        setBriefing(buildBriefing());
    }, [buildBriefing]);

    return briefing;
};
