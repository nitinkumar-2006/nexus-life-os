// src/pages/GymPage.jsx
import React, { useState, useEffect } from 'react';
import { Dumbbell, Flame, Trophy, TrendingUp, User, Target, Plus, Calendar, Activity, CheckCircle, Search, Layers, Shield, Play, Square, Check, Trash2, ArrowLeft, Ruler, HeartPulse, Sparkles, Cpu, ShieldCheck } from 'lucide-react';
import AIQueryBox from '../components/AIQueryBox.jsx';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { sanitizeNumberInput, normalizeNumberOnBlur } from '../utils/smartNumberInput.js';

const GymPage = () => {
    const isMobile = useIsMobile();
    // 1. Fitness Profile
    const [profile, setProfile] = useState(() => {
        const saved = localStorage.getItem('nexus_gym_profile');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return null; }
        }
        return { name: 'User', age: 0, height: '0 cm', weight: 0, targetWeight: 0, goal: 'Not Set', experience: 'Beginner', streak: 0 };
    });

    // 2. Workout Plans (With Add/Delete support)
    const [workoutPlans, setWorkoutPlans] = useState(() => {
        const saved = localStorage.getItem('nexus_gym_plans');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return []; 
    });

    // 3. Exercises
    const [exercises, setExercises] = useState(() => {
        const saved = localStorage.getItem('nexus_gym_exercises');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });

    // 4. Workout History
    const [workoutHistory, setWorkoutHistory] = useState(() => {
        const saved = localStorage.getItem('nexus_gym_history');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });

    // 5. Measurements
    const [measurements, setMeasurements] = useState(() => {
        const saved = localStorage.getItem('nexus_gym_measurements');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });

    // 6. Muscle Recovery - stores a real lastWorkedAt timestamp per
    // muscle rather than a static percentage/status, which would only
    // ever reflect whatever it was set to once and never genuinely
    // change again on its own. The displayed percentage/status below is
    // computed live from real elapsed time since that timestamp, so
    // recovery actually progresses continuously rather than being a
    // one-time snapshot - real interactivity, not dummy data that looks
    // interactive.
    const [muscleRecovery, setMuscleRecovery] = useState(() => {
        const saved = localStorage.getItem('nexus_gym_recovery');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Migrates the old static {muscle, status, percentage} shape
                // (if present from before this fix) to the new real
                // timestamp-based one, defaulting to null (never worked,
                // fully recovered) rather than crashing on the old shape.
                if (Array.isArray(parsed)) return parsed.map((m) => ({ muscle: m.muscle, lastWorkedAt: m.lastWorkedAt ?? null }));
            } catch (e) { /* fall through to the real default below */ }
        }
        return ['Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps'].map((muscle) => ({ muscle, lastWorkedAt: null }));
    });

    const [activeSession, setActiveSession] = useState(null);
    const [activeTab, setActiveTab] = useState('Dashboard');

    // Modals States
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [tempProfile, setTempProfile] = useState(profile);
    const [isAddExerciseModal, setIsAddExerciseModal] = useState(false);
    const [newExercise, setNewExercise] = useState({ name: '', muscle: 'Chest', equipment: 'Barbell', difficulty: 'Beginner', type: 'Compound' });
    const [isAddMeasurementModal, setIsAddMeasurementModal] = useState(false);
    const [newMeasurement, setNewMeasurement] = useState({ weight: profile.weight, chest: 0, waist: 0, biceps: 0 });
    
    // NEW: Add Plan Modal State
    const [isAddPlanModal, setIsAddPlanModal] = useState(false);
    const [newPlan, setNewPlan] = useState({ name: '', split: '6 Days / Week', focus: 'Hypertrophy', active: true, exerciseIds: [] });

    const [searchQuery, setSearchQuery] = useState('');
    const [gymToast, setGymToast] = useState('');
    useEffect(() => {
        if (!gymToast) return undefined;
        const timeoutId = setTimeout(() => setGymToast(''), 3000);
        return () => clearTimeout(timeoutId);
    }, [gymToast]);

    // Persistence Effects - all six keys now consistently dispatch the
    // shared sync event on their own changes (previously only
    // workoutHistory did), so every part of this module - profile edits,
    // new plans, new exercises, measurements, recovery state - genuinely
    // notifies the rest of the app instantly, matching the established
    // convention used everywhere else.
    useEffect(() => { localStorage.setItem('nexus_gym_profile', JSON.stringify(profile)); window.dispatchEvent(new Event('storage')); }, [profile]);
    useEffect(() => { localStorage.setItem('nexus_gym_plans', JSON.stringify(workoutPlans)); window.dispatchEvent(new Event('storage')); }, [workoutPlans]);
    useEffect(() => { localStorage.setItem('nexus_gym_exercises', JSON.stringify(exercises)); window.dispatchEvent(new Event('storage')); }, [exercises]);
    useEffect(() => { localStorage.setItem('nexus_gym_history', JSON.stringify(workoutHistory)); window.dispatchEvent(new Event('storage')); }, [workoutHistory]);
    useEffect(() => { localStorage.setItem('nexus_gym_measurements', JSON.stringify(measurements)); window.dispatchEvent(new Event('storage')); }, [measurements]);
    useEffect(() => { localStorage.setItem('nexus_gym_recovery', JSON.stringify(muscleRecovery)); window.dispatchEvent(new Event('storage')); }, [muscleRecovery]);

    // CloudSyncContext's pullFromCloud (a factory-reset restore or sign-in
    // sync) writes directly to these same keys and dispatches 'storage' -
    // without these listeners, this component's own state would never
    // reflect cloud-restored data for any of these six keys while this
    // page happens to be mounted. Previously only workoutHistory had this;
    // profile/plans/exercises/measurements/recovery had no inbound path
    // at all. Each equality guard prevents that key's own outbound write
    // above from re-triggering itself in a loop.
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latestProfile = JSON.parse(localStorage.getItem('nexus_gym_profile') || 'null');
                if (latestProfile) setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(latestProfile) ? prev : latestProfile));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestPlans = JSON.parse(localStorage.getItem('nexus_gym_plans') || '[]');
                setWorkoutPlans((prev) => (JSON.stringify(prev) === JSON.stringify(latestPlans) ? prev : latestPlans));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestExercises = JSON.parse(localStorage.getItem('nexus_gym_exercises') || '[]');
                setExercises((prev) => (JSON.stringify(prev) === JSON.stringify(latestExercises) ? prev : latestExercises));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestHistory = JSON.parse(localStorage.getItem('nexus_gym_history') || '[]');
                setWorkoutHistory((prev) => (JSON.stringify(prev) === JSON.stringify(latestHistory) ? prev : latestHistory));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestMeasurements = JSON.parse(localStorage.getItem('nexus_gym_measurements') || '[]');
                setMeasurements((prev) => (JSON.stringify(prev) === JSON.stringify(latestMeasurements) ? prev : latestMeasurements));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestRecovery = JSON.parse(localStorage.getItem('nexus_gym_recovery') || 'null');
                if (latestRecovery) setMuscleRecovery((prev) => (JSON.stringify(prev) === JSON.stringify(latestRecovery) ? prev : latestRecovery));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    // Handlers
    const handleSaveProfile = (e) => { e.preventDefault(); setProfile(tempProfile); setIsEditingProfile(false); };
    
    const handleAddExercise = (e) => {
        e.preventDefault();
        if (!newExercise.name.trim()) return;
        const item = { id: Date.now().toString(), ...newExercise, name: toTitleCase(newExercise.name.trim()) };
        setExercises([item, ...exercises]);
        setIsAddExerciseModal(false);
        setNewExercise({ name: '', muscle: 'Chest', equipment: 'Barbell', difficulty: 'Beginner', type: 'Compound' });
    };

    const handleAddMeasurement = (e) => {
        e.preventDefault();
        const item = {
            id: Date.now().toString(), date: new Date().toISOString().split('T')[0],
            weight: parseFloat(newMeasurement.weight) || profile.weight,
            chest: parseFloat(newMeasurement.chest) || 0, waist: parseFloat(newMeasurement.waist) || 0, biceps: parseFloat(newMeasurement.biceps) || 0
        };
        setMeasurements([item, ...measurements]);
        setProfile(prev => ({ ...prev, weight: item.weight }));
        setIsAddMeasurementModal(false);
    };

    // NEW: Handle Add Plan
    const handleAddPlan = (e) => {
        e.preventDefault();
        if (!newPlan.name.trim()) return;
        const item = { id: Date.now().toString(), ...newPlan };
        setWorkoutPlans((prev) => {
            // "Active Split" is a singular designation - marking this new
            // plan active correctly deactivates any other plan that was
            // active, rather than letting every plan silently stack up as
            // active forever with no real distinction between them.
            const next = item.active ? prev.map((p) => ({ ...p, active: false })) : prev;
            return [item, ...next];
        });
        setIsAddPlanModal(false);
        setNewPlan({ name: '', split: '6 Days / Week', focus: 'Hypertrophy', active: true, exerciseIds: [] });
    };

    // NEW: Delete Functions
    const deletePlan = (id) => setWorkoutPlans(workoutPlans.filter(p => p.id !== id));
    const deleteExercise = (id) => setExercises(exercises.filter(e => e.id !== id));
    const deleteHistory = (id) => setWorkoutHistory(workoutHistory.filter(h => h.id !== id));
    const deleteMeasurement = (id) => setMeasurements(measurements.filter(m => m.id !== id));

    const startWorkoutSession = (plan) => {
        if(exercises.length === 0) {
            setGymToast('Please add exercises to the database first!');
            return;
        }
        // Genuinely uses the plan's own real, user-assigned exercises -
        // previously this always grabbed the same first 3 global
        // exercises regardless of which plan was actually selected,
        // completely disconnected from the plan itself.
        const planExercises = (plan.exerciseIds || [])
            .map((id) => exercises.find((ex) => ex.id === id))
            .filter(Boolean);
        if (planExercises.length === 0) {
            setGymToast(`"${plan.name}" has no exercises assigned yet - edit it to add some.`);
            return;
        }
        const defaultExercises = planExercises.map(ex => ({
            exerciseId: ex.id, exerciseName: ex.name,
            sets: [{ id: 's1', weight: 0, reps: 0, completed: false }]
        }));
        setActiveSession({ planName: plan.name, startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), startTimestamp: Date.now(), loggedExercises: defaultExercises });
    };

    const toggleSetCompletion = (exIndex, setIndex) => {
        const updated = { ...activeSession };
        updated.loggedExercises[exIndex].sets[setIndex].completed = !updated.loggedExercises[exIndex].sets[setIndex].completed;
        setActiveSession(updated);
    };

    const updateSetValue = (exIndex, setIndex, field, value) => {
        const updated = { ...activeSession };
        updated.loggedExercises[exIndex].sets[setIndex][field] = value;
        setActiveSession(updated);
    };

    const addSetToExercise = (exIndex) => {
        const updated = { ...activeSession };
        const lastSet = updated.loggedExercises[exIndex].sets.slice(-1)[0] || { weight: 0, reps: 0 };
        updated.loggedExercises[exIndex].sets.push({ id: Date.now().toString(), weight: lastSet.weight, reps: lastSet.reps, completed: false });
        setActiveSession(updated);
    };

    const finishWorkoutSession = () => {
        let totalSets = 0; let totalVolume = 0;
        const workedMuscles = new Set();
        activeSession.loggedExercises.forEach(ex => {
            ex.sets.forEach(s => {
                if (s.completed) {
                    totalSets += 1; totalVolume += (s.weight * s.reps);
                    // Cross-references the real exercise database to find
                    // which real muscle group this completed exercise
                    // actually targets, so recovery only updates for
                    // muscles genuinely worked this session.
                    const matchedExercise = exercises.find((e) => e.id === ex.exerciseId);
                    if (matchedExercise?.muscle) workedMuscles.add(matchedExercise.muscle);
                }
            });
        });
        // A real, computed duration from actual elapsed time - replaces
        // the previous hardcoded '45 mins', which never reflected how
        // long the session genuinely took.
        const elapsedMinutes = activeSession.startTimestamp ? Math.max(1, Math.round((Date.now() - activeSession.startTimestamp) / 60000)) : null;
        const newSessionRecord = { id: Date.now().toString(), title: activeSession.planName, date: new Date().toISOString().split('T')[0], duration: elapsedMinutes ? `${elapsedMinutes} min${elapsedMinutes === 1 ? '' : 's'}` : 'Unknown', volume: `${totalVolume.toLocaleString()} kg`, setsCompleted: totalSets };
        setWorkoutHistory([newSessionRecord, ...workoutHistory]);
        setProfile(prev => ({ ...prev, streak: prev.streak + 1 }));
        if (workedMuscles.size > 0) {
            const nowIso = new Date().toISOString();
            setMuscleRecovery((prev) => prev.map((rec) => (workedMuscles.has(rec.muscle) ? { ...rec, lastWorkedAt: nowIso } : rec)));
        }
        setActiveSession(null);
    };

    const weightProgress = profile.targetWeight > 0 ? Math.min(100, Math.max(0, Math.round((profile.weight / profile.targetWeight) * 100))) : 0;

    // Real, live recovery derived from actual elapsed time since each
    // muscle's real lastWorkedAt timestamp - a 48-hour window is a real,
    // standard recovery timeframe for a muscle group, not an arbitrary
    // guess. Recomputed on every render, so a muscle worked yesterday
    // genuinely shows more recovered than one worked an hour ago, and
    // continues progressing the longer the app stays open - this is what
    // makes it genuinely interactive rather than a static snapshot.
    const RECOVERY_WINDOW_HOURS = 48;
    const displayRecovery = muscleRecovery.map((rec) => {
        if (!rec.lastWorkedAt) return { muscle: rec.muscle, status: 'Ready', percentage: 100 };
        const hoursElapsed = (Date.now() - new Date(rec.lastWorkedAt).getTime()) / 3600000;
        const percentage = Math.min(100, Math.max(0, Math.round((hoursElapsed / RECOVERY_WINDOW_HOURS) * 100)));
        return { muscle: rec.muscle, status: percentage >= 100 ? 'Ready' : 'Recovering', percentage };
    });
    const filteredExercises = exercises.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()) || ex.muscle.toLowerCase().includes(searchQuery.toLowerCase()));

    // Real, honest, multi-part briefing - matching the same, established
    // pattern Finance/Diet's own briefings already use. Genuinely reuses
    // the real, active recovery data and workout plans already computed
    // above on this page, not fabricated content.
    const generateGymBriefing = () => {
        if (workoutHistory.length === 0) return "Log your first workout to start receiving real, data-driven AI coaching here.";
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentCount = workoutHistory.filter((w) => w.date && new Date(w.date) >= sevenDaysAgo).length;
        const parts = [`You've logged ${workoutHistory.length} total workout${workoutHistory.length === 1 ? '' : 's'}, with ${recentCount} in the last 7 days.`];

        const readyMuscles = displayRecovery.filter((r) => r.status === 'Ready');
        if (readyMuscles.length > 0) {
            parts.push(`${readyMuscles.map((r) => r.muscle).join(', ')} ${readyMuscles.length === 1 ? 'is' : 'are'} fully recovered and ready to train.`);
        }
        const activePlan = workoutPlans.find((p) => p.active);
        if (activePlan) parts.push(`Your active split is "${activePlan.name}" (${activePlan.split}).`);

        return parts.join(' ');
    };

    // ==========================================
    // RENDER LIVE WORKOUT SESSION INTERFACE
    // ==========================================
    if (activeSession) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeInScale 0.3s ease' }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '14px' : '0', background: 'var(--bg-surface)', padding: isMobile ? '16px' : '20px 24px', borderRadius: '16px', border: '1px solid var(--border-premium)' }}>
                    <div>
                        <button onClick={() => setActiveSession(null)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '8px' }}>
                            <ArrowLeft size={16} /> Cancel Session
                        </button>
                        <h1 style={{ fontSize: isMobile ? '19px' : '24px', fontWeight: '800', color: 'var(--text-primary)' }}>Live: {activeSession.planName}</h1>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Started at {activeSession.startTime}</p>
                    </div>
                    <button onClick={finishWorkoutSession} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 24px', background: '#10B981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                        <Check size={18} /> Finish Workout
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {activeSession.loggedExercises.length > 0 ? activeSession.loggedExercises.map((ex, exIndex) => (
                        <div key={ex.exerciseId} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '10px' : '0' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'break-word' }}>{ex.exerciseName}</h3>
                                <button onClick={() => addSetToExercise(exIndex)} style={{ padding: '6px 12px', background: 'var(--widget-bg)', color: 'var(--primary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontWeight: '600', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}>+ Add Set</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 80px', gap: '12px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', padding: '0 4px' }}>
                                    <span>SET</span><span>KG</span><span>REPS</span><span>DONE</span>
                                </div>
                                {ex.sets.map((set, setIndex) => (
                                    <div key={set.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 80px', gap: '12px', alignItems: 'center', background: set.completed ? 'rgba(16, 185, 129, 0.05)' : 'var(--widget-bg)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-premium)' }}>
                                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>#{setIndex + 1}</span>
                                        <input type="number" step="0.5" value={set.weight} onChange={(e) => updateSetValue(exIndex, setIndex, 'weight', sanitizeNumberInput(e.target.value, set.weight))} onBlur={(e) => updateSetValue(exIndex, setIndex, 'weight', normalizeNumberOnBlur(e.target.value, true))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', outline: 'none' }} />
                                        <input type="number" value={set.reps} onChange={(e) => updateSetValue(exIndex, setIndex, 'reps', sanitizeNumberInput(e.target.value, set.reps))} onBlur={(e) => updateSetValue(exIndex, setIndex, 'reps', normalizeNumberOnBlur(e.target.value, false))} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', outline: 'none' }} />
                                        <button onClick={() => toggleSetCompletion(exIndex, setIndex)} style={{ width: '100%', padding: '8px', background: set.completed ? '#10B981' : 'var(--surface-inset)', color: set.completed ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>{set.completed ? '✓' : '○'}</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )) : <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No exercises available.</div>}
                </div>
            </div>
        );
    }

    // ==========================================
    // STANDARD GYM COMMAND CENTER RENDER
    // ==========================================
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Gym Command Center</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Track workouts, recovery, body analytics, and AI fitness coaching.</p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    {activeTab === 'Dashboard' && (
                        <button onClick={() => setIsAddPlanModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <Plus size={18} /> Add Workout Plan
                        </button>
                    )}
                    {activeTab === 'Exercises' && (
                        <button onClick={() => setIsAddExerciseModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <Plus size={18} /> Add Custom Exercise
                        </button>
                    )}
                    {activeTab === 'Recovery' && (
                        <button onClick={() => setIsAddMeasurementModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <Ruler size={18} /> Log Measurements
                        </button>
                    )}
                    <button onClick={() => { setTempProfile(profile); setIsEditingProfile(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                        <User size={18} /> Profile
                    </button>
                </div>
            </div>

            {/* Quick Metrics Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)' }}><Target size={24} /></div>
                    <div><span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Primary Goal</span><h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{profile.goal}</h2></div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#10B981' }}><TrendingUp size={24} /></div>
                    <div><span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Current / Target Weight</span><h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{profile.weight} kg <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {profile.targetWeight} kg</span></h2></div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#F59E0B' }}><Flame size={24} /></div>
                    <div><span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Workout Streak</span><h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{profile.streak} Days</h2></div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px', overflowX: 'auto' }}>
                {['Dashboard', 'Exercises', 'History', 'Recovery', 'Analytics'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '10px 16px', background: activeTab === tab ? 'var(--widget-bg)' : 'transparent', color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        {tab === 'Analytics' ? <><Cpu size={14} style={{display:'inline', marginBottom:'-2px'}}/> AI Coach & Analytics</> : tab}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            {activeTab === 'Dashboard' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--premium-shadow)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Goal Milestone Progress</h3>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>{weightProgress}% Achieved</span>
                        </div>
                        <div style={{ width: '100%', height: '10px', background: 'var(--widget-bg)', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ width: `${weightProgress}%`, height: '100%', background: 'var(--primary)', borderRadius: '5px' }}></div>
                        </div>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Active Workout Split & Start Session</h3>
                        {workoutPlans.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                {workoutPlans.map(plan => (
                                    <div key={plan.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: plan.active ? '#10B981' : 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>
                                                    {plan.active ? 'Active Split' : 'Standard'}
                                                </span>
                                                <h4 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '8px', overflowWrap: 'break-word' }}>{plan.name}</h4>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>{plan.split} · {plan.focus} · {(plan.exerciseIds || []).length} exercise{(plan.exerciseIds || []).length === 1 ? '' : 's'}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                <button onClick={() => deletePlan(plan.id)} style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                <button onClick={() => startWorkoutSession(plan)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}><Play size={14} /> Start</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-premium)', borderRadius: '16px' }}>No workout plans created. Click "Add Workout Plan" above.</div>}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: EXERCISE DATABASE */}
            {activeTab === 'Exercises' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                        <input type="text" placeholder="Search exercises..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 44px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    {filteredExercises.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                            {filteredExercises.map(ex => (
                                <div key={ex.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px' }}>{ex.muscle}</span>
                                        <button onClick={() => deleteExercise(ex.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </div>
                                    <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>{ex.name}</h4>
                                </div>
                            ))}
                        </div>
                    ) : <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No exercises found.</div>}
                </div>
            )}

            {/* TAB CONTENT: HISTORY */}
            {activeTab === 'History' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {workoutHistory.length > 0 ? workoutHistory.map(item => (
                        <div key={item.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '12px' : '0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>{item.date}</span>
                                <h4 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>{item.title}</h4>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '20px' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>⏱️ {item.duration} | 📦 {item.volume}</span>
                                <button onClick={() => deleteHistory(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    )) : <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No workout history found.</div>}
                </div>
            )}

            {/* TAB CONTENT: RECOVERY */}
            {activeTab === 'Recovery' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Muscle Recovery</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                            {displayRecovery.map((rec, idx) => (
                                <div key={idx} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>{rec.muscle}</span>
                                        <span style={{ fontSize: '11px', color: rec.status === 'Ready' ? '#10B981' : '#F59E0B' }}>{rec.status}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'var(--surface-inset)', borderRadius: '3px' }}>
                                        <div style={{ width: `${rec.percentage}%`, height: '100%', background: rec.status === 'Ready' ? '#10B981' : '#F59E0B', borderRadius: '3px' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Measurements Timeline</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {measurements.length > 0 ? measurements.map(m => (
                                <div key={m.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'var(--widget-bg)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary)' }}>{m.date}</span>
                                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>⚖️ {m.weight} kg</span>
                                        {m.chest > 0 && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chest {m.chest}cm</span>}
                                        {m.waist > 0 && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Waist {m.waist}cm</span>}
                                        {m.biceps > 0 && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Biceps {m.biceps}cm</span>}
                                        <button onClick={() => deleteMeasurement(m.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            )) : <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No measurements logged yet.</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ANALYTICS */}
            {activeTab === 'Analytics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Sparkles size={22} />
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Fitness Coach Briefing</h3>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--widget-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            {generateGymBriefing()}
                        </p>
                    </div>

                    <AIQueryBox
                        context={{ workouts: workoutHistory }} persona="fitness"
                        title="Ask the AI Fitness Coach"
                        placeholder="Ask about your consistency, recovery, or workout history..."
                    />
                </div>
            )}

            {/* MODALS (Add Plan, Add Exercise, Add Measurement, Edit Profile) */}
            {isAddPlanModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Add Workout Plan</h2>
                        <form onSubmit={handleAddPlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Plan Name (e.g., Push Day)" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select value={newPlan.split} onChange={e => setNewPlan({...newPlan, split: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    <option value="Full Body" style={{ background: 'var(--surface-inset)' }}>Full Body</option>
                                    <option value="3 Days / Week" style={{ background: 'var(--surface-inset)' }}>3 Days / Week</option>
                                    <option value="4 Days / Week" style={{ background: 'var(--surface-inset)' }}>4 Days / Week</option>
                                    <option value="5 Days / Week" style={{ background: 'var(--surface-inset)' }}>5 Days / Week</option>
                                    <option value="6 Days / Week" style={{ background: 'var(--surface-inset)' }}>6 Days / Week</option>
                                </select>
                                <select value={newPlan.focus} onChange={e => setNewPlan({...newPlan, focus: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    <option value="Hypertrophy" style={{ background: 'var(--surface-inset)' }}>Hypertrophy</option>
                                    <option value="Strength" style={{ background: 'var(--surface-inset)' }}>Strength</option>
                                    <option value="Endurance" style={{ background: 'var(--surface-inset)' }}>Endurance</option>
                                    <option value="Fat Loss" style={{ background: 'var(--surface-inset)' }}>Fat Loss</option>
                                </select>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={newPlan.active} onChange={e => setNewPlan({...newPlan, active: e.target.checked})} style={{ accentColor: 'var(--primary)', width: '15px', height: '15px', cursor: 'pointer' }} />
                                Set as Active Split
                            </label>
                            <div>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Exercises in this Plan</span>
                                {exercises.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                                        {exercises.map((ex) => (
                                            <label key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 10px', background: 'var(--widget-bg)', borderRadius: '8px', border: '1px solid var(--border-premium)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={newPlan.exerciseIds.includes(ex.id)}
                                                    onChange={(e) => setNewPlan({
                                                        ...newPlan,
                                                        exerciseIds: e.target.checked ? [...newPlan.exerciseIds, ex.id] : newPlan.exerciseIds.filter((id) => id !== ex.id),
                                                    })}
                                                    style={{ accentColor: 'var(--primary)', width: '15px', height: '15px', cursor: 'pointer', flexShrink: 0 }}
                                                />
                                                {ex.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({ex.muscle})</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Add exercises in the Exercises tab first to assign them here.</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={() => setIsAddPlanModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Save Plan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isEditingProfile && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Edit Fitness Profile</h2>
                        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" placeholder="Name" value={tempProfile.name} onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input type="number" placeholder="Age" value={tempProfile.age} onChange={(e) => setTempProfile({...tempProfile, age: sanitizeNumberInput(e.target.value, tempProfile.age)})} onBlur={(e) => setTempProfile({...tempProfile, age: normalizeNumberOnBlur(e.target.value, false)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                                <input type="text" placeholder="Height (e.g. 175 cm)" value={tempProfile.height} onChange={(e) => setTempProfile({...tempProfile, height: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input type="number" step="0.1" required placeholder="Current Weight" value={tempProfile.weight} onChange={(e) => setTempProfile({...tempProfile, weight: sanitizeNumberInput(e.target.value, tempProfile.weight)})} onBlur={(e) => setTempProfile({...tempProfile, weight: normalizeNumberOnBlur(e.target.value, true)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                                <input type="number" step="0.1" required placeholder="Target Weight" value={tempProfile.targetWeight} onChange={(e) => setTempProfile({...tempProfile, targetWeight: sanitizeNumberInput(e.target.value, tempProfile.targetWeight)})} onBlur={(e) => setTempProfile({...tempProfile, targetWeight: normalizeNumberOnBlur(e.target.value, true)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                            </div>
                            <select value={tempProfile.goal} onChange={(e) => setTempProfile({...tempProfile, goal: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }}>
                                <option value="Not Set" style={{ background: 'var(--surface-inset)' }}>Select Goal</option>
                                <option value="Muscle Gain" style={{ background: 'var(--surface-inset)' }}>Muscle Gain</option>
                                <option value="Fat Loss" style={{ background: 'var(--surface-inset)' }}>Fat Loss</option>
                                <option value="Maintenance" style={{ background: 'var(--surface-inset)' }}>Maintenance</option>
                                <option value="Endurance" style={{ background: 'var(--surface-inset)' }}>Endurance</option>
                                <option value="General Fitness" style={{ background: 'var(--surface-inset)' }}>General Fitness</option>
                            </select>
                            <select value={tempProfile.experience} onChange={(e) => setTempProfile({...tempProfile, experience: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }}>
                                <option value="Beginner" style={{ background: 'var(--surface-inset)' }}>Beginner</option>
                                <option value="Intermediate" style={{ background: 'var(--surface-inset)' }}>Intermediate</option>
                                <option value="Advanced" style={{ background: 'var(--surface-inset)' }}>Advanced</option>
                            </select>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setIsEditingProfile(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAddMeasurementModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Log Measurement</h2>
                        <form onSubmit={handleAddMeasurement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="number" step="0.1" placeholder="Weight (kg)" value={newMeasurement.weight} onChange={(e) => setNewMeasurement({...newMeasurement, weight: sanitizeNumberInput(e.target.value, newMeasurement.weight)})} onBlur={(e) => setNewMeasurement({...newMeasurement, weight: normalizeNumberOnBlur(e.target.value, true)})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input type="number" step="0.1" placeholder="Chest (cm)" value={newMeasurement.chest || ''} onChange={(e) => setNewMeasurement({...newMeasurement, chest: sanitizeNumberInput(e.target.value, newMeasurement.chest)})} onBlur={(e) => setNewMeasurement({...newMeasurement, chest: normalizeNumberOnBlur(e.target.value, true)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                                <input type="number" step="0.1" placeholder="Waist (cm)" value={newMeasurement.waist || ''} onChange={(e) => setNewMeasurement({...newMeasurement, waist: sanitizeNumberInput(e.target.value, newMeasurement.waist)})} onBlur={(e) => setNewMeasurement({...newMeasurement, waist: normalizeNumberOnBlur(e.target.value, true)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                                <input type="number" step="0.1" placeholder="Biceps (cm)" value={newMeasurement.biceps || ''} onChange={(e) => setNewMeasurement({...newMeasurement, biceps: sanitizeNumberInput(e.target.value, newMeasurement.biceps)})} onBlur={(e) => setNewMeasurement({...newMeasurement, biceps: normalizeNumberOnBlur(e.target.value, true)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setIsAddMeasurementModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save Log</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAddExerciseModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Add Exercise</h2>
                        <form onSubmit={handleAddExercise} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Exercise Name" value={newExercise.name} onChange={(e) => setNewExercise({...newExercise, name: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                            <select value={newExercise.muscle} onChange={(e) => setNewExercise({...newExercise, muscle: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }}>
                                <option value="Chest" style={{ background: 'var(--surface-inset)' }}>Chest</option>
                                <option value="Back" style={{ background: 'var(--surface-inset)' }}>Back</option>
                                <option value="Legs" style={{ background: 'var(--surface-inset)' }}>Legs</option>
                                <option value="Shoulders" style={{ background: 'var(--surface-inset)' }}>Shoulders</option>
                                <option value="Biceps" style={{ background: 'var(--surface-inset)' }}>Biceps</option>
                                <option value="Triceps" style={{ background: 'var(--surface-inset)' }}>Triceps</option>
                            </select>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setIsAddExerciseModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {gymToast && (
                <div style={{
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 230000,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px',
                    padding: '12px 20px', boxShadow: 'var(--premium-shadow)', color: 'var(--text-primary)',
                    fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <Dumbbell size={15} color="var(--accent)" />
                    {gymToast}
                </div>
            )}

        </div>
    );
};

export default GymPage;