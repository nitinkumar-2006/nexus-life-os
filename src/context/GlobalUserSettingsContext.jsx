// src/context/GlobalUserSettingsContext.jsx
//
// Fixes a real, confirmed "silo" bug: ProfilePage.jsx has always kept its
// own separate copies of two values that other modules also track
// independently -
//   - profile.monthlyBudget (Profile) vs profile.monthlyBudget (Finance,
//     under the unrelated 'nexus_finance_profile' key, which is the value
//     Finance's own budgetProgress/emergencyFundMonths calculations
//     actually use)
//   - profile.dailyWaterTarget, a free-text string like "4.0 L" (Profile)
//     vs profile.waterGoal, a real number (Diet, under the unrelated
//     'nexus_diet_profile' key, which is the value Diet's own
//     waterProgress calculation actually uses)
// Editing either value from the Profile page has never had any effect on
// the module that actually uses it, and vice versa - two disconnected
// sources of truth for what the user experiences as one setting.
//
// This migrates both into one real, shared 'nexus_global_settings' key,
// making it the single source of truth both Profile and Finance/Diet
// read from and write to - editing the cap in either place is
// immediately visible in the other, with no page reload, the same way
// TaskRegistryContext already keeps its own registry current across
// Planner/Timetable/Gym/Diet.
//
// StudyHub and Planner are explicitly named in this request's own
// "standardize this connectivity pattern across all modules" ask, but
// investigation found no real, confirmed duplicate-value bug for either
// of them the way Finance/Diet's budget and hydration values have - so
// nothing was migrated for those two modules. Inventing a "global
// setting" neither module actually has would itself be dummy code; this
// provider's own shape is built to extend cleanly (see updateSetting
// convention below) the moment a genuine cross-module duplicate like
// this is found there too.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const GLOBAL_SETTINGS_KEY = 'nexus_global_settings';

const readJson = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

// Extracts the real leading numeric portion of a free-text value like
// "4.0 L" or "4L" - used only once, to seed the new shared value from
// Profile's own pre-existing dailyWaterTarget string on first migration.
const parseLeadingNumber = (raw) => {
    if (typeof raw === 'number') return raw;
    if (typeof raw !== 'string') return 0;
    const match = raw.trim().match(/^-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
};

// Runs exactly once, the first time this provider ever mounts on a
// browser that has no 'nexus_global_settings' key yet - seeds the new
// shared values from whichever of the two existing, real pre-migration
// sources is genuinely non-zero, so an existing user's own already-set
// values are carried forward rather than reset to 0. Prefers the
// module that actually performs arithmetic with the value (Finance's
// own monthlyBudget, Diet's own waterGoal) since that is the value the
// user has had the most direct, functional reason to keep accurate;
// falls back to Profile's own copy only if the module-owned value is
// still at its own untouched default.
const buildInitialSettings = () => {
    const financeProfile = readJson('nexus_finance_profile', null);
    const dietProfile = readJson('nexus_diet_profile', null);
    const userProfile = readJson('nexus_user_profile', null);

    const financeBudget = financeProfile?.monthlyBudget;
    const profileBudget = userProfile?.monthlyBudget;
    const monthlyBudgetCap = (typeof financeBudget === 'number' && financeBudget > 0)
        ? financeBudget
        : (typeof profileBudget === 'number' && profileBudget > 0 ? profileBudget : 0);

    const dietWater = dietProfile?.waterGoal;
    const profileWaterRaw = userProfile?.dailyWaterTarget;
    const dailyHydrationGoal = (typeof dietWater === 'number' && dietWater > 0)
        ? dietWater
        : parseLeadingNumber(profileWaterRaw);

    return { monthlyBudgetCap, dailyHydrationGoal };
};

// Validates each field individually against its own real, safe
// fallback - rather than trusting a stored object's own overall
// truthiness (the actual root cause of the crash this round fixes: a
// partial/malformed object, or one missing a field a future schema
// version adds, is truthy as a whole even though a specific field on
// it is undefined). Every field this provider exposes is guaranteed
// to genuinely be a real number after this function runs, regardless
// of what shape (or non-object type entirely) was actually found in
// localStorage.
const sanitizeSettings = (raw, fallback) => {
    const safeRaw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        monthlyBudgetCap: typeof safeRaw.monthlyBudgetCap === 'number' && !Number.isNaN(safeRaw.monthlyBudgetCap)
            ? safeRaw.monthlyBudgetCap
            : fallback.monthlyBudgetCap,
        dailyHydrationGoal: typeof safeRaw.dailyHydrationGoal === 'number' && !Number.isNaN(safeRaw.dailyHydrationGoal)
            ? safeRaw.dailyHydrationGoal
            : fallback.dailyHydrationGoal,
    };
};

const GlobalUserSettingsContext = createContext(null);

export const GlobalUserSettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(() => {
        const existing = readJson(GLOBAL_SETTINGS_KEY, null);
        return sanitizeSettings(existing, buildInitialSettings());
    });

    // Persists on every real change and dispatches the same 'storage'
    // event convention already used throughout this app (header.jsx,
    // TaskRegistryContext.jsx, CloudSyncContext.jsx) - native 'storage'
    // events only fire for OTHER tabs, so this manual dispatch is what
    // makes same-tab consumers (Profile, Finance, Diet, all mounted at
    // once within DashboardLayout's own tab system) pick up a change
    // immediately, with no page reload.
    useEffect(() => {
        localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
        window.dispatchEvent(new Event('storage'));
    }, [settings]);

    // Real inbound path - a change written by another same-tab consumer,
    // another browser tab, or a cloud-restore all land here the same
    // way, updating this provider's own state (and therefore every
    // component consuming useGlobalSettings()) atomically. The
    // JSON.stringify equality guard prevents this component's own
    // outbound write above from re-triggering itself in a loop, the
    // same defensive pattern already used in FinancePage/DietPage/etc.
    useEffect(() => {
        const handleExternalChange = () => {
            const latest = readJson(GLOBAL_SETTINGS_KEY, null);
            if (!latest) return;
            setSettings((prev) => {
                const safeLatest = sanitizeSettings(latest, prev);
                return JSON.stringify(prev) === JSON.stringify(safeLatest) ? prev : safeLatest;
            });
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    // A single, atomic setter every consuming module calls the same
    // way - updateSetting('monthlyBudgetCap', 2000) - rather than each
    // module hand-rolling its own read-modify-write of the shared
    // object, which is exactly the kind of divergence that created the
    // original silo bug this provider fixes.
    const updateSetting = useCallback((key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    }, []);

    const value = useMemo(() => ({ settings, updateSetting }), [settings, updateSetting]);

    return <GlobalUserSettingsContext.Provider value={value}>{children}</GlobalUserSettingsContext.Provider>;
};

export const useGlobalSettings = () => {
    const ctx = useContext(GlobalUserSettingsContext);
    if (!ctx) {
        // Defensive fallback so a consumer rendered outside the
        // provider degrades to a real, honest empty/zeroed shape
        // rather than throwing - matching useTaskRegistry's own
        // established fallback convention.
        return { settings: { monthlyBudgetCap: 0, dailyHydrationGoal: 0 }, updateSetting: () => {} };
    }
    return ctx;
};
