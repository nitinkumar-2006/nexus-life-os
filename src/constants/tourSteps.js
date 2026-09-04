// src/constants/tourSteps.js
//
// Per-page tour step config for TourGuide.jsx - one small, curated set of
// genuinely useful elements per section (2-3 steps, not an exhaustive
// walkthrough of every button). Each `target` value must match a real
// data-tour-id attribute on the actual element in that page's own JSX.
//
// Bodies tightened to real one-liners (explicit request: a first-time
// user's tour text was reading as too wordy/multi-clause for a quick
// mobile tooltip) - each one now says the single thing that matters and
// stops, instead of stacking a second explanatory clause on with a dash.
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
    settings: [
        { target: 'settings-account', title: 'Account & Profile', body: 'Manage sign-in, cloud sync, and your profile.' },
        { target: 'settings-modules', title: 'Toggle Hubs', body: 'Turn Hubs on or off to customize your Nexus.' },
        { target: 'settings-display', title: 'Themes & Visuals', body: 'Themes, wallpapers, and the glass/blur look.' },
    ],
};
