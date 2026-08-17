// src/constants/tourSteps.js
//
// Per-page tour step config for TourGuide.jsx - one small, curated set of
// genuinely useful elements per section (2-3 steps, not an exhaustive
// walkthrough of every button). Each `target` value must match a real
// data-tour-id attribute on the actual element in that page's own JSX.
export const TOUR_STEPS = {
    home: [
        { target: 'home-search', title: 'Search Everything', body: 'Find tasks, notes, and pages from anywhere in Nexus - just start typing.' },
        { target: 'home-audio', title: 'Your Focus Audio', body: "Control what's playing right here, or tap this to open the full Audio Hub with playlists and queue." },
        { target: 'home-schedule', title: 'Your Day at a Glance', body: 'Tasks from Planner, Timetable, Gym, and Diet all show up here automatically - no extra setup needed.' },
    ],
    finance: [
        { target: 'finance-stats', title: 'Your Money at a Glance', body: 'Balance, budget remaining, and monthly spend - all updated live as you add transactions.' },
        { target: 'finance-add-account', title: 'Add an Account', body: 'Start by adding a bank account, wallet, or card - every transaction links to one of these.' },
        { target: 'finance-tabs', title: 'Explore Finance', body: 'Switch between Overview, Transactions, Goals & Bills, and your AI Finance Coach here.' },
    ],
    ai: [
        { target: 'ai-menu', title: 'Chat History & More', body: 'Open this menu for past conversations, quick prompts, and switching between assistant modes.' },
        { target: 'ai-plus', title: 'Attach & Quick Actions', body: 'Start a new chat or jump to a quick prompt from here.' },
        { target: 'ai-input', title: 'Ask Anything', body: 'Type a question about your schedule, finances, study plan, or anything else - the AI has real context on your Nexus data.' },
    ],
    calendar: [
        { target: 'calendar-add-event', title: 'Schedule an Event', body: 'Add a new event directly to your Nexus calendar.' },
        { target: 'calendar-sync', title: 'Sync Your Calendar', body: 'Import or export .ics files to bring events in from - or send events out to - any other calendar app.' },
    ],
    settings: [
        { target: 'settings-account', title: 'Account & Profile', body: 'Manage your sign-in, cloud account, and full profile from here.' },
        { target: 'settings-modules', title: 'Toggle Hubs', body: 'Turn any Hub on or off to customize which modules show up across Nexus.' },
        { target: 'settings-display', title: 'Themes & Visuals', body: 'Switch themes, pick a wallpaper, and fine-tune the glass/blur look of the whole app.' },
    ],
};
