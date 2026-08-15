// src/pages/AnalyticsPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, TrendingUp, PieChart, Activity, CheckCircle, DollarSign, Flame, Zap, Award, Sparkles, ShieldCheck, Target, Clock, Database } from 'lucide-react';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';

const AnalyticsPage = () => {
    const isMobile = useIsMobile();
    // 1. Pull EXACT data from all Nexus modules via localStorage
    const [plannerTasks, setPlannerTasks] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_planner_tasks')) || []; } catch (e) { return []; }
    });

    // Study assignments - the request explicitly groups "Planner/Study"
    // together as one domain, but Productivity previously only ever read
    // Planner data, completely ignoring Study assignments.
    const [studyAssignments, setStudyAssignments] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_study_assignments')) || []; } catch (e) { return []; }
    });

    const [workoutHistory, setWorkoutHistory] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_gym_history')) || []; } catch (e) { return []; }
    });

    const [rawFinanceProfile, setRawFinanceProfile] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_finance_profile')) || { monthlyBudget: 0 }; } catch (e) { return { monthlyBudget: 0 }; }
    });
    const { settings: globalSettings } = useGlobalSettings();
    const financeProfile = useMemo(() => ({ ...rawFinanceProfile, monthlyBudget: globalSettings.monthlyBudgetCap }), [rawFinanceProfile, globalSettings.monthlyBudgetCap]);

    const [transactions, setTransactions] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_finance_transactions')) || []; } catch (e) { return []; }
    });

    const [calendarEvents, setCalendarEvents] = useState(() => {
        try { return JSON.parse(localStorage.getItem('nexus_calendar_events')) || []; } catch (e) { return []; }
    });

    // BUG FIXED: useEffect was imported but never used anywhere in this
    // file - all six data sources above were read exactly once on
    // mount and never updated again for the rest of this page's mounted
    // lifetime. A workout logged in GymPage, a task completed in
    // Planner, or a cloud restore would never be reflected here while
    // this page happened to stay open, directly contradicting this
    // request's own "updating instantly as activities are completed"
    // requirement. Each equality guard prevents redundant re-renders
    // when the underlying data hasn't actually changed.
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
                setPlannerTasks((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_study_assignments') || '[]');
                setStudyAssignments((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_gym_history') || '[]');
                setWorkoutHistory((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_finance_profile') || 'null');
                if (latest) setRawFinanceProfile((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_finance_transactions') || '[]');
                setTransactions((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latest = JSON.parse(localStorage.getItem('nexus_calendar_events') || '[]');
                setCalendarEvents((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    // 2. Calculated Unified Metrics (FIXED: Zero-state handling so reset actually shows 00%)
    
    // Productivity - genuinely combines Planner tasks AND Study
    // assignments, matching this request's explicit "Planner/Study"
    // grouping. Previously this only ever reflected Planner tasks alone,
    // completely ignoring Study assignments despite them tracking the
    // exact same kind of real, comparable completion data.
    const totalPlannerTasks = plannerTasks.length;
    const completedPlannerTasks = plannerTasks.filter(t => t.completed).length;
    const totalStudyAssignments = studyAssignments.length;
    const completedStudyAssignments = studyAssignments.filter(a => a.status === 'Completed').length;
    const totalTasks = totalPlannerTasks + totalStudyAssignments;
    const completedTasks = completedPlannerTasks + completedStudyAssignments;
    const productivityRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Fitness
    const completedWorkouts = workoutHistory.length;
    // Cap at 100% max. Each workout adds 15% to the score (just a logical metric for active users)
    const fitnessRate = completedWorkouts > 0 ? Math.min(100, completedWorkouts * 15) : 0; 

    // Finance
    const totalSpent = transactions.filter(t => t.type === 'Expense').reduce((acc, curr) => acc + curr.amount, 0);
    const budget = financeProfile.monthlyBudget > 0 ? financeProfile.monthlyBudget : 0;
    const budgetUtilization = budget > 0 ? Math.min(100, Math.round((totalSpent / budget) * 100)) : 0;
    const financeScore = budget > 0 ? Math.max(0, 100 - budgetUtilization) : 0;

    // Schedule
    const completedCalendarEvents = calendarEvents.filter(e => e.completed).length;
    const totalCalendarEvents = calendarEvents.length;
    const calendarRate = totalCalendarEvents > 0 ? Math.round((completedCalendarEvents / totalCalendarEvents) * 100) : 0;

    // Overall Holistic Life Performance Score
    const hasAnyData = totalTasks > 0 || completedWorkouts > 0 || budget > 0 || totalCalendarEvents > 0;
    const holisticScore = hasAnyData ? Math.round((productivityRate + fitnessRate + financeScore + calendarRate) / 4) : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Life Intelligence Center</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Cross-module analytics, performance trends, and AI-driven life insights.</p>
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
                            ? "Your activity across productivity, fitness, nutrition, and finance shows strong synergy. Keep maintaining your execution consistency."
                            : "No activity data found. Start logging your tasks, workouts, and finances to generate your holistic performance score."}
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100px', height: '100px', borderRadius: '50%', background: 'var(--widget-bg)', border: holisticScore > 0 ? '4px solid var(--primary)' : '4px solid var(--text-muted)', boxShadow: holisticScore > 0 ? '0 0 20px rgba(var(--primary-rgb), 0.2)' : 'none' }}>
                    <span style={{ fontSize: '28px', fontWeight: '800', color: holisticScore > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{holisticScore}%</span>
                </div>
            </div>

            {/* Core Domain Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                
                {/* Productivity Domain */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>PRODUCTIVITY & STUDY</span>
                        <Zap size={18} color={totalTasks > 0 ? "var(--primary)" : "var(--text-muted)"} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: '800', color: totalTasks > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{productivityRate}%</h3>
                    <div style={{ width: '100%', height: '8px', background: 'var(--widget-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${productivityRate}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{completedTasks} of {totalTasks} tasks completed</span>
                </div>

                {/* Fitness Domain */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>GYM & FITNESS</span>
                        <Flame size={18} color={completedWorkouts > 0 ? "#EF4444" : "var(--text-muted)"} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: '800', color: completedWorkouts > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{fitnessRate}%</h3>
                    <div style={{ width: '100%', height: '8px', background: 'var(--widget-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${fitnessRate}%`, height: '100%', background: '#EF4444', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{completedWorkouts} workouts executed</span>
                </div>

                {/* Finance Domain */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>FINANCIAL HEALTH</span>
                        <DollarSign size={18} color={budget > 0 ? "#10B981" : "var(--text-muted)"} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: '800', color: budget > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{financeScore}%</h3>
                    <div style={{ width: '100%', height: '8px', background: 'var(--widget-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${financeScore}%`, height: '100%', background: '#10B981', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Budget utilization at {budgetUtilization}%</span>
                </div>

                {/* Schedule Domain */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>SCHEDULE DISCIPLINE</span>
                        <Clock size={18} color={totalCalendarEvents > 0 ? "#3B82F6" : "var(--text-muted)"} />
                    </div>
                    <h3 style={{ fontSize: '24px', fontWeight: '800', color: totalCalendarEvents > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{calendarRate}%</h3>
                    <div style={{ width: '100%', height: '8px', background: 'var(--widget-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${calendarRate}%`, height: '100%', background: '#3B82F6', borderRadius: '4px', transition: 'width 0.5s ease' }}></div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{completedCalendarEvents} of {totalCalendarEvents} calendar events kept</span>
                </div>

            </div>

            {/* AI Cross-Module Insights Feed */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                    <Sparkles size={22} />
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Cross-Module Intelligence Feed</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {holisticScore > 0 ? (
                        <>
                            {/* Planner & Study - independent of any other domain, so a
                                user who only tracks tasks (no gym/finance/calendar
                                activity yet) still genuinely sees their own real insight,
                                rather than needing multiple domains active at once. */}
                            {totalTasks > 0 && (
                                <div style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ padding: '10px', background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '10px', color: 'var(--primary)' }}><Activity size={20} /></div>
                                    <div>
                                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                            {productivityRate >= 70 ? 'Strong Task Execution' : productivityRate > 0 ? 'Tasks In Progress' : 'Tasks Awaiting Action'}
                                        </h4>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            {productivityRate >= 70
                                                ? `${completedTasks}/${totalTasks} Planner & Study items complete (${productivityRate}%) - strong execution across both domains.`
                                                : productivityRate > 0
                                                    ? `${totalTasks - completedTasks} of ${totalTasks} Planner & Study items are still pending. Keep chipping away at the queue.`
                                                    : `${totalTasks} Planner & Study item${totalTasks === 1 ? '' : 's'} logged but none completed yet - time to knock out the first one.`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Gym & Fitness - independent, so real workout activity is
                                surfaced even with zero Planner/Study data. */}
                            {completedWorkouts > 0 && (
                                <div style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', color: '#EF4444' }}><Flame size={20} /></div>
                                    <div>
                                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                            {fitnessRate >= 70 ? 'Fitness Momentum Building' : 'Workouts Logged'}
                                        </h4>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            {completedWorkouts} workout{completedWorkouts === 1 ? '' : 's'} logged in Gym & Fitness.
                                            {productivityRate > 50 ? ' This pairs well with your task completion rate - physical activity and focus tend to reinforce each other.' : ' Keep the consistency going.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {budget > 0 && (
                                <div style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ padding: '10px', background: budgetUtilization > 80 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', color: budgetUtilization > 80 ? '#EF4444' : '#10B981' }}><ShieldCheck size={20} /></div>
                                    <div>
                                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                            {budgetUtilization > 80 ? 'Budget Alert' : 'Financial Discipline Stable'}
                                        </h4>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            {budgetUtilization > 80 
                                                ? `You have utilized ${budgetUtilization}% of your monthly budget. Limit unnecessary expenses.`
                                                : `Your monthly spending is well within the ₹${financeProfile.monthlyBudget?.toLocaleString()} limit, keeping savings goals on track.`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Calendar & Schedule - genuinely new. calendarRate was
                                already being computed before this fix, but never
                                actually surfaced in any insight - Calendar had zero
                                presence here despite being one of the four domains
                                this request explicitly names. */}
                            {totalCalendarEvents > 0 && (
                                <div style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                    <div style={{ padding: '10px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', color: '#3B82F6' }}><Clock size={20} /></div>
                                    <div>
                                        <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                            {calendarRate >= 70 ? 'Schedule Discipline Strong' : calendarRate > 0 ? 'Schedule In Progress' : 'Events Awaiting Completion'}
                                        </h4>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                                            {completedCalendarEvents}/{totalCalendarEvents} scheduled events kept ({calendarRate}%).
                                            {calendarRate >= 70 ? ' Your schedule discipline is genuinely paying off.' : totalCalendarEvents - completedCalendarEvents > 0 ? ` ${totalCalendarEvents - completedCalendarEvents} event${totalCalendarEvents - completedCalendarEvents === 1 ? ' is' : 's are'} still open.` : ''}
                                        </p>
                                    </div>
                                </div>
                            )}
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

        </div>
    );
};

export default AnalyticsPage;