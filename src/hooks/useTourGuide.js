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
