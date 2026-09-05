// src/pages/GymPage.jsx
import { useState, useEffect } from 'react';
import { Dumbbell, Flame, TrendingUp, User, Target, Plus, Search, Play, Check, Trash2, ArrowLeft, Ruler, Sparkles, Cpu, Pencil, Save } from 'lucide-react';
import AIQueryBox from '../components/AIQueryBox.jsx';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { sanitizeNumberInput, normalizeNumberOnBlur } from '../utils/smartNumberInput.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { getLocalDateString } from '../utils/dateUtils.js';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';

const KG_PER_LB = 0.45359237;
// All weight data is stored in kilograms internally regardless of the
// user's display preference - these two helpers are the only place a
// kg<->lbs conversion happens, applied purely at the display/input
// boundary so the underlying stored numbers (and history already saved)
// never drift from repeated round-tripping.
const kgToDisplay = (kg, unit) => (unit === 'lbs' ? (Number(kg) || 0) / KG_PER_LB : Number(kg) || 0);
const displayToKg = (value, unit) => (unit === 'lbs' ? (Number(value) || 0) * KG_PER_LB : Number(value) || 0);

const GymPage = () => {
    const isMobile = useIsMobile();
    // Mobile-only, real-first-visit-only tour - same pattern as every
    // other page's tour (see FinancePage.jsx/CalendarPage.jsx).
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('gym'));
    const { settings } = useGlobalSettings();
    const weightUnit = settings.weightUnit === 'lbs' ? 'lbs' : 'kg';
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
    // profile.weight/targetWeight are always stored in kg - these hold the
    // same two values converted into whatever unit is currently displayed,
    // so the Edit Profile weight fields can be typed in that unit directly
    // (kept as separate string-friendly state, not converted inline on
    // every keystroke, so sanitizeNumberInput's own "stay empty while
    // typing" behavior isn't broken by a live unit conversion).
    const [tempWeightDisplay, setTempWeightDisplay] = useState(kgToDisplay(profile.weight, weightUnit));
    const [tempTargetWeightDisplay, setTempTargetWeightDisplay] = useState(kgToDisplay(profile.targetWeight, weightUnit));
    const [isAddExerciseModal, setIsAddExerciseModal] = useState(false);
    const [newExercise, setNewExercise] = useState({ name: '', muscle: 'Chest', equipment: 'Barbell', difficulty: 'Beginner', type: 'Compound' });
    // null while adding a fresh exercise; the exercise's own id while
    // editing an existing one - same single-flag branching pattern
    // TimetablePage.jsx's editingIndex uses for its own Add/Edit modal.
    const [editingExerciseId, setEditingExerciseId] = useState(null);
    const [isAddMeasurementModal, setIsAddMeasurementModal] = useState(false);
    const [newMeasurement, setNewMeasurement] = useState({ chest: 0, waist: 0, biceps: 0 });
    const [editingMeasurementId, setEditingMeasurementId] = useState(null);
    // Same "separate display-unit state" pattern as tempWeightDisplay above
    // - keeps the field typeable in whatever unit is currently selected
    // without converting through kg on every keystroke.
    const [measurementWeightDisplay, setMeasurementWeightDisplay] = useState(kgToDisplay(profile.weight, weightUnit));

    // NEW: Add Plan Modal State
    const [isAddPlanModal, setIsAddPlanModal] = useState(false);
    const [newPlan, setNewPlan] = useState({ name: '', split: '6 Days / Week', focus: 'Hypertrophy', active: true, exerciseIds: [] });
    const [editingPlanId, setEditingPlanId] = useState(null);

    // Workout History entries have no manual "Add" flow (they're created by
    // finishWorkoutSession or the AI assistant) - only a real, focused Edit
    // modal for correcting a genuinely wrong title/date after the fact, not
    // a full Add/Edit dual-purpose form like the other three.
    const [isEditHistoryModal, setIsEditHistoryModal] = useState(false);
    const [editingHistoryId, setEditingHistoryId] = useState(null);
    const [editHistoryDraft, setEditHistoryDraft] = useState({ title: '', date: '' });

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
    const handleSaveProfile = (e) => {
        e.preventDefault();
        setProfile({
            ...tempProfile,
            weight: displayToKg(tempWeightDisplay, weightUnit),
            targetWeight: displayToKg(tempTargetWeightDisplay, weightUnit),
        });
        setIsEditingProfile(false);
    };
    
    const handleAddExercise = (e) => {
        e.preventDefault();
        if (!newExercise.name.trim()) return;
        const resolvedExercise = { ...newExercise, name: toTitleCase(newExercise.name.trim()) };
        if (editingExerciseId !== null) {
            setExercises((prev) => prev.map((ex) => (ex.id === editingExerciseId ? { ...ex, ...resolvedExercise } : ex)));
        } else {
            setExercises([{ id: Date.now().toString(), ...resolvedExercise }, ...exercises]);
        }
        closeExerciseModal();
    };

    // Opens the shared Add/Edit modal fresh for a brand-new exercise -
    // resets every field so a previous Add or a cancelled Edit never
    // leaves stale values behind for the next "Add Custom Exercise" click.
    const openAddExerciseModal = () => {
        setEditingExerciseId(null);
        setNewExercise({ name: '', muscle: 'Chest', equipment: 'Barbell', difficulty: 'Beginner', type: 'Compound' });
        setIsAddExerciseModal(true);
    };

    const openEditExerciseModal = (exercise) => {
        setEditingExerciseId(exercise.id);
        setNewExercise({
            name: exercise.name || '', muscle: exercise.muscle || 'Chest',
            equipment: exercise.equipment || 'Barbell', difficulty: exercise.difficulty || 'Beginner', type: exercise.type || 'Compound',
        });
        setIsAddExerciseModal(true);
    };

    const closeExerciseModal = () => {
        setIsAddExerciseModal(false);
        setEditingExerciseId(null);
    };

    const handleAddMeasurement = (e) => {
        e.preventDefault();
        const weightKg = displayToKg(measurementWeightDisplay, weightUnit) || profile.weight;
        const chest = parseFloat(newMeasurement.chest) || 0, waist = parseFloat(newMeasurement.waist) || 0, biceps = parseFloat(newMeasurement.biceps) || 0;
        if (editingMeasurementId !== null) {
            // Editing an existing (possibly historical) log entry doesn't
            // touch the profile's current weight - only a genuinely new
            // measurement below does that.
            setMeasurements((prev) => prev.map((m) => (m.id === editingMeasurementId ? { ...m, weight: weightKg, chest, waist, biceps } : m)));
        } else {
            const item = { id: Date.now().toString(), date: getLocalDateString(), weight: weightKg, chest, waist, biceps };
            setMeasurements([item, ...measurements]);
            setProfile(prev => ({ ...prev, weight: item.weight }));
        }
        closeMeasurementModal();
    };

    const openAddMeasurementModal = () => {
        setEditingMeasurementId(null);
        setMeasurementWeightDisplay(kgToDisplay(profile.weight, weightUnit));
        setNewMeasurement({ chest: 0, waist: 0, biceps: 0 });
        setIsAddMeasurementModal(true);
    };

    const openEditMeasurementModal = (measurement) => {
        setEditingMeasurementId(measurement.id);
        setMeasurementWeightDisplay(kgToDisplay(measurement.weight, weightUnit));
        setNewMeasurement({ chest: measurement.chest || 0, waist: measurement.waist || 0, biceps: measurement.biceps || 0 });
        setIsAddMeasurementModal(true);
    };

    const closeMeasurementModal = () => {
        setIsAddMeasurementModal(false);
        setEditingMeasurementId(null);
    };

    // NEW: Handle Add Plan
    const handleAddPlan = (e) => {
        e.preventDefault();
        if (!newPlan.name.trim()) return;
        if (editingPlanId !== null) {
            setWorkoutPlans((prev) => prev.map((p) => {
                if (p.id === editingPlanId) return { ...p, ...newPlan };
                // Same "Active Split" singularity rule as the Add branch
                // below - editing a plan into the active slot correctly
                // deactivates every other plan.
                return newPlan.active ? { ...p, active: false } : p;
            }));
        } else {
            const item = { id: Date.now().toString(), ...newPlan };
            setWorkoutPlans((prev) => {
                // "Active Split" is a singular designation - marking this new
                // plan active correctly deactivates any other plan that was
                // active, rather than letting every plan silently stack up as
                // active forever with no real distinction between them.
                const next = item.active ? prev.map((p) => ({ ...p, active: false })) : prev;
                return [item, ...next];
            });
        }
        closePlanModal();
    };

    const openAddPlanModal = () => {
        setEditingPlanId(null);
        setNewPlan({ name: '', split: '6 Days / Week', focus: 'Hypertrophy', active: true, exerciseIds: [] });
        setIsAddPlanModal(true);
    };

    const openEditPlanModal = (plan) => {
        setEditingPlanId(plan.id);
        setNewPlan({ name: plan.name || '', split: plan.split || '6 Days / Week', focus: plan.focus || 'Hypertrophy', active: !!plan.active, exerciseIds: plan.exerciseIds || [] });
        setIsAddPlanModal(true);
    };

    const closePlanModal = () => {
        setIsAddPlanModal(false);
        setEditingPlanId(null);
        setNewPlan({ name: '', split: '6 Days / Week', focus: 'Hypertrophy', active: true, exerciseIds: [] });
    };

    const openEditHistoryModal = (item) => {
        setEditingHistoryId(item.id);
        setEditHistoryDraft({ title: item.title || '', date: item.date || '' });
        setIsEditHistoryModal(true);
    };

    const closeEditHistoryModal = () => {
        setIsEditHistoryModal(false);
        setEditingHistoryId(null);
    };

    const handleSaveHistoryEdit = (e) => {
        e.preventDefault();
        if (!editHistoryDraft.title.trim()) return;
        setWorkoutHistory((prev) => prev.map((h) => (h.id === editingHistoryId ? { ...h, title: toTitleCase(editHistoryDraft.title.trim()), date: editHistoryDraft.date || h.date } : h)));
        closeEditHistoryModal();
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
        const newSessionRecord = { id: Date.now().toString(), title: activeSession.planName, date: getLocalDateString(), duration: elapsedMinutes ? `${elapsedMinutes} min${elapsedMinutes === 1 ? '' : 's'}` : 'Unknown', volume: `${Math.round(kgToDisplay(totalVolume, weightUnit)).toLocaleString()} ${weightUnit}`, setsCompleted: totalSets };
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
                                        <input id={`gymSetWeight_${exIndex}_${setIndex}`} name={`setWeight_${exIndex}_${setIndex}`} type="number" step="0.5" aria-label={`Set ${setIndex + 1} weight (${weightUnit})`} value={kgToDisplay(set.weight, weightUnit)} onChange={(e) => updateSetValue(exIndex, setIndex, 'weight', displayToKg(sanitizeNumberInput(e.target.value, kgToDisplay(set.weight, weightUnit)), weightUnit))} onBlur={(e) => updateSetValue(exIndex, setIndex, 'weight', displayToKg(normalizeNumberOnBlur(e.target.value, true), weightUnit))} style={{ width: '100%', padding: isMobile ? '12px 8px' : '8px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', outline: 'none' }} />
                                        <input id={`gymSetReps_${exIndex}_${setIndex}`} name={`setReps_${exIndex}_${setIndex}`} type="number" aria-label={`Set ${setIndex + 1} reps`} value={set.reps} onChange={(e) => updateSetValue(exIndex, setIndex, 'reps', sanitizeNumberInput(e.target.value, set.reps))} onBlur={(e) => updateSetValue(exIndex, setIndex, 'reps', normalizeNumberOnBlur(e.target.value, false))} style={{ width: '100%', padding: isMobile ? '12px 8px' : '8px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', outline: 'none' }} />
                                        <button onClick={() => toggleSetCompletion(exIndex, setIndex)} style={{ width: '100%', padding: isMobile ? '12px 8px' : '8px', background: set.completed ? '#10B981' : 'var(--surface-inset)', color: set.completed ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>{set.completed ? '✓' : '○'}</button>
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
            {showTour && <TourGuide tourId="gym" steps={TOUR_STEPS.gym} onFinish={() => setShowTour(false)} />}

            {/* Header Section - title and every action button share one
                row even on mobile (buttons drop to icon-only there via
                each one's own {!isMobile && '...'} label) instead of the
                button group wrapping onto its own row below the title -
                the same real fix already applied to Finance Hub's header,
                mirrored here so the vertical space it used to cost is
                saved back for the actual page content underneath. */}
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: isMobile ? '8px' : '16px' }}>
                <h1 style={{ fontSize: isMobile ? '19px' : '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>Gym Hub</h1>

                <div style={{ display: 'flex', flexWrap: 'nowrap', gap: isMobile ? '6px' : '10px', flexShrink: 0 }}>
                    {activeTab === 'Dashboard' && (
                        <button data-tour-id="gym-add-plan" title="Add Workout Plan" onClick={openAddPlanModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: isMobile ? '10px' : '10px 20px', flexShrink: 0, boxSizing: 'border-box', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <Plus size={isMobile ? 16 : 18} /> {!isMobile && 'Add Workout Plan'}
                        </button>
                    )}
                    {activeTab === 'Exercises' && (
                        <button title="Add Custom Exercise" onClick={openAddExerciseModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: isMobile ? '10px' : '10px 20px', flexShrink: 0, boxSizing: 'border-box', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <Plus size={isMobile ? 16 : 18} /> {!isMobile && 'Add Custom Exercise'}
                        </button>
                    )}
                    {activeTab === 'Recovery' && (
                        <button title="Log Measurements" onClick={openAddMeasurementModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: isMobile ? '10px' : '10px 20px', flexShrink: 0, boxSizing: 'border-box', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <Ruler size={isMobile ? 16 : 18} /> {!isMobile && 'Log Measurements'}
                        </button>
                    )}
                    <button title="Profile" onClick={() => { setTempProfile(profile); setTempWeightDisplay(kgToDisplay(profile.weight, weightUnit)); setTempTargetWeightDisplay(kgToDisplay(profile.targetWeight, weightUnit)); setIsEditingProfile(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: isMobile ? '10px' : '10px 20px', flexShrink: 0, boxSizing: 'border-box', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <User size={isMobile ? 16 : 18} /> {!isMobile && 'Profile'}
                    </button>
                </div>
            </div>

            {/* Quick Metrics Overview Cards - compact 3-column grid on
                mobile (matches the same pattern used across Planner/Study)
                so all three stats are glanceable without extra scrolling. */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: isMobile ? '10px' : '16px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '12px 10px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '8px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)', flexShrink: 0, display: 'flex' }}><Target size={isMobile ? 16 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Primary Goal</span>
                        <h2 style={{ fontSize: isMobile ? '13px' : '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.goal}</h2>
                    </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '12px 10px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '8px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#10B981', flexShrink: 0, display: 'flex' }}><TrendingUp size={isMobile ? 16 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{isMobile ? 'Weight' : 'Current / Target Weight'}</span>
                        <h2 style={{ fontSize: isMobile ? '13px' : '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {kgToDisplay(profile.weight, weightUnit).toFixed(1)}{isMobile ? '' : ` ${weightUnit}`} <span style={{ fontSize: isMobile ? '10px' : '14px', color: 'var(--text-muted)' }}>/ {kgToDisplay(profile.targetWeight, weightUnit).toFixed(1)} {weightUnit}</span>
                        </h2>
                    </div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: isMobile ? '12px 10px' : '20px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '8px' : '16px', minWidth: 0 }}>
                    <div style={{ padding: isMobile ? '8px' : '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#F59E0B', flexShrink: 0, display: 'flex' }}><Flame size={isMobile ? 16 : 24} /></div>
                    <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: isMobile ? '10px' : '12px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>Streak</span>
                        <h2 style={{ fontSize: isMobile ? '13px' : '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.streak}{isMobile ? '' : ' Days'}</h2>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs - fade-masked horizontal scroll (matching
                the same pattern used on Timetable/Study/Syllabus) plus
                taller mobile padding for a real touch target. */}
            <div data-tour-id="gym-tabs" style={{
                display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px', overflowX: 'auto',
                maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
            }}>
                {['Dashboard', 'Exercises', 'History', 'Recovery', 'Analytics'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: isMobile ? '13px 16px' : '10px 16px', background: activeTab === tab ? 'var(--widget-bg)' : 'transparent', color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', flexShrink: 0 }}>
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

                    {/* Given an explicit glassmorphic treatment (backdrop
                        blur + a soft top-edge sheen) that works uniformly
                        across all 4 themes - matching the same pattern
                        used for Study's Quick Doubt Solver card, since
                        --bg-surface alone is fully opaque under night/
                        comfort/day and a plain blur there is invisible. */}
                    <div style={{
                        background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '18px' : '20px',
                        padding: '16px', boxShadow: 'var(--premium-shadow), inset 0 1px 0 rgba(255,255,255,0.07)',
                        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxSizing: 'border-box',
                    }}>
                        <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: 0, marginBottom: '16px' }}>Active Workout Split & Start Session</h3>
                        {workoutPlans.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: isMobile ? '12px' : '20px' }}>
                                {workoutPlans.map(plan => (
                                    <div key={plan.id} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--surface-inset)', color: plan.active ? '#10B981' : 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>
                                                    {plan.active ? 'Active Split' : 'Standard'}
                                                </span>
                                                <h4 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '8px', overflowWrap: 'break-word' }}>{plan.name}</h4>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>{plan.split} · {plan.focus} · {(plan.exerciseIds || []).length} exercise{(plan.exerciseIds || []).length === 1 ? '' : 's'}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                <button onClick={() => openEditPlanModal(plan)} title="Edit Plan" style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><Pencil size={16} /></button>
                                                <button onClick={() => deletePlan(plan.id)} title="Delete Plan" style={{ padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                <button onClick={() => startWorkoutSession(plan)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', cursor: 'pointer' }}><Play size={14} /> Start</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: isMobile ? '28px 16px' : '40px', boxSizing: 'border-box', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-premium)', borderRadius: '14px' }}>
                                <Dumbbell size={28} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>No workout plans yet</span>
                                <span style={{ fontSize: '12px' }}>Tap "{isMobile ? 'Add Plan' : 'Add Workout Plan'}" above to build your first split.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: EXERCISE DATABASE */}
            {activeTab === 'Exercises' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                        <input type="text" aria-label="Search exercises" placeholder="Search exercises..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 44px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none' }} />
                    </div>
                    {filteredExercises.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                            {filteredExercises.map(ex => (
                                <div key={ex.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px' }}>{ex.muscle}</span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button onClick={() => openEditExerciseModal(ex)} title="Edit Exercise" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><Pencil size={16} /></button>
                                            <button onClick={() => deleteExercise(ex.id)} title="Delete Exercise" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                                        </div>
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
                                <button onClick={() => openEditHistoryModal(item)} title="Edit Entry" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Pencil size={16} /></button>
                                <button onClick={() => deleteHistory(item.id)} title="Delete Entry" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16} /></button>
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
                                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>⚖️ {kgToDisplay(m.weight, weightUnit).toFixed(1)} {weightUnit}</span>
                                        {m.chest > 0 && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chest {m.chest}cm</span>}
                                        {m.waist > 0 && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Waist {m.waist}cm</span>}
                                        {m.biceps > 0 && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Biceps {m.biceps}cm</span>}
                                        <button onClick={() => openEditMeasurementModal(m)} title="Edit Measurement" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Pencil size={16} /></button>
                                        <button onClick={() => deleteMeasurement(m.id)} title="Delete Measurement" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
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

                    {/* AI coaching is paused on mobile for this pass - desktop is unaffected. */}
                    {!isMobile && (
                        <AIQueryBox
                            context={{ workouts: workoutHistory }} persona="fitness"
                            title="Ask the AI Fitness Coach"
                            placeholder="Ask about your consistency, recovery, or workout history..."
                        />
                    )}
                </div>
            )}

            {/* MODALS (Add Plan, Add Exercise, Add Measurement, Edit Profile) */}
            {isAddPlanModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingPlanId !== null ? 'Edit Workout Plan' : 'Add Workout Plan'}</h2>
                        <form onSubmit={handleAddPlan} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required aria-label="Plan name" placeholder="Plan Name (e.g., Push Day)" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select aria-label="Plan split" value={newPlan.split} onChange={e => setNewPlan({...newPlan, split: e.target.value})} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    <option value="Full Body" style={{ background: 'var(--surface-inset)' }}>Full Body</option>
                                    <option value="3 Days / Week" style={{ background: 'var(--surface-inset)' }}>3 Days / Week</option>
                                    <option value="4 Days / Week" style={{ background: 'var(--surface-inset)' }}>4 Days / Week</option>
                                    <option value="5 Days / Week" style={{ background: 'var(--surface-inset)' }}>5 Days / Week</option>
                                    <option value="6 Days / Week" style={{ background: 'var(--surface-inset)' }}>6 Days / Week</option>
                                </select>
                                <select aria-label="Plan focus" value={newPlan.focus} onChange={e => setNewPlan({...newPlan, focus: e.target.value})} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
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
                                <button type="button" onClick={closePlanModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>{editingPlanId !== null ? 'Save Changes' : 'Save Plan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isEditingProfile && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Edit Fitness Profile</h2>
                        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" placeholder="Name" value={tempProfile.name} onChange={(e) => setTempProfile({...tempProfile, name: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input type="number" placeholder="Age" value={tempProfile.age} onChange={(e) => setTempProfile({...tempProfile, age: sanitizeNumberInput(e.target.value, tempProfile.age)})} onBlur={(e) => setTempProfile({...tempProfile, age: normalizeNumberOnBlur(e.target.value, false)})} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                                <input type="text" placeholder="Height (e.g. 175 cm)" value={tempProfile.height} onChange={(e) => setTempProfile({...tempProfile, height: e.target.value})} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input id="gymCurrentWeight" name="currentWeight" type="number" step="0.1" required aria-label={`Current weight (${weightUnit})`} placeholder={`Current Weight (${weightUnit})`} value={tempWeightDisplay} onChange={(e) => setTempWeightDisplay(sanitizeNumberInput(e.target.value, tempWeightDisplay))} onBlur={(e) => setTempWeightDisplay(normalizeNumberOnBlur(e.target.value, true))} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                                <input id="gymTargetWeight" name="targetWeight" type="number" step="0.1" required aria-label={`Target weight (${weightUnit})`} placeholder={`Target Weight (${weightUnit})`} value={tempTargetWeightDisplay} onChange={(e) => setTempTargetWeightDisplay(sanitizeNumberInput(e.target.value, tempTargetWeightDisplay))} onBlur={(e) => setTempTargetWeightDisplay(normalizeNumberOnBlur(e.target.value, true))} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
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
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingMeasurementId !== null ? 'Edit Measurement' : 'Log Measurement'}</h2>
                        <form onSubmit={handleAddMeasurement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input id="gymMeasurementWeight" name="measurementWeight" type="number" step="0.1" aria-label={`Weight (${weightUnit})`} placeholder={`Weight (${weightUnit})`} value={measurementWeightDisplay} onChange={(e) => setMeasurementWeightDisplay(sanitizeNumberInput(e.target.value, measurementWeightDisplay))} onBlur={(e) => setMeasurementWeightDisplay(normalizeNumberOnBlur(e.target.value, true))} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <input type="number" step="0.1" placeholder="Chest (cm)" value={newMeasurement.chest || ''} onChange={(e) => setNewMeasurement({...newMeasurement, chest: sanitizeNumberInput(e.target.value, newMeasurement.chest)})} onBlur={(e) => setNewMeasurement({...newMeasurement, chest: normalizeNumberOnBlur(e.target.value, true)})} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                                <input type="number" step="0.1" placeholder="Waist (cm)" value={newMeasurement.waist || ''} onChange={(e) => setNewMeasurement({...newMeasurement, waist: sanitizeNumberInput(e.target.value, newMeasurement.waist)})} onBlur={(e) => setNewMeasurement({...newMeasurement, waist: normalizeNumberOnBlur(e.target.value, true)})} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                                <input type="number" step="0.1" placeholder="Biceps (cm)" value={newMeasurement.biceps || ''} onChange={(e) => setNewMeasurement({...newMeasurement, biceps: sanitizeNumberInput(e.target.value, newMeasurement.biceps)})} onBlur={(e) => setNewMeasurement({...newMeasurement, biceps: normalizeNumberOnBlur(e.target.value, true)})} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeMeasurementModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>{editingMeasurementId !== null ? 'Save Changes' : 'Save Log'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAddExerciseModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingExerciseId !== null ? 'Edit Exercise' : 'Add Exercise'}</h2>
                        <form onSubmit={handleAddExercise} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required aria-label="Exercise name" placeholder="Exercise Name" value={newExercise.name} onChange={(e) => setNewExercise({...newExercise, name: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                            <select aria-label="Target muscle" value={newExercise.muscle} onChange={(e) => setNewExercise({...newExercise, muscle: e.target.value})} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }}>
                                <option value="Chest" style={{ background: 'var(--surface-inset)' }}>Chest</option>
                                <option value="Back" style={{ background: 'var(--surface-inset)' }}>Back</option>
                                <option value="Legs" style={{ background: 'var(--surface-inset)' }}>Legs</option>
                                <option value="Shoulders" style={{ background: 'var(--surface-inset)' }}>Shoulders</option>
                                <option value="Biceps" style={{ background: 'var(--surface-inset)' }}>Biceps</option>
                                <option value="Triceps" style={{ background: 'var(--surface-inset)' }}>Triceps</option>
                            </select>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeExerciseModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>{editingExerciseId !== null ? 'Save Changes' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isEditHistoryModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Edit Workout Entry</h2>
                        <form onSubmit={handleSaveHistoryEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required aria-label="Workout title" placeholder="Workout Title" value={editHistoryDraft.title} onChange={(e) => setEditHistoryDraft({ ...editHistoryDraft, title: e.target.value })} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)' }} />
                            <input type="date" required aria-label="Workout date" value={editHistoryDraft.date} onChange={(e) => setEditHistoryDraft({ ...editHistoryDraft, date: e.target.value })} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeEditHistoryModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}><Save size={16} /> Save Changes</button>
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