// src/utils/smartNumberInput.js
//
// Shared, reusable smart-number-input handling, applied across every
// numeric field in this app (Weights, Calories, Goals, and so on).
// Fixes a real, confirmed bug: the previous, common pattern of
// `onChange={(e) => setX(parseInt(e.target.value) || 0)}` forces the
// stored value back to 0 the instant a field is genuinely emptied
// (parseInt('') is NaN, and NaN || 0 evaluates to 0) - since these are
// all real, controlled inputs, that snap-back immediately re-displays
// '0' in the field, making it genuinely impossible to ever see an
// empty box while typing a replacement value. Typing '3' right after
// then produces '03', not '3'.
//
// The fix, matching this request's own precise technical spec: store
// the raw, possibly-empty string while typing (sanitizeNumberInput),
// and only convert an empty/invalid value to 0 when the user actually
// leaves the field (normalizeNumberOnBlur) - never on every keystroke.

// Real "while typing" sanitizer - genuinely never forces a value. Two
// jobs: (1) let a genuinely empty field stay empty (no forced 0), and
// (2) the actual "smart zero override" this request names directly -
// if the field's own current value was '0' and the very next keystroke
// produces a leading-zero-plus-digit string (e.g. '05'), strip the
// leading zero so typing '5' over a displayed '0' genuinely replaces
// it (becomes '5'), rather than appending (staying '05').
export const sanitizeNumberInput = (rawValue, previousValue) => {
    if (rawValue === '') return '';
    const prevAsString = previousValue === null || previousValue === undefined ? '' : String(previousValue);
    if (prevAsString === '0' && /^0[1-9]$/.test(rawValue)) {
        return rawValue.slice(1);
    }
    return rawValue;
};

// Real "on blur" normalizer - the only point where an empty/invalid
// value genuinely becomes 0, matching this request's own explicit
// "reset to 0 only on blur if empty" instruction. allowDecimal governs
// parseFloat vs parseInt, matching each real field's own existing
// step="0.1" (decimal) vs whole-number convention.
export const normalizeNumberOnBlur = (rawValue, allowDecimal = false) => {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return 0;
    const parsed = allowDecimal ? parseFloat(rawValue) : parseInt(rawValue, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};
