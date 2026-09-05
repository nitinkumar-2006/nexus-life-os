// src/hooks/useTourGuide.js
//
// Tracks which per-section tours the user has already seen, so
// TourGuide.jsx only ever shows a section's tour on that section's real
// first visit - not every time the page mounts. One localStorage key per
// tour id, deliberately separate keys (not a single JSON blob) so
// clearing/resetting one section's tour later never risks touching
// another's.
const TOUR_STORAGE_PREFIX = 'nexus_tour_seen_';

export const hasSeenTour = (tourId) => {
    try {
        return localStorage.getItem(TOUR_STORAGE_PREFIX + tourId) === 'true';
    } catch (e) {
        // Storage unavailable (private browsing, quota, etc.) - default to
        // "already seen" so a broken tour can't block real page use.
        return true;
    }
};

export const markTourSeen = (tourId) => {
    try {
        localStorage.setItem(TOUR_STORAGE_PREFIX + tourId, 'true');
    } catch (e) {
        // Nothing meaningful to recover here - worst case the tour
        // reappears next visit, not a broken page.
    }
};

// Real, requested gap closed: once a tour was dismissed there was no way
// to see it again short of manually clearing localStorage. This is the
// one, global "start over" a user actually wants - not a per-section
// reset UI (with 11 short, skippable tours, that would be its own
// clutter). Scans by prefix rather than a hardcoded tour-id list, so it
// stays correct as new tours are added later without needing an update
// here.
export const resetAllTours = () => {
    try {
        Object.keys(localStorage)
            .filter((key) => key.startsWith(TOUR_STORAGE_PREFIX))
            .forEach((key) => localStorage.removeItem(key));
    } catch (e) {
        // Nothing meaningful to recover here - worst case the replay
        // button silently doesn't reset anything.
    }
};
