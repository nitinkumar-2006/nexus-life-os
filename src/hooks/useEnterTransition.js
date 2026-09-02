// src/hooks/useEnterTransition.js
//
// Real bug fix: every Audio Hub overlay (QueueDrawer, LyricsOverlay,
// FullPlayerView, ProfileMenu, VolumePopup, TrackOptionsMenu) played its
// one-shot "enter" animation via a CSS `animation` keyframe applied
// through an inline `style` object. All of them live inside
// FloatingBottomPlayer's own render tree, which re-renders continuously
// during playback (AudioPlayerContext ticks `currentTime` roughly once a
// second). Confirmed live: that constant re-rendering was restarting the
// keyframe animation on every tick, and since a translateX(100%)→
// translateX(0) slide-in never got a chance to finish before being
// restarted, the drawers ended up permanently stuck at their OFF-SCREEN
// starting position - genuinely invisible/unusable, not just visually
// janky.
//
// Fix: drive the enter state from real component state instead of a CSS
// keyframe restarting on every parent re-render. `entered` flips true
// exactly once, on the first paint after mount (via requestAnimationFrame,
// so the browser commits the "closed" starting styles first and can
// genuinely transition from them). Once true, it stays true regardless of
// how many times the parent re-renders - a CSS `transition` (not
// `animation`) on the consuming component only fires when the STYLE VALUE
// actually changes, so re-renders that keep passing the same `entered`
// value are inert, unlike a keyframe `animation` shorthand.
import { useEffect, useState } from 'react';

export const useEnterTransition = (isOpen) => {
    const [entered, setEntered] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setEntered(false);
            return undefined;
        }
        // A plain setTimeout, not requestAnimationFrame - confirmed live
        // that rAF gets throttled/starved while the tab isn't the actively
        // rendered one (backgrounded/inactive), which left this stuck
        // pre-transition indefinitely in exactly that condition. A short
        // timeout still reliably yields one real tick to the browser (so
        // the "closed" starting styles get painted at least once, giving
        // the CSS transition something to animate from) without depending
        // on the page actually being in the foreground.
        const id = setTimeout(() => setEntered(true), 20);
        return () => clearTimeout(id);
    }, [isOpen]);

    return entered;
};
