// src/pages/DietPage.jsx
import { useState, useEffect } from 'react';
import { Utensils, Flame, Droplet, Target, User, Plus, CheckCircle, Award, Search, Check, Trash2, Pencil, Clock, Sparkles, ShoppingCart, Cpu } from 'lucide-react';
import AIQueryBox from '../components/AIQueryBox.jsx';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { sanitizeNumberInput, normalizeNumberOnBlur } from '../utils/smartNumberInput.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';

const DietPage = () => {
    const isMobile = useIsMobile();
    // Mobile-only, real-first-visit-only tour - same pattern as every
    // other page's tour (see FinancePage.jsx/CalendarPage.jsx).
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('diet'));
    const { settings, updateSetting } = useGlobalSettings();
    // 1. FIXED: Zeroed out Profile & Goals
    const [profile, setProfile] = useState(() => {
        const saved = localStorage.getItem('nexus_diet_profile');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return null; }
        }
        return {
            goal: 'Not Set',
            currentWeight: 0,
            targetWeight: 0,
            dailyCalories: 0,
            proteinGoal: 0,
            carbsGoal: 0,
            fatGoal: 0,
            mealsPerDay: 0
        };
    });

    // 2. FIXED: Zeroed out Daily Log
    const [dailyLog, setDailyLog] = useState(() => {
        const saved = localStorage.getItem('nexus_diet_daily_log');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return null; }
        }
        return {
            caloriesConsumed: 0,
            proteinConsumed: 0,
            carbsConsumed: 0,
            fatConsumed: 0,
            waterConsumed: 0,
            mealsLoggedCount: 0
        };
    });

    // 3. FIXED: Emptied Food Database
    const [foods, setFoods] = useState(() => {
        const saved = localStorage.getItem('nexus_diet_foods');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });

    // 4. FIXED: Emptied Daily Meals Timeline
    const [meals, setMeals] = useState(() => {
        const saved = localStorage.getItem('nexus_diet_meals');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });

    // 5. FIXED: Emptied Grocery List
    const [groceryList, setGroceryList] = useState(() => {
        const saved = localStorage.getItem('nexus_diet_grocery');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });

    const [activeTab, setActiveTab] = useState('Dashboard');

    // Modals & Forms State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [tempProfile, setTempProfile] = useState(profile);
    const [tempWaterGoal, setTempWaterGoal] = useState(settings.dailyHydrationGoal);
    const [isAddFoodModalOpen, setIsAddFoodModalOpen] = useState(false);
    const [newFood, setNewFood] = useState({ name: '', category: 'Grains', serving: '100 g', calories: '', protein: '', carbs: '', fat: '' });
    // null while adding a fresh food; the food's own id while editing an
    // existing one - the flag handleAddFood branches on to update in
    // place instead of always appending, matching the same editingIndex
    // pattern TimetablePage's own Add/Edit modal already established.
    const [editingFoodId, setEditingFoodId] = useState(null);

    // NEW: Add Meal Modal State
    const [isAddMealModalOpen, setIsAddMealModalOpen] = useState(false);
    const [newMeal, setNewMeal] = useState({ title: 'Breakfast', time: '', foodName: '', calories: '', protein: '', carbs: '', fat: '' });
    const [editingMealId, setEditingMealId] = useState(null);

    const [newGroceryItem, setNewGroceryItem] = useState('');
    // Grocery has no separate modal - editing reuses the same always-
    // visible add form, pre-filled with the item's name, so this flag
    // just switches that one form between "+ Add" and "Save" in place.
    const [editingGroceryId, setEditingGroceryId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Persistence Effects - all five keys now consistently dispatch the
    // shared sync event on their own changes (previously only meals did),
    // matching the same fix already applied to GymPage.
    useEffect(() => { localStorage.setItem('nexus_diet_profile', JSON.stringify(profile)); window.dispatchEvent(new Event('storage')); }, [profile]);
    useEffect(() => { localStorage.setItem('nexus_diet_daily_log', JSON.stringify(dailyLog)); window.dispatchEvent(new Event('storage')); }, [dailyLog]);
    useEffect(() => { localStorage.setItem('nexus_diet_foods', JSON.stringify(foods)); window.dispatchEvent(new Event('storage')); }, [foods]);
    useEffect(() => { localStorage.setItem('nexus_diet_meals', JSON.stringify(meals)); window.dispatchEvent(new Event('storage')); }, [meals]);
    useEffect(() => { localStorage.setItem('nexus_diet_grocery', JSON.stringify(groceryList)); window.dispatchEvent(new Event('storage')); }, [groceryList]);

    // CloudSyncContext's pullFromCloud (a factory-reset restore or sign-in
    // sync) writes directly to these same keys and dispatches 'storage' -
    // without these listeners, this component's own state would never
    // reflect cloud-restored data for any of these five keys while this
    // page happens to be mounted. Previously only meals had this;
    // profile/dailyLog/foods/groceryList had no inbound path at all. Each
    // equality guard prevents that key's own outbound write above from
    // re-triggering itself in a loop.
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latestProfile = JSON.parse(localStorage.getItem('nexus_diet_profile') || 'null');
                if (latestProfile) setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(latestProfile) ? prev : latestProfile));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestDailyLog = JSON.parse(localStorage.getItem('nexus_diet_daily_log') || 'null');
                if (latestDailyLog) setDailyLog((prev) => (JSON.stringify(prev) === JSON.stringify(latestDailyLog) ? prev : latestDailyLog));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestFoods = JSON.parse(localStorage.getItem('nexus_diet_foods') || '[]');
                setFoods((prev) => (JSON.stringify(prev) === JSON.stringify(latestFoods) ? prev : latestFoods));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestMeals = JSON.parse(localStorage.getItem('nexus_diet_meals') || '[]');
                setMeals((prev) => (JSON.stringify(prev) === JSON.stringify(latestMeals) ? prev : latestMeals));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestGrocery = JSON.parse(localStorage.getItem('nexus_diet_grocery') || '[]');
                setGroceryList((prev) => (JSON.stringify(prev) === JSON.stringify(latestGrocery) ? prev : latestGrocery));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    const handleSaveProfile = (e) => { e.preventDefault(); setProfile(tempProfile); updateSetting('dailyHydrationGoal', tempWaterGoal); setIsEditingProfile(false); };

    const handleAddFood = (e) => {
        e.preventDefault();
        if (!newFood.name.trim()) return;
        const resolvedFood = {
            name: toTitleCase(newFood.name.trim()), category: newFood.category, serving: newFood.serving.trim() || '100 g',
            calories: parseInt(newFood.calories) || 0, protein: parseFloat(newFood.protein) || 0, carbs: parseFloat(newFood.carbs) || 0, fat: parseFloat(newFood.fat) || 0
        };
        if (editingFoodId) {
            setFoods(foods.map(f => f.id === editingFoodId ? { ...f, ...resolvedFood } : f));
        } else {
            setFoods([{ id: Date.now().toString(), ...resolvedFood }, ...foods]);
        }
        setIsAddFoodModalOpen(false);
        setEditingFoodId(null);
        setNewFood({ name: '', category: 'Grains', serving: '100 g', calories: '', protein: '', carbs: '', fat: '' });
    };

    // Opens the shared Add/Edit Food modal fresh for a brand-new item.
    const openAddFoodModal = () => {
        setNewFood({ name: '', category: 'Grains', serving: '100 g', calories: '', protein: '', carbs: '', fat: '' });
        setEditingFoodId(null);
        setIsAddFoodModalOpen(true);
    };

    // Pre-fills the same modal with an existing food's own real values.
    const openEditFoodModal = (item) => {
        setNewFood({ name: item.name, category: item.category, serving: item.serving, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat });
        setEditingFoodId(item.id);
        setIsAddFoodModalOpen(true);
    };

    const closeAddFoodModal = () => {
        setIsAddFoodModalOpen(false);
        setEditingFoodId(null);
    };

    // NEW: Add Meal Handler
    const handleAddMeal = (e) => {
        e.preventDefault();
        if (!newMeal.title.trim()) return;
        const resolvedMeal = {
            title: toTitleCase(newMeal.title), time: newMeal.time || '12:00 PM', foodName: newMeal.foodName,
            calories: parseInt(newMeal.calories) || 0, protein: parseFloat(newMeal.protein) || 0, carbs: parseFloat(newMeal.carbs) || 0, fat: parseFloat(newMeal.fat) || 0,
        };
        if (editingMealId) {
            const previousMeal = meals.find(m => m.id === editingMealId);
            setMeals(meals.map(m => m.id === editingMealId ? { ...m, ...resolvedMeal } : m));
            if (previousMeal && previousMeal.completed) {
                // This meal's old macros were already added into today's
                // log while it was marked done - swap in the delta so the
                // log stays accurate instead of going stale after an edit.
                setDailyLog(prev => ({
                    ...prev,
                    caloriesConsumed: Math.max(0, prev.caloriesConsumed - previousMeal.calories + resolvedMeal.calories),
                    proteinConsumed: Math.max(0, prev.proteinConsumed - previousMeal.protein + resolvedMeal.protein),
                    carbsConsumed: Math.max(0, prev.carbsConsumed - previousMeal.carbs + resolvedMeal.carbs),
                    fatConsumed: Math.max(0, prev.fatConsumed - previousMeal.fat + resolvedMeal.fat)
                }));
            }
        } else {
            setMeals([...meals, { id: Date.now().toString(), ...resolvedMeal, completed: false }]);
        }
        setIsAddMealModalOpen(false);
        setEditingMealId(null);
        setNewMeal({ title: 'Breakfast', time: '', foodName: '', calories: '', protein: '', carbs: '', fat: '' });
    };

    // Opens the shared Add/Edit Meal modal fresh for a brand-new entry.
    const openAddMealModal = () => {
        setNewMeal({ title: 'Breakfast', time: '', foodName: '', calories: '', protein: '', carbs: '', fat: '' });
        setEditingMealId(null);
        setIsAddMealModalOpen(true);
    };

    // Pre-fills the same modal with an existing meal's own real values.
    const openEditMealModal = (meal) => {
        setNewMeal({ title: meal.title, time: meal.time || '', foodName: meal.foodName || '', calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat });
        setEditingMealId(meal.id);
        setIsAddMealModalOpen(true);
    };

    const closeAddMealModal = () => {
        setIsAddMealModalOpen(false);
        setEditingMealId(null);
    };

    // Real keyword-based auto-categorization for the Smart Grocery List -
    // matches against the same categories the Food Database itself uses,
    // so a grocery item's category badge genuinely reflects what it is,
    // rather than every single item being hardcoded to the same generic
    // label regardless of content. Falls back to 'Miscellaneous' only
    // when nothing genuinely matches, an honest default rather than a
    // guess.
    const GROCERY_CATEGORY_KEYWORDS = {
        Meat: ['chicken', 'beef', 'pork', 'mutton', 'fish', 'salmon', 'tuna', 'shrimp', 'bacon', 'sausage', 'turkey', 'lamb'],
        Dairy: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'paneer', 'curd'],
        Eggs: ['egg'],
        Grains: ['rice', 'bread', 'pasta', 'oats', 'flour', 'cereal', 'noodle', 'quinoa', 'wheat'],
        Fruits: ['apple', 'banana', 'orange', 'grape', 'mango', 'berry', 'berries', 'melon', 'pineapple', 'lemon', 'avocado'],
        Vegetables: ['carrot', 'broccoli', 'spinach', 'potato', 'onion', 'tomato', 'pepper', 'lettuce', 'cucumber', 'garlic', 'cabbage'],
        'Nuts & Seeds': ['almond', 'cashew', 'walnut', 'peanut', 'seed', 'pistachio'],
        Snacks: ['chips', 'chocolate', 'cookie', 'candy', 'popcorn'],
    };
    const categorizeGroceryItem = (name) => {
        const lower = name.toLowerCase();
        for (const [category, keywords] of Object.entries(GROCERY_CATEGORY_KEYWORDS)) {
            if (keywords.some((kw) => lower.includes(kw))) return category;
        }
        return 'Miscellaneous';
    };

    const handleAddGrocery = (e) => {
        e.preventDefault();
        if (!newGroceryItem.trim()) return;
        const trimmedName = newGroceryItem.trim();
        if (editingGroceryId) {
            setGroceryList(groceryList.map(g => g.id === editingGroceryId ? { ...g, name: trimmedName, category: categorizeGroceryItem(trimmedName) } : g));
            setEditingGroceryId(null);
        } else {
            setGroceryList([{ id: Date.now().toString(), name: trimmedName, category: categorizeGroceryItem(trimmedName), purchased: false }, ...groceryList]);
        }
        setNewGroceryItem('');
    };

    // Pre-fills the same add-item input with an existing item's own real
    // name, so submitting updates it in place instead of appending a new
    // one. stopPropagation matches deleteGrocery below - both sit inside
    // the row's own onClick-to-toggle-purchased handler.
    const openEditGrocery = (item, e) => {
        e.stopPropagation();
        setNewGroceryItem(item.name);
        setEditingGroceryId(item.id);
    };

    const closeGroceryEdit = () => {
        setEditingGroceryId(null);
        setNewGroceryItem('');
    };

    // NEW: Delete Handlers
    const deleteFood = (id) => setFoods(foods.filter(f => f.id !== id));

    const deleteGrocery = (id, e) => {
        e.stopPropagation(); // Prevents toggling the purchase status when clicking delete
        setGroceryList(groceryList.filter(g => g.id !== id));
        if (editingGroceryId === id) closeGroceryEdit();
    };

    const deleteMeal = (id) => {
        const mealToDelete = meals.find(m => m.id === id);
        if (mealToDelete && mealToDelete.completed) {
            // Subtract macros if the meal was completed
            setDailyLog(prev => ({
                ...prev,
                caloriesConsumed: Math.max(0, prev.caloriesConsumed - mealToDelete.calories),
                proteinConsumed: Math.max(0, prev.proteinConsumed - mealToDelete.protein),
                carbsConsumed: Math.max(0, prev.carbsConsumed - mealToDelete.carbs),
                fatConsumed: Math.max(0, prev.fatConsumed - mealToDelete.fat)
            }));
        }
        setMeals(meals.filter(m => m.id !== id));
    };

    const toggleGroceryPurchased = (id) => {
        setGroceryList(groceryList.map(item => item.id === id ? { ...item, purchased: !item.purchased } : item));
    };

    const toggleMealCompletion = (id) => {
        const targetMeal = meals.find(m => m.id === id);
        if (!targetMeal) return;

        const willComplete = !targetMeal.completed;
        setMeals(meals.map(m => m.id === id ? { ...m, completed: willComplete } : m));

        setDailyLog(prev => ({
            ...prev,
            caloriesConsumed: willComplete ? prev.caloriesConsumed + targetMeal.calories : Math.max(0, prev.caloriesConsumed - targetMeal.calories),
            proteinConsumed: willComplete ? prev.proteinConsumed + targetMeal.protein : Math.max(0, prev.proteinConsumed - targetMeal.protein),
            carbsConsumed: willComplete ? prev.carbsConsumed + targetMeal.carbs : Math.max(0, prev.carbsConsumed - targetMeal.carbs),
            fatConsumed: willComplete ? prev.fatConsumed + targetMeal.fat : Math.max(0, prev.fatConsumed - targetMeal.fat)
        }));
    };

    const addWater = (amountInLiters) => {
        setDailyLog(prev => ({ ...prev, waterConsumed: parseFloat((prev.waterConsumed + amountInLiters).toFixed(1)) }));
    };

    // FIXED: Division by Zero guards
    const calorieProgress = profile.dailyCalories > 0 ? Math.min(100, Math.round((dailyLog.caloriesConsumed / profile.dailyCalories) * 100)) : 0;
    const proteinProgress = profile.proteinGoal > 0 ? Math.min(100, Math.round((dailyLog.proteinConsumed / profile.proteinGoal) * 100)) : 0;
    const waterProgress = settings.dailyHydrationGoal > 0 ? Math.min(100, Math.round((dailyLog.waterConsumed / settings.dailyHydrationGoal) * 100)) : 0;

    const filteredFoods = foods.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase()));

    // A real, honest multi-metric briefing - every sentence is a genuine,
    // computed fact about the user's own actual logged data (calories,
    // protein, water), never a fabricated specific claim about data that
    // doesn't exist. Prioritizes whichever real metric most needs
    // attention (water first if genuinely low, since hydration is easy
    // to forget), rather than always leading with the same single metric
    // regardless of what's actually going on.
    const generateNutritionBriefing = () => {
        if (meals.length === 0) return "Start logging your meals to receive AI-driven nutritional insights.";
        const parts = [];
        if (settings.dailyHydrationGoal > 0 && waterProgress < 50) {
            parts.push(`You're at ${dailyLog.waterConsumed}L of your ${settings.dailyHydrationGoal}L water goal - try to catch up on hydration.`);
        }
        if (profile.dailyCalories > 0) {
            parts.push(`You've logged ${dailyLog.caloriesConsumed} of ${profile.dailyCalories} kcal (${calorieProgress}%) today.`);
        }
        if (profile.proteinGoal > 0) {
            parts.push(`Protein is at ${dailyLog.proteinConsumed}g of your ${profile.proteinGoal}g target${proteinProgress >= 100 ? ' - goal met!' : '.'}`);
        }
        if (parts.length === 0) return "Set your daily goals in Profile to start receiving personalized nutrition insights.";
        return parts.join(' ');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            {showTour && <TourGuide tourId="diet" steps={TOUR_STEPS.diet} onFinish={() => setShowTour(false)} />}

            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Diet Hub</h1>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                    {activeTab === 'FoodDatabase' && (
                        <button onClick={openAddFoodModal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <Plus size={18} /> Add Custom Food
                        </button>
                    )}
                    {activeTab === 'DailyLog' && (
                        <button onClick={openAddMealModal} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <Plus size={18} /> Add Meal
                        </button>
                    )}
                    <button data-tour-id="diet-profile" onClick={() => { setTempProfile(profile); setTempWaterGoal(settings.dailyHydrationGoal); setIsEditingProfile(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                        <User size={18} /> Profile
                    </button>
                </div>
            </div>

            {/* Quick Metrics Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)' }}><Flame size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Calories Today</span>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{dailyLog.caloriesConsumed} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {profile.dailyCalories} kcal</span></h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#10B981' }}><Award size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Protein Intake</span>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{dailyLog.proteinConsumed} g <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {profile.proteinGoal} g</span></h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#3B82F6' }}><Droplet size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Hydration</span>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{dailyLog.waterConsumed} L <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ {settings.dailyHydrationGoal} L</span></h2>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div data-tour-id="diet-tabs" style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px', overflowX: 'auto' }}>
                {['Dashboard', 'DailyLog', 'FoodDatabase', 'GroceryAI'].map((tab) => (
                    <button 
                        key={tab} onClick={() => setActiveTab(tab)}
                        style={{ padding: '10px 16px', background: activeTab === tab ? 'var(--widget-bg)' : 'transparent', color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {tab === 'Dashboard' && 'Diet Dashboard'}
                        {tab === 'DailyLog' && 'Daily Meal Log & Water'}
                        {tab === 'FoodDatabase' && `Food Database (${foods.length})`}
                        {tab === 'GroceryAI' && <><Cpu size={14} /> Grocery & AI Coach</>}
                    </button>
                ))}
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            {activeTab === 'Dashboard' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Daily Macronutrient Breakdown</h3>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>Goal: {profile.goal}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                            <div style={{ background: 'var(--widget-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700' }}>
                                    <span style={{ color: 'var(--text-primary)' }}>Calories</span>
                                    <span style={{ color: 'var(--primary)' }}>{calorieProgress}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--surface-inset)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${calorieProgress}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }}></div>
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Remaining: {Math.max(0, profile.dailyCalories - dailyLog.caloriesConsumed)} kcal</span>
                            </div>

                            <div style={{ background: 'var(--widget-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700' }}>
                                    <span style={{ color: 'var(--text-primary)' }}>Protein ({dailyLog.proteinConsumed}/{profile.proteinGoal}g)</span>
                                    <span style={{ color: '#10B981' }}>{proteinProgress}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--surface-inset)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${proteinProgress}%`, height: '100%', background: '#10B981', borderRadius: '4px' }}></div>
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Carbs: {dailyLog.carbsConsumed}/{profile.carbsGoal}g | Fat: {dailyLog.fatConsumed}/{profile.fatGoal}g</span>
                            </div>

                            <div style={{ background: 'var(--widget-bg)', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700' }}>
                                    <span style={{ color: 'var(--text-primary)' }}>Water Intake ({dailyLog.waterConsumed}/{settings.dailyHydrationGoal}L)</span>
                                    <span style={{ color: '#3B82F6' }}>{waterProgress}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--surface-inset)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${waterProgress}%`, height: '100%', background: '#3B82F6', borderRadius: '4px' }}></div>
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hydration target on track</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: DAILY MEAL LOG & WATER */}
            {activeTab === 'DailyLog' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3B82F6' }}>
                                <Droplet size={22} />
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Hydration Tracker</h3>
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{dailyLog.waterConsumed} L / {settings.dailyHydrationGoal} L</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button onClick={() => addWater(0.25)} style={{ padding: '10px 16px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>+ 250 mL</button>
                            <button onClick={() => addWater(0.5)} style={{ padding: '10px 16px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>+ 500 mL</button>
                            <button onClick={() => addWater(0.75)} style={{ padding: '10px 16px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>+ 750 mL</button>
                            <button onClick={() => setDailyLog(prev => ({ ...prev, waterConsumed: 0 }))} style={{ padding: '10px 16px', background: 'var(--widget-bg)', color: '#EF4444', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>Reset</button>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                                <Utensils size={22} />
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Today's Meal Timeline</h3>
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>{meals.filter(m => m.completed).length} / {meals.length} Meals Logged</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {meals.length > 0 ? meals.map(meal => (
                                <div key={meal.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '14px' : '0', background: meal.completed ? 'rgba(16, 185, 129, 0.05)' : 'var(--widget-bg)', padding: isMobile ? '14px 16px' : '16px 20px', borderRadius: '14px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                                        <div onClick={() => toggleMealCompletion(meal.id)} style={{ cursor: 'pointer', color: meal.completed ? '#10B981' : 'var(--text-muted)', flexShrink: 0 }}>
                                            {meal.completed ? <CheckCircle size={24} /> : <div style={{ width: '24px', height: '24px', border: '2px solid var(--text-muted)', borderRadius: '50%' }}></div>}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                                                <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>{meal.title}</h4>
                                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}><Clock size={11} style={{ display: 'inline', marginRight: '2px' }} />{meal.time}</span>
                                            </div>
                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', overflowWrap: 'break-word' }}>{meal.foodName}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '16px' }}>
                                        <div style={{ textAlign: isMobile ? 'left' : 'right', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{meal.calories} kcal</span>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>P: {meal.protein}g | C: {meal.carbs}g | F: {meal.fat}g</div>
                                        </div>
                                        <button onClick={() => openEditMealModal(meal)} title="Edit Meal" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Pencil size={16} /></button>
                                        <button onClick={() => deleteMeal(meal.id)} title="Delete Meal" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-premium)', borderRadius: '12px' }}>No meals added yet. Click "+ Add Meal" to start tracking.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: FOOD DATABASE */}
            {activeTab === 'FoodDatabase' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search food items by name or category..."
                            aria-label="Search food items by name or category"
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: '12px 12px 12px 44px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxShadow: 'var(--premium-shadow)' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        {filteredFoods.length > 0 ? filteredFoods.map(item => (
                            <div key={item.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--premium-shadow)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>
                                        {item.category}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>Serving: {item.serving}</span>
                                        <button onClick={() => openEditFoodModal(item)} title="Edit Food" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Pencil size={16} /></button>
                                        <button onClick={() => deleteFood(item.id)} title="Delete Food" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.name}</h4>
                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--widget-bg)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-premium)' }}>
                                    <span>🔥 <strong>{item.calories}</strong> kcal</span>
                                    <span>🥩 P: <strong>{item.protein}g</strong></span>
                                    <span>🍞 C: <strong>{item.carbs}g</strong></span>
                                    <span>🥑 F: <strong>{item.fat}g</strong></span>
                                </div>
                            </div>
                        )) : (
                            <div style={{ gridColumn: '1/-1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No foods found in your database.</div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: GROCERY & AI COACH */}
            {activeTab === 'GroceryAI' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* AI Nutrition Coach Briefing */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Sparkles size={22} />
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Nutrition Coach Daily Briefing</h3>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--widget-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            {generateNutritionBriefing()}
                        </p>
                    </div>

                    {/* Smart Grocery Shopping List */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                                <ShoppingCart size={22} />
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Smart Grocery Shopping List</h3>
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>{groceryList.filter(i => i.purchased).length} / {groceryList.length} Purchased</span>
                        </div>

                        <form onSubmit={handleAddGrocery} style={{ display: 'flex', gap: '12px' }}>
                            <input
                                type="text" placeholder="Add new grocery item (e.g. Eggs 1 crate)..."
                                aria-label="Add new grocery item"
                                value={newGroceryItem} onChange={(e) => setNewGroceryItem(e.target.value)}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                            />
                            {editingGroceryId && (
                                <button type="button" onClick={closeGroceryEdit} style={{ padding: '12px 16px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                            )}
                            <button type="submit" style={{ padding: '12px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>{editingGroceryId ? 'Save' : '+ Add'}</button>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                            {groceryList.length > 0 ? groceryList.map(item => (
                                <div key={item.id} onClick={() => toggleGroceryPurchased(item.id)} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : '0', background: item.purchased ? 'rgba(16, 185, 129, 0.05)' : 'var(--widget-bg)', padding: isMobile ? '12px 16px' : '14px 18px', borderRadius: '12px', border: '1px solid var(--border-premium)', cursor: 'pointer' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                        <div style={{ color: item.purchased ? '#10B981' : 'var(--text-muted)', flexShrink: 0 }}>
                                            {item.purchased ? <Check size={20} /> : <div style={{ width: '20px', height: '20px', border: '2px solid var(--text-muted)', borderRadius: '4px' }}></div>}
                                        </div>
                                        <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', textDecoration: 'none', opacity: item.purchased ? 0.6 : 1, overflowWrap: 'break-word', minWidth: 0 }}>{item.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '12px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', background: 'var(--surface-inset)', color: 'var(--primary)', borderRadius: '6px', flexShrink: 0 }}>{item.category}</span>
                                        <button onClick={(e) => openEditGrocery(item, e)} title="Edit Grocery Item" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Pencil size={16} /></button>
                                        <button onClick={(e) => deleteGrocery(item.id, e)} title="Delete Grocery Item" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            )) : <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Your grocery list is empty.</div>}
                        </div>
                    </div>

                    {/* AI coaching is paused on mobile for this pass - desktop is unaffected. */}
                    {!isMobile && (
                        <AIQueryBox
                            context={{ dietProfile: profile, dietDailyLog: dailyLog }} persona="nutrition"
                            title="Ask the AI Nutrition Coach"
                            placeholder="Ask about your calories or daily macros..."
                        />
                    )}
                </div>
            )}

            {/* MODALS */}
            
            {/* Add Meal Modal */}
            {isAddMealModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%', boxShadow: 'var(--premium-shadow)' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingMealId ? 'Edit Meal' : 'Add Meal to Log'}</h2>
                        <form onSubmit={handleAddMeal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietMealType" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Meal Type</label>
                                    <select id="dietMealType" name="mealType" value={newMeal.title} onChange={(e) => setNewMeal({...newMeal, title: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }}>
                                        <option value="Breakfast" style={{ background: 'var(--surface-inset)' }}>Breakfast</option>
                                        <option value="Lunch" style={{ background: 'var(--surface-inset)' }}>Lunch</option>
                                        <option value="Dinner" style={{ background: 'var(--surface-inset)' }}>Dinner</option>
                                        <option value="Snack" style={{ background: 'var(--surface-inset)' }}>Snack</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietMealTime" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Time</label>
                                    <input id="dietMealTime" name="mealTime" type="text" placeholder="e.g. 08:30 AM" value={newMeal.time} onChange={(e) => setNewMeal({...newMeal, time: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="dietMealFoodName" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Food Name / Details</label>
                                <input id="dietMealFoodName" name="mealFoodName" type="text" required placeholder="e.g. Oats + Eggs" value={newMeal.foodName} onChange={(e) => setNewMeal({...newMeal, foodName: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="dietMealCalories" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Calories</label><input id="dietMealCalories" name="mealCalories" type="number" required value={newMeal.calories} onChange={(e) => setNewMeal({...newMeal, calories: sanitizeNumberInput(e.target.value, newMeal.calories)})} onBlur={(e) => setNewMeal({...newMeal, calories: normalizeNumberOnBlur(e.target.value, false)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="dietMealProtein" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Protein (g)</label><input id="dietMealProtein" name="mealProtein" type="number" required value={newMeal.protein} onChange={(e) => setNewMeal({...newMeal, protein: sanitizeNumberInput(e.target.value, newMeal.protein)})} onBlur={(e) => setNewMeal({...newMeal, protein: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="dietMealCarbs" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Carbs (g)</label><input id="dietMealCarbs" name="mealCarbs" type="number" required value={newMeal.carbs} onChange={(e) => setNewMeal({...newMeal, carbs: sanitizeNumberInput(e.target.value, newMeal.carbs)})} onBlur={(e) => setNewMeal({...newMeal, carbs: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="dietMealFat" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Fat (g)</label><input id="dietMealFat" name="mealFat" type="number" required value={newMeal.fat} onChange={(e) => setNewMeal({...newMeal, fat: sanitizeNumberInput(e.target.value, newMeal.fat)})} onBlur={(e) => setNewMeal({...newMeal, fat: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none' }} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="button" onClick={closeAddMealModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>{editingMealId ? 'Save Changes' : 'Save Meal'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {isEditingProfile && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%', boxShadow: 'var(--premium-shadow)' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Edit Nutrition Profile</h2>
                        
                        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietCurrentWeight" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Current Weight (kg)</label>
                                    <input id="dietCurrentWeight" name="currentWeight" type="number" step="0.1" value={tempProfile.currentWeight} onChange={(e) => setTempProfile({...tempProfile, currentWeight: sanitizeNumberInput(e.target.value, tempProfile.currentWeight)})} onBlur={(e) => setTempProfile({...tempProfile, currentWeight: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietTargetWeight" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Target Weight (kg)</label>
                                    <input id="dietTargetWeight" name="targetWeight" type="number" step="0.1" value={tempProfile.targetWeight} onChange={(e) => setTempProfile({...tempProfile, targetWeight: sanitizeNumberInput(e.target.value, tempProfile.targetWeight)})} onBlur={(e) => setTempProfile({...tempProfile, targetWeight: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietDailyCalories" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Daily Calories (kcal)</label>
                                    <input id="dietDailyCalories" name="dailyCalories" type="number" required value={tempProfile.dailyCalories} onChange={(e) => setTempProfile({...tempProfile, dailyCalories: sanitizeNumberInput(e.target.value, tempProfile.dailyCalories)})} onBlur={(e) => setTempProfile({...tempProfile, dailyCalories: normalizeNumberOnBlur(e.target.value, false)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietProteinGoal" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Protein Goal (g)</label>
                                    <input id="dietProteinGoal" name="proteinGoal" type="number" required value={tempProfile.proteinGoal} onChange={(e) => setTempProfile({...tempProfile, proteinGoal: sanitizeNumberInput(e.target.value, tempProfile.proteinGoal)})} onBlur={(e) => setTempProfile({...tempProfile, proteinGoal: normalizeNumberOnBlur(e.target.value, false)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietCarbsGoal" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Carbs Goal (g)</label>
                                    <input id="dietCarbsGoal" name="carbsGoal" type="number" value={tempProfile.carbsGoal} onChange={(e) => setTempProfile({...tempProfile, carbsGoal: sanitizeNumberInput(e.target.value, tempProfile.carbsGoal)})} onBlur={(e) => setTempProfile({...tempProfile, carbsGoal: normalizeNumberOnBlur(e.target.value, false)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietFatGoal" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Fat Goal (g)</label>
                                    <input id="dietFatGoal" name="fatGoal" type="number" value={tempProfile.fatGoal} onChange={(e) => setTempProfile({...tempProfile, fatGoal: sanitizeNumberInput(e.target.value, tempProfile.fatGoal)})} onBlur={(e) => setTempProfile({...tempProfile, fatGoal: normalizeNumberOnBlur(e.target.value, false)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietWaterGoal" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Water Goal (L)</label>
                                    <input id="dietWaterGoal" name="waterGoal" type="number" step="0.1" required value={tempWaterGoal} onChange={(e) => setTempWaterGoal(sanitizeNumberInput(e.target.value, tempWaterGoal))} onBlur={(e) => setTempWaterGoal(normalizeNumberOnBlur(e.target.value, true))} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietMealsPerDay" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Meals Per Day</label>
                                    <input id="dietMealsPerDay" name="mealsPerDay" type="number" required value={tempProfile.mealsPerDay} onChange={(e) => setTempProfile({...tempProfile, mealsPerDay: sanitizeNumberInput(e.target.value, tempProfile.mealsPerDay)})} onBlur={(e) => setTempProfile({...tempProfile, mealsPerDay: normalizeNumberOnBlur(e.target.value, false)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="dietPrimaryGoal" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Primary Goal</label>
                                <select id="dietPrimaryGoal" name="primaryGoal" value={tempProfile.goal} onChange={(e) => setTempProfile({...tempProfile, goal: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                    <option value="Muscle Gain" style={{ background: 'var(--surface-inset)' }}>Muscle Gain (Hypertrophy)</option>
                                    <option value="Fat Loss" style={{ background: 'var(--surface-inset)' }}>Fat Loss (Cutting)</option>
                                    <option value="Weight Maintenance" style={{ background: 'var(--surface-inset)' }}>Weight Maintenance</option>
                                    <option value="High Protein" style={{ background: 'var(--surface-inset)' }}>High Protein Lifestyle</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="button" onClick={() => setIsEditingProfile(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Save Profile</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Custom Food Modal */}
            {isAddFoodModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%', boxShadow: 'var(--premium-shadow)' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingFoodId ? 'Edit Food Item' : 'Add Custom Food Item'}</h2>
                        
                        <form onSubmit={handleAddFood} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label htmlFor="dietFoodName" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Food Name</label>
                                <input id="dietFoodName" name="foodName" type="text" required autoFocus value={newFood.name} onChange={(e) => setNewFood({...newFood, name: e.target.value})} placeholder="e.g. Greek Yogurt" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietFoodCategory" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Category</label>
                                    <select id="dietFoodCategory" name="foodCategory" value={newFood.category} onChange={(e) => setNewFood({...newFood, category: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}>
                                        <option value="Meat" style={{ background: 'var(--surface-inset)' }}>Meat</option>
                                        <option value="Grains" style={{ background: 'var(--surface-inset)' }}>Grains</option>
                                        <option value="Dairy" style={{ background: 'var(--surface-inset)' }}>Dairy</option>
                                        <option value="Eggs" style={{ background: 'var(--surface-inset)' }}>Eggs</option>
                                        <option value="Fruits" style={{ background: 'var(--surface-inset)' }}>Fruits</option>
                                        <option value="Vegetables" style={{ background: 'var(--surface-inset)' }}>Vegetables</option>
                                        <option value="Nuts & Seeds" style={{ background: 'var(--surface-inset)' }}>Nuts & Seeds</option>
                                        <option value="Snacks" style={{ background: 'var(--surface-inset)' }}>Snacks</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="dietFoodServing" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Serving Size</label>
                                    <input id="dietFoodServing" name="foodServing" type="text" required value={newFood.serving} onChange={(e) => setNewFood({...newFood, serving: e.target.value})} placeholder="100 g" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="dietFoodCalories" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Calories</label><input id="dietFoodCalories" name="foodCalories" type="number" required value={newFood.calories} onChange={(e) => setNewFood({...newFood, calories: sanitizeNumberInput(e.target.value, newFood.calories)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="dietFoodProtein" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Protein (g)</label><input id="dietFoodProtein" name="foodProtein" type="number" step="0.1" required value={newFood.protein} onChange={(e) => setNewFood({...newFood, protein: sanitizeNumberInput(e.target.value, newFood.protein)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="dietFoodCarbs" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Carbs (g)</label><input id="dietFoodCarbs" name="foodCarbs" type="number" step="0.1" required value={newFood.carbs} onChange={(e) => setNewFood({...newFood, carbs: sanitizeNumberInput(e.target.value, newFood.carbs)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="dietFoodFat" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Fat (g)</label><input id="dietFoodFat" name="foodFat" type="number" step="0.1" required value={newFood.fat} onChange={(e) => setNewFood({...newFood, fat: sanitizeNumberInput(e.target.value, newFood.fat)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                <button type="button" onClick={closeAddFoodModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>{editingFoodId ? 'Save Changes' : 'Save Food'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DietPage;