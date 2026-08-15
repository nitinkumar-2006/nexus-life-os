// src/pages/FinancePage.jsx
import React, { useState, useEffect } from 'react';
import { Wallet, DollarSign, TrendingUp, CreditCard, Shield, User, Target, Plus, Calendar, ArrowUpRight, ArrowDownLeft, Landmark, Search, Tag, CheckCircle, Clock, Award, Sparkles, Cpu, ShieldCheck, Trash2, Download, FileText, Upload } from 'lucide-react';
import AIQueryBox from '../components/AIQueryBox.jsx';
import { exportFinanceReportCsv, exportFinanceReportText } from '../utils/reportExport.js';
import StatementImportModal from '../components/StatementImportModal.jsx';
import ExpenseDonutChart from '../components/ExpenseDonutChart.jsx';
import { toTitleCase } from '../utils/textFormat.js';
import { sanitizeNumberInput, normalizeNumberOnBlur } from '../utils/smartNumberInput.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss.js';

const FinancePage = () => {
    const isMobile = useIsMobile();
    const { settings, updateSetting } = useGlobalSettings();
    // 1. FIXED: Zeroed out Financial Profile
    const [profile, setProfile] = useState(() => {
        const saved = localStorage.getItem('nexus_finance_profile');
        const defaultProfile = { monthlyIncome: 0, monthlySavingsGoal: 0, currency: '₹', emergencyFund: 0 };
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

    const [activeTab, setActiveTab] = useState('Dashboard');
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isStatementImportOpen, setIsStatementImportOpen] = useState(false);
    // Real swipe-to-dismiss for the Add Transaction modal - a simple,
    // centered modal with no existing drag-to-move behavior, so a touch
    // swipe here genuinely, unambiguously reads as "dismiss" rather than
    // conflicting with a different gesture already living on the same
    // surface.
    const { swipeHandlers: addTxSwipeHandlers, translateY: addTxTranslateY, isDragging: addTxIsDragging } = useSwipeToDismiss(() => setIsAddTxModal(false));

    // Modals & Forms State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [tempProfile, setTempProfile] = useState(profile);
    const [tempMonthlyBudget, setTempMonthlyBudget] = useState(settings.monthlyBudgetCap || 0);
    
    const [isAddAccountModal, setIsAddAccountModal] = useState(false);
    const [newAccount, setNewAccount] = useState({ name: '', type: 'Savings Account', balance: '', institution: '' });
    
    const [isAddTxModal, setIsAddTxModal] = useState(false);
    const [newTx, setNewTx] = useState({ title: '', type: 'Expense', amount: '', category: 'Food', account: '' });
    
    const [isAddGoalModal, setIsAddGoalModal] = useState(false);
    const [newGoal, setNewGoal] = useState({ title: '', target: '', current: '', deadline: new Date().toISOString().split('T')[0] });
    
    const [isAddBillModal, setIsAddBillModal] = useState(false);
    const [newBill, setNewBill] = useState({ title: '', amount: '', dueDate: new Date().toISOString().split('T')[0] });
    
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

    const handleSaveProfile = (e) => { e.preventDefault(); setProfile(tempProfile); updateSetting('monthlyBudgetCap', tempMonthlyBudget); setIsEditingProfile(false); };

    const handleAddAccount = (e) => {
        e.preventDefault();
        if (!newAccount.name.trim()) return;
        const item = {
            id: Date.now().toString(),
            name: newAccount.name.trim(), type: newAccount.type,
            balance: parseFloat(newAccount.balance) || 0,
            institution: newAccount.institution.trim() || 'Bank'
        };
        setAccounts([item, ...accounts]);
        setIsAddAccountModal(false);
        setNewAccount({ name: '', type: 'Savings Account', balance: '', institution: '' });
    };

    const handleAddTransaction = (e) => {
        e.preventDefault();
        if (!newTx.title.trim() || !newTx.amount || !newTx.account) {
            setFinanceToast('Please fill title, amount, and select an account.');
            return;
        }
        
        const amountVal = parseFloat(newTx.amount) || 0;
        const txItem = {
            id: Date.now().toString(),
            title: toTitleCase(newTx.title.trim()), type: newTx.type, amount: amountVal,
            category: toTitleCase(newTx.category), account: newTx.account,
            date: new Date().toISOString().split('T')[0]
        };

        // Update Account Balance
        setAccounts(accounts.map(acc => {
            if (acc.name === newTx.account) {
                const updatedBalance = newTx.type === 'Income' ? acc.balance + amountVal : acc.balance - amountVal;
                return { ...acc, balance: updatedBalance };
            }
            return acc;
        }));

        setTransactions([txItem, ...transactions]);
        setIsAddTxModal(false);
        setNewTx({ title: '', type: 'Expense', amount: '', category: 'Food', account: accounts.length > 0 ? accounts[0].name : '' });
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

    const handleAddGoal = (e) => {
        e.preventDefault();
        if (!newGoal.title.trim() || !newGoal.target) return;
        const goalItem = {
            id: Date.now().toString(),
            title: toTitleCase(newGoal.title.trim()),
            target: parseFloat(newGoal.target) || 0,
            current: parseFloat(newGoal.current) || 0,
            deadline: newGoal.deadline
        };
        setSavingsGoals([goalItem, ...savingsGoals]);
        setIsAddGoalModal(false);
        setNewGoal({ title: '', target: '', current: '', deadline: new Date().toISOString().split('T')[0] });
    };

    const handleAddBill = (e) => {
        e.preventDefault();
        if (!newBill.title.trim() || !newBill.amount) return;
        const billItem = {
            id: Date.now().toString(),
            title: toTitleCase(newBill.title.trim()), amount: parseFloat(newBill.amount) || 0,
            dueDate: newBill.dueDate, paid: false
        };
        setBills([billItem, ...bills]);
        setIsAddBillModal(false);
        setNewBill({ title: '', amount: '', dueDate: new Date().toISOString().split('T')[0] });
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
        const parts = [`Your monthly budget utilization is currently at ${budgetProgress}%. You have ${profile.currency}${budgetRemaining.toLocaleString()} remaining for the rest of the month.`];

        if (savingsGoals.length > 0) {
            const avgProgress = Math.round(savingsGoals.reduce((acc, g) => acc + (g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0), 0) / savingsGoals.length);
            parts.push(avgProgress >= 70
                ? `Your savings goals are averaging ${avgProgress}% progress - great discipline, keep it up!`
                : `Your savings goals are averaging ${avgProgress}% progress - consider allocating more toward them this month.`);
        }

        const unpaidBills = bills.filter((b) => !b.paid);
        if (unpaidBills.length > 0) {
            const totalUnpaid = unpaidBills.reduce((acc, b) => acc + b.amount, 0);
            parts.push(`You have ${unpaidBills.length} unpaid bill${unpaidBills.length === 1 ? '' : 's'} totaling ${profile.currency}${totalUnpaid.toLocaleString()}.`);
        }

        return parts.join(' ');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease', position: 'relative' }}>
            
            {/* Header Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>Financial Command Center</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Manage accounts, track budget, savings goals, and AI financial insights.</p>
                </div>
                
                <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: '10px' }}>
                    {activeTab === 'Transactions' && (
                        <button 
                            onClick={() => {
                                if(accounts.length === 0) {
                                    setFinanceToast('Please create an Account/Wallet first before adding transactions.');
                                    return;
                                }
                                setNewTx(prev => ({...prev, account: accounts[0].name}));
                                setIsAddTxModal(true);
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '9px 14px' : '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer' }}
                        >
                            <Plus size={18} /> Add Transaction
                        </button>
                    )}
                    {activeTab === 'Transactions' && (
                        <button
                            onClick={() => setIsStatementImportOpen(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '9px 14px' : '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer' }}
                        >
                            <Upload size={18} /> Import Statement
                        </button>
                    )}
                    {activeTab === 'GoalsBills' && (
                        <>
                            <button onClick={() => setIsAddBillModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '9px 14px' : '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer' }}>
                                <Plus size={18} /> Add Bill
                            </button>
                            <button onClick={() => setIsAddGoalModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '9px 14px' : '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer' }}>
                                <Plus size={18} /> Add Savings Goal
                            </button>
                        </>
                    )}
                    {activeTab === 'Dashboard' && (
                        <button onClick={() => setIsAddAccountModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '9px 14px' : '10px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer' }}>
                            <Plus size={18} /> Add Account
                        </button>
                    )}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsExportMenuOpen((v) => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '9px 14px' : '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer' }}
                        >
                            <Download size={18} /> Export Report
                        </button>
                        {isExportMenuOpen && (
                            <>
                                <div onClick={() => setIsExportMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1199 }} />
                                <div style={{
                                    /* Right-anchored (the desktop value) can put this
                                       220px-wide menu's LEFT edge off-screen on mobile -
                                       this button-group wraps by tab (Add Transaction +
                                       Import Statement can push Export Report onto its
                                       own row starting near the left edge), and a
                                       right-anchored menu there hangs mostly off-screen.
                                       Left-anchoring on mobile keeps it on-screen in that
                                       case; matches the same fix already applied to the
                                       identical Export Report menu on StudyPage. */
                                    position: 'absolute', top: 'calc(100% + 8px)', right: isMobile ? 'auto' : 0, left: isMobile ? 0 : 'auto', width: '220px', zIndex: 1200,
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '4px',
                                }}>
                                    <button
                                        onClick={() => { exportFinanceReportText({ ...(profile || {}), monthlyBudget: settings.monthlyBudgetCap || 0 }, transactions || []); setIsExportMenuOpen(false); }}
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
                    <button onClick={() => { setTempProfile(profile); setIsEditingProfile(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '9px 14px' : '10px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: isMobile ? '13px' : '14px', cursor: 'pointer' }}>
                        <User size={18} /> Profile
                    </button>
                </div>
            </div>

            {/* Quick Metrics Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#10B981' }}><Wallet size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Available Balance</span>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{profile.currency} {totalBalance.toLocaleString()}</h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)' }}><Target size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Budget Remaining</span>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{profile.currency} {budgetRemaining.toLocaleString()} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {profile.currency}{(settings.monthlyBudgetCap || 0).toLocaleString()}</span></h2>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', background: 'var(--widget-bg)', borderRadius: '12px', color: '#EF4444' }}><ArrowDownLeft size={24} /></div>
                    <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Total Spent (Month)</span>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{profile.currency} {totalSpent.toLocaleString()}</h2>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '4px', overflowX: 'auto',
                maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
            }}>
                <button onClick={() => setActiveTab('Dashboard')} style={{ padding: '10px 16px', background: activeTab === 'Dashboard' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Dashboard' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Dashboard' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>
                    Overview & Accounts
                </button>
                <button onClick={() => setActiveTab('Transactions')} style={{ padding: '10px 16px', background: activeTab === 'Transactions' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Transactions' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Transactions' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>
                    Transactions ({transactions.length})
                </button>
                <button onClick={() => setActiveTab('GoalsBills')} style={{ padding: '10px 16px', background: activeTab === 'GoalsBills' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'GoalsBills' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'GoalsBills' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}>
                    Savings Goals & Bills
                </button>
                <button onClick={() => setActiveTab('Analytics')} style={{ padding: '10px 16px', background: activeTab === 'Analytics' ? 'var(--widget-bg)' : 'transparent', color: activeTab === 'Analytics' ? 'var(--primary)' : 'var(--text-secondary)', border: 'none', borderBottom: activeTab === 'Analytics' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={14} /> AI Coach & Analytics
                </button>
            </div>

            {/* TAB CONTENT: DASHBOARD */}
            {activeTab === 'Dashboard' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: 'var(--premium-shadow)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Monthly Budget Utilization</h3>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: budgetProgress > 85 ? '#EF4444' : 'var(--primary)' }}>{budgetProgress}% Spent</span>
                        </div>
                        <div style={{ width: '100%', height: '10px', background: 'var(--widget-bg)', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ width: `${budgetProgress}%`, height: '100%', background: budgetProgress > 85 ? '#EF4444' : 'var(--primary)', borderRadius: '5px', transition: 'width 0.4s ease' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                            <span>Spent: {profile.currency} {totalSpent.toLocaleString()}</span>
                            <span>Monthly Limit: {profile.currency} {(settings.monthlyBudgetCap || 0).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Expense Breakdown - a real, live bar chart derived
                        directly from the transactions state, so it
                        genuinely re-renders the moment a statement import
                        (or any other transaction change) updates that
                        state - no separate refresh/recompute step needed. */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Expense Breakdown by Category</h3>
                        {categoryBreakdown.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                No expenses recorded yet. Add a transaction or import a statement to see your real breakdown here.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <ExpenseDonutChart categoryBreakdown={categoryBreakdown} currency={profile.currency} totalSpent={totalSpent} colorForCategory={getCategoryBarColor} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {categoryBreakdown.map((row) => (
                                    <div key={row.category} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{row.category}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{profile.currency}{row.amount.toLocaleString()} · {row.pct}%</span>
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

                    <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>Accounts & Wallets</h3>
                        {accounts.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                                {accounts.map(acc => (
                                    <div key={acc.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--premium-shadow)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', background: 'var(--widget-bg)', color: 'var(--primary)', borderRadius: '6px', border: '1px solid var(--border-premium)' }}>
                                                    {acc.type}
                                                </span>
                                                <h4 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '8px', overflowWrap: 'break-word' }}>{acc.name}</h4>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                <button onClick={() => deleteAccount(acc.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}><Trash2 size={16} /></button>
                                                <div style={{ padding: '8px', background: 'var(--widget-bg)', borderRadius: '12px', color: 'var(--primary)' }}><Landmark size={18} /></div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '10px' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: 0, overflowWrap: 'break-word' }}>{acc.institution}</span>
                                            <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', flexShrink: 0 }}>{profile.currency} {(acc.balance || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                                <Wallet size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>No accounts added</h3>
                                <p style={{ fontSize: '13px' }}>Add a bank account or wallet to start tracking finances.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: TRANSACTIONS */}
            {activeTab === 'Transactions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={18} style={{ position: 'absolute', top: '14px', left: '14px', color: 'var(--text-muted)' }} />
                        <input 
                            type="text" placeholder="Search transactions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', padding: isMobile ? '10px 12px 10px 44px' : '12px 12px 12px 44px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: isMobile ? 'border-box' : 'content-box' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {filteredTransactions.length > 0 ? filteredTransactions.map(tx => (
                            <div key={tx.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: isMobile ? '14px' : '20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '14px' : '0', boxShadow: 'var(--premium-shadow)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                                    <div style={{ padding: '12px', background: tx.type === 'Income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: tx.type === 'Income' ? '#10B981' : '#EF4444', flexShrink: 0 }}>
                                        {tx.type === 'Income' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                        <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>{tx.title}</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            <span>📅 {tx.date}</span><span>•</span><span>🏷️ {tx.category}</span><span>•</span><span>🏦 {tx.account}</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-start', gap: '16px' }}>
                                    <span style={{ fontSize: '18px', fontWeight: '800', color: tx.type === 'Income' ? '#10B981' : '#EF4444' }}>
                                        {tx.type === 'Income' ? '+' : '-'}{profile.currency} {(tx.amount || 0).toLocaleString()}
                                    </span>
                                    <button onClick={() => deleteTransaction(tx.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16} /></button>
                                </div>
                            </div>
                        )) : (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)' }}>
                                <DollarSign size={40} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>No transactions found</h3>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: SAVINGS GOALS & BILLS */}
            {activeTab === 'GoalsBills' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Target size={22} />
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Savings Goals</h3>
                        </div>

                        {savingsGoals.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                {savingsGoals.map(goal => {
                                    const goalCurrent = goal.current || 0;
                                    const goalTarget = goal.target || 0;
                                    const progress = goalTarget > 0 ? Math.min(100, Math.round((goalCurrent / goalTarget) * 100)) : 0;
                                    return (
                                        <div key={goal.id} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                                <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'break-word' }}>{goal.title}</h4>
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>{progress}%</span>
                                                    <button onClick={() => deleteGoal(goal.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                            <div style={{ width: '100%', height: '8px', background: 'var(--surface-inset)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }}></div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                <span>Saved: {profile.currency} {goalCurrent.toLocaleString()}</span>
                                                <span>Target: {profile.currency} {goalTarget.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No savings goals created.</div>}
                    </div>

                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Calendar size={22} />
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>Upcoming Bills</h3>
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
                                        <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{profile.currency} {(bill.amount || 0).toLocaleString()}</span>
                                        <button onClick={() => deleteBill(bill.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            )) : <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No upcoming bills.</div>}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: AI COACH & ANALYTICS */}
            {activeTab === 'Analytics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                            <Sparkles size={22} />
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Finance Coach Briefing</h3>
                        </div>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--widget-bg)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            {generateFinanceBriefing()}
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700' }}>
                                <TrendingUp size={18} color="var(--primary)" /> Estimated Net Worth
                            </div>
                            <h2 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' }}>{profile.currency} {estimatedNetWorth.toLocaleString()}</h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Calculated from liquid balances + savings goals.</span>
                        </div>

                        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: '700' }}>
                                <ShieldCheck size={18} color="#10B981" /> Financial Health Score
                            </div>
                            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#10B981' }}>{financialHealthScore} / 100</h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status: {financialHealthScore >= 70 ? 'Excellent savings & budget discipline.' : financialHealthScore >= 40 ? 'Fair - room to build savings or reduce spending.' : 'High spending alert.'}</span>
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
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Edit Financial Profile</h2>
                        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Currency Symbol</label>
                                <input type="text" required maxLength={3} value={tempProfile.currency} onChange={(e) => setTempProfile({...tempProfile, currency: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Monthly Income</label>
                                    <input type="number" required value={tempProfile.monthlyIncome} onChange={(e) => setTempProfile({...tempProfile, monthlyIncome: sanitizeNumberInput(e.target.value, tempProfile.monthlyIncome)})} onBlur={(e) => setTempProfile({...tempProfile, monthlyIncome: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Monthly Budget Limit</label>
                                    <input type="number" required value={tempMonthlyBudget} onChange={(e) => setTempMonthlyBudget(sanitizeNumberInput(e.target.value, tempMonthlyBudget))} onBlur={(e) => setTempMonthlyBudget(normalizeNumberOnBlur(e.target.value, true))} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Monthly Savings Goal</label>
                                    <input type="number" value={tempProfile.monthlySavingsGoal} onChange={(e) => setTempProfile({...tempProfile, monthlySavingsGoal: sanitizeNumberInput(e.target.value, tempProfile.monthlySavingsGoal)})} onBlur={(e) => setTempProfile({...tempProfile, monthlySavingsGoal: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Emergency Fund</label>
                                    <input type="number" value={tempProfile.emergencyFund} onChange={(e) => setTempProfile({...tempProfile, emergencyFund: sanitizeNumberInput(e.target.value, tempProfile.emergencyFund)})} onBlur={(e) => setTempProfile({...tempProfile, emergencyFund: normalizeNumberOnBlur(e.target.value, true)})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
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
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Add Account or Wallet</h2>
                        <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Account Name (e.g. ICICI)" value={newAccount.name} onChange={(e) => setNewAccount({...newAccount, name: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <select value={newAccount.type} onChange={(e) => setNewAccount({...newAccount, type: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                <option value="Savings Account" style={{ background: 'var(--surface-inset)' }}>Savings Account</option>
                                <option value="Current Account" style={{ background: 'var(--surface-inset)' }}>Current Account</option>
                                <option value="Cash" style={{ background: 'var(--surface-inset)' }}>Cash</option>
                                <option value="Digital Wallet" style={{ background: 'var(--surface-inset)' }}>Digital Wallet</option>
                                <option value="Credit Card" style={{ background: 'var(--surface-inset)' }}>Credit Card</option>
                            </select>
                            <input type="number" required placeholder="Initial Balance" value={newAccount.balance} onChange={(e) => setNewAccount({...newAccount, balance: sanitizeNumberInput(e.target.value, newAccount.balance)})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setIsAddAccountModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>Save Account</button>
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
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                        background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%',
                        transform: `translateY(${addTxTranslateY}px)`, transition: addTxIsDragging ? 'none' : 'transform 0.25s ease',
                    }}>
                        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-premium)', margin: '-16px auto 12px' }} />
                        <div {...addTxSwipeHandlers} style={{ cursor: 'grab', touchAction: 'none' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Add Transaction</h2>
                        </div>
                        <form onSubmit={handleAddTransaction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Title (e.g. Groceries)" value={newTx.title} onChange={(e) => setNewTx({...newTx, title: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                                <select value={newTx.type} onChange={(e) => setNewTx({...newTx, type: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    <option value="Expense" style={{ background: 'var(--surface-inset)' }}>Expense</option><option value="Income" style={{ background: 'var(--surface-inset)' }}>Income</option>
                                </select>
                                <input type="number" required placeholder="Amount" value={newTx.amount} onChange={(e) => setNewTx({...newTx, amount: sanitizeNumberInput(e.target.value, newTx.amount)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                                <select value={newTx.category} onChange={(e) => setNewTx({...newTx, category: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    <option value="Food" style={{ background: 'var(--surface-inset)' }}>Food</option><option value="Shopping" style={{ background: 'var(--surface-inset)' }}>Shopping</option><option value="Salary" style={{ background: 'var(--surface-inset)' }}>Salary</option><option value="Others" style={{ background: 'var(--surface-inset)' }}>Others</option>
                                </select>
                                <select required value={newTx.account} onChange={(e) => setNewTx({...newTx, account: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }}>
                                    {accounts.map(a => <option key={a.id} value={a.name} style={{ background: 'var(--surface-inset)' }}>{a.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setIsAddTxModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Goal Modal */}
            {isAddGoalModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Add Savings Goal</h2>
                        <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Goal Title" value={newGoal.title} onChange={(e) => setNewGoal({...newGoal, title: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
                                <input type="number" required placeholder="Target Amount" value={newGoal.target} onChange={(e) => setNewGoal({...newGoal, target: sanitizeNumberInput(e.target.value, newGoal.target)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                                <input type="number" placeholder="Current Saved" value={newGoal.current} onChange={(e) => setNewGoal({...newGoal, current: sanitizeNumberInput(e.target.value, newGoal.current)})} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Target Deadline</label>
                                <input type="date" required value={newGoal.deadline} onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setIsAddGoalModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>Save Goal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Bill Modal */}
            {isAddBillModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '30px', width: '420px', maxWidth: '90%' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '20px' }}>Add Bill / Subscription</h2>
                        <form onSubmit={handleAddBill} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="text" required placeholder="Bill Title" value={newBill.title} onChange={(e) => setNewBill({...newBill, title: e.target.value})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <input type="number" required placeholder="Amount" value={newBill.amount} onChange={(e) => setNewBill({...newBill, amount: sanitizeNumberInput(e.target.value, newBill.amount)})} style={{ padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)' }} />
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '6px' }}>Due Date</label>
                                <input type="date" required value={newBill.dueDate} onChange={(e) => setNewBill({...newBill, dueDate: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" onClick={() => setIsAddBillModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '10px' }}>Cancel</button>
                                <button type="submit" style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>Save Bill</button>
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