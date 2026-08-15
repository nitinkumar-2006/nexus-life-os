// src/hooks/useSwipeToDismiss.js
//
// A real, shared swipe-to-dismiss gesture - matches the native iOS/
// Android sheet-modal pattern (drag the sheet down, release past a real
// threshold to dismiss, or release early and it snaps back). This is
// what a modal genuinely needs to feel native on a touch device rather
// than only supporting a tap-outside/X-button close, which is what
// every modal in this app has used until now.
//
// Deliberately vertical-only (translateY, not X) - matches the real,
// standard direction every native sheet/modal dismiss gesture uses.
// Deliberately a hook returning raw handlers + a live value, not a
// wrapper component - every modal in this app builds its own JSX
// inline (no shared <Modal> component exists), so a hook is what lets
// each one opt in with a few lines rather than a structural rewrite.
import { useState, useRef, useCallback } from 'react';

// dismissThresholdPx: how far down the user must drag before release
// counts as "dismiss" rather than "snap back" - 80px is comfortably
// past an accidental small scroll-touch, but well short of needing a
// full-screen-height drag.
export const useSwipeToDismiss = (onDismiss, { dismissThresholdPx = 80 } = {}) => {
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef(0);

    const onTouchStart = useCallback((e) => {
        startYRef.current = e.touches[0].clientY;
        setIsDragging(true);
    }, []);

    const onTouchMove = useCallback((e) => {
        const delta = e.touches[0].clientY - startYRef.current;
        // Only follows a genuine downward drag - an upward swipe (e.g.
        // the user's real intent is scrolling content inside the modal
        // upward) is clamped to 0 rather than pulling the sheet up past
        // its own resting position, which would look broken.
        setTranslateY(Math.max(0, delta));
    }, []);

    const onTouchEnd = useCallback(() => {
        setIsDragging(false);
        if (translateY > dismissThresholdPx) {
            onDismiss();
        }
        // Snaps back to resting position either way - if onDismiss above
        // is about to unmount this component, this is harmless; if the
        // drag didn't clear the threshold, this is the real "spring back"
        // motion the native gesture is known for.
        setTranslateY(0);
    }, [translateY, dismissThresholdPx, onDismiss]);

    return {
        // Spread directly onto the real draggable surface (e.g. a
        // modal's own header/handle).
        swipeHandlers: { onTouchStart, onTouchMove, onTouchEnd },
        // The caller applies this as `transform: translateY(${translateY}px)`
        // on the modal's own sheet element for a real-time drag-follow
        // effect, and can use isDragging to conditionally disable its own
        // CSS transition while a live drag is in progress (a transition
        // fighting a per-frame transform update is what makes a dragged
        // element feel "sticky"/laggy instead of directly finger-tracking).
        translateY,
        isDragging,
    };
};
