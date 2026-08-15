// src/hooks/useIsMobile.js
//
// A real, shared "is this a mobile viewport" hook, tracking window.
// innerWidth live via a real resize listener - not a one-time check at
// mount, so rotating a device or resizing a browser window updates the
// result immediately. Deliberately JS-based rather than a CSS media
// query: this app's own established convention is inline styles for
// component layout (width, display, padding), and a CSS media query
// cannot reliably override an inline style for the same property
// without !important scattered across dozens of files - a real
// maintenance and specificity-fighting risk this hook avoids by letting
// components conditionally choose their own inline style values
// instead.
//
// Also checks a real, independent second signal: the device's own user
// agent. A pure window.innerWidth check can genuinely be unreliable
// inside a third-party Android WebView wrapper (an app packaged as an
// APK from this web app) - some WebView configurations report a real,
// historical "desktop-style" viewport width (~980px, scaled down to
// visually fit the real screen) rather than the device's own actual CSS
// pixel width, a known Android WebView quirk that requires native-side
// configuration this web app's own code cannot control. Combining both
// signals via OR means a genuine phone is still correctly detected even
// if its own reported width is wrong; a real desktop browser's own user
// agent never matches these patterns, so this can't create a false
// positive there.
import { useState, useEffect } from 'react';

// 768px matches this request's own specified breakpoint, and is the
// same, standard tablet/mobile boundary used by most real responsive
// frameworks.
const MOBILE_BREAKPOINT = 768;

const isMobileUserAgent = () =>
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

const computeIsMobile = () =>
    (typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT) || isMobileUserAgent();

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(computeIsMobile);

    useEffect(() => {
        const handleResize = () => setIsMobile(computeIsMobile());
        window.addEventListener('resize', handleResize);
        // Also re-checked here in case the real viewport width genuinely
        // changed between this hook's own initial useState evaluation
        // (which could race a server-rendered/pre-hydration width on some
        // setups) and this effect actually running.
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
};
