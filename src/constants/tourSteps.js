// src/constants/tourSteps.js
//
// Per-page tour step config for TourGuide.jsx - one small, curated set of
// genuinely useful elements per section (2-3 steps, not an exhaustive
// walkthrough of every button). Each `target` value must match a real
// data-tour-id attribute on the actual element in that page's own JSX,
// AND must render unconditionally on that page's own default tab/view -
// TourGuide has no way to open a collapsed section or switch a page's
// internal tab on its own, so a step whose target only exists behind a
// non-default tab would silently show a dud, centered spotlight.
//
// Bodies tightened to real one-liners (explicit request: a first-time
// user's tour text was reading as too wordy/multi-clause for a quick
// mobile tooltip) - each one now says the single thing that matters and
// stops, instead of stacking a second explanatory clause on with a dash.
//
// Deliberately NOT every section: Syllabus (a plain checklist), Analytics
// (read-only charts/dashboards), and Audio Hub (a standard player,
// already teased by Home's own `home-audio` step) have no genuinely
// non-obvious first-visit affordance worth a tour - adding one anyway
// would be exactly the "kachra" this system is meant to avoid.
export const TOUR_STEPS = {
    home: [
        { target: 'home-search', title: 'Search Everything', body: 'Find any task, note, or page - just start typing.' },
        { target: 'home-audio', title: 'Your Focus Audio', body: 'Play, pause, or tap to open the full Audio Hub.' },
        { target: 'home-schedule', title: 'Your Day at a Glance', body: 'Planner, Timetable, Gym, and Diet tasks all land here automatically.' },
    ],
    finance: [
        { target: 'finance-stats', title: 'Your Money at a Glance', body: 'Balance, budget, and spend - updated live.' },
        { target: 'finance-add-account', title: 'Add an Account', body: 'Add a bank, wallet, or card - transactions link to it.' },
        { target: 'finance-tabs', title: 'Explore Finance', body: 'Overview, Transactions, Goals & Bills, and your AI Coach.' },
    ],
    ai: [
        { target: 'ai-menu', title: 'Chat History & More', body: 'Chat history, quick prompts, and coach modes live here.' },
        { target: 'ai-plus', title: 'Attach & Quick Actions', body: 'Start a new chat or try a quick prompt.' },
        { target: 'ai-input', title: 'Ask Anything', body: 'Ask about your day - Nexus AI already knows your data.' },
    ],
    calendar: [
        { target: 'calendar-add-event', title: 'Schedule an Event', body: 'Add a new event to your calendar.' },
        { target: 'calendar-sync', title: 'Sync Your Calendar', body: 'Import or export .ics files with any other calendar app.' },
    ],
    // `category` is a page-specific field (not read by TourGuide.jsx
    // itself) - SettingsPage.jsx's own onBeforeStep reads it to switch
    // Settings' category tab before this step's target is even searched
    // for. Real, confirmed bug fixed by this: settings-modules and
    // settings-display only ever render inside the 'general'/
    // 'appearance' tabs, but Settings always opens on 'account' - so
    // steps 2 and 3 previously spotlighted nothing on a real first run.
    settings: [
        { target: 'settings-account', category: 'account', title: 'Account & Profile', body: 'Manage sign-in, cloud sync, and your profile.' },
        { target: 'settings-modules', category: 'general', title: 'Toggle Hubs', body: 'Some Hubs (like Finance) are off by default - tap a card for what each one does.' },
        { target: 'settings-display', category: 'appearance', title: 'Themes & Visuals', body: 'Themes, wallpapers, and the glass/blur look.' },
    ],
    planner: [
        { target: 'planner-new-task', title: 'Add a Task', body: 'Freeform to-dos and multi-step projects - separate from your fixed daily schedule.' },
        { target: 'planner-tabs', title: 'Filter Your Tasks', body: 'Switch between views to focus on what matters right now.' },
    ],
    study: [
        { target: 'study-new', title: 'Add a Subject', body: 'Start with your Syllabus subjects, then track sessions and progress.' },
        { target: 'study-queue', title: 'Your Study Queue', body: "Today's suggested topics, generated from your own subjects." },
    ],
    gym: [
        { target: 'gym-add-plan', title: 'Build a Workout Plan', body: 'Create your own split - then log sets and reps against it.' },
        { target: 'gym-tabs', title: 'Explore Gym', body: 'Dashboard, plans, and your full workout history.' },
    ],
    diet: [
        { target: 'diet-tabs', title: 'Explore Diet', body: 'Dashboard, meals, and hydration - all in one place.' },
        { target: 'diet-profile', title: 'Set Your Targets', body: 'Your calorie and macro goals live here.' },
    ],
    dailytable: [
        { target: 'dailytable-days', title: 'Pick a Day', body: 'Your timetable is set per day of the week.' },
        { target: 'dailytable-add', title: 'Add an Entry', body: 'Build out that day\'s fixed schedule, slot by slot.' },
    ],
    profile: [
        { target: 'profile-tabs', title: 'Your Full Profile', body: 'Stats, achievements, and account details - all in one place.' },
    ],
};
