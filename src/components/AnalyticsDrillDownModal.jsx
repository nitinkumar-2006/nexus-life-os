// src/components/AnalyticsDrillDownModal.jsx
//
// Per-domain drill-down for the Analytics Hub - complete historical data,
// streak, and a 30-day trend chart. Styling matches QuickNotesModal.jsx's
// own TextPromptModal/ConfirmModal sub-modal convention exactly (centered
// overlay, click-outside + Escape to close, var(--bg-surface)/
// var(--border-premium)/var(--premium-shadow), 20px radius) so this reads
// as a native part of the app rather than a new pattern. No portal, same
// as ImageCropModal.jsx - position:fixed doesn't need one here.
import { useEffect } from 'react';
import { X, Flame } from 'lucide-react';
import AnalyticsTrendChart from './AnalyticsTrendChart.jsx';
import AnalyticsEmptyState from './AnalyticsEmptyState.jsx';

const formatDate = (dateStr) => {
    if (!dateStr) return 'No date';
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// Domain-specific row rendering - each source module's items carry
// different real fields worth surfacing (a workout's volume, a
// transaction's amount, a task's completion state), so this isn't one
// generic "title + date" row for every domain.
const renderRow = (domain, item, currency) => {
    if (domain === 'finance') {
        const isExpense = item.type === 'Expense';
        return (
            <div key={item.id} style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                    <div style={rowTitleStyle}>{item.title || item.category || 'Transaction'}</div>
                    <div style={rowSubStyle}>{formatDate(item.date)} · {item.category || 'Uncategorized'}</div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: isExpense ? '#EF4444' : '#10B981', flexShrink: 0 }}>
                    {isExpense ? '-' : '+'}{currency}{Math.round(item.amount || 0).toLocaleString()}
                </span>
            </div>
        );
    }
    if (domain === 'gym') {
        const raw = item.raw || {};
        return (
            <div key={item.id} style={rowStyle}>
                <div style={{ minWidth: 0 }}>
                    <div style={rowTitleStyle}>{raw.title || item.title}</div>
                    <div style={rowSubStyle}>{formatDate(item.date)} · {raw.duration || 'Unknown duration'}</div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', flexShrink: 0 }}>{raw.volume || ''}</span>
            </div>
        );
    }
    // productivity (planner/study) + schedule (calendar/timetable)
    const isCompleted = item.status === 'completed';
    return (
        <div key={item.id} style={rowStyle}>
            <div style={{ minWidth: 0 }}>
                <div style={rowTitleStyle}>{item.title}</div>
                <div style={rowSubStyle}>{item.date ? formatDate(item.date) : (item.day || 'Recurring')}</div>
            </div>
            <span style={{
                fontSize: '11px', fontWeight: '700', flexShrink: 0, padding: '3px 8px', borderRadius: '8px',
                color: isCompleted ? '#10B981' : 'var(--text-muted)',
                background: isCompleted ? 'rgba(16,185,129,0.12)' : 'var(--widget-bg)',
            }}>
                {isCompleted ? 'Done' : 'Pending'}
            </span>
        </div>
    );
};

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', borderRadius: '10px', background: 'var(--widget-bg)' };
const rowTitleStyle = { fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const rowSubStyle = { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' };

const AnalyticsDrillDownModal = ({ domain, config, data, currency, onClose, onCta }) => {
    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '18px' }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ padding: '10px', background: `rgba(${config.rgb}, 0.12)`, borderRadius: '12px', color: config.color, flexShrink: 0 }}>
                            {config.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{config.label}</h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{data.rate}% current rate</span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                        <X size={16} />
                    </button>
                </div>

                {data.hasData ? (
                    <>
                        {data.streak > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', width: 'fit-content' }}>
                                <Flame size={16} color="#F59E0B" />
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#F59E0B' }}>{data.streak}-day streak</span>
                            </div>
                        )}

                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>30-Day Trend</div>
                            <AnalyticsTrendChart data={data.history} color={config.color} variant="full" />
                        </div>

                        <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>History</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {data.items.slice(0, 20).map((item) => renderRow(domain, item, currency))}
                            </div>
                        </div>
                    </>
                ) : (
                    <AnalyticsEmptyState
                        icon={config.icon}
                        title={config.emptyTitle}
                        subtitle={config.emptySubtitle}
                        ctaLabel={config.emptyCta}
                        onCta={onCta}
                    />
                )}
            </div>
        </div>
    );
};

export default AnalyticsDrillDownModal;
