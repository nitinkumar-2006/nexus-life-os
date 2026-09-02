// src/components/StatementImportModal.jsx
//
// The real statement upload + review UI. Deliberately never auto-
// commits parsed rows straight into the live transaction store - given
// PDF parsing is genuinely, inherently heuristic (see statementParser.js's
// own comments), silently importing everything it finds risks corrupting
// someone's real financial records with a misread row. Instead: parse ->
// show every row for review (editable type/category, per-row include/
// exclude) -> the user explicitly commits via "Import N Transactions".
// The data still ends up in the live store in one flow, just with a real
// human checkpoint in between, which is both more honest about what a
// heuristic parser can promise and better UX than either silence or a
// blind bulk write.
import { useState, useRef } from 'react';
import { Upload, FileText, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { parseStatementFile } from '../utils/statementParser.js';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss.js';

const CATEGORY_OPTIONS = ['Food', 'Shopping', 'Bills', 'Travel', 'Transport', 'Entertainment', 'Health', 'Salary', 'Others'];

const StatementImportModal = ({ onClose, accounts, onImport }) => {
    const [stage, setStage] = useState('upload'); // 'upload' | 'parsing' | 'review' | 'error'
    const [parsedRows, setParsedRows] = useState([]); // [{ ...transaction, id, included }]
    const [warnings, setWarnings] = useState([]);
    const [fileName, setFileName] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [targetAccount, setTargetAccount] = useState(accounts.length > 0 ? accounts[0].name : '');
    const fileInputRef = useRef(null);
    const { swipeHandlers, translateY, isDragging } = useSwipeToDismiss(onClose);

    const handleFile = async (file) => {
        if (!file) return;
        setFileName(file.name);
        setStage('parsing');
        try {
            const { transactions, warnings: w } = await parseStatementFile(file);
            setWarnings(w);
            setParsedRows(transactions.map((t, idx) => ({ ...t, id: `import_${idx}`, included: true })));
            setStage(transactions.length > 0 ? 'review' : 'error');
        } catch (e) {
            setWarnings(['An unexpected error occurred while reading this file.']);
            setParsedRows([]);
            setStage('error');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const updateRow = (id, patch) => setParsedRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const includedRows = parsedRows.filter((r) => r.included);
    const includedCount = includedRows.length;
    const allIncluded = parsedRows.length > 0 && includedCount === parsedRows.length;
    const toggleAll = () => setParsedRows((prev) => prev.map((r) => ({ ...r, included: !allIncluded })));

    const handleCommit = () => {
        if (includedCount === 0 || !targetAccount) return;
        onImport(includedRows, targetAccount);
        onClose();
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '28px', width: '720px', maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '18px',
                transform: `translateY(${translateY}px)`, transition: isDragging ? 'none' : 'transform 0.25s ease',
            }}>
                {/* Real drag-handle indicator - the standard native-sheet
                    visual cue that this surface can be swiped down to
                    dismiss, matched by the real swipeHandlers below. */}
                <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-premium)', margin: '-14px auto 0', flexShrink: 0 }} />
                <div {...swipeHandlers} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', touchAction: 'none' }}>
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Import Bank Statement</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Upload a CSV or PDF statement - everything is parsed locally in your browser, never uploaded anywhere.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                </div>

                {stage === 'upload' && (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border-premium)'}`, borderRadius: '16px', padding: '48px 24px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer',
                            background: isDragOver ? 'rgba(var(--primary-rgb), 0.06)' : 'var(--widget-bg)', transition: 'background 0.15s, border 0.15s',
                        }}
                    >
                        <Upload size={32} color="var(--primary)" />
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Drop a statement here, or click to browse</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Supports .csv and .pdf - SBI, HDFC, ICICI, Axis, and most other bank export formats</div>
                        <input
                            ref={fileInputRef} type="file" accept=".csv,.pdf,text/csv,application/pdf" aria-label="Upload statement file" style={{ display: 'none' }}
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                    </div>
                )}

                {stage === 'parsing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 24px' }}>
                        <FileText size={32} color="var(--primary)" style={{ animation: 'nexusPulseIcon 1.2s ease-in-out infinite' }} />
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Reading {fileName}...</div>
                        <style>{`@keyframes nexusPulseIcon { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }`}</style>
                    </div>
                )}

                {stage === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px' }}>
                            <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {warnings.map((w, i) => <span key={i} style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{w}</span>)}
                            </div>
                        </div>
                        <button onClick={() => { setStage('upload'); setFileName(''); }} style={{ padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>Try a Different File</button>
                    </div>
                )}

                {stage === 'review' && (
                    <>
                        {warnings.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '12px' }}>
                                <AlertTriangle size={15} color="#F59E0B" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {warnings.map((w, i) => <span key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{w}</span>)}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label htmlFor="statement-import-target-account" style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Import into account:</label>
                            <select id="statement-import-target-account" value={targetAccount} onChange={(e) => setTargetAccount(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', fontSize: '13px' }}>
                                {accounts.length === 0 && <option value="">No accounts - create one first</option>}
                                {accounts.map((acc) => <option key={acc.name} value={acc.name} style={{ background: 'var(--surface-inset)' }}>{acc.name}</option>)}
                            </select>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-premium)', borderRadius: '12px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--widget-bg)' }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '700' }}>
                                            <input type="checkbox" checked={allIncluded} onChange={toggleAll} title={allIncluded ? 'Deselect all' : 'Select all'} aria-label={allIncluded ? 'Deselect all' : 'Select all'} />
                                        </th>
                                        <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '700' }}>Date</th>
                                        <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '700' }}>Description</th>
                                        <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: '700' }}>Amount</th>
                                        <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '700' }}>Type</th>
                                        <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '700' }}>Category</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedRows.map((row) => (
                                        <tr key={row.id} style={{ borderTop: '1px solid var(--border-premium)', opacity: row.included ? 1 : 0.4 }}>
                                            <td style={{ padding: '8px 10px' }}>
                                                <input type="checkbox" checked={row.included} onChange={(e) => updateRow(row.id, { included: e.target.checked })} aria-label="Include this transaction" />
                                            </td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.date}</td>
                                            <td style={{ padding: '8px 10px', color: 'var(--text-primary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.title}>{row.title}</td>
                                            <td style={{ padding: '8px 10px', textAlign: 'right', color: row.type === 'Income' ? '#10B981' : 'var(--text-primary)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                {row.type === 'Income' ? '+' : '-'}{row.amount.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <select value={row.type} onChange={(e) => updateRow(row.id, { type: e.target.value })} aria-label="Transaction type" style={{ padding: '4px 6px', borderRadius: '6px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', fontSize: '11px' }}>
                                                    <option value="Expense" style={{ background: 'var(--surface-inset)' }}>Expense</option>
                                                    <option value="Income" style={{ background: 'var(--surface-inset)' }}>Income</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '8px 10px' }}>
                                                <select value={row.category} onChange={(e) => updateRow(row.id, { category: e.target.value })} aria-label="Transaction category" style={{ padding: '4px 6px', borderRadius: '6px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', fontSize: '11px' }}>
                                                    {CATEGORY_OPTIONS.map((c) => <option key={c} value={c} style={{ background: 'var(--surface-inset)' }}>{c}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>{includedCount} of {parsedRows.length} transactions selected</span>
                            <button onClick={() => { setStage('upload'); setFileName(''); setParsedRows([]); }} style={{ padding: '12px 18px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                                Start Over
                            </button>
                            <button
                                onClick={handleCommit} disabled={includedCount === 0 || !targetAccount}
                                style={{ padding: '12px 22px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: (includedCount === 0 || !targetAccount) ? 'default' : 'pointer', opacity: (includedCount === 0 || !targetAccount) ? 0.5 : 1, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <CheckCircle2 size={16} /> Import {includedCount} Transaction{includedCount === 1 ? '' : 's'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default StatementImportModal;
