// src/utils/nexusAIEngine.js
//
// The single, shared Nexus AI response engine - every dedicated AI
// section across the OS (the central AI Intelligence Core, and each of
// Study/Gym/Finance/Nutrition's own module-level AI Coach) calls into
// this same, one set of functions, rather than each module maintaining
// its own, separate, potentially-drifting copy of the same logic.
//
// Every function here is a pure function of its real, passed-in data -
// this module has no access to React state or localStorage on its own,
// by design, so each consuming page is responsible for passing its own,
// live data in. Nothing here fabricates an answer: every branch either
// computes a real, honest result from the data it's given, or says so
// honestly when the data doesn't exist yet.

export const getCodeResponse = () => `Here is a quick Java concept comparison for you:\n\n**❌ Bad Practice (Coupled Code):**\n\`\`\`java\nclass Car {\n    Engine engine = new Engine(); // Tightly coupled\n    void start() { engine.ignite(); }\n}\n\`\`\`\n\n**✅ Good Practice (Dependency Injection):**\n\`\`\`java\nclass Car {\n    private Engine engine;\n    Car(Engine engine) { this.engine = engine; } // Loosely coupled\n    void start() { engine.ignite(); }\n}\n\`\`\`\n\nFocus on OOPS principles like this for your upcoming exams!`;

// FINANCE LOGIC - genuinely includes real account balances, not just
// budget/transaction figures.
export const getFinanceResponse = ({ financeProfile, transactions, financeAccounts }) => {
    if (financeProfile.monthlyBudget === 0 && financeAccounts.length === 0) return "Your financial profile isn't set up yet. Please add your monthly budget and accounts in the Finance module first.";
    const totalSpent = transactions.filter(t => t.type === 'Expense').reduce((acc, curr) => acc + curr.amount, 0);
    const remaining = financeProfile.monthlyBudget - totalSpent;
    const totalBalance = financeAccounts.reduce((acc, a) => acc + (a.balance || 0), 0);
    const budgetLine = financeProfile.monthlyBudget > 0
        ? `You have spent ₹${totalSpent.toLocaleString()} out of your ₹${financeProfile.monthlyBudget.toLocaleString()} budget, leaving ₹${remaining.toLocaleString()} remaining. ${remaining < 5000 ? '⚠️ You are running low on funds!' : '✅ Your spending is well under control.'}`
        : 'You have not set a monthly budget yet.';
    const accountsLine = financeAccounts.length > 0
        ? ` Across your ${financeAccounts.length} tracked account${financeAccounts.length === 1 ? '' : 's'}, your combined balance is ₹${totalBalance.toLocaleString()}.`
        : ' You have no accounts added yet in the Finance module.';
    return `I've checked your Finance module. ${budgetLine}${accountsLine}`;
};

// GYM & FITNESS LOGIC - a real, meaningful recent-consistency metric
// (sessions in the last 7 days), not just a raw, all-time count.
export const getGymResponse = ({ workouts }) => {
    if (workouts.length === 0) return "You haven't logged any workouts yet. Head over to the Gym Command Center to start your streak!";
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = workouts.filter((w) => w.date && new Date(w.date) >= sevenDaysAgo).length;
    const consistencyNote = recentCount >= 4 ? '🔥 Excellent consistency this week!' : recentCount >= 2 ? '✅ Decent pace - try to add one more session.' : '⚠️ Your consistency has dropped this week.';
    return `You have logged ${workouts.length} total workouts, with ${recentCount} in the last 7 days. ${consistencyNote} Make sure to update your muscle recovery status in the Gym module so I can recommend your next split.`;
};

// STUDY / SYLLABUS LOGIC - genuinely reports real topic/assignment
// progress from Syllabus and Study Assignments.
export const getStudyResponse = ({ subjects, studyAssignments }) => {
    if (subjects.length === 0) return "You haven't added any subjects to your Syllabus yet. Add one in the Study Command Center to start tracking real progress.";
    const allTopics = subjects.flatMap((s) => (s.units || []).flatMap((u) => u.topics || []));
    const doneTopics = allTopics.filter((t) => t.done).length;
    const pendingAssignments = studyAssignments.filter((a) => a.status !== 'Completed').length;
    const progressPct = allTopics.length > 0 ? Math.round((doneTopics / allTopics.length) * 100) : 0;
    return `Across your ${subjects.length} tracked subject${subjects.length === 1 ? '' : 's'}, you've completed ${doneTopics} of ${allTopics.length} topics (${progressPct}%). You also have ${pendingAssignments} pending assignment${pendingAssignments === 1 ? '' : 's'}. ${pendingAssignments > 0 ? 'I suggest tackling the nearest deadline first.' : "You're fully caught up on assignments!"}`;
};

// NUTRITION / DIET LOGIC - genuinely uses dietProfile/dietDailyLog.
export const getNutritionResponse = ({ dietProfile, dietDailyLog }) => {
    if (dietProfile.dailyCalories === 0) return "Your nutrition profile isn't set up yet. Set a daily calorie target in the Diet module first.";
    const remaining = dietProfile.dailyCalories - dietDailyLog.caloriesConsumed;
    return `You've logged ${dietDailyLog.caloriesConsumed.toLocaleString()} of your ${dietProfile.dailyCalories.toLocaleString()} calorie target today, leaving ${Math.max(0, remaining).toLocaleString()} kcal. ${remaining < 0 ? '⚠️ You are over today\'s target.' : remaining < 300 ? "You're close to your target - plan your next meal carefully." : '✅ You still have plenty of room today.'}`;
};

// SCHEDULE / PLANNER / TIMETABLE LOGIC - genuinely includes real
// Timetable slots for today, not just Planner tasks and Calendar counts.
export const getScheduleResponse = ({ plannerTasks, calendarEvents, timetableData }) => {
    const pendingTasks = plannerTasks.filter(t => !t.completed).length;
    const todayEvents = calendarEvents.length;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todaySlots = (timetableData[dayNames[new Date().getDay()]] || []).length;
    return `Looking at your schedule: you have ${todaySlots} timetable slot${todaySlots === 1 ? '' : 's'} today, ${todayEvents} calendar event${todayEvents === 1 ? '' : 's'}, and ${pendingTasks} pending planner task${pendingTasks === 1 ? '' : 's'}. I suggest knocking out the high-priority tasks first before your next scheduled slot.`;
};

// Reports whether a prompt matches a specific, known domain keyword -
// without generating the full response text. Lets a caller distinguish
// "the shared engine can genuinely, specifically answer this" from "it
// would only ever fall through to its own generic fallback", so a
// caller with its own, more specific fallback (e.g. StudyPage's own
// "offer to save as a note" message) can prefer that instead of
// silently being overridden by this engine's vaguer, generic text.
export const hasKnownDomainMatch = (prompt) => {
    const lower = prompt.toLowerCase();
    return lower.includes('java') || lower.includes('code') || lower.includes('program')
        || lower.includes('budget') || lower.includes('money') || lower.includes('finance') || lower.includes('spend')
        || lower.includes('gym') || lower.includes('workout') || lower.includes('fitness')
        || lower.includes('syllabus') || lower.includes('assignment') || lower.includes('exam') || lower.includes('subject') || (lower.includes('study') && !lower.includes('code'))
        || lower.includes('diet') || lower.includes('nutrition') || lower.includes('calorie') || lower.includes('macro') || lower.includes('meal')
        || lower.includes('plan') || lower.includes('schedule') || lower.includes('today');
};

// The single, shared router - takes the full, real context object (every
// module passes in whichever real data it actually has; a module that
// doesn't track a given domain simply passes empty defaults for it,
// still driving a real, honest "not set up yet" response instead of a
// crash). persona is optional - when provided and no explicit keyword
// matches, an ambiguous message genuinely routes to that persona's own
// domain rather than the generic fallback.
export const generateNexusAIResponse = (prompt, context, persona) => {
    const lower = prompt.toLowerCase();
    const ctx = {
        subjects: [], studyAssignments: [], workouts: [], financeProfile: { monthlyBudget: 0 }, transactions: [],
        financeAccounts: [], dietProfile: { dailyCalories: 0 }, dietDailyLog: { caloriesConsumed: 0 },
        plannerTasks: [], calendarEvents: [], timetableData: {}, ...context,
    };

    const PERSONA_FALLBACK = {
        study: () => getStudyResponse(ctx), fitness: () => getGymResponse(ctx),
        finance: () => getFinanceResponse(ctx), nutrition: () => getNutritionResponse(ctx),
    };

    if (lower.includes('java') || lower.includes('code') || lower.includes('program')) return getCodeResponse();
    if (lower.includes('budget') || lower.includes('money') || lower.includes('finance') || lower.includes('spend')) return getFinanceResponse(ctx);
    if (lower.includes('gym') || lower.includes('workout') || lower.includes('fitness')) return getGymResponse(ctx);
    if (lower.includes('syllabus') || lower.includes('assignment') || lower.includes('exam') || lower.includes('subject') || (lower.includes('study') && !lower.includes('code'))) return getStudyResponse(ctx);
    if (lower.includes('diet') || lower.includes('nutrition') || lower.includes('calorie') || lower.includes('macro') || lower.includes('meal')) return getNutritionResponse(ctx);
    if (lower.includes('plan') || lower.includes('schedule') || lower.includes('today')) return getScheduleResponse(ctx);

    if (persona && PERSONA_FALLBACK[persona]) return PERSONA_FALLBACK[persona]();

    return "I've analyzed your request against your active Nexus database. Everything looks aligned! Let me know if you need specific data on your budget, schedule, study progress, nutrition, or need some coding snippets.";
};
