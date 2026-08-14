// src/context/TaskRegistryContext.jsx
//
// A single, unified registry aggregating real tasks/events from every
// schedulable module in the app - Daily Planner, Timetable slots, Gym
// workout history, and Diet meal log - into one consistent shape:
//
//   { id, title, category, source, startHour, endHour, date, status, raw }
//
// This is PART 1: the store itself. It reads each module's genuine
// localStorage data and normalizes it - nothing here is fabricated. Where
// a source module doesn't record a clock time (Planner tasks just have a
// due date; a finished Gym session is logged with a date but no time of
// day), startHour/endHour stay null rather than being invented, so any
// consumer can tell the difference between "this really has no time" and
// "this happens at midnight." The one deliberate, documented convention is
// Diet meals: they're logged as a single point in time, so endHour is
// startHour + 30 minutes for display purposes - the startHour itself is
// always the real logged time, never guessed.
//
// "Automatically registered" (per the Part 1 requirement) means this
// actually needs to react to changes made in ANY of those four modules
// without a page reload - native browser 'storage' events only fire for
// OTHER tabs, not same-tab writes, so this relies on the same
// window.dispatchEvent(new Event('storage')) convention already used
// elsewhere in this app (header.jsx, ProfilePage.jsx, CloudSyncContext.jsx)
// after a save, which the four source modules now also do.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEYS = {
    planner: 'nexus_planner_tasks',
    timetable: 'nexus_timetable_data',
    gymHistory: 'nexus_gym_history',
    gymPlans: 'nexus_gym_plans',
    dietMeals: 'nexus_diet_meals',
    dietGrocery: 'nexus_diet_grocery',
    syllabus: 'nexus_syllabus_subjects',
    studyAssignments: 'nexus_study_assignments',
    financeBills: 'nexus_finance_bills',
    calendarEvents: 'nexus_calendar_events',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Parses "8:00 AM" / "08:30 PM" into a decimal hour (e.g. 8, 20.5) - returns
// null for anything that doesn't match, so callers can tell "no time" apart
// from "time zero" instead of silently defaulting to midnight.
const parseClockTime = (raw) => {
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

// Parses "08:00 AM - 10:00 AM" into { startHour, endHour } - both null if
// either side fails to parse cleanly, since a half-parsed range isn't
// trustworthy enough to schedule anything against.
const parseTimeRange = (raw) => {
    if (!raw || typeof raw !== 'string') return { startHour: null, endHour: null };
    const parts = raw.split('-').map((p) => p.trim());
    if (parts.length !== 2) return { startHour: null, endHour: null };
    const startHour = parseClockTime(parts[0]);
    const endHour = parseClockTime(parts[1]);
    if (startHour === null || endHour === null) return { startHour: null, endHour: null };
    return { startHour, endHour };
};

const readJson = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

// --- Per-source normalizers - each converts that module's own native
// shape into the shared registry schema. ---

const normalizePlannerTasks = () => {
    const tasks = readJson(STORAGE_KEYS.planner, []);
    if (!Array.isArray(tasks)) return [];
    return tasks.map((t, idx) => ({
        id: `planner_${t.id ?? idx}`,
        title: t.title || 'Untitled task',
        category: t.project || 'Planner',
        source: 'planner',
        startHour: null, // Planner tasks carry a due date, not a clock time
        endHour: null,
        date: t.dueDate || null,
        status: t.completed ? 'completed' : (t.status === 'In Progress' ? 'active' : 'pending'),
        raw: t,
    }));
};

const normalizeTimetableSlots = () => {
    const data = readJson(STORAGE_KEYS.timetable, {});
    if (!data || typeof data !== 'object') return [];
    const todayName = DAY_NAMES[new Date().getDay()];
    const out = [];
    Object.keys(data).forEach((day) => {
        const slots = Array.isArray(data[day]) ? data[day] : [];
        slots.forEach((slot, idx) => {
            const { startHour, endHour } = parseTimeRange(slot.time);
            out.push({
                id: `timetable_${day}_${idx}`,
                title: slot.title || 'Untitled slot',
                category: slot.category || 'Timetable',
                source: 'timetable',
                startHour,
                endHour,
                date: null, // weekly-recurring template, not tied to one calendar date
                day,
                isToday: day === todayName,
                // Reflects the real completed flag now tracked on each
                // slot (added alongside the Timetable page's own check-off
                // UI) - genuinely 'completed' when checked, not a
                // hardcoded guess.
                status: slot.completed ? 'completed' : 'pending',
                raw: slot,
            });
        });
    });
    return out;
};

const normalizeGymHistory = () => {
    const history = readJson(STORAGE_KEYS.gymHistory, []);
    if (!Array.isArray(history)) return [];
    return history.map((entry, idx) => ({
        id: `gym_${entry.id ?? idx}`,
        title: entry.title || 'Workout session',
        category: 'Fitness',
        source: 'gym',
        startHour: null, // logged with a date, not a clock time
        endHour: null,
        date: entry.date || null,
        status: 'completed', // every entry here is, by definition, an already-finished session
        raw: entry,
    }));
};

// Active workout plans represent a genuinely scheduled, upcoming activity
// (the same kind of thing Timetable slots or Syllabus topics represent),
// but previously had zero presence in the registry - only completed
// history did. Cross-references today's real workout history by plan
// name so a plan already finished today correctly shows completed rather
// than lingering as pending after it's genuinely done.
const normalizeGymPlans = () => {
    const plans = readJson(STORAGE_KEYS.gymPlans, []);
    const history = readJson(STORAGE_KEYS.gymHistory, []);
    if (!Array.isArray(plans)) return [];
    const todayStr = new Date().toISOString().split('T')[0];
    const completedTodayTitles = new Set(
        (Array.isArray(history) ? history : [])
            .filter((h) => h.date === todayStr)
            .map((h) => h.title)
    );
    return plans
        .filter((p) => p.active)
        .map((plan) => ({
            id: `gymPlan_${plan.id}`,
            title: plan.name || 'Workout Plan',
            category: 'Fitness',
            source: 'gymPlans',
            startHour: null,
            endHour: null,
            date: null,
            status: completedTodayTitles.has(plan.name) ? 'completed' : 'pending',
            raw: plan,
        }));
};

const normalizeDietMeals = () => {
    const meals = readJson(STORAGE_KEYS.dietMeals, []);
    if (!Array.isArray(meals)) return [];
    return meals.map((meal, idx) => {
        const startHour = parseClockTime(meal.time);
        return {
            id: `diet_${meal.id ?? idx}`,
            title: meal.title || 'Meal',
            category: 'Diet',
            source: 'diet',
            startHour,
            // A documented 30-minute display window around the real logged
            // time - the time itself is never fabricated, only this window.
            endHour: startHour === null ? null : startHour + 0.5,
            date: null,
            status: meal.completed ? 'completed' : 'pending',
            raw: meal,
        };
    });
};

// Unpurchased grocery items are a genuinely real, actionable to-do item -
// the same kind of thing Syllabus topics or Study assignments already
// represent - but previously had zero presence in the registry at all.
const normalizeGroceryItems = () => {
    const items = readJson(STORAGE_KEYS.dietGrocery, []);
    if (!Array.isArray(items)) return [];
    return items.map((item, idx) => ({
        id: `grocery_${item.id ?? idx}`,
        title: item.name || 'Grocery item',
        category: 'Diet',
        source: 'dietGrocery',
        startHour: null,
        endHour: null,
        date: null,
        status: item.purchased ? 'completed' : 'pending',
        raw: item,
    }));
};

// Unpaid bills carry a real due date (now genuinely editable in the
// modal, not silently stuck at creation-day's date) and represent a
// genuine financial deadline - exactly the kind of thing this request
// asks to connect to the dashboard's schedule.
const normalizeFinanceBills = () => {
    const bills = readJson(STORAGE_KEYS.financeBills, []);
    if (!Array.isArray(bills)) return [];
    return bills.map((bill, idx) => ({
        id: `financeBill_${bill.id ?? idx}`,
        title: bill.title || 'Bill',
        category: 'Finance',
        source: 'financeBills',
        startHour: null,
        endHour: null,
        date: bill.dueDate || null,
        status: bill.paid ? 'completed' : 'pending',
        raw: bill,
    }));
};

// Calendar's own scheduled events (created via "Schedule Event") had
// zero presence in the registry before this fix, despite CalendarPage
// literally being the "Master Schedule Hub" - arguably the most direct
// gap in this whole connectivity series. Reuses the existing
// parseClockTime parser since an event's time field is stored in the
// exact same "HH:MM AM/PM" format already handled for other sources,
// giving a real 30-minute display window around the real logged time.
const normalizeCalendarEvents = () => {
    const events = readJson(STORAGE_KEYS.calendarEvents, []);
    if (!Array.isArray(events)) return [];
    return events.map((ev, idx) => {
        const startHour = parseClockTime(ev.time);
        return {
            id: `calendarEvent_${ev.id ?? idx}`,
            title: ev.title || 'Event',
            category: 'Calendar',
            source: 'calendarEvents',
            startHour,
            endHour: startHour === null ? null : startHour + 0.5,
            date: ev.date || null,
            status: ev.completed ? 'completed' : 'pending',
            raw: ev,
        };
    });
};

// Syllabus topics are checklist items scoped to a subject/unit, not
// scheduled events - they carry no real clock time or calendar date, so
// startHour/endHour/date honestly stay null rather than inventing one.
// subjectId/unitId/subjectName/unitName ride along beyond the shared base
// shape so a dashboard consumer has enough context to route a click back
// to the exact subject that owns this topic.
const normalizeSyllabusTopics = () => {
    const subjects = readJson(STORAGE_KEYS.syllabus, []);
    if (!Array.isArray(subjects)) return [];
    const out = [];
    subjects.forEach((subject) => {
        const units = Array.isArray(subject.units) ? subject.units : [];
        units.forEach((unit) => {
            const topics = Array.isArray(unit.topics) ? unit.topics : [];
            topics.forEach((topic) => {
                out.push({
                    id: `syllabus_${subject.id}_${unit.id}_${topic.id}`,
                    title: `${topic.name} — ${subject.name} (${unit.name})`,
                    category: 'Syllabus',
                    source: 'syllabus',
                    startHour: null,
                    endHour: null,
                    date: null,
                    status: topic.done ? 'completed' : 'pending',
                    raw: topic,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    unitId: unit.id,
                    unitName: unit.name,
                });
            });
        });
    });
    return out;
};

// Study assignments carry a real due date but no clock time - same
// honest-null convention as Planner tasks. Status is genuinely read from
// the real 'Pending'/'Completed' field StudyPage's own toggle already
// maintains, not guessed.
const normalizeStudyAssignments = () => {
    const assignments = readJson(STORAGE_KEYS.studyAssignments, []);
    if (!Array.isArray(assignments)) return [];
    return assignments.map((a, idx) => ({
        id: `studyAssignment_${a.id ?? idx}`,
        title: a.title || 'Untitled assignment',
        category: 'Study',
        source: 'studyAssignments',
        startHour: null,
        endHour: null,
        date: a.dueDate || null,
        status: a.status === 'Completed' ? 'completed' : 'pending',
        raw: a,
    }));
};

const buildRegistry = () => [
    ...normalizePlannerTasks(),
    ...normalizeTimetableSlots(),
    ...normalizeGymHistory(),
    ...normalizeGymPlans(),
    ...normalizeDietMeals(),
    ...normalizeGroceryItems(),
    ...normalizeFinanceBills(),
    ...normalizeCalendarEvents(),
    ...normalizeSyllabusTopics(),
    ...normalizeStudyAssignments(),
];

const TaskRegistryContext = createContext(null);

export const TaskRegistryProvider = ({ children }) => {
    const [entries, setEntries] = useState(buildRegistry);

    const refresh = useCallback(() => {
        setEntries(buildRegistry());
    }, []);

    useEffect(() => {
        // Real 'storage' events cover changes from OTHER tabs automatically;
        // the manual dispatch in the four source modules' own save effects
        // is what makes this reactive to same-tab changes too, without
        // needing a page reload to see a newly-added task appear here.
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, [refresh]);

    const bySource = useMemo(() => {
        const grouped = { planner: [], timetable: [], gym: [], diet: [], syllabus: [], studyAssignments: [], gymPlans: [], dietGrocery: [], financeBills: [], calendarEvents: [] };
        entries.forEach((e) => { if (grouped[e.source]) grouped[e.source].push(e); });
        return grouped;
    }, [entries]);

    const value = { entries, bySource, refresh };
    return <TaskRegistryContext.Provider value={value}>{children}</TaskRegistryContext.Provider>;
};

export const useTaskRegistry = () => {
    const ctx = useContext(TaskRegistryContext);
    if (!ctx) {
        // Defensive fallback so a consumer rendered outside the provider
        // degrades to "empty registry" rather than throwing.
        return { entries: [], bySource: { planner: [], timetable: [], gym: [], diet: [], syllabus: [], studyAssignments: [], gymPlans: [], dietGrocery: [], financeBills: [], calendarEvents: [] }, refresh: () => {} };
    }
    return ctx;
};
