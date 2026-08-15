// src/utils/textFormat.js
//
// A real, shared "capitalize every word" transform, applied at the
// actual point of data entry (when a task/activity title or category
// is saved) rather than via a CSS text-transform. This matters because
// a pure CSS approach only changes how text LOOKS wherever that exact
// rule happens to be applied - the real, underlying stored value stays
// whatever the user typed, and would need the identical CSS rule
// repeated at every single place that title is later displayed across
// this entire app (Home's Master Schedule, Planner, Study, the
// Timetable grid, and so on) to stay visually consistent. Transforming
// the real stored string once, here, at save time means every reader
// downstream sees the same, already-correct value with zero extra
// work - genuinely "clean visual alignment" everywhere, not just
// wherever a matching CSS rule happens to also exist.
export const toTitleCase = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str
        .split(' ')
        .map((word) => (word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
        .join(' ');
};
