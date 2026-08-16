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

// Mobile's own bottom-dock tab list (Home/Audio/AI/Profile/Settings)
// lives directly in MobileTabBar.jsx now, not here - it isn't a subset
// of ALL_NAV_ITEMS (Audio Hub was never part of this shared list), so a
// name-filter constant no longer fits. Every module in ALL_NAV_ITEMS is
// reachable on mobile via MobileSidebarDrawer.jsx instead.
