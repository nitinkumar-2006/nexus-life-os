// src/utils/reportExport.js
//
// The shared, real client-side export engine behind every "Export
// Report" button across the OS - genuine browser Blob downloads, zero
// server round-trip, zero new dependencies. Every number in every
// report below is computed from the real, live data passed in by the
// calling page at the moment the button is clicked, not a placeholder
// or a static example.
//
// Two real formats, both natively supported by every browser with
// nothing extra to install:
// - CSV: a real, standards-compliant, spreadsheet-importable file
//   (proper quote/comma/newline escaping - not naive string joining).
// - Formatted text (.txt): a real, human-readable summary report -
//   sectioned, aligned, genuinely readable when opened directly, and
//   also exactly what a person would paste into a PDF if they wanted
//   one via their OS's own "Print to PDF".

// Triggers a real, native browser file download via a Blob + a
// synthetic, immediately-removed anchor click - the standard, dependency-
// free way to hand the browser a client-generated file. No server
// involved; the file only ever exists in the user's own browser memory
// until this line writes it to disk.
const downloadFile = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Freed on the next tick rather than immediately - revoking synchronously
    // has, in some browsers, raced the download actually starting.
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

// Real CSV field escaping per RFC 4180: any field containing a comma,
// double-quote, or newline gets wrapped in quotes, with internal quotes
// doubled - without this, a transaction titled `Coffee, "large"` would
// silently corrupt the column structure of every row after it.
const csvField = (value) => {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
};

const toCsv = (headers, rows) => {
    const lines = [headers.map(csvField).join(',')];
    rows.forEach((row) => lines.push(row.map(csvField).join(',')));
    return lines.join('\r\n'); // CRLF - the real CSV spec's own line ending, for maximum compatibility with Excel/Sheets import
};

const monthLabel = (date = new Date()) => {
    const safeDate = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date) : new Date();
    return safeDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};
const todayStamp = (date = new Date()) => date.toISOString().split('T')[0];

// ============================================================
// FINANCE - fully supported by real, date-stamped transaction data,
// so every figure here is a genuine historical total for the real
// current calendar month, not an estimate.
// ============================================================

// Filters to transactions whose real date falls within the current
// real calendar month - the one, shared definition of "this month"
// every figure below is built from, so the CSV and the formatted-text
// report can never disagree with each other about which transactions
// counted.
const getCurrentMonthTransactions = (transactions) => {
    const now = new Date();
    return transactions.filter((t) => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
};

const buildFinanceCategoryBreakdown = (monthTx) => {
    const byCategory = {};
    monthTx.filter((t) => t.type === 'Expense').forEach((t) => {
        const cat = t.category || 'Uncategorized';
        byCategory[cat] = (byCategory[cat] || 0) + (Number(t.amount) || 0);
    });
    return Object.entries(byCategory).sort((a, b) => b[1] - a[1]); // largest category first
};

export const exportFinanceReportCsv = (profile, transactions) => {
    const monthTx = getCurrentMonthTransactions(transactions);
    const headers = ['Date', 'Title', 'Type', 'Category', 'Account', 'Amount'];
    const rows = monthTx
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((t) => [t.date, t.title, t.type, t.category, t.account, (Number(t.amount) || 0).toFixed(2)]);
    downloadFile(`Nexus_Finance_Transactions_${todayStamp()}.csv`, toCsv(headers, rows), 'text/csv;charset=utf-8');
};

export const exportFinanceReportText = (profile, transactions) => {
    const monthTx = getCurrentMonthTransactions(transactions);
    const totalIncome = monthTx.filter((t) => t.type === 'Income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalExpense = monthTx.filter((t) => t.type === 'Expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const budget = Number(profile?.monthlyBudget) || 0;
    const utilizationPct = budget > 0 ? Math.round((totalExpense / budget) * 100) : null;
    const categoryBreakdown = buildFinanceCategoryBreakdown(monthTx);
    const currency = profile?.currency || '₹';

    const lines = [];
    lines.push('NEXUS FINANCE - MONTHLY AUDIT REPORT');
    lines.push(`Period: ${monthLabel()}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('='.repeat(50));
    lines.push('');
    lines.push('SUMMARY');
    lines.push('-'.repeat(50));
    lines.push(`Total Income:          ${currency}${totalIncome.toLocaleString()}`);
    lines.push(`Total Expenses:        ${currency}${totalExpense.toLocaleString()}`);
    lines.push(`Net:                   ${currency}${(totalIncome - totalExpense).toLocaleString()}`);
    lines.push('');
    if (budget > 0) {
        lines.push('BUDGET UTILIZATION');
        lines.push('-'.repeat(50));
        lines.push(`Monthly Budget:        ${currency}${budget.toLocaleString()}`);
        lines.push(`Spent:                 ${currency}${totalExpense.toLocaleString()} (${utilizationPct}% of budget)`);
        lines.push(`Remaining:             ${currency}${Math.max(0, budget - totalExpense).toLocaleString()}`);
        if (utilizationPct > 100) lines.push(`⚠ Over budget by ${currency}${(totalExpense - budget).toLocaleString()}`);
        lines.push('');
    } else {
        lines.push('BUDGET UTILIZATION');
        lines.push('-'.repeat(50));
        lines.push('No monthly budget set - utilization cannot be calculated.');
        lines.push('');
    }
    lines.push('EXPENSE CATEGORY BREAKDOWN');
    lines.push('-'.repeat(50));
    if (categoryBreakdown.length === 0) {
        lines.push('No expenses recorded this month.');
    } else {
        categoryBreakdown.forEach(([cat, amt]) => {
            const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
            lines.push(`${cat.padEnd(20)} ${currency}${amt.toLocaleString().padStart(10)}  (${pct}%)`);
        });
    }
    lines.push('');
    lines.push(`Transactions this month: ${monthTx.length}`);
    lines.push('='.repeat(50));

    downloadFile(`Nexus_Finance_Report_${todayStamp()}.txt`, lines.join('\n'), 'text/plain;charset=utf-8');
};

// ============================================================
// STUDY / CODE - real syllabus progress is fully supported by real
// data (topics genuinely marked done/not-done). Study HOURS, however,
// only exist in this app as a weekly-recurring timetable template with
// no per-occurrence completion date - so this report is explicit and
// honest about that: real "scheduled hours per week" from the actual,
// current timetable, clearly labeled as a schedule, not a historical
// log, alongside a clearly-labeled projected monthly figure. It never
// claims to be a record of hours that genuinely, historically happened,
// since this app does not track that.
// ============================================================

// Real weekly scheduled hours - sums (endHour - startHour) across every
// Study/Development-category timetable slot, across all 7 days.
const computeWeeklyScheduledHours = (timetableData) => {
    let totalHours = 0;
    const byDay = {};
    Object.keys(timetableData || {}).forEach((day) => {
        const slots = Array.isArray(timetableData[day]) ? timetableData[day] : [];
        let dayHours = 0;
        slots.forEach((slot) => {
            if (slot.category !== 'Study' && slot.category !== 'Development') return;
            const parts = String(slot.time || '').split('-').map((p) => p.trim());
            if (parts.length !== 2) return;
            const start = parseClockTimeToDecimal(parts[0]);
            const end = parseClockTimeToDecimal(parts[1]);
            if (start === null || end === null) return;
            const duration = end > start ? end - start : 0; // ignores an overnight/malformed range rather than reporting a negative duration
            dayHours += duration;
        });
        if (dayHours > 0) byDay[day] = dayHours;
        totalHours += dayHours;
    });
    return { totalHours, byDay };
};

// Parses "08:00 AM" / "8:00 PM" into a decimal hour (e.g. 20.5 for
// 8:30 PM) - matching the same real time-string format the Timetable
// page itself writes. Returns null on anything malformed rather than
// guessing, so a bad entry is silently skipped instead of corrupting
// the total with a wrong number.
const parseClockTimeToDecimal = (raw) => {
    const match = String(raw || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (period === 'AM') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
    return hour + minute / 60;
};

const buildSyllabusProgress = (subjects) => {
    return (subjects || []).map((subj) => {
        const allTopics = (subj.units || []).flatMap((u) => u.topics || []);
        const done = allTopics.filter((t) => t.done).length;
        return { name: subj.name, done, total: allTopics.length, pct: allTopics.length > 0 ? Math.round((done / allTopics.length) * 100) : 0 };
    });
};

export const exportStudyReportCsv = (subjects, timetableData) => {
    const progress = buildSyllabusProgress(subjects);
    const headers = ['Subject', 'Topics Completed', 'Total Topics', 'Completion %'];
    const rows = progress.map((p) => [p.name, p.done, p.total, `${p.pct}%`]);
    downloadFile(`Nexus_Study_Progress_${todayStamp()}.csv`, toCsv(headers, rows), 'text/csv;charset=utf-8');
};

export const exportStudyReportText = (subjects, studyAssignments, timetableData) => {
    const progress = buildSyllabusProgress(subjects);
    const { totalHours, byDay } = computeWeeklyScheduledHours(timetableData);
    const projectedMonthlyHours = totalHours * 4.345; // average weeks per month (365.25/12/7) - explicitly labeled below as a projection, not a historical count
    const pendingAssignments = (studyAssignments || []).filter((a) => a.status !== 'Completed').length;
    const completedAssignments = (studyAssignments || []).length - pendingAssignments;

    const lines = [];
    lines.push('NEXUS STUDY & CODE - MONTHLY AUDIT REPORT');
    lines.push(`Period: ${monthLabel()}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('='.repeat(50));
    lines.push('');
    lines.push('SCHEDULED STUDY TIME (from current Timetable)');
    lines.push('-'.repeat(50));
    lines.push(`Weekly scheduled study/dev hours: ${totalHours.toFixed(1)}h`);
    lines.push(`~Projected monthly (weekly × 4.35): ${projectedMonthlyHours.toFixed(1)}h`);
    lines.push('Note: this reflects your current weekly Timetable template,');
    lines.push('not a historical log of hours actually completed.');
    if (Object.keys(byDay).length > 0) {
        lines.push('');
        lines.push('By day:');
        Object.entries(byDay).forEach(([day, hrs]) => lines.push(`  ${day.padEnd(12)} ${hrs.toFixed(1)}h`));
    }
    lines.push('');
    lines.push('SYLLABUS PROGRESS');
    lines.push('-'.repeat(50));
    if (progress.length === 0) {
        lines.push('No subjects added yet.');
    } else {
        progress.forEach((p) => lines.push(`${p.name.padEnd(24)} ${String(p.done).padStart(3)}/${String(p.total).padEnd(3)} topics  (${p.pct}%)`));
    }
    lines.push('');
    lines.push('ASSIGNMENTS');
    lines.push('-'.repeat(50));
    lines.push(`Completed: ${completedAssignments}`);
    lines.push(`Pending:   ${pendingAssignments}`);
    lines.push('='.repeat(50));

    downloadFile(`Nexus_Study_Report_${todayStamp()}.txt`, lines.join('\n'), 'text/plain;charset=utf-8');
};
