// src/components/AnalyticsEmptyState.jsx
//
// Reusable empty state for the Analytics Hub - matches the established
// visual language already used elsewhere (HomePage's own
// .master-schedule__empty: muted icon -> title -> subtitle, centered in a
// bordered card). Used both per-domain (a card with zero data yet) and
// inside the drill-down modal. The "step-by-step guidance" the request
// asks for is the subtitle text plus a real navigation button - clicking
// it actually takes the user to the module that would populate this
// domain, not just a decorative label.
import { ArrowRight } from 'lucide-react';

const AnalyticsEmptyState = ({ icon, title, subtitle, ctaLabel, onCta, compact = false }) => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '10px', padding: compact ? '20px 16px' : '36px 24px',
        background: 'var(--widget-bg)', border: '1px dashed var(--border-premium)',
        borderRadius: '14px', textAlign: 'center',
    }}>
        <div style={{ opacity: 0.6 }}>{icon}</div>
        <span style={{ fontSize: compact ? '13px' : '15px', fontWeight: '700', color: 'var(--text-secondary)' }}>{title}</span>
        {subtitle && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', maxWidth: '320px' }}>{subtitle}</span>
        )}
        {ctaLabel && onCta && (
            <button
                type="button"
                onClick={onCta}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px',
                    padding: '8px 14px', background: 'var(--primary)', color: 'var(--text-on-primary, #fff)',
                    border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '12px',
                    cursor: 'pointer', fontFamily: 'inherit',
                }}
            >
                {ctaLabel} <ArrowRight size={13} />
            </button>
        )}
    </div>
);

export default AnalyticsEmptyState;
