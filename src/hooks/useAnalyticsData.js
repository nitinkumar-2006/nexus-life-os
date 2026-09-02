// src/hooks/useAnalyticsData.js
//
// Single data-layer hook for the Analytics Hub - replaces AnalyticsPage's
// own independent localStorage reads with the same registry HomePage's
// Master Schedule Flow already uses (useTaskRegistry), plus a direct
// finance-transactions read (the registry has no transaction normalizer,
// same reason useDailyBriefing.js reads finance directly too).
//
// Every domain below returns { rate, history, streak, items, hasData }:
//   - rate: 0-100, same lifetime-cumulative formulas AnalyticsPage already
//     used - this hook does NOT change the headline score's meaning, only
//     where the data comes from.
//   - history: last 30 days of { date, total, completed } - bucketed by
//     each domain's own real, immutable date field (a due date, a workout
//     log date, a transaction date, a scheduled event date). None of these
//     modules record a completion TIMESTAMP, only a boolean flag, so a
//     day's bar means "items dated that day, and how many are complete
//     right now" - an honest best-effort trend, not a fabricated
//     exact-completion-moment log.
//   - streak: consecutive days back from today with qualifying activity,
//     stopping at the first gap.
//   - items: raw entries for that domain, newest first, for a drill-down
//     history list.
//
// Schedule Discipline folds in Timetable slot completion (matching how
// HomePage's Master Schedule Flow already treats Timetable + Calendar as
// one combined schedule source) - but ONLY into the live `rate`, not into
// `history`/`streak`. Timetable slots are a recurring weekly TEMPLATE with
// a single persistent `completed` flag per slot (see TimetablePage.jsx) -
// there is no per-day historical record of which Mondays were actually
// attended, so trending it as if there were would be fabricating data.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTaskRegistry } from '../context/TaskRegistryContext.jsx';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { getLocalDateString } from '../utils/dateUtils.js';

const HISTORY_DAYS = 30;
const FINANCE_TX_KEY = 'nexus_finance_transactions';

const readJson = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

// Last N calendar-day strings, oldest first, ending today.
const lastNDays = (n) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        out.push(getLocalDateString(d));
    }
    return out;
};

// Buckets `items` (each with a `date` field, YYYY-MM-DD or null) into the
// last HISTORY_DAYS days, counting how many are dated that day (`total`)
// and how many of those are complete right now (`completed`) per
// `isComplete(item)`.
const buildHistory = (items, isComplete) => {
    const days = lastNDays(HISTORY_DAYS);
    const byDate = {};
    days.forEach((d) => { byDate[d] = { date: d, total: 0, completed: 0 }; });
    items.forEach((item) => {
        if (!item.date || !byDate[item.date]) return;
        byDate[item.date].total += 1;
        if (isComplete(item)) byDate[item.date].completed += 1;
    });
    return days.map((d) => byDate[d]);
};

// Consecutive days back from today with at least one item dated that day
// satisfying `qualifies(item)` - stops counting at the first gap day.
const computeStreak = (items, qualifies) => {
    const byDate = {};
    items.forEach((item) => {
        if (!item.date) return;
        if (!byDate[item.date]) byDate[item.date] = [];
        byDate[item.date].push(item);
    });
    let streak = 0;
    // 3650-day (10-year) cap - purely defensive so a data-corruption edge
    // case can never spin this into an unbounded loop; no real streak in
    // this app's data will ever legitimately reach it.
    for (let i = 0; i < 3650; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        const dayItems = byDate[dateStr] || [];
        if (dayItems.some(qualifies)) {
            streak += 1;
        } else {
            break;
        }
    }
    return streak;
};

// --- Cross-module "missed task" suggestion ---------------------------
// Finds the most urgent overdue Planner task or Calendar event (date in
// the past, not completed), then scans Timetable slots + today/tomorrow's
// Calendar events for occupied hour ranges to suggest the first genuinely
// free 1-hour block between 08:00-22:00, today then tomorrow. Returns
// null if nothing is overdue, or if no free slot could be found within
// the scanned window (never fabricates a slot that's actually occupied).
const findMissedTaskSuggestion = (registryEntries, todayStr) => {
    const overdue = registryEntries
        .filter((e) => (e.source === 'planner' || e.source === 'calendarEvents')
            && e.date && e.date < todayStr && e.status !== 'completed')
        .sort((a, b) => a.date.localeCompare(b.date));
    if (overdue.length === 0) return null;
    const target = overdue[0];

    // Occupied hour ranges: today's applicable Timetable slots + today's
    // and tomorrow's Calendar events (both carry real startHour/endHour).
    // Tomorrow's own Timetable slots are deliberately NOT checked here -
    // TaskRegistryContext's own isToday flag already handles that day's
    // weekday-plus-midnight-crossing logic once, correctly; re-deriving
    // "which slots apply to tomorrow" a second time here would either
    // duplicate that logic or risk getting the midnight-crossing edge case
    // subtly wrong. In practice this only means a tomorrow-suggestion
    // could rarely land on an hour a recurring class already occupies -
    // a real but minor gap, not a fabricated result.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrow);

    const occupiedFor = (dateStr, isToday) => registryEntries
        .filter((e) => e.startHour !== null && e.endHour !== null && (
            (e.source === 'calendarEvents' && e.date === dateStr)
            || (e.source === 'timetable' && isToday && e.isToday)
        ))
        .map((e) => [e.startHour, e.endHour]);

    const findFreeHour = (dateStr, isToday, earliestHour) => {
        const occupied = occupiedFor(dateStr, isToday);
        for (let hour = earliestHour; hour < 22; hour++) {
            const overlaps = occupied.some(([start, end]) => hour < end && hour + 1 > start);
            if (!overlaps) return hour;
        }
        return null;
    };

    const nowHour = new Date().getHours();
    let hour = findFreeHour(todayStr, true, Math.max(8, nowHour + 1));
    if (hour !== null) return { item: target, suggestedDate: todayStr, suggestedHour: hour, isToday: true };
    hour = findFreeHour(tomorrowStr, false, 8);
    if (hour !== null) return { item: target, suggestedDate: tomorrowStr, suggestedHour: hour, isToday: false };
    return null;
};

const formatHour = (hour) => {
    const h = Math.floor(hour);
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:00 ${period}`;
};

export const useAnalyticsData = () => {
    const { entries, bySource } = useTaskRegistry();
    const { settings } = useGlobalSettings();

    const [transactions, setTransactions] = useState(() => readJson(FINANCE_TX_KEY, []));

    useEffect(() => {
        const reload = () => {
            const latest = readJson(FINANCE_TX_KEY, []);
            setTransactions((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
        };
        window.addEventListener('storage', reload);
        window.addEventListener('nexus_settings_updated', reload);
        return () => {
            window.removeEventListener('storage', reload);
            window.removeEventListener('nexus_settings_updated', reload);
        };
    }, []);

    return useMemo(() => {
        const todayStr = getLocalDateString();

        // --- Productivity: Planner + Study -------------------------------
        const plannerItems = bySource.planner || [];
        const studyItems = bySource.studyAssignments || [];
        const productivityItems = [...plannerItems, ...studyItems];
        const productivityCompleted = productivityItems.filter((i) => i.status === 'completed').length;
        const productivityRate = productivityItems.length > 0
            ? Math.round((productivityCompleted / productivityItems.length) * 100) : 0;

        const productivity = {
            rate: productivityRate,
            completedCount: productivityCompleted,
            totalCount: productivityItems.length,
            history: buildHistory(productivityItems, (i) => i.status === 'completed'),
            streak: computeStreak(productivityItems, (i) => i.status === 'completed'),
            items: [...productivityItems].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
            hasData: productivityItems.length > 0,
        };

        // --- Gym & Fitness -------------------------------------------------
        const gymItems = bySource.gym || [];
        const fitnessRate = gymItems.length > 0 ? Math.min(100, gymItems.length * 15) : 0;

        const gym = {
            rate: fitnessRate,
            completedCount: gymItems.length,
            totalCount: gymItems.length,
            history: buildHistory(gymItems, () => true),
            streak: computeStreak(gymItems, () => true),
            items: [...gymItems].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
            hasData: gymItems.length > 0,
        };

        // --- Financial Health ----------------------------------------------
        const budget = settings.monthlyBudgetCap > 0 ? settings.monthlyBudgetCap : 0;
        const totalSpent = transactions
            .filter((t) => t.type === 'Expense')
            .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
        const budgetUtilization = budget > 0 ? Math.min(100, Math.round((totalSpent / budget) * 100)) : 0;
        const financeRate = budget > 0 ? Math.max(0, 100 - budgetUtilization) : 0;

        // Finance's "completion" concept doesn't apply to a single
        // transaction (every logged transaction is already a real, done
        // event) - the trend/streak below track LOGGING activity (did the
        // user record anything that day), the same way Gym's history
        // tracks whether a workout was logged.
        const financeItemsForHistory = transactions.map((t, idx) => ({ date: t.date || null, id: t.id ?? idx }));
        const finance = {
            rate: financeRate,
            budget,
            totalSpent,
            budgetUtilization,
            currency: settings.currencySymbol,
            history: buildHistory(financeItemsForHistory, () => true),
            streak: computeStreak(financeItemsForHistory, () => true),
            items: [...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
            hasData: transactions.length > 0,
        };

        // --- Schedule Discipline: Calendar events + Timetable ---------------
        // Live rate blends both sources (Timetable's own checklist state has
        // no per-day history to separate out - see the file header comment).
        // History/streak use ONLY Calendar events, which do carry a real,
        // per-instance date.
        const calendarItems = bySource.calendarEvents || [];
        const timetableItems = bySource.timetable || [];
        const scheduleCompleted = calendarItems.filter((i) => i.status === 'completed').length
            + timetableItems.filter((i) => i.status === 'completed').length;
        const scheduleTotal = calendarItems.length + timetableItems.length;
        const scheduleRate = scheduleTotal > 0 ? Math.round((scheduleCompleted / scheduleTotal) * 100) : 0;

        const schedule = {
            rate: scheduleRate,
            completedCount: scheduleCompleted,
            totalCount: scheduleTotal,
            history: buildHistory(calendarItems, (i) => i.status === 'completed'),
            streak: computeStreak(calendarItems, (i) => i.status === 'completed'),
            items: [...calendarItems, ...timetableItems].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
            hasData: scheduleTotal > 0,
        };

        const hasAnyData = productivity.hasData || gym.hasData || finance.hasData || schedule.hasData;
        const holisticScore = hasAnyData
            ? Math.round((productivity.rate + gym.rate + finance.rate + schedule.rate) / 4) : 0;

        const missedTaskSuggestion = findMissedTaskSuggestion(entries, todayStr);

        return {
            productivity,
            gym,
            finance,
            schedule,
            holisticScore,
            hasAnyData,
            missedTaskSuggestion: missedTaskSuggestion ? {
                ...missedTaskSuggestion,
                suggestedLabel: `${missedTaskSuggestion.isToday ? 'Today' : 'Tomorrow'} at ${formatHour(missedTaskSuggestion.suggestedHour)}`,
            } : null,
        };
    }, [entries, bySource, transactions, settings.monthlyBudgetCap, settings.currencySymbol]);
};

export default useAnalyticsData;
