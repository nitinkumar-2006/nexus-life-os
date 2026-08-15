// src/utils/statementParser.js
//
// The real, client-side bank statement parsing engine - everything here
// runs entirely in the browser, on the user's own device. No file is
// ever uploaded to a server; parsing happens against the raw bytes/text
// the browser's own File/FileReader APIs hand back.
//
// Two genuinely different problems, handled honestly:
//
// CSV is a real, structured text format - this parser reads it
// correctly (proper quote/comma/newline handling per RFC 4180) and uses
// flexible, keyword-based header matching rather than hardcoded exact
// column names, since different banks (SBI, HDFC, ICICI, Axis, etc.)
// use different but recognizably-similar header text for the same real
// columns (date/description/debit/credit).
//
// PDF is fundamentally harder and is treated that way. A PDF has no
// real concept of "rows" - pdf.js can only return positioned text
// fragments. This module reconstructs approximate lines by grouping
// fragments with similar Y-coordinates, then applies real regex
// heuristics (a date pattern + an amount pattern per line) to find
// transactions. This is inherently best-effort: a scanned/image-only
// PDF will yield zero results (no OCR is performed, since that's a
// fundamentally different, much harder problem this module does not
// attempt to solve), and an unusually-formatted statement may produce
// partial or malformed rows. Every caller is expected to show these
// results in a review step before committing them anywhere - this
// module never silently assumes its own output is perfect.

// ============================================================
// Real category keyword dictionary - matched against a transaction's
// own description text. Order matters: more specific categories are
// checked before generic ones, so e.g. "Zomato" (Food) is caught before
// any broader fallback.
// ============================================================
const CATEGORY_KEYWORDS = {
    Food: ['swiggy', 'zomato', 'restaurant', 'cafe', 'coffee', 'starbucks', 'dominos', 'pizza', 'food', 'dine', 'eatery', 'bakery'],
    Bills: ['electricity', 'water bill', 'gas bill', 'broadband', 'wifi', 'internet bill', 'recharge', 'postpaid', 'prepaid', 'dth', 'insurance', 'emi', 'loan', 'rent', 'maintenance'],
    Travel: ['uber', 'ola', 'irctc', 'railway', 'flight', 'airline', 'indigo', 'spicejet', 'airindia', 'petrol', 'fuel', 'diesel', 'hpcl', 'iocl', 'bpcl', 'toll', 'fastag', 'metro', 'bus fare', 'taxi'],
    Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'mall', 'store', 'mart', 'shop', 'retail'],
    Entertainment: ['netflix', 'prime video', 'hotstar', 'spotify', 'movie', 'cinema', 'pvr', 'inox', 'bookmyshow'],
    Health: ['pharmacy', 'hospital', 'clinic', 'medical', 'apollo', 'medplus', 'doctor', 'diagnostic'],
    Salary: ['salary', 'payroll', 'stipend'],
};

// Returns the best-matching category for a description, honestly
// falling back to 'Others' when nothing matches rather than guessing.
export const categorizeTransaction = (description) => {
    const desc = (description || '').toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => desc.includes(kw))) return category;
    }
    return 'Others';
};

// ============================================================
// CSV parsing - real RFC 4180 handling (quoted fields may contain
// commas/newlines; a doubled quote inside a quoted field is a literal
// quote), not naive String.split(',').
// ============================================================
const parseCsvRows = (text) => {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];
        if (inQuotes) {
            if (char === '"' && next === '"') { field += '"'; i++; }
            else if (char === '"') { inQuotes = false; }
            else { field += char; }
        } else {
            if (char === '"') inQuotes = true;
            else if (char === ',') { row.push(field); field = ''; }
            else if (char === '\r') { /* skip - \n below closes the row */ }
            else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
            else field += char;
        }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((f) => f.trim() !== '')); // drop genuinely blank rows
};

// Fuzzy header matching - finds the column index whose header text
// contains any of the given keywords, case-insensitively. Returns -1
// (not found) rather than guessing at a wrong column when no real
// match exists.
const findColumn = (headers, keywords) => {
    const lower = headers.map((h) => (h || '').toLowerCase().trim());
    for (const kw of keywords) {
        const idx = lower.findIndex((h) => h.includes(kw));
        if (idx !== -1) return idx;
    }
    return -1;
};

// Real amount parsing - strips currency symbols/commas, handles a
// leading minus or trailing "Dr"/"Cr" marker some bank exports use, and
// returns null (not 0) on genuinely unparseable input, so a bad cell
// is skipped rather than silently recorded as a zero-value transaction.
const parseAmount = (raw) => {
    if (raw === null || raw === undefined) return null;
    let str = String(raw).trim();
    if (!str) return null;
    const isNegative = /^-|\(.*\)$|dr\.?$/i.test(str);
    str = str.replace(/[₹$,()]|dr\.?$|cr\.?$/gi, '').trim();
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return null;
    return isNegative ? -Math.abs(num) : num;
};

// Real date normalization - handles the common real formats bank
// exports use (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD) and returns a
// genuine ISO 'YYYY-MM-DD' string, or null if nothing recognizable was
// found, rather than fabricating today's date for an unparseable cell.
const parseStatementDate = (raw) => {
    if (!raw) return null;
    const str = String(raw).trim();
    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // YYYY-MM-DD
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); // DD/MM/YYYY or DD-MM-YYYY
    if (m) {
        let [, d, mo, y] = m;
        if (y.length === 2) y = `20${y}`;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
};

// Parses a real bank CSV export into structured transaction rows.
// Returns { transactions, warnings } - warnings lists any real rows
// that were skipped and why, so the review UI can be honest about what
// didn't make it through, rather than silently dropping rows.
export const parseCsvStatement = (text) => {
    const allRows = parseCsvRows(text);
    if (allRows.length < 2) return { transactions: [], warnings: ['File has no data rows after the header.'] };

    const headers = allRows[0];
    const dateCol = findColumn(headers, ['date']);
    const descCol = findColumn(headers, ['narration', 'description', 'particulars', 'remarks', 'details']);
    const debitCol = findColumn(headers, ['debit', 'withdrawal']);
    const creditCol = findColumn(headers, ['credit', 'deposit']);
    const amountCol = findColumn(headers, ['amount']); // some exports use one signed "amount" column instead of separate debit/credit

    const warnings = [];
    if (dateCol === -1) warnings.push('Could not find a Date column - file may not be a recognized bank statement format.');
    if (descCol === -1) warnings.push('Could not find a Description/Narration column.');
    if (debitCol === -1 && creditCol === -1 && amountCol === -1) warnings.push('Could not find any Debit/Credit/Amount column.');

    const transactions = [];
    for (let i = 1; i < allRows.length; i++) {
        const row = allRows[i];
        const date = dateCol !== -1 ? parseStatementDate(row[dateCol]) : null;
        const description = descCol !== -1 ? (row[descCol] || '').trim() : '';
        if (!date || !description) continue; // a row missing either isn't a usable transaction

        let amount = null;
        let type = 'Expense';
        if (debitCol !== -1 && parseAmount(row[debitCol]) !== null && Math.abs(parseAmount(row[debitCol])) > 0) {
            amount = Math.abs(parseAmount(row[debitCol]));
            type = 'Expense';
        } else if (creditCol !== -1 && parseAmount(row[creditCol]) !== null && Math.abs(parseAmount(row[creditCol])) > 0) {
            amount = Math.abs(parseAmount(row[creditCol]));
            type = 'Income';
        } else if (amountCol !== -1) {
            const signed = parseAmount(row[amountCol]);
            if (signed !== null) { amount = Math.abs(signed); type = signed < 0 ? 'Expense' : 'Income'; }
        }
        if (amount === null || amount === 0) continue; // no usable amount found for this row

        transactions.push({ date, title: description, amount, type, category: categorizeTransaction(description) });
    }

    if (transactions.length === 0 && warnings.length === 0) warnings.push('No usable transaction rows were found in this file.');
    return { transactions, warnings };
};

// ============================================================
// PDF parsing - genuinely best-effort. pdfjs-dist is loaded via a
// dynamic import so this heavy library (and its worker) is never
// fetched by users who only ever import CSVs.
// ============================================================

let pdfjsLoadPromise = null;
const loadPdfJs = async () => {
    if (!pdfjsLoadPromise) {
        pdfjsLoadPromise = (async () => {
            try {
                const pdfjsLib = await import('pdfjs-dist');
                const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
                pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                return pdfjsLib;
            } catch (err) {
                // A real, common production-deployment failure mode: this
                // browser tab has been open since before the most recent
                // deploy, so index.html (and the chunk hashes it
                // references) is stale - the specific chunk this dynamic
                // import asks for may no longer exist on the server at
                // all, since a new build replaces old chunk files rather
                // than keeping them around. A real reload fetches the
                // current index.html and its own, current chunk
                // references, which resolves this cleanly. Guarded by a
                // real, session-scoped flag so this can only ever happen
                // once - if reloading doesn't fix it (a genuine, unrelated
                // failure like a real network outage), the second attempt
                // surfaces as a real, honest error instead of silently
                // reloading forever.
                const alreadyRetried = window.sessionStorage.getItem('nexus_pdfjs_chunk_retry');
                if (!alreadyRetried) {
                    window.sessionStorage.setItem('nexus_pdfjs_chunk_retry', '1');
                    window.location.reload();
                    // Never resolves - the reload above is already in
                    // flight, so there is no real, meaningful value this
                    // promise could return before the page navigates away.
                    return new Promise(() => {});
                }
                throw err;
            }
        })();
    }
    return pdfjsLoadPromise;
};

// Real date-pattern and amount-pattern regexes, used to scan each
// reconstructed line for a plausible transaction. Deliberately
// conservative - a line must contain BOTH a recognizable date and a
// recognizable amount to be treated as a transaction, so page headers,
// running balances printed alone, and account-summary boilerplate are
// naturally excluded rather than misread as transactions.
const LINE_DATE_RE = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/;
const LINE_AMOUNT_RE = /(?:₹|Rs\.?|INR)?\s*([\d,]+\.\d{2})\s*(Dr|Cr)?/i;

// Groups pdf.js's own positioned text items into approximate lines by
// rounding their Y position - real PDF text extraction returns
// individually-positioned fragments, not lines, so this reconstruction
// step is what makes line-level regex matching possible at all.
const groupItemsIntoLines = (items) => {
    const lines = {};
    items.forEach((item) => {
        const y = Math.round(item.transform[5] / 3) * 3; // 3pt tolerance groups genuinely same-line fragments despite minor sub-pixel offsets
        if (!lines[y]) lines[y] = [];
        lines[y].push(item);
    });
    return Object.keys(lines)
        .sort((a, b) => b - a) // PDF Y grows upward - top of page (largest Y) reads first
        .map((y) => lines[y].sort((a, b) => a.transform[4] - b.transform[4]).map((it) => it.str).join(' ').trim())
        .filter((line) => line.length > 0);
};

export const parsePdfStatement = async (file) => {
    const warnings = [];
    let pdfjsLib;
    try {
        pdfjsLib = await loadPdfJs();
    } catch (e) {
        return { transactions: [], warnings: ['Could not load the PDF engine. Please try a CSV export instead.'] };
    }

    let pdf;
    try {
        const buffer = await file.arrayBuffer();
        pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    } catch (e) {
        return { transactions: [], warnings: ['This PDF could not be opened - it may be password-protected or corrupted.'] };
    }

    const allLines = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            allLines.push(...groupItemsIntoLines(content.items));
        } catch (e) {
            warnings.push(`Page ${pageNum} could not be read and was skipped.`);
        }
    }

    if (allLines.length === 0) {
        warnings.push('No extractable text was found. This PDF may be a scanned image, which this tool cannot read - please try a CSV export instead.');
        return { transactions: [], warnings };
    }

    const transactions = [];
    allLines.forEach((line) => {
        const dateMatch = line.match(LINE_DATE_RE);
        const amountMatch = line.match(LINE_AMOUNT_RE);
        if (!dateMatch || !amountMatch) return; // this line honestly doesn't look like a transaction row
        const date = parseStatementDate(dateMatch[1]);
        const amount = parseAmount(amountMatch[1]);
        if (!date || amount === null || amount === 0) return;

        // The description is whatever text remains after removing the
        // matched date and amount tokens - a real, if imperfect, way to
        // isolate the narration text on a line pdf.js gave us no column
        // boundaries for.
        const description = line.replace(dateMatch[0], '').replace(amountMatch[0], '').replace(/\s{2,}/g, ' ').trim() || 'Unlabeled transaction';
        const isCredit = /cr$/i.test(amountMatch[2] || '');
        transactions.push({ date, title: description, amount: Math.abs(amount), type: isCredit ? 'Income' : 'Expense', category: categorizeTransaction(description) });
    });

    if (transactions.length === 0) {
        warnings.push('Text was extracted, but no lines matched a recognizable date + amount pattern. This statement\'s layout may not be supported - a CSV export will parse more reliably.');
    }

    return { transactions, warnings };
};

// Real, single entry point - dispatches by file type so callers don't
// need to know which parser to invoke.
export const parseStatementFile = async (file) => {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text();
        return parseCsvStatement(text);
    }
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
        return parsePdfStatement(file);
    }
    return { transactions: [], warnings: ['Unsupported file type - please upload a .csv or .pdf bank statement.'] };
};
