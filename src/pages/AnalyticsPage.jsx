// src/pages/AnalyticsPage.jsx
import { useMemo, useState } from 'react';
import { Activity, DollarSign, Flame, Zap, Award, Sparkles, ShieldCheck, Clock, Database, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useAnalyticsData } from '../hooks/useAnalyticsData.js';
import AnalyticsTrendChart from '../components/AnalyticsTrendChart.jsx';
import AnalyticsEmptyState from '../components/AnalyticsEmptyState.jsx';
import AnalyticsDrillDownModal from '../components/AnalyticsDrillDownModal.jsx';

const AnalyticsPage = ({ setActiveTab }) => {
    const isMobile = useIsMobile();
    const analytics = useAnalyticsData();
    const [openDomain, setOpenDomain] = useState(null);

    const goTo = (tab) => { if (typeof setActiveTab === 'function') setActiveTab(tab); };

    // One config object per domain - drives the card, the empty state, the
    // AI feed insight, and the drill-down modal, so all four stay
    // consistent instead of re-declaring icon/color/copy four separate times.
    const DOMAIN_CONFIG = useMemo(() => ({
        productivity: {
            label: 'Productivity & Study', icon: <Zap size={18} />, color: 'var(--primary)', rgb: 'var(--primary-rgb)',
            emptyTitle: 'No tasks logged yet', emptySubtitle: 'Add a task in Planner or an assignment in Study Hub to start tracking your productivity score.', emptyCta: 'Go to Planner', tab: 'Planner',
        },
        gym: {
            label: 'Gym & Fitness', icon: <Flame size={18} />, color: '#EF4444', rgb: '239,68,68',
            emptyTitle: 'No workouts logged yet', emptySubtitle: 'Log a session in Gym & Fitness to start building your fitness streak and trend.', emptyCta: 'Go to Gym', tab: 'Gym',
        },
        finance: {
            label: 'Financial Health', icon: <DollarSign size={18} />, color: '#10B981', rgb: '16,185,129',
            emptyTitle: 'No transactions logged yet', emptySubtitle: 'Record an expense or income in the Finance Hub to activate budget tracking here.', emptyCta: 'Go to Finance', tab: 'Finance',
        },
        schedule: {
            label: 'Schedule Discipline', icon: <Clock size={18} />, color: '#3B82F6', rgb: '59,130,246',
            emptyTitle: 'No schedule activity yet', emptySubtitle: 'Add an event in Calendar or fill in your Daily Timetable to track schedule discipline.', emptyCta: 'Go to Calendar', tab: 'Calendar',
        },
    }), []);

    const { productivity, gym, finance, schedule, holisticScore, hasAnyData, missedTaskSuggestion } = analytics;
    const domainData = { productivity, gym, finance, schedule };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>

            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Analytics Hub</h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                    <Sparkles size={18} color="var(--primary)" />
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>System Synced Across Modules</span>
                </div>
            </div>

            {/* Holistic Performance Score Card */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '28px', boxShadow: 'var(--premium-shadow)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '600px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: '700', fontSize: '14px' }}>
                        <Award size={20} /> HOLISTIC LIFE PERFORMANCE SCORE
                    </div>
                    <h2 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {holisticScore} / 100 — {holisticScore > 80 ? 'Excellent Balance' : holisticScore > 50 ? 'Good Progress' : holisticScore > 0 ? 'Needs Focus' : 'System Ready'}
                    </h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        {holisticScore > 0
                            ? 'Your activity across productivity, fitness, schedule, and finance shows real, connected progress. Click any domain below for the full history.'
                            : 'No activity data found. Start logging your tasks, workouts, and finances to generate your holistic performance score.'}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100px', height: '100px', borderRadius: '50%', background: 'var(--widget-bg)', border: holisticScore > 0 ? '4px solid var(--primary)' : '4px solid var(--text-muted)', boxShadow: holisticScore > 0 ? '0 0 20px rgba(var(--primary-rgb), 0.2)' : 'none' }}>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: holisticScore > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{holisticScore}%</span>
                </div>
            </div>

            {/* Core Domain Breakdown Cards - each clickable, opening its own
                drill-down (real historical data, streak, 30-day trend) - and
                each renders a real empty state with a way to go log
                something instead of a static "0%" when it has no data yet. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                {Object.entries(DOMAIN_CONFIG).map(([key, config]) => {
                    const d = domainData[key];
                    return (
                        <div
                            key={key}
                            onClick={() => setOpenDomain(key)}
                            role="button" tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') setOpenDomain(key); }}
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)', cursor: 'pointer', transition: 'transform 0.2s ease, border-color 0.2s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = config.color; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border-premium)'; }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{config.label}</span>
                                <span style={{ color: d.hasData ? config.color : 'var(--text-muted)' }}>{config.icon}</span>
                            </div>

                            {d.hasData ? (
                                <>
                                    <h3 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{d.rate}%</h3>
                                    <div style={{ width: '100%', height: '8px', background: 'var(--widget-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${d.rate}%`, height: '100%', background: config.color, borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {key === 'finance'
                                            ? `Budget utilization at ${d.budgetUtilization}%`
                                            : `${d.completedCount} of ${d.totalCount} ${key === 'gym' ? 'workouts executed' : 'completed'}`}
                                    </span>
                                </>
                            ) : (
                                <AnalyticsEmptyState
                                    icon={config.icon}
                                    title={config.emptyTitle}
                                    subtitle={null}
                                    ctaLabel={config.emptyCta}
                                    onCta={(e) => { e.stopPropagation(); goTo(config.tab); }}
                                    compact
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* AI Cross-Module Insights Feed */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <Sparkles size={22} />
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Cross-Module Intelligence Feed</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {hasAnyData ? (
                        <>
                            {/* Missed-task cross-module suggestion - the concrete
                                example this request names: an overdue Planner
                                task or Calendar event, cross-referenced against
                                today's/tomorrow's real Timetable + Calendar
                                occupancy to suggest a genuinely free hour. */}
                            {missedTaskSuggestion && (
                                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '10px', color: '#EF4444', flexShrink: 0 }}><AlertTriangle size={20} /></div>
                                    <div>
                                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>Missed Task Detected</h4>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            "{missedTaskSuggestion.item.title}" was due {formatShortDate(missedTaskSuggestion.item.date)} and is still not complete.
                                            Your schedule looks free <strong>{missedTaskSuggestion.suggestedLabel}</strong> - a good window to reschedule it.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {Object.entries(DOMAIN_CONFIG).map(([key, config]) => {
                                const d = domainData[key];
                                if (!d.hasData) return null;
                                return (
                                    <div key={key} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        <div style={{ padding: '10px', background: `rgba(${config.rgb}, 0.1)`, borderRadius: '10px', color: config.color, flexShrink: 0, alignSelf: 'flex-start' }}>{config.icon}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                {insightHeading(key, d)}
                                            </h4>
                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                                {insightBody(key, d)}
                                            </p>
                                        </div>
                                        <div style={{ flexShrink: 0 }}>
                                            <AnalyticsTrendChart data={d.history.slice(-14)} color={config.color} variant="sparkline" />
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    ) : (
                        <div style={{ background: 'var(--widget-bg)', border: '1px dashed var(--border-premium)', borderRadius: '14px', padding: '30px 20px', textAlign: 'center' }}>
                            <Database size={32} style={{ margin: '0 auto 12px auto', color: 'var(--text-muted)' }} />
                            <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>System Initialized. Awaiting Data...</h4>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Log activities across Planner, Gym, Finance, and Calendar to activate AI Insights.</p>
                        </div>
                    )}
                </div>
            </div>

            {openDomain && (
                <AnalyticsDrillDownModal
                    domain={openDomain}
                    config={DOMAIN_CONFIG[openDomain]}
                    data={domainData[openDomain]}
                    currency={finance.currency}
                    onClose={() => setOpenDomain(null)}
                    onCta={() => { goTo(DOMAIN_CONFIG[openDomain].tab); setOpenDomain(null); }}
                />
            )}

        </div>
    );
};

const formatShortDate = (dateStr) => {
    if (!dateStr) return 'recently';
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// One heading/body sentence pair per domain, using the same real numbers
// (completedCount/totalCount/rate/streak/budgetUtilization) the card and
// modal already show - not a separate, disconnected copy of the data.
const insightHeading = (key, d) => {
    if (key === 'productivity') return d.rate >= 70 ? 'Strong Task Execution' : d.rate > 0 ? 'Tasks In Progress' : 'Tasks Awaiting Action';
    if (key === 'gym') return d.rate >= 70 ? 'Fitness Momentum Building' : 'Workouts Logged';
    if (key === 'finance') return d.budgetUtilization > 80 ? 'Budget Alert' : 'Financial Discipline Stable';
    return d.rate >= 70 ? 'Schedule Discipline Strong' : d.rate > 0 ? 'Schedule In Progress' : 'Events Awaiting Completion';
};

const insightBody = (key, d) => {
    if (key === 'productivity') {
        const streakNote = d.streak > 1 ? ` ${d.streak}-day completion streak going.` : '';
        return `${d.completedCount}/${d.totalCount} Planner & Study items complete (${d.rate}%).${streakNote}`;
    }
    if (key === 'gym') {
        const streakNote = d.streak > 1 ? ` ${d.streak}-day logging streak.` : '';
        return `${d.completedCount} workout${d.completedCount === 1 ? '' : 's'} logged in Gym & Fitness.${streakNote}`;
    }
    if (key === 'finance') {
        return d.budgetUtilization > 80
            ? `You've used ${d.budgetUtilization}% of your monthly budget. Limit unnecessary expenses.`
            : `Monthly spending is at ${d.budgetUtilization}% of your ${d.currency}${(d.budget || 0).toLocaleString()} budget, keeping savings goals on track.`;
    }
    const remaining = d.totalCount - d.completedCount;
    return `${d.completedCount}/${d.totalCount} scheduled items kept (${d.rate}%).${remaining > 0 ? ` ${remaining} still open.` : ''}`;
};

export default AnalyticsPage;
