// src/constants/moduleMeta.js
//
// One short, honest description per Hub, keyed by the exact
// `settings.activeModules` id - the single source of truth the OS Module
// Manager (SettingsPage.jsx) reads from, so a module's description never
// has to be duplicated between the Settings UI and the tour tooltip text.
//
// Real, explicit request: a first-time user had zero way to know what a
// Hub actually does before toggling it, and specifically no honest
// explanation of why Finance is off by default on a native/APK build.
import { ClipboardList, BookOpen, Activity, Utensils, DollarSign, CalendarDays, BarChart2, Cpu } from 'lucide-react';

export const MODULE_META = {
    planner: {
        icon: ClipboardList,
        label: 'Planner',
        description: 'Freeform to-dos and multi-step projects, separate from your fixed daily schedule.',
    },
    study: {
        icon: BookOpen,
        label: 'Study',
        description: 'Track subjects, sessions, and progress linked to your Syllabus.',
    },
    gym: {
        icon: Activity,
        label: 'Gym',
        description: 'Log workouts, sets, and reps against your own workout plans.',
    },
    diet: {
        icon: Utensils,
        label: 'Diet',
        description: 'Track meals, calories, and hydration against your daily targets.',
    },
    finance: {
        icon: DollarSign,
        label: 'Finance',
        description: 'Manual transaction tracking, budgets, and goals - works fully on its own.',
        // Real, confirmed fact (not a guess): this app's Android manifest
        // no longer declares READ_SMS/RECEIVE_SMS at all (removed in an
        // earlier fix - that permission pairing was getting sideloaded
        // APKs flagged/blocked by Play Protect as an SMS-interception
        // signature). So there genuinely is no SMS access to warn about
        // right now, on any platform - a browser could never read SMS
        // either. This says so plainly instead of either staying silent
        // (the original gap) or inventing a privacy warning that isn't
        // true of the app's actual current behavior.
        offByDefaultNote: (isNative) => (isNative
            ? "Off by default here. Automatic SMS transaction detection needs a permission this build doesn't request, so it's not available right now - manual tracking, budgets, and goals all work the same either way."
            : null),
    },
    calendar: {
        icon: CalendarDays,
        label: 'Calendar',
        description: 'Schedule events and sync with other calendar apps via .ics import/export.',
    },
    analytics: {
        icon: BarChart2,
        label: 'Analytics',
        description: 'Cross-module trends, streaks, and productivity charts.',
    },
    ai: {
        icon: Cpu,
        label: 'AI',
        description: 'Chat with Nexus AI about your own data across every Hub.',
    },
};
