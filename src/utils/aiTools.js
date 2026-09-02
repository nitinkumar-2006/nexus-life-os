// src/utils/aiTools.js
//
// Real function-calling tools the AI chat can actually invoke to modify
// this app's own data - not a chat-only illusion. Each executor below
// performs the exact same real localStorage read-modify-write +
// 'storage' event dispatch this app's own header.jsx quick-add already
// uses to write into a page's data from outside that page's own React
// state (see header.jsx's handleQuickSubmit for the original, proven
// precedent) - so a task/transaction created through conversation shows
// up on its real page live, the same way a quick-add from the header
// does, through the exact same inbound 'storage' listener every page
// already has, with no special-case rendering path of its own.
//
// TOOL_DEFINITIONS is shaped for Gemini's own real function-calling API
// (tools: [{ functionDeclarations: [...] }] on the request body) - see
// geminiClient.js's streamGeminiResponse. Started with 2 tools (Planner
// + Finance) as a proven starting point; now extended with the same
// exact pattern to Gym, Diet, Study, and Calendar - every executor
// below writes into the precise real localStorage shape each page's
// own "Add" form already produces (confirmed by reading each page's
// own handleAdd* function directly, not guessed), so a record created
// through conversation renders identically to one typed into that
// page's own form, with no separate rendering path.
import { getLocalDateString } from './dateUtils.js';

export const TOOL_DEFINITIONS = [
    {
        name: 'create_planner_task',
        description: "Creates a new task in the user's Planner. Gather the details conversationally first, one at a time - ask for the title, then offer to add a description/project/priority/due date if the user wants (none of those are required) - and only call this once the user has clearly confirmed they want it saved.",
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'The task title.' },
                description: { type: 'STRING', description: 'Optional longer description of the task.' },
                project: { type: 'STRING', description: 'Optional project/category this task belongs to.' },
                priority: { type: 'STRING', enum: ['Low', 'Medium', 'High'], description: 'Optional priority, defaults to Medium.' },
                dueDate: { type: 'STRING', description: 'Optional due date in YYYY-MM-DD format.' },
            },
            required: ['title'],
        },
    },
    {
        name: 'add_finance_transaction',
        description: "Logs a new income or expense transaction in the user's Finance section, and updates the matching account's balance. Ask for whatever is missing first (title, amount, and expense-vs-income are required) and confirm with the user before calling this.",
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'A short label for this transaction, e.g. "Chai" or "Salary".' },
                amount: { type: 'NUMBER', description: 'The transaction amount, always a positive number.' },
                type: { type: 'STRING', enum: ['Expense', 'Income'], description: 'Whether this is money spent or money received.' },
                category: { type: 'STRING', description: 'Optional category, e.g. "Food", "Transport", "Salary".' },
                account: { type: 'STRING', description: "Optional - which account this affects, by name. Defaults to the user's first/primary account if not specified or not found." },
            },
            required: ['title', 'amount', 'type'],
        },
    },
    {
        name: 'log_gym_workout',
        description: "Logs a completed workout in the user's Gym history. Ask for the workout name/title first (e.g. \"Push Day\", \"Leg Day\") and confirm before calling this - duration is a nice-to-have, not required.",
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'The workout name, e.g. "Push Day" or "Leg Day".' },
                durationMins: { type: 'NUMBER', description: 'Optional workout duration in minutes.' },
            },
            required: ['title'],
        },
    },
    {
        name: 'log_diet_meal',
        description: "Logs a meal in the user's Diet tracker. Ask for the meal type, what they ate, and at least the calories - protein/carbs/fat are optional and can be skipped if the user doesn't know them. Confirm before calling this.",
        parameters: {
            type: 'OBJECT',
            properties: {
                mealType: { type: 'STRING', enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], description: 'Which meal this is.' },
                foodName: { type: 'STRING', description: 'What was eaten, e.g. "Oats + Eggs".' },
                calories: { type: 'NUMBER', description: 'Calories for this meal.' },
                protein: { type: 'NUMBER', description: 'Optional protein in grams.' },
                carbs: { type: 'NUMBER', description: 'Optional carbs in grams.' },
                fat: { type: 'NUMBER', description: 'Optional fat in grams.' },
            },
            required: ['mealType', 'foodName', 'calories'],
        },
    },
    {
        name: 'add_study_assignment',
        description: "Adds an assignment/task to the user's Study tracker. Ask for the title first, then offer to attach a subject and due date if they want - both optional. Confirm before calling this.",
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'The assignment title.' },
                subject: { type: 'STRING', description: 'Optional subject/course this belongs to.' },
                dueDate: { type: 'STRING', description: 'Optional due date in YYYY-MM-DD format, defaults to today.' },
            },
            required: ['title'],
        },
    },
    {
        name: 'add_calendar_event',
        description: "Adds an event to the user's Calendar. Ask for the title first, then offer to gather date/time/category/location/priority if the user wants to specify them - all optional with sensible defaults. Confirm before calling this.",
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'The event title.' },
                category: { type: 'STRING', enum: ['Festivals', 'Work', 'Personal', 'Study', 'Fitness', 'Nutrition', 'Productivity', 'Finance'], description: 'Optional category, defaults to Personal.' },
                date: { type: 'STRING', description: 'Optional date in YYYY-MM-DD format, defaults to today.' },
                time: { type: 'STRING', description: 'Optional time, e.g. "04:00 PM", defaults to 10:00 AM.' },
                priority: { type: 'STRING', enum: ['Low', 'Medium', 'High'], description: 'Optional priority, defaults to Medium.' },
                location: { type: 'STRING', description: 'Optional location, defaults to "Nexus Space".' },
            },
            required: ['title'],
        },
    },
];

const readJson = (key, fallback) => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return fallback;
        const parsed = JSON.parse(saved);
        return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
        return fallback;
    }
};

// Same real write + live-sync convention every page in this app already
// shares - the 'storage' event is what makes PlannerPage/FinancePage's
// own existing listeners (already required to sync a cross-device
// cloud pull) pick this up immediately, with zero special-casing for
// "a task the AI created" vs "a task the user typed into the form".
const writeJsonAndNotify = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('storage'));
};

const toTitleCase = (str) => (str || '').replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const executors = {
    create_planner_task: (args) => {
        const title = (args?.title || '').trim();
        if (!title) return { success: false, error: 'A task title is required.' };
        const priority = ['Low', 'Medium', 'High'].includes(args?.priority) ? args.priority : 'Medium';
        const tasks = readJson('nexus_planner_tasks', []);
        const newTask = {
            id: Date.now().toString(),
            title,
            description: (args?.description || '').trim(),
            project: (args?.project || '').trim() || 'General',
            priority,
            status: 'To Do',
            dueDate: args?.dueDate || '',
            estimatedMins: null,
            completed: false,
        };
        writeJsonAndNotify('nexus_planner_tasks', [newTask, ...(Array.isArray(tasks) ? tasks : [])]);
        return { success: true, message: `Added "${title}" to Planner${newTask.dueDate ? ` (due ${newTask.dueDate})` : ''}.` };
    },

    add_finance_transaction: (args) => {
        const title = (args?.title || '').trim();
        if (!title) return { success: false, error: 'A transaction title is required.' };
        const amount = Number(args?.amount);
        if (!isFinite(amount) || amount <= 0) return { success: false, error: 'A valid, positive amount is required.' };
        const type = args?.type === 'Income' ? 'Income' : 'Expense';
        const category = toTitleCase((args?.category || '').trim()) || (type === 'Income' ? 'Other Income' : 'Other');

        const accounts = readJson('nexus_finance_accounts', []);
        const accountList = Array.isArray(accounts) ? accounts : [];
        if (accountList.length === 0) {
            return { success: false, error: 'No Finance account exists yet - the user needs to add one in the Finance section first.' };
        }
        const requestedName = (args?.account || '').trim().toLowerCase();
        const targetAccount = accountList.find((a) => a.name?.toLowerCase() === requestedName) || accountList[0];

        const txItem = {
            id: Date.now().toString(),
            title: toTitleCase(title), type, amount, category,
            account: targetAccount.name,
            date: getLocalDateString(),
        };
        const updatedAccounts = accountList.map((acc) => (acc.name === targetAccount.name
            ? { ...acc, balance: (acc.balance || 0) + (type === 'Income' ? amount : -amount) }
            : acc));

        writeJsonAndNotify('nexus_finance_accounts', updatedAccounts);
        const transactions = readJson('nexus_finance_transactions', []);
        writeJsonAndNotify('nexus_finance_transactions', [txItem, ...(Array.isArray(transactions) ? transactions : [])]);

        return { success: true, message: `Logged ${type.toLowerCase()} of ${amount} ("${txItem.title}") against ${targetAccount.name}.` };
    },

    log_gym_workout: (args) => {
        const title = (args?.title || '').trim();
        if (!title) return { success: false, error: 'A workout title is required.' };
        const durationMins = Number(args?.durationMins);
        const historyItem = {
            id: Date.now().toString(),
            title: toTitleCase(title),
            date: getLocalDateString(),
            duration: isFinite(durationMins) && durationMins > 0 ? `${durationMins} min${durationMins === 1 ? '' : 's'}` : 'Not tracked',
            volume: 'Not tracked',
        };
        const history = readJson('nexus_gym_history', []);
        writeJsonAndNotify('nexus_gym_history', [historyItem, ...(Array.isArray(history) ? history : [])]);
        return { success: true, message: `Logged "${historyItem.title}" in Gym history for today.` };
    },

    log_diet_meal: (args) => {
        const foodName = (args?.foodName || '').trim();
        if (!foodName) return { success: false, error: 'What was eaten is required.' };
        const calories = Number(args?.calories);
        if (!isFinite(calories) || calories < 0) return { success: false, error: 'A valid calorie count is required.' };
        const mealType = ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(args?.mealType) ? args.mealType : 'Snack';
        const mealItem = {
            id: Date.now().toString(),
            title: mealType,
            time: '12:00 PM',
            foodName: toTitleCase(foodName),
            calories,
            protein: Number(args?.protein) || 0,
            carbs: Number(args?.carbs) || 0,
            fat: Number(args?.fat) || 0,
            completed: false,
        };
        const meals = readJson('nexus_diet_meals', []);
        writeJsonAndNotify('nexus_diet_meals', [...(Array.isArray(meals) ? meals : []), mealItem]);
        return { success: true, message: `Logged ${mealType} - "${mealItem.foodName}" (${calories} cal) in Diet.` };
    },

    add_study_assignment: (args) => {
        const title = (args?.title || '').trim();
        if (!title) return { success: false, error: 'An assignment title is required.' };
        const assignmentItem = {
            id: Date.now().toString(),
            title: toTitleCase(title),
            subject: (args?.subject || '').trim() || 'General',
            dueDate: args?.dueDate || getLocalDateString(),
            status: 'Pending',
        };
        const assignments = readJson('nexus_study_assignments', []);
        writeJsonAndNotify('nexus_study_assignments', [assignmentItem, ...(Array.isArray(assignments) ? assignments : [])]);
        return { success: true, message: `Added "${assignmentItem.title}" to Study (due ${assignmentItem.dueDate}).` };
    },

    add_calendar_event: (args) => {
        const title = (args?.title || '').trim();
        if (!title) return { success: false, error: 'An event title is required.' };
        const validCategories = ['Festivals', 'Work', 'Personal', 'Study', 'Fitness', 'Nutrition', 'Productivity', 'Finance'];
        const category = validCategories.includes(args?.category) ? args.category : 'Personal';
        const priority = ['Low', 'Medium', 'High'].includes(args?.priority) ? args.priority : 'Medium';
        const eventItem = {
            id: Date.now().toString(),
            title: toTitleCase(title),
            category,
            date: args?.date || getLocalDateString(),
            time: (args?.time || '').trim() || '10:00 AM',
            priority,
            location: (args?.location || '').trim() || 'Nexus Space',
        };
        const events = readJson('nexus_calendar_events', []);
        writeJsonAndNotify('nexus_calendar_events', [eventItem, ...(Array.isArray(events) ? events : [])]);
        return { success: true, message: `Added "${eventItem.title}" to Calendar on ${eventItem.date} at ${eventItem.time}.` };
    },
};

// name: one of TOOL_DEFINITIONS' own names. args: the parsed arguments
// object Gemini's own functionCall part hands back. Always returns a
// plain { success, message } or { success: false, error } object -
// never throws - since this result is fed straight back to the model as
// its next turn's real input (see AIPage.jsx), a thrown exception here
// would break that whole round-trip instead of just producing an honest
// "this failed" reply.
export const executeToolCall = (name, args) => {
    const fn = executors[name];
    if (!fn) return { success: false, error: `Unknown tool: ${name}` };
    try {
        return fn(args || {});
    } catch (e) {
        return { success: false, error: e?.message || 'Something went wrong performing this action.' };
    }
};
