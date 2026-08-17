// src/components/TourGuide.jsx
//
// Lightweight, reusable step-by-step tour overlay: a dimmed backdrop with
// a spotlight cutout around one real DOM element per step (matched via a
// data-tour-id attribute the host page adds to the elements worth
// explaining) plus a tooltip card with Back/Skip/Next controls. Callers
// don't manage step state themselves - just render
// <TourGuide tourId="..." steps={[...]} onFinish={...} /> the first time
// a section is visited (see useTourGuide.js for the localStorage check
// that decides "first time").
//
// The spotlight is a transparent box sized to the target's real
// getBoundingClientRect() with a huge box-shadow covering the rest of the
// viewport - a standard, dependency-free way to get a cutout effect
// without an SVG mask. Position is re-measured on resize/scroll and via a
// short-lived rAF poll after every step change, since the target can
// still be settling into place right when a step becomes active
// (post-scrollIntoView animation, conditionally-rendered content, etc.).
import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { markTourSeen } from '../hooks/useTourGuide.js';

const SPOTLIGHT_PADDING = 8;

const TourGuide = ({ tourId, steps, onFinish }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState(null);
    const rafRef = useRef(null);

    const measure = useCallback(() => {
        const step = steps[stepIndex];
        if (!step) return;
        const el = document.querySelector(`[data-tour-id="${step.target}"]`);
        if (!el) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        if (r.top < 0 || r.bottom > window.innerHeight) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, [stepIndex, steps]);

    useEffect(() => {
        measure();
        window.addEventListener('resize', measure);
        // Capture phase - catches scroll on any scrollable ancestor
        // (this app scrolls an inner content div, not the window itself),
        // not just window-level scroll.
        window.addEventListener('scroll', measure, true);

        let ticks = 0;
        const poll = () => {
            measure();
            ticks += 1;
            if (ticks < 30) rafRef.current = requestAnimationFrame(poll);
        };
        rafRef.current = requestAnimationFrame(poll);

        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [measure]);

    const finish = () => {
        markTourSeen(tourId);
        onFinish();
    };

    const handleNext = () => {
        if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
        else finish();
    };
    const handleBack = () => setStepIndex((i) => Math.max(0, i - 1));

    const step = steps[stepIndex];
    if (!step) return null;

    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // No target found (yet) - centers a near-zero-size spotlight so the
    // dimmed backdrop still shows and the tooltip still centers itself
    // rather than the whole tour silently failing to render.
    const spot = rect
        ? { top: rect.top - SPOTLIGHT_PADDING, left: rect.left - SPOTLIGHT_PADDING, width: rect.width + SPOTLIGHT_PADDING * 2, height: rect.height + SPOTLIGHT_PADDING * 2 }
        : { top: vh / 2, left: vw / 2, width: 0, height: 0 };

    const tooltipWidth = Math.min(320, vw - 32);
    const spotCenterX = spot.left + spot.width / 2;
    const tooltipLeft = Math.max(16, Math.min(spotCenterX - tooltipWidth / 2, vw - tooltipWidth - 16));
    const placeBelow = spot.top < vh / 2;
    const tooltipTop = placeBelow ? spot.top + spot.height + 16 : undefined;
    const tooltipBottom = !placeBelow ? vh - spot.top + 16 : undefined;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 6000 }} role="dialog" aria-modal="true" aria-label={`${step.title} - tour step ${stepIndex + 1} of ${steps.length}`}>
            <div
                style={{
                    position: 'fixed', top: spot.top, left: spot.left, width: spot.width, height: spot.height,
                    borderRadius: '16px', boxShadow: '0 0 0 9999px rgba(8, 8, 14, 0.72)',
                    transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
                    pointerEvents: 'none', border: rect ? '2px solid var(--primary)' : 'none',
                }}
            />
            {/* Absorbs taps on the dimmed area (tapping outside the
                tooltip skips the tour - same convention every other
                overlay in this app already uses) - deliberately behind
                the tooltip card below via DOM order, not z-index, so the
                card's own onClick stopPropagation is enough to protect
                it. */}
            <div onClick={finish} style={{ position: 'fixed', inset: 0 }} />

            <div
                style={{
                    position: 'fixed', top: tooltipTop, bottom: tooltipBottom, left: tooltipLeft, width: tooltipWidth,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '18px',
                    padding: '18px', boxShadow: '0 16px 40px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '12px',
                    boxSizing: 'border-box',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        {steps.map((s, i) => (
                            <div key={s.target} style={{ width: '16px', height: '3px', borderRadius: '2px', background: i === stepIndex ? 'var(--primary)' : 'var(--border-premium)' }} />
                        ))}
                    </div>
                    <button type="button" onClick={finish} aria-label="Close tour" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', flexShrink: 0, display: 'flex' }}>
                        <X size={16} />
                    </button>
                </div>
                <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{step.title}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>{step.body}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    {stepIndex > 0 ? (
                        <button type="button" onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', padding: '6px 4px', fontFamily: 'inherit' }}>
                            <ChevronLeft size={14} /> Back
                        </button>
                    ) : (
                        <button type="button" onClick={finish} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: '600', fontSize: '13px', cursor: 'pointer', padding: '6px 4px', fontFamily: 'inherit' }}>
                            Skip
                        </button>
                    )}
                    <button type="button" onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '9px 18px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {stepIndex === steps.length - 1 ? 'Got it' : 'Next'} {stepIndex < steps.length - 1 && <ChevronRight size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TourGuide;
