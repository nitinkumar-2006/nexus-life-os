// src/pages/FinancePage.jsx
import { useState, useEffect } from 'react';
import { Wallet, DollarSign, TrendingUp, User, Target, Plus, Calendar, ArrowUpRight, ArrowDownLeft, Landmark, Search, CheckCircle, Clock, Sparkles, Cpu, ShieldCheck, Trash2, Pencil, Download, FileText, Upload, Smartphone, RefreshCw, Tag, Utensils, ShoppingBag, Receipt, Plane, Clapperboard, HeartPulse } from 'lucide-react';
import AIQueryBox from '../components/AIQueryBox.jsx';
import { exportFinanceReportCsv, exportFinanceReportText } from '../utils/reportExport.js';
import StatementImportModal from '../components/StatementImportModal.jsx';
import { isSmsFinanceBridgeAvailable, checkSmsFinancePermission, requestSmsFinancePermission, pullPendingSmsTransactions, onSmsTransactionDetected } from '../utils/smsFinanceBridge.js';
import ExpenseDonutChart from '../components/ExpenseDonutChart.jsx';
import { toTitleCase } from '../utils/textFormat.js';
import { sanitizeNumberInput, normalizeNumberOnBlur } from '../utils/smartNumberInput.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss.js';
import { getLocalDateString } from '../utils/dateUtils.js';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';

const FinancePage = () => {
    const isMobile = useIsMobile();
    const { settings, updateSetting } = useGlobalSettings();
    // Contextual first-visit tour (see TourGuide.jsx) - mobile only, same
    // scoping as every other page's own tour this pass.
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('finance'));
    // 1. FIXED: Zeroed out Financial Profile
    const [profile, setProfile] = useState(() => {
        const saved = localStorage.getItem('nexus_finance_profile');
        const defaultProfile = { monthlyIncome: 0, monthlySavingsGoal: 0, emergencyFund: 0 };
        if (saved) {
            try { return { ...defaultProfile, ...JSON.parse(saved) }; } catch (e) { return defaultProfile; }
        }
        return defaultProfile;
    });

    // 2. FIXED: Emptied Accounts
    const [accounts, setAccounts] = useState(() => {
        const saved = localStorage.getItem('nexus_finance_accounts');
        if (saved) {
            try { const parsed = JSON.parse(saved); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; }
        }
        return [];
    });

    // 3. FIXED: Emptied Transactions
    const [transactions, setTransactions] = useState(() => {
        const saved = localStorage.getItem('nexus_finance_transactions');
        if (saved) {
            try { const parsed = JSON.parse(saved); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; }
        }
        return [];
    });

    // 4. FIXED: Emptied Savings Goals
    const [savingsGoals, setSavingsGoals] = useState(() => {
        const saved = localStorage.getItem('nexus_finance_goals');
        if (saved) {
            try { const parsed = JSON.parse(saved); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; }
        }
        return [];
    });

    // 5. FIXED: Emptied Bills
    const [bills, setBills] = useState(() => {
        const saved = localStorage.getItem('nexus_finance_bills');
        if (saved) {
            try { const parsed = JSON.parse(saved); return Array.isArray(parsed) ? parsed : []; } catch (e) { return []; }
        }
        return [];
    });

    // Persisted (not just in-memory) so switching to another Hub and back
    // - or a full page reload - returns to the same tab instead of always
    // resetting to Dashboard, the actual "state-persistent" requirement.
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('nexus_finance_active_tab') || 'Dashboard');
    useEffect(() => { localStorage.setItem('nexus_finance_active_tab', activeTab); }, [activeTab]);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isStatementImportOpen, setIsStatementImportOpen] = useState(false);

    // SMS Auto-Tracking (native Android only - see utils/smsFinanceBridge.js).
    // 'unavailable' outside the installed Android app; on native,
    // whatever checkSmsFinancePermission() last reported ('prompt' |
    // 'denied' | 'granted'). smsTargetAccount is a single account every
    // SMS-detected transaction routes into, same one-account-per-batch
    // convention the existing statement importer already uses.
    const [smsPermission, setSmsPermission] = useState('unavailable');
    const [smsTargetAccount, setSmsTargetAccount] = useState('');
    const [isSmsSyncing, setIsSmsSyncing] = useState(false);
    // Real swipe-to-dismiss for the Add Transaction modal - a simple,
    // centered modal with no existing drag-to-move behavior, so a touch
    // swipe here genuinely, unambiguously reads as "dismiss" rather than
    // conflicting with a different gesture already living on the same
    // surface.
    const { swipeHandlers: addTxSwipeHandlers, translateY: addTxTranslateY, isDragging: addTxIsDragging } = useSwipeToDismiss(() => { setIsAddTxModal(false); setEditingTxId(null); });

    // Modals & Forms State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [tempProfile, setTempProfile] = useState(profile);
    const [tempMonthlyBudget, setTempMonthlyBudget] = useState(settings.monthlyBudgetCap || 0);
    const [tempCurrencySymbol, setTempCurrencySymbol] = useState(settings.currencySymbol || '₹');
    
    const [isAddAccountModal, setIsAddAccountModal] = useState(false);
    const [newAccount, setNewAccount] = useState({ name: '', type: 'Savings Account', balance: '', institution: '' });
    // null while adding a fresh account; the account's own id while editing
    // an existing one - same single-flag convention TimetablePage's
    // editingIndex established, branching handleAddAccount and this
    // modal's own title/submit label.
    const [editingAccountId, setEditingAccountId] = useState(null);

    const [isAddTxModal, setIsAddTxModal] = useState(false);
    const [newTx, setNewTx] = useState({ title: '', type: 'Expense', amount: '', category: 'Food', account: '' });
    const [editingTxId, setEditingTxId] = useState(null);

    const [isAddGoalModal, setIsAddGoalModal] = useState(false);
    const [newGoal, setNewGoal] = useState({ title: '', target: '', current: '', deadline: getLocalDateString() });
    const [editingGoalId, setEditingGoalId] = useState(null);

    const [isAddBillModal, setIsAddBillModal] = useState(false);
    const [newBill, setNewBill] = useState({ title: '', amount: '', dueDate: getLocalDateString() });
    const [editingBillId, setEditingBillId] = useState(null);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [financeToast, setFinanceToast] = useState('');
    useEffect(() => {
        if (!financeToast) return undefined;
        const timeoutId = setTimeout(() => setFinanceToast(''), 3000);
        return () => clearTimeout(timeoutId);
    }, [financeToast]);

    // Persistence Effects - all five keys now consistently dispatch the
    // shared sync event on their own changes (previously NONE did at
    // all - the most severe version of this gap found across this
    // series), matching the same fix already applied to GymPage/DietPage.
    useEffect(() => { localStorage.setItem('nexus_finance_profile', JSON.stringify(profile)); window.dispatchEvent(new Event('storage')); }, [profile]);
    useEffect(() => { localStorage.setItem('nexus_finance_accounts', JSON.stringify(accounts)); window.dispatchEvent(new Event('storage')); }, [accounts]);
    useEffect(() => { localStorage.setItem('nexus_finance_transactions', JSON.stringify(transactions)); window.dispatchEvent(new Event('storage')); }, [transactions]);
    useEffect(() => { localStorage.setItem('nexus_finance_goals', JSON.stringify(savingsGoals)); window.dispatchEvent(new Event('storage')); }, [savingsGoals]);
    useEffect(() => { localStorage.setItem('nexus_finance_bills', JSON.stringify(bills)); window.dispatchEvent(new Event('storage')); }, [bills]);

    // CloudSyncContext's pullFromCloud (a factory-reset restore or sign-in
    // sync) writes directly to these same keys and dispatches 'storage' -
    // without these listeners, this component's own state would never
    // reflect cloud-restored data for any of these five keys while this
    // page happens to be mounted. Previously NONE of these keys had any
    // inbound path at all. Each equality guard prevents that key's own
    // outbound write above from re-triggering itself in a loop.
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latestProfile = JSON.parse(localStorage.getItem('nexus_finance_profile') || 'null');
                if (latestProfile) setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(latestProfile) ? prev : latestProfile));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestAccounts = JSON.parse(localStorage.getItem('nexus_finance_accounts') || '[]');
                setAccounts((prev) => (JSON.stringify(prev) === JSON.stringify(latestAccounts) ? prev : latestAccounts));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestTransactions = JSON.parse(localStorage.getItem('nexus_finance_transactions') || '[]');
                setTransactions((prev) => (JSON.stringify(prev) === JSON.stringify(latestTransactions) ? prev : latestTransactions));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestGoals = JSON.parse(localStorage.getItem('nexus_finance_goals') || '[]');
                setSavingsGoals((prev) => (JSON.stringify(prev) === JSON.stringify(latestGoals) ? prev : latestGoals));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
            try {
                const latestBills = JSON.parse(localStorage.getItem('nexus_finance_bills') || '[]');
                setBills((prev) => (JSON.stringify(prev) === JSON.stringify(latestBills) ? prev : latestBills));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    const handleSaveProfile = (e) => { e.preventDefault(); setProfile(tempProfile); updateSetting('monthlyBudgetCap', tempMonthlyBudget); updateSetting('currencySymbol', tempCurrencySymbol.trim() || '₹'); setIsEditingProfile(false); };

    const handleAddAccount = (e) => {
        e.preventDefault();
        if (!newAccount.name.trim()) return;
        const accountFields = {
            name: newAccount.name.trim(), type: newAccount.type,
            balance: parseFloat(newAccount.balance) || 0,
            institution: newAccount.institution.trim() || 'Bank'
        };
        if (editingAccountId !== null) {
            const oldAccount = accounts.find(a => a.id === editingAccountId);
            setAccounts(accounts.map(a => a.id === editingAccountId ? { ...a, ...accountFields } : a));
            // Transactions link to their account by NAME, not id (see
            // handleAddTransaction/deleteTransaction above) - renaming an
            // account here without cascading the new name onto its existing
            // transactions would silently break that link: every one of
            // those transactions would stop matching any real account, so a
            // later edit or delete of one could no longer find it to reverse
            // its balance effect, corrupting the balance instead.
            if (oldAccount && oldAccount.name !== accountFields.name) {
                setTransactions(transactions.map(t => t.account === oldAccount.name ? { ...t, account: accountFields.name } : t));
                setSmsTargetAccount((prev) => (prev === oldAccount.name ? accountFields.name : prev));
            }
        } else {
            setAccounts([{ id: Date.now().toString(), ...accountFields }, ...accounts]);
        }
        setIsAddAccountModal(false);
        setEditingAccountId(null);
        setNewAccount({ name: '', type: 'Savings Account', balance: '', institution: '' });
    };

    const openAddAccountModal = () => {
        setEditingAccountId(null);
        setNewAccount({ name: '', type: 'Savings Account', balance: '', institution: '' });
        setIsAddAccountModal(true);
    };

    const openEditAccountModal = (acc) => {
        setEditingAccountId(acc.id);
        setNewAccount({ name: acc.name || '', type: acc.type || 'Savings Account', balance: acc.balance ?? '', institution: acc.institution || '' });
        setIsAddAccountModal(true);
    };

    const closeAccountModal = () => {
        setIsAddAccountModal(false);
        setEditingAccountId(null);
    };

    const handleAddTransaction = (e) => {
        e.preventDefault();
        if (!newTx.title.trim() || !newTx.amount || !newTx.account) {
            setFinanceToast('Please fill title, amount, and select an account.');
            return;
        }

        const amountVal = parseFloat(newTx.amount) || 0;
        // date is deliberately excluded here - the form has no date field,
        // so an edit must preserve the transaction's own original date
        // rather than overwriting it with today's.
        const txFields = {
            title: toTitleCase(newTx.title.trim()), type: newTx.type, amount: amountVal,
            category: toTitleCase(newTx.category), account: newTx.account,
        };

        if (editingTxId !== null) {
            const oldTx = transactions.find(t => t.id === editingTxId);
            // Reverses the OLD amount's effect on its own old account, then
            // applies the NEW amount's effect on the (possibly different)
            // newly-selected account - both adjustments run over accounts
            // in a single pass so editing a transaction that keeps the same
            // account nets out correctly instead of double-counting, and
            // moving a transaction to a different account correctly debits
            // one and credits the other.
            setAccounts(accounts.map(acc => {
                let updatedBalance = acc.balance;
                if (oldTx && acc.name === oldTx.account) {
                    updatedBalance = oldTx.type === 'Income' ? updatedBalance - oldTx.amount : updatedBalance + oldTx.amount;
                }
                if (acc.name === txFields.account) {
                    updatedBalance = txFields.type === 'Income' ? updatedBalance + amountVal : updatedBalance - amountVal;
                }
                return updatedBalance === acc.balance ? acc : { ...acc, balance: updatedBalance };
            }));
            setTransactions(transactions.map(t => t.id === editingTxId ? { ...t, ...txFields } : t));
        } else {
            const txItem = { id: Date.now().toString(), ...txFields, date: getLocalDateString() };
            setAccounts(accounts.map(acc => {
                if (acc.name === txFields.account) {
                    const updatedBalance = txFields.type === 'Income' ? acc.balance + amountVal : acc.balance - amountVal;
                    return { ...acc, balance: updatedBalance };
                }
                return acc;
            }));
            setTransactions([txItem, ...transactions]);
        }

        setIsAddTxModal(false);
        setEditingTxId(null);
        setNewTx({ title: '', type: 'Expense', amount: '', category: 'Food', account: accounts.length > 0 ? accounts[0].name : '' });
    };

    // Shared by the header's "Add Transaction" button (desktop, and
    // mobile when the Transactions tab is active) and the mobile
    // Dashboard tab's own quick-action row - one real guard against
    // adding a transaction with no account to attach it to, not two
    // copies that could drift apart.
    const openAddTransactionModal = () => {
        if (accounts.length === 0) {
            setFinanceToast('Please create an Account/Wallet first before adding transactions.');
            return;
        }
        setEditingTxId(null);
        setNewTx({ title: '', type: 'Expense', amount: '', category: 'Food', account: accounts[0].name });
        setIsAddTxModal(true);
    };

    const openEditTxModal = (tx) => {
        setEditingTxId(tx.id);
        setNewTx({
            title: tx.title || '', type: tx.type || 'Expense', amount: tx.amount ?? '',
            category: tx.category || 'Food', account: tx.account || (accounts.length > 0 ? accounts[0].name : ''),
        });
        setIsAddTxModal(true);
    };

    const closeTxModal = () => {
        setIsAddTxModal(false);
        setEditingTxId(null);
    };

    // Real handler for StatementImportModal's onImport - commits every
    // reviewed, included row the user explicitly approved into the real
    // transactions store, and updates the real target account's balance
    // by the NET effect of every imported row in a single pass, rather
    // than one setAccounts call per row (which could race against
    // React's own state batching and silently drop updates).
    const handleStatementImport = (importedRows, targetAccount) => {
        const netChange = importedRows.reduce((sum, row) => sum + (row.type === 'Income' ? row.amount : -row.amount), 0);
        setAccounts(accounts.map((acc) => (acc.name === targetAccount ? { ...acc, balance: acc.balance + netChange } : acc)));

        const newTxItems = importedRows.map((row) => ({
            id: `stmt_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
            title: row.title, type: row.type, amount: row.amount,
            category: row.category, account: targetAccount,
            date: row.date,
        }));
        setTransactions([...newTxItems, ...transactions]);
        setFinanceToast(`Imported ${importedRows.length} transaction${importedRows.length === 1 ? '' : 's'} into ${targetAccount}.`);
    };

    // SMS Auto-Tracking (native Android only). Same net-balance-change +
    // transaction-shape logic as handleStatementImport above, but using
    // functional setState updates rather than closing over the
    // `accounts`/`transactions` variables directly - this one genuinely
    // needs that: it's called from a long-lived event listener
    // (onSmsTransactionDetected below) that can fire many renders after
    // it was first subscribed, where a captured closure over those two
    // variables would silently use stale data instead of the real
    // current state. handleStatementImport doesn't have this problem
    // since it's only ever invoked directly from a modal's onImport
    // callback, not a standing subscription.
    const applySmsImportedRows = (importedRows, targetAccount) => {
        if (importedRows.length === 0 || !targetAccount) return;
        const netChange = importedRows.reduce((sum, row) => sum + (row.type === 'Income' ? row.amount : -row.amount), 0);
        setAccounts((prevAccounts) => prevAccounts.map((acc) => (acc.name === targetAccount ? { ...acc, balance: acc.balance + netChange } : acc)));
        setTransactions((prevTransactions) => {
            const newTxItems = importedRows.map((row) => ({
                id: `sms_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
                title: row.title, type: row.type, amount: row.amount,
                category: row.category, account: targetAccount,
                date: row.date,
            }));
            return [...newTxItems, ...prevTransactions];
        });
        setFinanceToast(`SMS Auto-Tracking: added ${importedRows.length} transaction${importedRows.length === 1 ? '' : 's'} to ${targetAccount}.`);
    };

    // The actual fix for the "Create an account first" blocker: once SMS
    // Auto-Tracking has real permission but the user has no accounts at
    // all yet, silently create a sensible default ("Cash") rather than
    // stopping the feature cold - a user who just granted SMS permission
    // clearly wants transactions tracked, and forcing a detour through
    // "go create an account, then come back" is exactly the friction this
    // fix removes. Guarded on accounts.length === 0 so this only ever
    // fires once; any real account the user creates afterward (including
    // renaming/deleting this default one later) is left alone.
    useEffect(() => {
        if (smsPermission === 'granted' && accounts.length === 0) {
            setAccounts([{ name: 'Cash', type: 'Cash', balance: 0, institution: '' }]);
        }
    }, [smsPermission, accounts.length]);

    // Defaults the SMS target account to the user's first real account
    // once accounts load (including the auto-created default above),
    // without ever overwriting a selection the user already made in the
    // picker below.
    useEffect(() => {
        if (!smsTargetAccount && accounts.length > 0) {
            setSmsTargetAccount(accounts[0].name);
        }
    }, [accounts, smsTargetAccount]);

    // Real permission-state check on mount (native only; resolves
    // 'unavailable' instantly everywhere else, see
    // utils/smsFinanceBridge.js) - drives which state the card below
    // renders (Enable button vs Active status) without requiring the
    // user to tap anything first just to see where they stand.
    useEffect(() => {
        if (!isSmsFinanceBridgeAvailable()) return;
        checkSmsFinancePermission().then(setSmsPermission);
    }, []);

    // Once permission is granted AND a target account is selected: pull
    // whatever SmsReceiver already queued while the app wasn't running,
    // then subscribe to the genuine real-time listener for as long as
    // this page stays mounted. Re-subscribes if the user changes the
    // target account mid-session, so a live SMS arriving right after a
    // switch still lands in the newly-selected account, not the old one.
    useEffect(() => {
        if (smsPermission !== 'granted' || !smsTargetAccount) return undefined;
        pullPendingSmsTransactions().then((rows) => applySmsImportedRows(rows, smsTargetAccount));
        const unsubscribe = onSmsTransactionDetected((row) => applySmsImportedRows([row], smsTargetAccount));
        return unsubscribe;
    }, [smsPermission, smsTargetAccount]);

    const handleEnableSmsTracking = async () => {
        const result = await requestSmsFinancePermission();
        setSmsPermission(result);
        if (result !== 'granted') {
            setFinanceToast('SMS permission was not granted - enable it in Android Settings to use SMS Auto-Tracking.');
        }
    };

    const handleSmsSyncNow = async () => {
        if (smsPermission !== 'granted' || !smsTargetAccount || isSmsSyncing) return;
        setIsSmsSyncing(true);
        try {
            const rows = await pullPendingSmsTransactions();
            if (rows.length === 0) {
                setFinanceToast('No new SMS transactions since the last sync.');
            } else {
                applySmsImportedRows(rows, smsTargetAccount);
            }
        } finally {
            setIsSmsSyncing(false);
        }
    };

    const handleAddGoal = (e) => {
        e.preventDefault();
        if (!newGoal.title.trim() || !newGoal.target) return;
        const goalFields = {
            title: toTitleCase(newGoal.title.trim()),
            target: parseFloat(newGoal.target) || 0,
            current: parseFloat(newGoal.current) || 0,
            deadline: newGoal.deadline
        };
        if (editingGoalId !== null) {
            setSavingsGoals(savingsGoals.map(g => g.id === editingGoalId ? { ...g, ...goalFields } : g));
        } else {
            setSavingsGoals([{ id: Date.now().toString(), ...goalFields }, ...savingsGoals]);
        }
        setIsAddGoalModal(false);
        setEditingGoalId(null);
        setNewGoal({ title: '', target: '', current: '', deadline: getLocalDateString() });
    };

    const openAddGoalModal = () => {
        setEditingGoalId(null);
        setNewGoal({ title: '', target: '', current: '', deadline: getLocalDateString() });
        setIsAddGoalModal(true);
    };

    const openEditGoalModal = (goal) => {
        setEditingGoalId(goal.id);
        setNewGoal({ title: goal.title || '', target: goal.target ?? '', current: goal.current ?? '', deadline: goal.deadline || getLocalDateString() });
        setIsAddGoalModal(true);
    };

    const closeGoalModal = () => {
        setIsAddGoalModal(false);
        setEditingGoalId(null);
    };

    const handleAddBill = (e) => {
        e.preventDefault();
        if (!newBill.title.trim() || !newBill.amount) return;
        const billFields = {
            title: toTitleCase(newBill.title.trim()), amount: parseFloat(newBill.amount) || 0,
            dueDate: newBill.dueDate,
        };
        if (editingBillId !== null) {
            setBills(bills.map(b => b.id === editingBillId ? { ...b, ...billFields } : b));
        } else {
            setBills([{ id: Date.now().toString(), ...billFields, paid: false }, ...bills]);
        }
        setIsAddBillModal(false);
        setEditingBillId(null);
        setNewBill({ title: '', amount: '', dueDate: getLocalDateString() });
    };

    const openAddBillModal = () => {
        setEditingBillId(null);
        setNewBill({ title: '', amount: '', dueDate: getLocalDateString() });
        setIsAddBillModal(true);
    };

    const openEditBillModal = (bill) => {
        setEditingBillId(bill.id);
        setNewBill({ title: bill.title || '', amount: bill.amount ?? '', dueDate: bill.dueDate || getLocalDateString() });
        setIsAddBillModal(true);
    };

    const closeBillModal = () => {
        setIsAddBillModal(false);
        setEditingBillId(null);
    };

    const toggleBillPaid = (id) => {
        setBills(bills.map(b => b.id === id ? { ...b, paid: !b.paid } : b));
    };

    // NEW: Delete Handlers
    const deleteAccount = (id) => setAccounts(accounts.filter(a => a.id !== id));
    
    const deleteTransaction = (id) => {
        const txToDelete = transactions.find(t => t.id === id);
        if (txToDelete) {
            // Reverse the balance effect before deleting
            setAccounts(accounts.map(acc => {
                if (acc.name === txToDelete.account) {
                    const updatedBalance = txToDelete.type === 'Income' ? acc.balance - txToDelete.amount : acc.balance + txToDelete.amount;
                    return { ...acc, balance: updatedBalance };
                }
                return acc;
            }));
        }
        setTransactions(transactions.filter(t => t.id !== id));
    };

    const deleteGoal = (id) => setSavingsGoals(savingsGoals.filter(g => g.id !== id));
    const deleteBill = (id) => setBills(bills.filter(b => b.id !== id));

    // Calculations & Math Safeguards
    const totalBalance = (accounts || []).reduce((acc, curr) => acc + (curr.type === 'Credit Card' ? -(curr.balance || 0) : (curr.balance || 0)), 0);
    const totalSpent = (transactions || []).filter(t => t.type === 'Expense').reduce((acc, curr) => acc + (curr.amount || 0), 0);
    // Same scope as totalSpent above (every real Income transaction, not
    // date-filtered) - the real number behind the new Income summary card,
    // giving the Dashboard tab an actual income-vs-expense comparison
    // instead of only ever showing the expense side.
    const totalIncome = (transactions || []).filter(t => t.type === 'Income').reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const budgetRemaining = Math.max(0, (settings.monthlyBudgetCap || 0) - totalSpent);
    const budgetProgress = (settings.monthlyBudgetCap || 0) > 0 ? Math.min(100, Math.round((totalSpent / (settings.monthlyBudgetCap || 0)) * 100)) : 0;

    // Real expense-by-category breakdown - deliberately matches
    // totalSpent's own scope (every real Expense transaction, not just
    // this calendar month) rather than introducing a different date
    // filter, since these percentages need to genuinely sum to the same
    // totalSpent figure shown right above them on this same screen.
    const categoryBreakdown = (() => {
        const byCategory = {};
        transactions.filter((t) => t.type === 'Expense').forEach((t) => {
            const cat = t.category || 'Uncategorized';
            byCategory[cat] = (byCategory[cat] || 0) + (Number(t.amount) || 0);
        });
        return Object.entries(byCategory)
            .map(([category, amount]) => ({ category, amount, pct: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0 }))
            .sort((a, b) => b.amount - a.amount);
    })();
    const CATEGORY_BAR_COLORS = { Food: '#F59E0B', Bills: '#EF4444', Travel: '#3B82F6', Shopping: '#EC4899', Entertainment: '#8B5CF6', Health: '#10B981', Salary: '#14B8A6', Others: '#64748B' };
    const getCategoryBarColor = (cat) => CATEGORY_BAR_COLORS[cat] || 'var(--accent)';

    // Category-specific glyph for the transaction feed (Recent Transactions
    // preview + the full Transactions tab list) - replaces the old generic
    // "up arrow for Income, down arrow for Expense" icon, which told you
    // the direction of money movement but nothing about what the
    // transaction actually was at a glance.
    const CATEGORY_ICONS = { Food: Utensils, Bills: Receipt, Travel: Plane, Shopping: ShoppingBag, Entertainment: Clapperboard, Health: HeartPulse, Salary: Landmark, Others: Tag };
    const getCategoryIcon = (cat) => CATEGORY_ICONS[cat] || Tag;

    // Shared look for every Quick Action Bar button (Add/Import/Export) and
    // each empty-state call-to-action below - one real definition instead
    // of hand-copying the same style object at each of the several call
    // sites that need it.
    // Sized to match the visual weight of the real Income/Expense/Budget
    // stat row directly above (12px/10px padding, ~16px icon in an 8px-
    // padded wrap) - previously these were noticeably chunkier (40px
    // circular icon wrap, 20px icons) than the actual financial data
    // they sit under, making three decorative action buttons visually
    // heavier than the real balance figures. Still three separate,
    // clearly-tappable buttons (the actual fix for the earlier
    // "overcrowded button stack" complaint, preserved) - just no longer
    // oversized relative to their neighbors.
    const quickActionButtonStyle = { width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '10px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--premium-shadow)' };
    const quickActionIconWrapStyle = (color) => ({ width: '30px', height: '30px', borderRadius: '50%', background: `${color}1F`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' });
    const quickActionLabelStyle = { fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' };
    const emptyStateCtaStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' };

    const totalSavingsSaved = (savingsGoals || []).reduce((acc, curr) => acc + (curr.current || 0), 0);
    const estimatedNetWorth = totalBalance + totalSavingsSaved;

    // A real, multi-factor Financial Health Score - the old version only
    // ever considered budget spending, completely ignoring emergencyFund
    // and savings goal progress despite both already being real, tracked
    // data. Each factor is genuinely computed; an honest neutral default
    // (50) is used only when the underlying data genuinely isn't set up
    // yet, rather than fabricating a specific high or low score.
    const budgetDisciplineScore = (settings.monthlyBudgetCap || 0) > 0 ? Math.max(0, 100 - budgetProgress) : 50;
    const emergencyFundMonths = (settings.monthlyBudgetCap || 0) > 0 ? (profile.emergencyFund || 0) / (settings.monthlyBudgetCap || 0) : 0;
    const emergencyFundScore = (settings.monthlyBudgetCap || 0) > 0 ? Math.min(100, Math.round((emergencyFundMonths / 6) * 100)) : 50; // 6 months of expenses = full score
    const avgGoalProgress = savingsGoals.length > 0
        ? savingsGoals.reduce((acc, g) => acc + (g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0), 0) / savingsGoals.length
        : 50;
    const financialHealthScore = Math.round((budgetDisciplineScore * 0.5) + (emergencyFundScore * 0.25) + (avgGoalProgress * 0.25));
    // True only once at least one real input exists for the formula
    // above. With neither a budget cap nor a savings goal set up, every
    // factor falls back to its own neutral 50 default, so the score is
    // ALWAYS exactly 50 regardless of the account's real activity - which
    // reads to a fresh user as a static, hardcoded number rather than a
    // real calculation (confirmed live: a brand-new profile shows "50 /
    // 100" no matter what). The card renders an honest "not enough data"
    // state instead of that number in exactly this one case; once either
    // input is real, the number itself is a genuine calculation again.
    const hasHealthScoreData = (settings.monthlyBudgetCap || 0) > 0 || savingsGoals.length > 0;

    const filteredTransactions = transactions.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.account.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // A real, honest multi-metric briefing - the old version fabricated a
    // fixed "Great discipline on savings goals" claim regardless of
    // whether any savings goals even existed or were being made
    // progress on. Every sentence below is a genuine, computed fact from
    // real data; savings/bills are only ever mentioned when real data
    // actually exists to support the claim, and progress is reported
    // honestly whether it's good or lagging - never assumed positive.
    const generateFinanceBriefing = () => {
        if ((settings.monthlyBudgetCap || 0) === 0) return "Set up your financial profile and add transactions to receive AI insights.";
        const parts = [`Your monthly budget utilization is currently at ${budgetProgress}%. You have ${settings.currencySymbol}${budgetRemaining.toLocaleString()} remaining for the rest of the month.`];

        if (savingsGoals.length > 0) {
            const avgProgress = Math.round(savingsGoals.reduce((acc, g) => acc + (g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0), 0) / savingsGoals.length);
            parts.push(avgProgress >= 70
                ? `Your savings goals are averaging ${avgProgress}% progress - great discipline, keep it up!`
                : `Your savings goals are averaging ${avgProgress}% progress - consider allocating more toward them this month.`);
        }

        const unpaidBills = bills.filter((b) => !b.paid);
        if (unpaidBills.length > 0) {
            const totalUnpaid = unpaidBills.reduce((acc, b) => acc + b.amount, 0);
            parts.push(`You have ${unpaidBills.length} unpaid bill${unpaidBills.length === 1 ? '' : 's'} totaling ${settings.currencySymbol}${totalUnpaid.toLocaleString()}.`);
        }

        return parts.join(' ');
    };

    // Shared between the desktop Transactions tab (its original home) and
    // the mobile Dashboard tab (its new "middle tier" home per the
    // requested top/middle/bottom hierarchy) - one real implementation,
    // both call sites always show the exact same live sync state.
    const renderSmsTrackingCard = () => (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '14px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--premium-shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={16} color="var(--accent)" />
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>SMS Auto-Tracking</h3>
            </div>

            {smsPermission === 'granted' ? (
                <>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '8px', alignItems: isMobile ? 'stretch' : 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>Route detected transactions into</span>
                        <select
                            aria-label="SMS Auto-Tracking target account" value={smsTargetAccount}
                            onChange={(e) => setSmsTargetAccount(e.target.value)}
                            disabled={accounts.length === 0}
                            style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '12px' }}
                        >
                            {accounts.length === 0 && <option value="">Create an account first</option>}
                            {accounts.map((acc) => <option key={acc.name} value={acc.name}>{acc.name}</option>)}
                        </select>
                        <button
                            type="button" onClick={handleSmsSyncNow} disabled={isSmsSyncing || accounts.length === 0}
                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 14px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: isSmsSyncing ? 'default' : 'pointer', opacity: isSmsSyncing ? 0.6 : 1 }}
                        >
                            <RefreshCw size={12} /> {isSmsSyncing ? 'Syncing…' : 'Sync Now'}
                        </button>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Active - listening for bank SMS in real time. Only messages that look like a genuine transaction (amount + debited/credited) are ever read or stored.
                    </span>
                </>
            ) : (
                <>
                    <button
                        type="button" onClick={handleEnableSmsTracking}
                        style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                    >
                        <Smartphone size={13} /> Enable SMS Auto-Tracking
                    </button>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {smsPermission === 'denied'
                            ? 'Permission was denied - enable it in Android Settings > Apps > Nexus > Permissions, then reopen this page.'
                            : 'Automatically logs bank transactions from incoming SMS - local to your device only, nothing is sent anywhere.'}
                    </span>
                </>
            )}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            {/* Scoped keyframes for the tab-content fade below - each tab's
                content div is keyed by activeTab so React remounts it (and
                replays this animation) on every tab switch, instead of an
                abrupt instant swap. */}
            <style>{`@keyframes financeTabFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            {showTour && <TourGuide tourId="finance" steps={TOUR_STEPS.finance} onFinish={() => setShowTour(false)} />}

            {/* Header Section - clean hub title only, no subtitle, on
                every viewport (desktop used to keep "Financial Command
                Center" + a subtitle here; now unified with every other
                Hub page's identical clean header treatment). */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: isMobile ? '8px' : '16px' }}>
                <div style={{ minWidth: 0, flexShrink: 1 }}>
                    <h1 style={{ fontSize: isMobile ? '19px' : '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>Finance Hub</h1>
                </div>

                {/* On mobile, every button here drops to icon-only (see
                    each button's own {!isMobile && '...'} label below) so
                    this whole row - title included - genuinely stays on
                    one line instead of the title and buttons wrapping
                    onto separate rows the way they used to (a real,
                    reported problem: on mobile this used to leave the
                    page's own vertical rhythm broken, with the Total
                    Balance card pushed an extra row down for no reason).
                    A title="..." on each still carries the real label for
                    accessibility/long-press tooltips even icon-only. */}
                <div style={{ display: 'flex', flexWrap: 'nowrap', gap: isMobile ? '6px' : '8px', flexShrink: 0 }}>
                    {/* Add Transaction / Import Statement - desktop only here.
                        Mobile gets these same two actions (plus Export) from
                        the single, always-visible Quick Action Bar below the
                        summary cards instead - keeping this header row from
                        ever growing into the "overcrowded button stack" it
                        used to wrap into on narrow screens. */}
                    {!isMobile && activeTab === 'Transactions' && (
                        <button
                            onClick={openAddTransactionModal}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                        >
                            <Plus size={16} /> Add Transaction
                        </button>
                    )}
                    {!isMobile && activeTab === 'Transactions' && (
                        <button
                            onClick={() => setIsStatementImportOpen(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                        >
                            <Upload size={16} /> Import Statement
                        </button>
                    )}
                    {activeTab === 'GoalsBills' && (
                        <>
                            <button title="Add Bill" onClick={openAddBillModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: isMobile ? '9px' : '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}>
                                <Plus size={16} /> {!isMobile && 'Add Bill'}
                            </button>
                            <button title="Add Savings Goal" onClick={openAddGoalModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: isMobile ? '9px' : '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}>
                                <Plus size={16} /> {!isMobile && 'Add Savings Goal'}
                            </button>
                        </>
                    )}
                    {activeTab === 'Dashboard' && (
                        <button title="Add Account" data-tour-id="finance-add-account" onClick={openAddAccountModal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: isMobile ? '9px' : '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}>
                            <Plus size={16} /> {!isMobile && 'Add Account'}
                        </button>
                    )}
                    {!isMobile && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setIsExportMenuOpen((v) => !v)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
                            >
                                <Download size={16} /> Export Report
                            </button>
                            {isExportMenuOpen && (
                                <>
                                    <div onClick={() => setIsExportMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1199 }} />
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '220px', zIndex: 1200,
                                        background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '8px',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '4px',
                                    }}>
                                        <button
                                            onClick={() => { exportFinanceReportText({ ...(profile || {}), monthlyBudget: settings.monthlyBudgetCap || 0, currency: settings.currencySymbol }, transactions || []); setIsExportMenuOpen(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}
                                        >
                                            <FileText size={15} color="var(--accent)" /> Monthly Summary (.txt)
                                        </button>
                                        <button
                                            onClick={() => { exportFinanceReportCsv(profile, transactions); setIsExportMenuOpen(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}
                                        >
                                            <Download size={15} color="var(--accent)" /> Transactions (.csv)
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    <button title="Profile" onClick={() => { setTempProfile(profile); setTempMonthlyBudget(settings.monthlyBudgetCap || 0); setTempCurrencySymbol(settings.currencySymbol || '₹'); setIsEditingProfile(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: isMobile ? '9px' : '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', flexShrink: 0 }}>
                        <User size={16} /> {!isMobile && 'Profile'}
                    </button>
                </div>
            </div>

            {/* Financial summary - a real visual hierarchy instead of 4
                identically-weighted cards: Balance is the one number that
                actually matters most "at a glance", so it gets its own
                full-width hero row with an accent-tinted background,
                bigger type, and the account count as real supporting
                context. Income vs Expense sit directly beside each other
                underneath specifically so they read as a real comparison
                (this is also the actual fix for a real gap: the page
                never computed/showed a total Income figure before, only
                Spent - "improve visual card hierarchy for income/
                expenses" genuinely needed that number to exist first).
                Budget Left stays a real but secondary, derived metric. */}
            <div data-tour-id="finance-stats" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '14px' }}>
                <div className="finance-glass-card" style={{
                    background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.16), rgba(var(--primary-rgb), 0.04))',
                    border: '1px solid rgba(var(--primary-rgb), 0.3)', borderRadius: isMobile ? '16px' : '20px',
                    padding: isMobile ? '16px' : '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '18px', minWidth: 0 }}>
                        <div style={{ padding: isMobile ? '10px' : '14px', background: 'var(--primary)', borderRadius: isMobile ? '12px' : '14px', color: 'var(--text-on-primary)', flexShrink: 0, display: 'flex' }}><Wallet size={isMobile ? 20 : 26} /></div>
                        <div style={{ minWidth: 0 }}>
                            <span style={{ fontSize: isMobile ? '11px' : '13px', color: 'var(--text-secondary)', fontWeight: '700', display: 'block' }}>Total Balance</span>
                            <h2 style={{ fontSize: isMobile ? '22px' : '34px', fontWeight: '800', color: 'var(--text-primary)', overflowWrap: 'break-word', lineHeight: 1.15 }}>{settings.currencySymbol} {totalBalance.toLocaleString()}</h2>
                        </div>
                    </div>
                    {!isMobile && (
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600', flexShrink: 0 }}>{accounts.length} account{accounts.length === 1 ? '' : 's'}</span>
                    )}
                </div>

                {/* Income/Expense/Budget Left cards: row layout (icon
                    beside the label+amount, not above it) on EVERY
                    viewport now - confirmed live at 375px that the old
                    mobile-only flexDirection: 'column' put the icon badge
                    alone in its own row, with the label+amount stacked
                    below it, leaving the rest of that first row's width
                    (each card is only ~110px wide in this 3-up grid) empty
                    next to the icon. Mobile stays visually compact through
                    smaller padding/icon/font sizes instead, not through a
                    different flex direction. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? '8px' : '14px' }}>
                    <div className="finance-glass-card" style={{ background: 'var(--bg-surface)', padding: isMobile ? '10px 8px' : '18px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: isMobile ? '7px' : '14px', minWidth: 0 }}>
                        <div style={{ padding: isMobile ? '6px' : '11px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: isMobile ? '8px' : '12px', color: '#10B981', flexShrink: 0, display: 'flex' }}><ArrowUpRight size={isMobile ? 14 : 22} /></div>
                        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                            <span style={{ fontSize: isMobile ? '9px' : '12px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Income</span>
                            <h2 style={{ fontSize: isMobile ? '13px' : '19px', fontWeight: '800', color: '#10B981', overflowWrap: 'break-word', lineHeight: 1.25 }}>{settings.currencySymbol} {totalIncome.toLocaleString()}</h2>
                        </div>
                    </div>

                    <div className="finance-glass-card" style={{ background: 'var(--bg-surface)', padding: isMobile ? '10px 8px' : '18px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: isMobile ? '7px' : '14px', minWidth: 0 }}>
                        <div style={{ padding: isMobile ? '6px' : '11px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: isMobile ? '8px' : '12px', color: '#EF4444', flexShrink: 0, display: 'flex' }}><ArrowDownLeft size={isMobile ? 14 : 22} /></div>
                        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                            <span style={{ fontSize: isMobile ? '9px' : '12px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Expense</span>
                            <h2 style={{ fontSize: isMobile ? '13px' : '19px', fontWeight: '800', color: '#EF4444', overflowWrap: 'break-word', lineHeight: 1.25 }}>{settings.currencySymbol} {totalSpent.toLocaleString()}</h2>
                        </div>
                    </div>

                    <div className="finance-glass-card" style={{ background: 'var(--bg-surface)', padding: isMobile ? '10px 8px' : '18px', borderRadius: isMobile ? '14px' : '16px', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: isMobile ? '7px' : '14px', minWidth: 0 }}>
                        <div style={{ padding: isMobile ? '6px' : '11px', background: 'var(--widget-bg)', borderRadius: isMobile ? '8px' : '12px', color: 'var(--primary)', flexShrink: 0, display: 'flex' }}><Target size={isMobile ? 14 : 22} /></div>
                        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                            <span style={{ fontSize: isMobile ? '9px' : '12px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Budget Left</span>
                            <h2 style={{ fontSize: isMobile ? '13px' : '19px', fontWeight: '800', color: 'var(--text-primary)', overflowWrap: 'break-word', lineHeight: 1.25 }}>
                                {settings.currencySymbol} {budgetRemaining.toLocaleString()}
                                {!isMobile && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}> / {settings.currencySymbol}{(settings.monthlyBudgetCap || 0).toLocaleString()}</span>}
                            </h2>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Action Bar - mobile only, Paytm/GPay-style: exactly
                three large icon-labeled buttons (Add/Import/Export),
                always visible regardless of which tab is active. This is
                the single real fix for the "overcrowded button stack"
                complaint - it replaces both the header's own
                tab-conditional Add Transaction/Import Statement/Export
                Report buttons (hidden on mobile above) and the narrower
                2-button row that used to live only inside the Dashboard
                tab's own content. Desktop is unaffected - it keeps the
                original header buttons, which have enough room there. */}
            {isMobile && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <button type="button" onClick={openAddTransactionModal} style={quickActionButtonStyle}>
                        <div style={quickActionIconWrapStyle('var(--primary)')}><Plus size={16} /></div>
                        <span style={quickActionLabelStyle}>Add</span>
                    </button>
                    <button type="button" onClick={() => setIsStatementImportOpen(true)} style={quickActionButtonStyle}>
                        <div style={quickActionIconWrapStyle('#3B82F6')}><Upload size={16} /></div>
                        <span style={quickActionLabelStyle}>Import</span>
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button type="button" onClick={() => setIsExportMenuOpen((v) => !v)} style={quickActionButtonStyle}>
                            <div style={quickActionIconWrapStyle('#8B5CF6')}><Download size={16} /></div>
                            <span style={quickActionLabelStyle}>Export</span>
                        </button>
                        {isExportMenuOpen && (
                            <>
                                <div onClick={() => setIsExportMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1199 }} />
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '200px', zIndex: 1200,
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '4px',
                                }}>
                                    <button
                                        onClick={() => { exportFinanceReportText({ ...(profile || {}), monthlyBudget: settings.monthlyBudgetCap || 0, currency: settings.currencySymbol }, transactions || []); setIsExportMenuOpen(false); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                                    >
                                        <FileText size={15} color="var(--accent)" /> Summary (.txt)
                                    </button>
                                    <button
                                        onClick={() => { exportFinanceReportCsv(profile, transactions); setIsExportMenuOpen(false); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                                    >
                                        <Download size={15} color="var(--accent)" /> Transactions (.csv)
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Navigation Tabs - shortened labels on mobile only (fade-mask
                horizontal scroll still there as a fallback), same pattern
                as every other Hub page's own tab row this session. */}
            <div data-tour-id="finance-tabs" style={{
                display: 'flex', gap: isMobile ? '4px' : '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px', overflowX: 'auto',
                maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
            }}>
                <button onClick={() => setActiveTab('Dashboard')} style={{ padding: isMobile ? '10px 12px' : '10px 16px', background: activeTab === 'Dashboard' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Dashboard' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Dashboard' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: isMobile ? '13px' : '14px', whiteSpace: 'nowrap' }}>
                    {isMobile ? 'Overview' : 'Overview & Accounts'}
                </button>
                <button onClick={() => setActiveTab('Transactions')} style={{ padding: isMobile ? '10px 12px' : '10px 16px', background: activeTab === 'Transactions' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Transactions' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Transactions' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: isMobile ? '13px' : '14px', whiteSpace: 'nowrap' }}>
                    Transactions ({transactions.length})
                </button>
                <button onClick={() => setActiveTab('GoalsBills')} style={{ padding: isMobile ? '10px 12px' : '10px 16px', background: activeTab === 'GoalsBills' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'GoalsBills' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'GoalsBills' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: isMobile ? '13px' : '14px', whiteSpace: 'nowrap' }}>
                    {isMobile ? 'Goals & Bills' : 'Savings Goals & Bills'}
                </button>
                <button onClick={() => setActiveTab('Analytics')} style={{ padding: isMobile ? '10px 12px' : '10px 16px', background: activeTab === 'Analytics' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Analytics' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Analytics' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: isMobile ? '13px' : '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={14} /> {isMobile ? 'AI Coach' : 'AI Coach & Analytics'}
                </button>
            </div>

            {/* TAB CONTENT: DASHBOARD - a real 2-column layout on desktop
                (budget + expense breakdown on the left, accounts on the
                right) instead of everything stacked full-width in one
                narrow column regardless of how wide the actual viewport
                is - the concrete "spacious, structured on desktop" fix.
                Mobile stays the original single stacked column. */}
            {activeTab === 'Dashboard' && (
                <div key="Dashboard" style={isMobile
                    ? { display: 'flex', flexDirection: 'column', gap: '14px', animation: 'financeTabFade 0.25s ease' }
                    : { display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start', animation: 'financeTabFade 0.25s ease' }
                }>
                    {/* Mobile-only middle + bottom tiers of the requested
                        top/middle/bottom hierarchy - the Total Balance/
                        Income/Expense summary above the tabs is already the
                        "top" tier for every tab. Desktop is untouched: the
                        SMS card stays in the Transactions tab there, and
                        there's no separate transactions preview since the
                        full searchable list is one tab away either way. */}
                    {isMobile && (
                        <>
                            {isSmsFinanceBridgeAvailable() && renderSmsTrackingCard()}

                            {/* Transaction Feed - the hero element of this
                                tab on mobile: category-specific icons (not
                                just a generic income/expense arrow) and
                                color-coded amounts, matching the rest of
                                the Transactions tab's own row styling. */}
                            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--premium-shadow)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Recent Transactions</h3>
                                    {transactions.length > 0 && (
                                        <button type="button" onClick={() => setActiveTab('Transactions')} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                                            View All
                                        </button>
                                    )}
                                </div>
                                {transactions.length === 0 ? (
                                    <div style={{ padding: '20px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                            <Wallet size={24} />
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No transactions yet.</p>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {isSmsFinanceBridgeAvailable() && smsPermission !== 'granted' && (
                                                <button type="button" onClick={handleEnableSmsTracking} style={emptyStateCtaStyle}><Smartphone size={13} /> Enable SMS Tracking</button>
                                            )}
                                            <button type="button" onClick={openAddTransactionModal} style={emptyStateCtaStyle}><Plus size={13} /> Add First Transaction</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {transactions.slice(0, 5).map((tx) => {
                                            const CategoryIcon = getCategoryIcon(tx.category);
                                            return (
                                            <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: 'var(--widget-bg)', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                    <div style={{ padding: '8px', borderRadius: '10px', background: tx.type === 'Income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: tx.type === 'Income' ? '#10B981' : '#EF4444', flexShrink: 0, display: 'flex' }}>
                                                        <CategoryIcon size={14} />
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.title}</h4>
                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>{tx.category} · {tx.date}</span>
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: '800', color: tx.type === 'Income' ? '#10B981' : '#EF4444', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                    {tx.type === 'Income' ? '+' : '-'}{settings.currencySymbol}{(tx.amount || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', minWidth: 0 }}>
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--premium-shadow)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Monthly Budget Utilization</h3>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: budgetProgress > 85 ? '#EF4444' : 'var(--primary)' }}>{budgetProgress}% Spent</span>
                            </div>
                            <div style={{ width: '100%', height: '10px', background: 'var(--widget-bg)', borderRadius: '5px', overflow: 'hidden' }}>
                                <div style={{ width: `${budgetProgress}%`, height: '100%', background: budgetProgress > 85 ? '#EF4444' : 'var(--primary)', borderRadius: '5px', transition: 'width 0.4s ease' }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <span>Spent: {settings.currencySymbol} {totalSpent.toLocaleString()}</span>
                                <span>Monthly Limit: {settings.currencySymbol} {(settings.monthlyBudgetCap || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Expense Breakdown - a real, live bar chart derived
                            directly from the transactions state, so it
                            genuinely re-renders the moment a statement import
                            (or any other transaction change) updates that
                            state - no separate refresh/recompute step needed. */}
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px', boxShadow: 'var(--premium-shadow)' }}>
                            <h3 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Expense Breakdown by Category</h3>
                            {categoryBreakdown.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    No expenses recorded yet. Add a transaction or import a statement to see your real breakdown here.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
                                    <ExpenseDonutChart categoryBreakdown={categoryBreakdown} currency={settings.currencySymbol} totalSpent={totalSpent} colorForCategory={getCategoryBarColor} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {categoryBreakdown.map((row) => (
                                        <div key={row.category} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{row.category}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>{settings.currencySymbol}{row.amount.toLocaleString()} · {row.pct}%</span>
                                            </div>
                                            <div style={{ width: '100%', height: '8px', background: 'var(--widget-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${row.pct}%`, height: '100%', background: getCategoryBarColor(row.category), borderRadius: '4px', transition: 'width 0.4s ease' }} />
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: isMobile ? '10px' : '16px' }}>Accounts & Wallets</h3>
                        {accounts.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: isMobile ? '12px' : '16px' }}>
                                {accounts.map(acc => {
                                    // Real, not decorative: true only for the
                                    // one account SMS Auto-Tracking is
                                    // actually routing parsed transactions
                                    // into (smsTargetAccount) while that
                                    // permission is genuinely granted - see
                                    // renderSmsTrackingCard above, which
                                    // drives the exact same state.
                                    const isAutoSynced = smsPermission === 'granted' && acc.name === smsTargetAccount;
                                    return (
                                    <div key={acc.id} className="finance-glass-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '14px', boxShadow: 'var(--premium-shadow)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>
                                                        {acc.type}
                                                    </span>
                                                    {isAutoSynced && (
                                                        <span title="Balance updates automatically from parsed SMS" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.12)', color: '#10B981', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                                            <RefreshCw size={10} /> Auto-synced
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '8px', overflowWrap: 'break-word' }}>{acc.name}</h4>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                <button onClick={() => openEditAccountModal(acc)} title="Edit Account" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', display: 'flex' }}><Pencil size={16} /></button>
                                                <button onClick={() => deleteAccount(acc.id)} title="Delete Account" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}><Trash2 size={16} /></button>
                                                <div style={{ padding: '8px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)' }}><Landmark size={16} /></div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '10px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: 0, overflowWrap: 'break-word' }}>{acc.institution}</span>
                                            <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', flexShrink: 0 }}>{settings.currencySymbol} {(acc.balance || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: isMobile ? '28px 20px' : '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                                <Wallet size={isMobile ? 30 : 40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>No accounts added</h3>
                                <p style={{ fontSize: '13px' }}>Add a bank account or wallet to start tracking finances.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: TRANSACTIONS */}
            {activeTab === 'Transactions' && (
                <div key="Transactions" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', animation: 'financeTabFade 0.25s ease' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                        <input
                            type="text" placeholder="Search transactions..." aria-label="Search transactions" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: isMobile ? '10px 12px 10px 44px' : '12px 12px 12px 44px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: isMobile ? 'border-box' : 'content-box' }}
                        />
                    </div>

                    {/* SMS Auto-Tracking - native Android only (see
                        utils/smsFinanceBridge.js). Absent entirely in a
                        browser tab, where the underlying plugin genuinely
                        doesn't exist, same pattern as Calendar Hub's
                        device-calendar bridge card. Desktop only here -
                        mobile shows this same card up in the Dashboard tab
                        instead (see renderSmsTrackingCard below), matching
                        the requested top/middle/bottom mobile hierarchy. */}
                    {isSmsFinanceBridgeAvailable() && !isMobile && renderSmsTrackingCard()}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '10px' }}>
                        {filteredTransactions.length > 0 ? filteredTransactions.map(tx => {
                            const CategoryIcon = getCategoryIcon(tx.category);
                            return (
                            <div key={tx.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderLeft: `3px solid ${tx.type === 'Income' ? '#10B981' : getCategoryBarColor(tx.category)}`, borderRadius: '14px', padding: isMobile ? '14px' : '16px 20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '12px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                                    <div style={{ padding: '10px', background: tx.type === 'Income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '11px', color: tx.type === 'Income' ? '#10B981' : '#EF4444', flexShrink: 0, display: 'flex' }}>
                                        <CategoryIcon size={18} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>{tx.title}</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={11} /> {tx.date}</span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Tag size={11} /> {tx.category}</span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Landmark size={11} /> {tx.account}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '16px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '16px', fontWeight: '800', color: tx.type === 'Income' ? '#10B981' : '#EF4444', whiteSpace: 'nowrap' }}>
                                        {tx.type === 'Income' ? '+' : '-'}{settings.currencySymbol} {(tx.amount || 0).toLocaleString()}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                        <button onClick={() => openEditTxModal(tx)} aria-label={`Edit ${tx.title}`} title="Edit Transaction" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><Pencil size={15} /></button>
                                        <button onClick={() => deleteTransaction(tx.id)} aria-label={`Delete ${tx.title}`} title="Delete Transaction" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><Trash2 size={15} /></button>
                                    </div>
                                </div>
                            </div>
                            );
                        }) : (
                            <div style={{ padding: isMobile ? '28px 20px' : '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                                <DollarSign size={isMobile ? 30 : 40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                    {transactions.length === 0 ? 'No transactions yet' : 'No transactions found'}
                                </h3>
                                {transactions.length === 0 ? (
                                    <>
                                        <p style={{ fontSize: '13px', margin: '0 0 14px 0' }}>Add your first transaction or enable SMS Auto-Tracking to get started.</p>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {isSmsFinanceBridgeAvailable() && smsPermission !== 'granted' && (
                                                <button type="button" onClick={handleEnableSmsTracking} style={emptyStateCtaStyle}><Smartphone size={13} /> Enable SMS Tracking</button>
                                            )}
                                            <button type="button" onClick={openAddTransactionModal} style={emptyStateCtaStyle}><Plus size={13} /> Add First Transaction</button>
                                        </div>
                                    </>
                                ) : (
                                    <p style={{ fontSize: '13px', margin: 0 }}>Try a different search term.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: SAVINGS GOALS & BILLS */}
            {activeTab === 'GoalsBills' && (
                <div key="GoalsBills" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '24px', animation: 'financeTabFade 0.25s ease' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Target size={20} />
                            <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Savings Goals</h3>
                        </div>

                        {savingsGoals.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: isMobile ? '10px' : '16px' }}>
                                {savingsGoals.map(goal => {
                                    const goalCurrent = goal.current || 0;
                                    const goalTarget = goal.target || 0;
                                    const progress = goalTarget > 0 ? Math.min(100, Math.round((goalCurrent / goalTarget) * 100)) : 0;
                                    return (
                                        <div key={goal.id} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '14px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                                <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'break-word' }}>{goal.title}</h4>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>{progress}%</span>
                                                    <button onClick={() => openEditGoalModal(goal)} title="Edit Goal" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}><Pencil size={14} /></button>
                                                    <button onClick={() => deleteGoal(goal.id)} title="Delete Goal" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                            <div style={{ width: '100%', height: '8px', background: 'var(--surface-inset)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }}></div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                <span>Saved: {settings.currencySymbol} {goalCurrent.toLocaleString()}</span>
                                                <span>Target: {settings.currencySymbol} {goalTarget.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No savings goals created.</div>}
                    </div>

                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: isMobile ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Calendar size={20} />
                            <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Upcoming Bills</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {bills.length > 0 ? bills.map(bill => (
                                <div key={bill.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '14px' : '0', background: bill.paid ? 'rgba(16, 185, 129, 0.05)' : 'var(--widget-bg)', padding: isMobile ? '14px 16px' : '16px 20px', borderRadius: '14px', border: '1px solid var(--border-premium)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                                        <div onClick={() => toggleBillPaid(bill.id)} style={{ cursor: 'pointer', color: bill.paid ? '#10B981' : 'var(--text-muted)', flexShrink: 0 }}>
                                            {bill.paid ? <CheckCircle size={24} /> : <div style={{ width: '24px', height: '24px', border: '2px solid var(--text-muted)', borderRadius: '50%' }}></div>}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>{bill.title}</h4>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}><Clock size={12} style={{ display: 'inline', marginRight: '3px' }} />Due: {bill.dueDate}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '16px' }}>
                                        <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{settings.currencySymbol} {(bill.amount || 0).toLocaleString()}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                            <button onClick={() => openEditBillModal(bill)} title="Edit Bill" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><Pencil size={16} /></button>
                                            <button onClick={() => deleteBill(bill.id)} title="Delete Bill" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            )) : <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No upcoming bills.</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: AI COACH & ANALYTICS */}
            {activeTab === 'Analytics' && (
                <div key="Analytics" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '24px', animation: 'financeTabFade 0.25s ease' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: isMobile ? '16px' : '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Sparkles size={20} />
                            <h3 style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Finance Coach Briefing</h3>
                        </div>
                        <p style={{ fontSize: isMobile ? '13px' : '14px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--widget-bg)', padding: isMobile ? '12px' : '16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            {generateFinanceBriefing()}
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: isMobile ? '10px' : '20px' }}>
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: isMobile ? '14px' : '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700', fontSize: isMobile ? '12px' : '14px' }}>
                                <TrendingUp size={16} color="var(--primary)" /> {isMobile ? 'Net Worth' : 'Estimated Net Worth'}
                            </div>
                            <h2 style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: '800', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>{settings.currencySymbol} {estimatedNetWorth.toLocaleString()}</h2>
                            {!isMobile && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Calculated from liquid balances + savings goals.</span>}
                        </div>

                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: isMobile ? '14px' : '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '8px' : '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700', fontSize: isMobile ? '12px' : '14px' }}>
                                <ShieldCheck size={16} color="#10B981" /> {isMobile ? 'Health Score' : 'Financial Health Score'}
                            </div>
                            {hasHealthScoreData ? (
                                <>
                                    <h2 style={{ fontSize: isMobile ? '18px' : '28px', fontWeight: '800', color: '#10B981' }}>{financialHealthScore} / 100</h2>
                                    {!isMobile && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status: {financialHealthScore >= 70 ? 'Excellent savings & budget discipline.' : financialHealthScore >= 40 ? 'Fair - room to build savings or reduce spending.' : 'High spending alert.'}</span>}
                                </>
                            ) : (
                                <>
                                    <h2 style={{ fontSize: isMobile ? '15px' : '20px', fontWeight: '700', color: 'var(--text-muted)' }}>Not enough data</h2>
                                    <span style={{ fontSize: isMobile ? '11px' : '12px', color: 'var(--text-muted)' }}>Set a monthly budget or add a savings goal to calculate this.</span>
                                </>
                            )}
                        </div>
                    </div>
                    {/* AI coaching is paused on mobile for this pass - desktop is unaffected. */}
                    {!isMobile && (
                        <AIQueryBox
                            context={{ financeProfile: profile, transactions, financeAccounts: accounts }} persona="finance"
                            title="Ask the AI Finance Coach"
                            placeholder="Ask about your budget, accounts, or spending..."
                        />
                    )}
                </div>
            )}

            {/* MODALS */}
            
            {/* Edit Profile Modal */}
            {isEditingProfile && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Edit Financial Profile</h2>
                        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label htmlFor="financeCurrencySymbol" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Currency Symbol</label>
                                <input id="financeCurrencySymbol" name="currencySymbol" type="text" required maxLength={3} value={tempCurrencySymbol} onChange={(e) => setTempCurrencySymbol(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="financeMonthlyIncome" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Monthly Income</label>
                                    <input id="financeMonthlyIncome" name="monthlyIncome" type="number" required value={tempProfile.monthlyIncome} onChange={(e) => setTempProfile({...tempProfile, monthlyIncome: sanitizeNumberInput(e.target.value, tempProfile.monthlyIncome)})} onBlur={(e) => setTempProfile({...tempProfile, monthlyIncome: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="financeMonthlyBudgetLimit" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Monthly Budget Limit</label>
                                    <input id="financeMonthlyBudgetLimit" name="monthlyBudgetLimit" type="number" required value={tempMonthlyBudget} onChange={(e) => setTempMonthlyBudget(sanitizeNumberInput(e.target.value, tempMonthlyBudget))} onBlur={(e) => setTempMonthlyBudget(normalizeNumberOnBlur(e.target.value, true))} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="financeMonthlySavingsGoal" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Monthly Savings Goal</label>
                                    <input id="financeMonthlySavingsGoal" name="monthlySavingsGoal" type="number" value={tempProfile.monthlySavingsGoal} onChange={(e) => setTempProfile({...tempProfile, monthlySavingsGoal: sanitizeNumberInput(e.target.value, tempProfile.monthlySavingsGoal)})} onBlur={(e) => setTempProfile({...tempProfile, monthlySavingsGoal: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label htmlFor="financeEmergencyFund" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Emergency Fund</label>
                                    <input id="financeEmergencyFund" name="emergencyFund" type="number" value={tempProfile.emergencyFund} onChange={(e) => setTempProfile({...tempProfile, emergencyFund: sanitizeNumberInput(e.target.value, tempProfile.emergencyFund)})} onBlur={(e) => setTempProfile({...tempProfile, emergencyFund: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setIsEditingProfile(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Account Modal */}
            {isAddAccountModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingAccountId !== null ? 'Edit Account or Wallet' : 'Add Account or Wallet'}</h2>
                        <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Account Name (e.g. ICICI)" aria-label="Account name" value={newAccount.name} onChange={(e) => setNewAccount({...newAccount, name: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <select aria-label="Account type" value={newAccount.type} onChange={(e) => setNewAccount({...newAccount, type: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                <option value="Savings Account" style={{ background: 'var(--surface-inset)' }}>Savings Account</option>
                                <option value="Current Account" style={{ background: 'var(--surface-inset)' }}>Current Account</option>
                                <option value="Cash" style={{ background: 'var(--surface-inset)' }}>Cash</option>
                                <option value="Digital Wallet" style={{ background: 'var(--surface-inset)' }}>Digital Wallet</option>
                                <option value="Credit Card" style={{ background: 'var(--surface-inset)' }}>Credit Card</option>
                            </select>
                            <input type="number" required placeholder="Initial Balance" aria-label="Initial balance" value={newAccount.balance} onChange={(e) => setNewAccount({...newAccount, balance: sanitizeNumberInput(e.target.value, newAccount.balance)})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeAccountModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>{editingAccountId !== null ? 'Save Changes' : 'Save Account'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Statement Import Modal - the real, already-built parser + review UI */}
            {isStatementImportOpen && (
                <StatementImportModal
                    onClose={() => setIsStatementImportOpen(false)}
                    accounts={accounts}
                    onImport={handleStatementImport}
                />
            )}

            {/* Add Transaction Modal */}
            {isAddTxModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                        background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%',
                        transform: `translateY(${addTxTranslateY}px)`, transition: addTxIsDragging ? 'none' : 'transform 0.25s ease',
                    }}>
                        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-premium)', margin: '-16px auto 12px' }} />
                        <div {...addTxSwipeHandlers} style={{ cursor: 'grab', touchAction: 'none' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingTxId !== null ? 'Edit Transaction' : 'Add Transaction'}</h2>
                        </div>
                        <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Title (e.g. Groceries)" aria-label="Transaction title" value={newTx.title} onChange={(e) => setNewTx({...newTx, title: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                                <select aria-label="Transaction type" value={newTx.type} onChange={(e) => setNewTx({...newTx, type: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    <option value="Expense" style={{ background: 'var(--surface-inset)' }}>Expense</option><option value="Income" style={{ background: 'var(--surface-inset)' }}>Income</option>
                                </select>
                                <input type="number" required placeholder="Amount" aria-label="Transaction amount" value={newTx.amount} onChange={(e) => setNewTx({...newTx, amount: sanitizeNumberInput(e.target.value, newTx.amount)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                                <select aria-label="Transaction category" value={newTx.category} onChange={(e) => setNewTx({...newTx, category: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    <option value="Food" style={{ background: 'var(--surface-inset)' }}>Food</option><option value="Shopping" style={{ background: 'var(--surface-inset)' }}>Shopping</option><option value="Salary" style={{ background: 'var(--surface-inset)' }}>Salary</option><option value="Others" style={{ background: 'var(--surface-inset)' }}>Others</option>
                                </select>
                                <select required aria-label="Account" value={newTx.account} onChange={(e) => setNewTx({...newTx, account: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    {accounts.map(a => <option key={a.id} value={a.name} style={{ background: 'var(--surface-inset)' }}>{a.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeTxModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>{editingTxId !== null ? 'Save Changes' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Goal Modal */}
            {isAddGoalModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingGoalId !== null ? 'Edit Savings Goal' : 'Add Savings Goal'}</h2>
                        <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Goal Title" aria-label="Goal title" value={newGoal.title} onChange={(e) => setNewGoal({...newGoal, title: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                                <input type="number" required placeholder="Target Amount" aria-label="Target amount" value={newGoal.target} onChange={(e) => setNewGoal({...newGoal, target: sanitizeNumberInput(e.target.value, newGoal.target)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                                <input type="number" placeholder="Current Saved" aria-label="Current saved amount" value={newGoal.current} onChange={(e) => setNewGoal({...newGoal, current: sanitizeNumberInput(e.target.value, newGoal.current)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            </div>
                            <div>
                                <label htmlFor="financeGoalDeadline" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Target Deadline</label>
                                <input id="financeGoalDeadline" name="goalDeadline" type="date" required value={newGoal.deadline} onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeGoalModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>{editingGoalId !== null ? 'Save Changes' : 'Save Goal'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Bill Modal */}
            {isAddBillModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>{editingBillId !== null ? 'Edit Bill / Subscription' : 'Add Bill / Subscription'}</h2>
                        <form onSubmit={handleAddBill} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Bill Title" aria-label="Bill title" value={newBill.title} onChange={(e) => setNewBill({...newBill, title: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <input type="number" required placeholder="Amount" aria-label="Bill amount" value={newBill.amount} onChange={(e) => setNewBill({...newBill, amount: sanitizeNumberInput(e.target.value, newBill.amount)})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div>
                                <label htmlFor="financeBillDueDate" style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Due Date</label>
                                <input id="financeBillDueDate" name="billDueDate" type="date" required value={newBill.dueDate} onChange={(e) => setNewBill({...newBill, dueDate: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={closeBillModal} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>{editingBillId !== null ? 'Save Changes' : 'Save Bill'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {financeToast && (
                <div style={{
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 230000,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px',
                    padding: '12px 20px', boxShadow: 'var(--premium-shadow)', color: 'var(--text-primary)',
                    fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <Wallet size={15} color="var(--accent)" />
                    {financeToast}
                </div>
            )}
        </div>
    );
};

export default FinancePage;