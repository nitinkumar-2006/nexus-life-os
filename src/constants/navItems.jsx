// src/constants/navItems.jsx
//
// Single source of truth for the app's primary navigation list - shared by
// the desktop Sidebar and the mobile bottom tab bar / More sheet, so a
// module toggled off in Settings (activeModules) or added/renamed here
// stays in sync across both surfaces instead of two hand-maintained copies
// drifting apart. Icon fields hold the component reference itself (not an
// instantiated element), so each consumer can render it at its own size.
import { Command, CheckSquare, BookOpen, Dumbbell, Apple, Wallet, Calendar, BarChart2, Cpu, FileText, User, Clock } from 'lucide-react';

export const ALL_NAV_ITEMS = [
    { name: 'Home', id: 'home', icon: Command, essential: true },
    { name: 'Planner', id: 'planner', icon: CheckSquare },
    { name: 'Daily Table', id: 'dailytable', icon: Clock, essential: true },
    { name: 'Study', id: 'study', icon: BookOpen },
    { name: 'Syllabus', id: 'syllabus', icon: FileText, essential: true },
    { name: 'Gym', id: 'gym', icon: Dumbbell },
    { name: 'Diet', id: 'diet', icon: Apple },
    { name: 'Finance', id: 'finance', icon: Wallet },
    { name: 'Calendar', id: 'calendar', icon: Calendar },
    { name: 'Analytics', id: 'analytics', icon: BarChart2 },
    { name: 'AI', id: 'ai', icon: Cpu },
    { name: 'Profile', id: 'profile', icon: User, essential: true },
];

// The 5 tabs that get a permanent slot in the mobile bottom bar - everything
// else (plus Settings/Audio Hub, which aren't in ALL_NAV_ITEMS since the
// desktop Sidebar renders them separately too) lives in the More sheet.
export const MOBILE_PRIMARY_TAB_NAMES = ['Home', 'Planner', 'Study', 'Finance', 'Gym'];
