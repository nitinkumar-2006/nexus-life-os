// src/hooks/useBodyScrollLock.js
//
// Real background-scroll lock for a full-screen mobile overlay (the
// Settings Hub's mobile category view, and any future one). Without
// this, the page BEHIND a `position: fixed` overlay stays genuinely
// touch-scrollable on mobile - the overlay itself doesn't move, but
// the real page content underneath does, which is what actually
// produces both the reported "background scrolls underneath" AND the
// "flashes solid white/black" symptoms: iOS Safari's real rubber-band
// overscroll can reveal the plain <body>/<html> background color past
// the edge of whatever's still scrolling behind the fixed layer.
//
// A single class on <html> - NOT direct DOM style mutation on the real
// scrolling element - is the actual, real fix here. This app's real
// page-scroll container (DashboardLayout's own `.nexus-page-scroll`
// div) is ALSO React-controlled: it re-renders with its own inline
// `style={{overflowY:'auto', ...}}` on every DashboardLayout re-render
// (which happens often - live-sync listeners fire throughout that
// component). A first version of this hook set `el.style.overflow`
// directly on that element, which genuinely worked for the first
// instant but then got silently reverted the next time DashboardLayout
// re-rendered for any unrelated reason, since React reconciles that
// element's `style` prop back to its own object, clobbering an outside
// mutation. Toggling a class on <html> instead - an element no
// component's render ever touches - and letting a real CSS rule
// (see style.css) force `overflow: hidden !important` on
// `.nexus-page-scroll` via a plain descendant selector sidesteps
// React's reconciliation entirely; CSS doesn't care what React last
// rendered.
import { useEffect } from 'react';

const LOCK_CLASS = 'nexus-scroll-locked';

export const useBodyScrollLock = (isLocked) => {
    useEffect(() => {
        if (!isLocked) return undefined;
        document.documentElement.classList.add(LOCK_CLASS);
        return () => document.documentElement.classList.remove(LOCK_CLASS);
    }, [isLocked]);
};
