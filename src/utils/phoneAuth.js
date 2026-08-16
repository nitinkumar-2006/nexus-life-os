// src/utils/phoneAuth.js
//
// Firebase Authentication's Phone provider is OTP/SMS-only - it has no
// "phone number + password" sign-in method. Rather than requiring the
// project owner to enable Phone sign-in in the Firebase Console (extra
// setup, real per-SMS cost, and a broken sign-in for every user until
// that's done), a phone number is deterministically mapped to a synthetic
// internal email address and signed in through Firebase's own, already-
// configured Email/Password provider underneath. The synthetic address is
// never shown to the user and never receives real mail - it only ever
// exists as Firebase's internal account key, the same way a username-only
// system might key accounts by "username@internal.local" behind the
// scenes.
const PHONE_EMAIL_DOMAIN = 'phone.nexuslifeos.internal';

// Keeps only digits and a single leading '+' (E.164-ish) so the same real
// number typed with spaces/dashes/parens always maps to the identical
// synthetic email.
export const normalizePhoneNumber = (raw) => {
    const trimmed = (raw || '').trim();
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    return hasPlus ? `+${digits}` : digits;
};

export const isValidPhoneNumber = (raw) => {
    const digitsOnly = normalizePhoneNumber(raw).replace('+', '');
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
};

// '+' isn't valid in the local part of an email address, so it's swapped
// for a literal 'p' before composing the synthetic address - still a
// deterministic, collision-free mapping since normalizePhoneNumber above
// already guarantees a canonical digit string per number.
export const phoneToSyntheticEmail = (raw) => {
    const normalized = normalizePhoneNumber(raw).replace('+', 'p');
    return `${normalized}@${PHONE_EMAIL_DOMAIN}`;
};

// True only for a real synthetic address this file itself generated -
// used to tell "this account's real Firebase email IS its phone number in
// disguise" apart from "this account's real Firebase email is a genuine
// email address", e.g. before ever displaying user.email as-is somewhere
// a person would actually read it.
export const isSyntheticPhoneEmail = (rawEmail) =>
    typeof rawEmail === 'string' && rawEmail.endsWith(`@${PHONE_EMAIL_DOMAIN}`);

// The exact inverse of phoneToSyntheticEmail - only ever meaningful when
// isSyntheticPhoneEmail(rawEmail) is already true. Reconstructs the real,
// human-readable phone number (with its original leading '+' restored)
// so a phone-signup account's own "you're signed in as..." UI never
// shows the internal synthetic address a person never typed or saw.
export const syntheticEmailToPhone = (rawEmail) => {
    if (!isSyntheticPhoneEmail(rawEmail)) return null;
    const localPart = rawEmail.slice(0, rawEmail.indexOf('@'));
    return localPart.startsWith('p') ? `+${localPart.slice(1)}` : localPart;
};
