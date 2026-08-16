// src/pages/PlannerPage.jsx
import { useState, useEffect } from 'react';
import {
    CheckSquare, Circle, Plus, Trash2, Calendar,
    Clock, ArrowUpRight, ClipboardList,
    Search, List, Columns, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useMicroFeedback } from '../hooks/useMicroFeedback.js';
import { toTitleCase } from '../utils/textFormat.js';
import { sanitizeNumberInput } from '../utils/smartNumberInput.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
const PlannerPage = ({ setActiveTab }) => {
    const { taskComplete, modalOpen } = useMicroFeedback();
    const isMobile = useIsMobile();
    // 1. FIXED: Removed all hardcoded dummy data. Now if storage is empty, it returns a 100% blank array [].
    const [tasks, setTasks] = useState(() => {
        const saved = localStorage.getItem('nexus_planner_tasks');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return []; // <-- Yahi wo fix है! अब रिसेट करने के बाद 0 टास्क दिखेंगे।
    });

    const [activeTab, setActiveTabFilter] = useState('All Tasks');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'kanban'
    
    // Form state for new task
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [project, setProject] = useState('Study');
    const [isCustomDomain, setIsCustomDomain] = useState(false);
    const [customDomain, setCustomDomain] = useState('');
    const [priority, setPriority] = useState('High');
    const [dueDate, setDueDate] = useState('');
    const [estimatedMins, setEstimatedMins] = useState(60);

    useEffect(() => {
        localStorage.setItem('nexus_planner_tasks', JSON.stringify(tasks));
        // Native 'storage' events only fire for OTHER tabs - this manual
        // dispatch (the same convention already used by header.jsx,
        // ProfilePage.jsx, CloudSyncContext.jsx) is what lets the
        // centralized Task Registry pick up a same-tab change immediately.
        window.dispatchEvent(new Event('storage'));
    }, [tasks]);

    // The effect above only pushes THIS component's own changes out - it
    // doesn't pull in changes made elsewhere. header.jsx's Quick Add
    // feature writes directly to the same nexus_planner_tasks key, fully
    // bypassing this component's own tasks state - without this listener,
    // a task added via Quick Add while this page happens to be mounted
    // would update the dashboard's registry correctly but never actually
    // appear in the Planner's own list until a full remount. The
    // JSON.stringify equality check is what keeps this from looping with
    // the effect above: once the incoming data already matches what this
    // component already has, the redundant setTasks call is skipped
    // entirely, so this component's own writes never re-trigger themselves.
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
                setTasks((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    const handleCreateTask = (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        // Either a standard category from the dropdown, or whatever custom
        // ad-hoc tag the user typed (e.g. "#Hackathon", "#Trip") - falls
        // back to a plain 'Custom' label only if they picked custom but
        // left the field blank, rather than saving an empty domain.
        const resolvedProject = toTitleCase(isCustomDomain ? (customDomain.trim() || 'Custom') : project);

        const newTask = {
            id: Date.now().toString(),
            title: toTitleCase(title.trim()),
            description: description.trim(),
            project: resolvedProject,
            priority,
            status: 'To Do',
            dueDate: dueDate || new Date().toISOString().split('T')[0],
            estimatedMins: Number(estimatedMins),
            completed: false
        };

        setTasks([newTask, ...tasks]);
        setTitle('');
        setDescription('');
        setDueDate('');
        setIsCustomDomain(false);
        setCustomDomain('');
        setIsModalOpen(false);
    };

    const toggleTaskCompletion = (id) => {
        const task = tasks.find(t => t.id === id);
        const willBeCompleted = task && !task.completed;
        if (willBeCompleted) taskComplete();
        setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed, status: !t.completed ? 'Completed' : 'To Do' } : t));
    };

    // Full 3-state control for the Kanban board below - 'completed' is kept
    // in sync automatically (true only for the Completed column) so every
    // OTHER page reading nexus_planner_tasks (Home's queue, Analytics, the
    // header's notification bell) keeps working exactly as before; none of
    // them need to know a third status value exists now.
    const setTaskStatus = (id, newStatus) => {
        const task = tasks.find(t => t.id === id);
        if (newStatus === 'Completed' && task && task.status !== 'Completed') taskComplete();
        setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus, completed: newStatus === 'Completed' } : t));
    };

    const deleteTask = (id) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    // Category -> destination module page, for the clickable source badge
    // on every task card. Mirrors the same convention already established
    // in HomePage.jsx's queue cards (Fitness -> Gym, Development -> Planner)
    // so a category routes to the same place everywhere in the app.
    const CATEGORY_TAB = {
        Study: 'Study', Syllabus: 'Syllabus', Fitness: 'Gym', Gym: 'Gym', Diet: 'Diet',
        Finance: 'Finance', Calendar: 'Calendar', Analytics: 'Analytics', AI: 'AI', Development: 'Planner',
    };
    const handleSourceBadgeClick = (project) => {
        const tab = CATEGORY_TAB[project];
        if (tab && typeof setActiveTab === 'function') setActiveTab(tab);
    };

    // Filter logic: the active tab and the real-time search box compose
    // together (both apply at once) rather than one replacing the other -
    // e.g. the "Active" tab + typing "binary" shows only active tasks whose
    // title/description actually contains "binary".
    const filteredTasks = tasks.filter(t => {
        if (activeTab === 'Active' && t.completed) return false;
        if (activeTab === 'Completed' && !t.completed) return false;
        if (activeTab === 'Study' && t.project !== 'Study') return false;
        if (activeTab === 'Fitness' && t.project !== 'Fitness') return false;
        if (activeTab === 'Finance' && t.project !== 'Finance') return false;
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            const haystack = `${t.title} ${t.description || ''}`.toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });

    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const highPriorityCount = tasks.filter(t => t.priority === 'High' && !t.completed).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease' }}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Planner Command Center</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>Manage operational workflows, projects, priorities, and execution schedules.</p>
                </div>
                
                <button
                    onClick={() => { modalOpen(); setIsModalOpen(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 22px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.3)' }}
                >
                    <Plus size={18} /> New Task
                </button>
            </div>

            {/* KPI Metric Cards - a real, compact 3-column grid on mobile
                (was auto-fit/minmax(220px,...), which is wider than half
                a phone screen, so each card forced itself onto its own
                full-width row instead of the three sitting together in
                one glanceable row) with shorter labels and stacked
                number/subtext so nothing wraps or overflows at 110px-ish
                column width. Desktop keeps the original layout untouched. */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? '10px' : '20px' }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '16px' : '20px', padding: isMobile ? '12px 10px' : '20px 24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '2px' : '10px', minWidth: 0 }}>
                    <span style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isMobile ? 'TASKS' : 'TOTAL TASKS'}</span>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'baseline', gap: isMobile ? 0 : '8px' }}>
                        <span style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: 'var(--text-primary)' }}>{totalCount}</span>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{isMobile ? 'Total' : 'Active Workspace'}</span>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '16px' : '20px', padding: isMobile ? '12px 10px' : '20px 24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '2px' : '10px', minWidth: 0 }}>
                    <span style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isMobile ? 'DONE %' : 'COMPLETION RATE'}</span>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'baseline', gap: isMobile ? 0 : '8px' }}>
                        <span style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: '#10B981' }}>{completionRate}%</span>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{completedCount} Done</span>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '16px' : '20px', padding: isMobile ? '12px 10px' : '20px 24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '2px' : '10px', minWidth: 0 }}>
                    <span style={{ fontSize: isMobile ? '10px' : '12px', fontWeight: '700', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isMobile ? 'HIGH PRI.' : 'HIGH PRIORITY PENDING'}</span>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'baseline', gap: isMobile ? 0 : '8px' }}>
                        <span style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: '#EF4444' }}>{highPriorityCount}</span>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{isMobile ? 'Pending' : 'Requires Focus'}</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px',
                maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
            }}>
                {['All Tasks', 'Active', 'Completed', 'Study', 'Fitness', 'Finance'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTabFilter(tab)}
                        style={{
                            padding: isMobile ? '8px 16px' : '10px 20px', borderRadius: '9999px', fontSize: isMobile ? '12px' : '13px', fontWeight: '700', cursor: 'pointer',
                            background: activeTab === tab ? 'var(--primary)' : 'var(--bg-surface)',
                            color: activeTab === tab ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                            border: '1px solid var(--border-premium)', transition: 'all 0.2s ease', whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Search + View Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isMobile ? '10px' : '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: isMobile ? '100%' : '320px' }}>
                    <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                        type="text"
                        aria-label="Search tasks"
                        placeholder={isMobile ? 'Search tasks...' : 'Search tasks by title or keyword...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: isMobile ? '9px 14px 9px 38px' : '10px 14px 10px 38px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                {/* iOS-style segmented control - a fully pill-rounded outer
                    track with the active option's own pill sliding between
                    the two positions, matching the same shape language as
                    the pill search bar and New Task button beside it. */}
                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '9999px', padding: '4px', flexShrink: 0 }}>
                    <button
                        onClick={() => setViewMode('list')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 14px' : '8px 16px', borderRadius: '9999px', border: 'none', cursor: 'pointer',
                            fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', transition: 'background 0.2s ease, color 0.2s ease',
                            background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                            color: viewMode === 'list' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                        }}
                    >
                        <List size={14} /> List
                    </button>
                    <button
                        onClick={() => setViewMode('kanban')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: isMobile ? '7px 14px' : '8px 16px', borderRadius: '9999px', border: 'none', cursor: 'pointer',
                            fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', transition: 'background 0.2s ease, color 0.2s ease',
                            background: viewMode === 'kanban' ? 'var(--primary)' : 'transparent',
                            color: viewMode === 'kanban' ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                        }}
                    >
                        <Columns size={14} /> Kanban
                    </button>
                </div>
            </div>

            {/* Task List Container */}
            {viewMode === 'list' && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, borderBottom: '1px solid var(--border-premium)', paddingBottom: '12px' }}>
                    {activeTab} Queue ({filteredTasks.length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredTasks.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', padding: isMobile ? '36px 20px' : '48px 0' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <ClipboardList size={22} />
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600', margin: 0 }}>No tasks in this queue yet</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0, opacity: 0.8 }}>Tap 'New Task' above to add your first one.</p>
                        </div>
                    ) : (
                        filteredTasks.map(task => (
                            <div 
                                key={task.id} 
                                style={{ 
                                    display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                                    alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between',
                                    padding: isMobile ? '14px 16px' : '16px 20px', gap: isMobile ? '12px' : '0',
                                    background: 'var(--widget-bg)', borderRadius: '16px', border: '1px solid var(--border-premium)',
                                    opacity: task.completed ? 0.7 : 1, transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                                    {/* Custom icon toggle - matches the same
                                        mark-done pattern used on the Home
                                        page's timeline cards, instead of a
                                        raw browser checkbox. */}
                                    <button
                                        onClick={() => toggleTaskCompletion(task.id)}
                                        title={task.completed ? 'Mark as not done' : 'Mark as done'}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '22px', height: '22px', padding: 0, flexShrink: 0,
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            color: task.completed ? 'var(--success)' : 'var(--text-muted)',
                                        }}
                                    >
                                        {task.completed ? <CheckSquare size={20} /> : <Circle size={18} />}
                                    </button>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                        {/* STRICT: no textDecoration/line-through here or
                                            anywhere else on this page, ever - completion is
                                            shown only via the icon above and this muted
                                            color, so the title stays solid, clean, and
                                            crisp, never cut through by a strike line. */}
                                        <span style={{ fontSize: '15px', fontWeight: '700', color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                            {task.title}
                                        </span>
                                        {task.description && (
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '360px' }}>
                                                {task.description}
                                            </span>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => handleSourceBadgeClick(task.project)}
                                                title={`Go to ${CATEGORY_TAB[task.project] || task.project}`}
                                                style={{
                                                    fontSize: '11px', color: 'var(--primary)', fontWeight: '700',
                                                    background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 10px 2px 8px',
                                                    borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.2)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.1)'; }}
                                            >
                                                {task.project} <ArrowUpRight size={10} />
                                            </button>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} /> {task.dueDate}
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={12} /> {task.estimatedMins} mins
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '12px' }}>
                                    <span style={{ 
                                        fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '8px',
                                        background: task.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : task.priority === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                        color: task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : '#3B82F6',
                                        border: '1px solid var(--border-premium)'
                                    }}>
                                        {task.priority}
                                    </span>

                                    <button 
                                        onClick={() => deleteTask(task.id)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: isMobile ? '12px' : '6px', borderRadius: '8px' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            )}

            {/* Kanban Board View - same filteredTasks (search + tab filters
                both still apply), grouped into columns by status instead of
                one flat list. Move buttons give real, functional
                reorganization between columns without needing drag-and-drop
                machinery. */}
            {viewMode === 'kanban' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'start' }}>
                    {['To Do', 'In Progress', 'Completed'].map((column, columnIndex) => {
                        const columnTasks = filteredTasks.filter(t => t.status === column);
                        return (
                            <div key={column} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{column}</h4>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', background: 'var(--widget-bg)', padding: '2px 8px', borderRadius: '8px' }}>{columnTasks.length}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '40px' }}>
                                    {columnTasks.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '12px' }}>No tasks here</div>
                                    ) : (
                                        columnTasks.map(task => (
                                            <div key={task.id} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{task.title}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    {/* Clickable source badge - same cross-module
                                                        routing as the list view below. */}
                                                    <button
                                                        onClick={() => handleSourceBadgeClick(task.project)}
                                                        title={`Go to ${CATEGORY_TAB[task.project] || task.project}`}
                                                        style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                                                    >
                                                        {task.project}
                                                    </button>
                                                    <span style={{
                                                        fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
                                                        color: task.priority === 'High' ? '#EF4444' : task.priority === 'Medium' ? '#F59E0B' : '#3B82F6',
                                                        background: task.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : task.priority === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                    }}>
                                                        {task.priority}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                                                    <button
                                                        onClick={() => setTaskStatus(task.id, ['To Do', 'In Progress', 'Completed'][columnIndex - 1])}
                                                        disabled={columnIndex === 0}
                                                        title="Move back"
                                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'transparent', border: 'none', color: columnIndex === 0 ? 'var(--border-premium)' : 'var(--text-secondary)', cursor: columnIndex === 0 ? 'default' : 'pointer', fontSize: '11px', fontFamily: 'inherit' }}
                                                    >
                                                        <ChevronLeft size={13} /> Back
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTask(task.id)}
                                                        title="Delete"
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => setTaskStatus(task.id, ['To Do', 'In Progress', 'Completed'][columnIndex + 1])}
                                                        disabled={columnIndex === 2}
                                                        title="Move forward"
                                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'transparent', border: 'none', color: columnIndex === 2 ? 'var(--border-premium)' : 'var(--accent)', cursor: columnIndex === 2 ? 'default' : 'pointer', fontSize: '11px', fontFamily: 'inherit' }}
                                                    >
                                                        Next <ChevronRight size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {isModalOpen && (
                // Mobile: a real bottom slide-up sheet (anchored to the
                // bottom edge, rounded top corners only, the app's own
                // existing nexusSheetSlideUp keyframe - previously defined
                // in style.css for the old MobileTabBar "More" sheet but
                // never actually wired up anywhere since that panel was
                // removed) instead of a centered dialog floating in the
                // middle of a small screen. Desktop keeps the original
                // centered modal, completely unchanged.
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <form
                        onSubmit={handleCreateTask} className="nexus-glass-modal"
                        style={{
                            background: 'var(--bg-surface)', border: '1px solid var(--border-premium)',
                            borderRadius: isMobile ? '24px 24px 0 0' : '24px',
                            padding: isMobile ? '24px 20px calc(20px + env(safe-area-inset-bottom, 0px)) 20px' : '32px',
                            width: '100%', maxWidth: isMobile ? '100%' : '480px',
                            maxHeight: isMobile ? '88vh' : 'none', overflowY: isMobile ? 'auto' : 'visible',
                            boxShadow: 'var(--premium-shadow)', boxSizing: 'border-box',
                            display: 'flex', flexDirection: 'column', gap: '20px',
                            animation: isMobile ? 'nexusSheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                        }}
                    >
                        {isMobile && (
                            <div style={{ width: '40px', height: '4px', borderRadius: '4px', background: 'var(--border-premium)', margin: '-8px auto 0 auto', flexShrink: 0 }} />
                        )}
                        <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Create New Task</h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label htmlFor="taskTitle" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Task Title</label>
                            <input
                                id="taskTitle"
                                type="text"
                                placeholder="e.g. Master Binary Search Trees"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label htmlFor="taskDescription" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Description <span style={{ fontWeight: '400', opacity: 0.7 }}>(optional)</span></label>
                            <textarea
                                id="taskDescription"
                                placeholder="A few extra details about this task..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="taskProjectDomain" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Project Domain</label>
                                <select
                                    id="taskProjectDomain"
                                    value={isCustomDomain ? '__custom__' : project}
                                    onChange={(e) => {
                                        if (e.target.value === '__custom__') {
                                            setIsCustomDomain(true);
                                        } else {
                                            setIsCustomDomain(false);
                                            setProject(e.target.value);
                                        }
                                    }}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value="Study" style={{ background: 'var(--surface-inset)' }}>Study (AI/ML)</option>
                                    <option value="College" style={{ background: 'var(--surface-inset)' }}>College</option>
                                    <option value="Syllabus" style={{ background: 'var(--surface-inset)' }}>Syllabus</option>
                                    <option value="Fitness" style={{ background: 'var(--surface-inset)' }}>Fitness</option>
                                    <option value="Gym" style={{ background: 'var(--surface-inset)' }}>Gym</option>
                                    <option value="Diet" style={{ background: 'var(--surface-inset)' }}>Diet</option>
                                    <option value="Finance" style={{ background: 'var(--surface-inset)' }}>Finance</option>
                                    <option value="Calendar" style={{ background: 'var(--surface-inset)' }}>Calendar</option>
                                    <option value="Analytics" style={{ background: 'var(--surface-inset)' }}>Analytics</option>
                                    <option value="AI" style={{ background: 'var(--surface-inset)' }}>AI</option>
                                    <option value="Development" style={{ background: 'var(--surface-inset)' }}>Development</option>
                                    <option value="Review" style={{ background: 'var(--surface-inset)' }}>Review</option>
                                    <option value="__custom__" style={{ background: 'var(--surface-inset)' }}>+ Custom tag...</option>
                                </select>
                                {isCustomDomain && (
                                    <input
                                        type="text"
                                        aria-label="Custom project domain tag"
                                        autoFocus
                                        placeholder="#Hackathon, #Trip, or any tag"
                                        value={customDomain}
                                        onChange={(e) => setCustomDomain(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="taskPriority" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Priority</label>
                                <select
                                    id="taskPriority"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value="High" style={{ background: 'var(--surface-inset)' }}>High</option>
                                    <option value="Medium" style={{ background: 'var(--surface-inset)' }}>Medium</option>
                                    <option value="Low" style={{ background: 'var(--surface-inset)' }}>Low</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="taskDueDate" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Due Date</label>
                                <input
                                    id="taskDueDate"
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="taskEstimatedMins" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>Estimated Time (Mins)</label>
                                <input
                                    id="taskEstimatedMins"
                                    type="number"
                                    value={estimatedMins}
                                    onChange={(e) => setEstimatedMins(sanitizeNumberInput(e.target.value, estimatedMins))}
                                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                            <button 
                                type="button" 
                                onClick={() => { setIsModalOpen(false); setDescription(''); setIsCustomDomain(false); setCustomDomain(''); }}
                                style={{ padding: '12px 20px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                style={{ padding: '12px 24px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                            >
                                Save Task
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default PlannerPage;