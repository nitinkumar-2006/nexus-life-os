// src/utils/autoCapitalize.js
//
// Project-wide, LIVE "first letter of the first word - and of the first
// word of every new sentence - capitalizes automatically as you type",
// installed as a single global document-level listener (see main.jsx)
// instead of being wired into every individual input's own onChange.
// Genuinely covers "wherever there's typing" across the whole app without
// editing dozens of files by hand, and mirrors how a phone keyboard's own
// auto-capitalization behaves: only the character that was JUST typed is
// ever touched, and only when it sits at a real sentence-start position -
// the rest of the field's text, any pasted text, and the cursor position
// are never otherwise disturbed.
//
// Deliberately scoped to plain <textarea> and <input> with no type (or
// type="text") - every other input type (email, password, number, tel,
// url, search, date, checkbox, etc.) is naturally excluded, so login
// fields, numeric fields, and dropdowns are untouched without needing a
// manual opt-out list.
const isEligible = (el) => {
    if (!el || !el.tagName) return false;
    if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
    if (el.tagName === 'INPUT') {
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        return (type === 'text' || type === '') && !el.readOnly && !el.disabled;
    }
    return false;
};

// True when the character at `index` in `value` sits at the start of a
// sentence: the very start of the field (ignoring any leading
// whitespace), or right after a ". "/"! "/"? " boundary (any run of
// whitespace between the punctuation and the next word, matching how
// people naturally type a space before the next word).
const isSentenceStart = (value, index) => {
    let i = index;
    while (i > 0 && /\s/.test(value[i - 1])) i -= 1;
    if (i === 0) return true;
    return /[.!?]/.test(value[i - 1]);
};

// Setting `el.value` directly would update React's own internal value
// tracker along with the DOM, so the native 'input' event dispatched
// afterward would look like a no-op change and React's onChange would
// never fire - leaving the controlled component's state stuck on the old,
// lowercase character. Calling the PROTOTYPE's native setter (bypassing
// the instance-level property React installs to track controlled inputs)
// updates only the real DOM value, so the following native event is
// genuinely seen as a change and correctly flows into the owning
// component's own onChange/state.
const setNativeValue = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
};

const handleInput = (e) => {
    if (e.isComposing) return; // mid-IME-composition - not a finished character yet
    const el = e.target;
    if (!isEligible(el)) return;
    if (typeof el.selectionStart !== 'number') return;

    const value = el.value;
    const caret = el.selectionStart;
    if (caret === 0 || caret > value.length) return;

    const charIndex = caret - 1;
    const ch = value[charIndex];
    // Already-uppercase (including the recursive call this function's own
    // dispatched 'input' event below triggers) or not a letter at all -
    // nothing to do. This is also what naturally stops that recursive
    // call from looping: the second time through, the character is
    // already uppercase, so this check fails and the function returns.
    if (!/[a-z]/.test(ch)) return;
    if (!isSentenceStart(value, charIndex)) return;

    const corrected = value.slice(0, charIndex) + ch.toUpperCase() + value.slice(charIndex + 1);
    setNativeValue(el, corrected);
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
};

export const installAutoCapitalize = () => {
    document.addEventListener('input', handleInput);
};
