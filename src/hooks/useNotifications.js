// src/hooks/useNotifications.js
//
// Point 11: the Notification Center's real data layer. Every notification
// here is DERIVED from actual app state already being tracked elsewhere -
// WeatherContext's own real severe-weather check, today's real Calendar
// events, real unpaid Finance bills, and real overdue Planner tasks - not
// fabricated placeholder content. A category with nothing genuinely
// happening simply contributes zero notifications, matching this app's
// established "never invent data" rule (see WeatherPage/WeatherContext's
// own honest fallbacks).
//
// Read/cleared state persists in localStorage so "Mark All Read"/"Clear
// All" survive a reload. A notification's relative-time badge is backed
// by a real "first detected at" timestamp (nexus_notifications_seen_at) -
// recomputing every minute or on any 'storage' event does NOT reset an
// already-surfaced notification's clock back to "just now"; only a
// genuinely NEW condition gets a fresh timestamp.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertTriangle, Calendar, Wallet, CheckSquare } from 'lucide-react';
import { useWeather } from '../context/WeatherContext.jsx';
import { getLocalDateString } from '../utils/dateUtils.js';

const READ_KEY = 'nexus_notifications_read';
const CLEARED_KEY = 'nexus_notifications_cleared';
const SEEN_AT_KEY = 'nexus_notifications_seen_at';
const DAY_MS = 24 * 60 * 60 * 1000;

const readJson = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

const writeJson = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        /* storage full/unavailable - state still works for this session */
    }
};

// Same "HH:MM AM/PM" -> decimal-hour parser already established in
// TaskRegistryContext.jsx - duplicated here (not imported) since that
// module's version is scoped to its own file-local normalizers and this
// hook has no other dependency on it.
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

// Formats a real Date into "just now" / "10m ago" / "3h ago" / "2d ago" -
// the exact relative-time convention this feature's own spec asks for.
export const formatRelativeTime = (date) => {
    if (!date) return '';
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

// "YYYY-MM-DD" -> a local midnight Date, NOT `new Date(dateStr)` (which
// parses as UTC midnight). Mixing that UTC instant with a local `now` is
// the exact class of bug dateUtils.js's own getLocalDateString already
// documents: for a user ahead of UTC (e.g. IST, +5:30), a bill/task due
// "today" would parse to an instant several hours in the PAST relative
// to local now, making it read as already overdue for most of its due
// day instead of due-today/due-soon.
const parseLocalDateOnly = (dateStr) => {
    const parts = String(dateStr).split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
};

// Builds today's real candidate notifications, content-only (no
// timestamp yet - that's layered on separately below using each item's
// real first-seen moment, not the moment this function happens to run).
const buildCandidates = (severeAlert) => {
    const items = [];
    const todayStr = getLocalDateString();
    const now = new Date();
    const nowHours = now.getHours() + now.getMinutes() / 60;
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (severeAlert) {
        items.push({
            id: `weather_${severeAlert.title.replace(/\s+/g, '_')}`,
            category: 'Weather Alert',
            icon: AlertTriangle,
            title: severeAlert.title,
            description: severeAlert.description,
            accent: severeAlert.level === 'severe' ? 'var(--danger)' : '#F59E0B',
            targetTab: 'weather',
        });
    }

    // Calendar: today's real events, starting within the next 3 hours,
    // not already marked completed - genuinely upcoming, not stale.
    const events = readJson('nexus_calendar_events', []);
    if (Array.isArray(events)) {
        events.filter((ev) => ev.date === todayStr && !ev.completed).forEach((ev) => {
            const startHour = parseClockTime(ev.time);
            if (startHour === null) return;
            const hoursUntil = startHour - nowHours;
            if (hoursUntil > 0 && hoursUntil <= 3) {
                items.push({
                    id: `calendar_${ev.id}`,
                    category: 'Calendar Event',
                    icon: Calendar,
                    title: ev.title || 'Event',
                    description: `Starts at ${ev.time} today${ev.location ? ` · ${ev.location}` : ''}`,
                    accent: 'var(--accent)',
                    targetTab: 'Calendar',
                });
            }
        });
    }

    // Finance: real unpaid bills, either already overdue or due within
    // the next 3 days - the same two-stage split FinancePage's own
    // reminder logic already uses, so this never invents a new threshold.
    const bills = readJson('nexus_finance_bills', []);
    if (Array.isArray(bills)) {
        bills.filter((b) => !b.paid && b.dueDate).forEach((b) => {
            const due = parseLocalDateOnly(b.dueDate);
            if (!due || Number.isNaN(due.getTime())) return;
            const daysUntil = (due.getTime() - todayLocal.getTime()) / DAY_MS;
            if (daysUntil < 0) {
                items.push({
                    id: `bill_overdue_${b.id}`,
                    category: 'Task Update',
                    icon: Wallet,
                    title: `${b.title} is overdue`,
                    description: `Was due ${b.dueDate}${b.amount ? ` · ₹${b.amount}` : ''}`,
                    accent: 'var(--danger)',
                    targetTab: 'Finance',
                });
            } else if (daysUntil <= 3) {
                items.push({
                    id: `bill_duesoon_${b.id}`,
                    category: 'Task Update',
                    icon: Wallet,
                    title: `${b.title} due soon`,
                    description: `Due ${b.dueDate}${b.amount ? ` · ₹${b.amount}` : ''}`,
                    accent: 'var(--accent)',
                    targetTab: 'Finance',
                });
            }
        });
    }

    // Planner: real tasks more than a day past their own due date - the
    // "more than a day" floor avoids same-day noise for a task simply due
    // "today", which isn't genuinely overdue yet.
    const tasks = readJson('nexus_planner_tasks', []);
    if (Array.isArray(tasks)) {
        tasks.filter((t) => !t.completed && t.dueDate).forEach((t) => {
            const due = parseLocalDateOnly(t.dueDate);
            if (!due || Number.isNaN(due.getTime())) return;
            if (due.getTime() < todayLocal.getTime() - DAY_MS) {
                items.push({
                    id: `task_overdue_${t.id}`,
                    category: 'Task Update',
                    icon: CheckSquare,
                    title: `${t.title} is overdue`,
                    description: `Was due ${t.dueDate}`,
                    accent: 'var(--danger)',
                    targetTab: 'Planner',
                });
            }
        });
    }

    return items;
};

export const useNotifications = () => {
    const { severeAlert } = useWeather();
    const [readIds, setReadIds] = useState(() => new Set(readJson(READ_KEY, [])));
    const [clearedIds, setClearedIds] = useState(() => new Set(readJson(CLEARED_KEY, [])));
    const [seenAt, setSeenAt] = useState(() => readJson(SEEN_AT_KEY, {}));
    // Bumped every minute (for time-based conditions like "starts within
    // 3 hours" drifting true/false purely from the clock moving) and on
    // every 'storage' event (a bill get paid, a task completed elsewhere)
    // - the actual trigger for useMemo below to recompute.
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick((t) => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleStorage = () => setTick((t) => t + 1);
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const candidates = useMemo(() => buildCandidates(severeAlert), [severeAlert, tick]);

    // Stamps each genuinely-new candidate id with its real first-seen
    // time and persists it - a plain side effect (not derived inline in
    // the memo above) since it needs to both read AND write the same
    // localStorage key without racing itself across renders.
    useEffect(() => {
        setSeenAt((prev) => {
            let changed = false;
            const next = { ...prev };
            candidates.forEach((item) => {
                if (!(item.id in next)) {
                    next[item.id] = Date.now();
                    changed = true;
                }
            });
            if (changed) writeJson(SEEN_AT_KEY, next);
            return changed ? next : prev;
        });
    }, [candidates]);

    const notifications = useMemo(() => {
        return candidates
            .filter((item) => !clearedIds.has(item.id))
            .map((item) => ({
                ...item,
                read: readIds.has(item.id),
                timestamp: seenAt[item.id] ? new Date(seenAt[item.id]) : new Date(),
            }))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [candidates, clearedIds, readIds, seenAt]);

    const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

    const markRead = useCallback((id) => {
        setReadIds((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            writeJson(READ_KEY, [...next]);
            return next;
        });
    }, []);

    const markAllRead = useCallback(() => {
        setReadIds((prev) => {
            const next = new Set(prev);
            candidates.forEach((item) => next.add(item.id));
            writeJson(READ_KEY, [...next]);
            return next;
        });
    }, [candidates]);

    const clearAll = useCallback(() => {
        setClearedIds((prev) => {
            const next = new Set(prev);
            candidates.forEach((item) => next.add(item.id));
            writeJson(CLEARED_KEY, [...next]);
            return next;
        });
    }, [candidates]);

    return { notifications, unreadCount, markRead, markAllRead, clearAll };
};
