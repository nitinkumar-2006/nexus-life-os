// src/utils/authErrorMessages.js
//
// The single, real source of truth for translating a raw Firebase Auth
// error into an honest, plain-English message. Previously duplicated in
// two separate places (SettingsPage.jsx's own AUTH_ERROR_MESSAGES map,
// LoginPage.jsx's own, much narrower friendlyAuthError function) that
// had already drifted out of sync - a real fix added to one (auth/
// operation-not-allowed, the most likely real cause of a generic
// failure on every attempt) never reached the other, so the same bug
// kept reproducing on whichever page didn't get the update. Consolidated
// here so there is exactly one map to keep current going forward.
export const AUTH_ERROR_MESSAGES = {
    'auth/invalid-email': 'That email address doesn\'t look valid.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error - check your connection and try again.',
    // Thrown when Email/Password sign-in hasn't been enabled in the
    // Firebase Console (Build > Authentication > Sign-in method) - this
    // is a separate, real configuration step from just having valid
    // project credentials, and is very likely the actual cause of a
    // generic-looking failure on every single attempt (rather than only
    // on bad input) - only the project owner can fix this, from their
    // own Firebase Console, not from this code.
    'auth/operation-not-allowed': 'Email/Password sign-in isn\'t enabled for this project yet - enable it in the Firebase Console under Authentication > Sign-in method.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/missing-password': 'Please enter a password.',
    'auth/invalid-api-key': 'This app\'s Firebase configuration looks invalid - check the API key in src/firebase/config.js.',
    // Real codes the Google SSO flow can genuinely throw.
    'auth/popup-closed-by-user': 'Sign-in was cancelled - the popup was closed before finishing.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup - please allow popups for this site and try again.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    // Real codes this round's own work specifically introduces or
    // defensively anticipates in mobile WebView / APK environments.
    'auth/missing-initial-state': 'Sign-in session was lost - this can happen in the mobile app if the sign-in window is closed too early. Please try again.',
    'auth/timeout': 'Sign-in timed out. Please check your connection and try again.',
    'auth/unauthorized-domain': 'This app\'s domain isn\'t authorized for sign-in yet - add it in the Firebase Console under Authentication > Settings > Authorized domains.',
    // Real codes the in-app password management flow can genuinely
    // throw.
    'auth/requires-recent-login': 'For your security, please sign out and sign back in before changing your password.',
};

// A real, confirmed mismatch found on review: phone sign-in maps to a
// synthetic internal email under the hood (see phoneAuth.js's own header
// comment), so Firebase itself throws the exact same codes below whether
// a person actually typed an email or a mobile number - it has no idea
// a phone number was ever involved. Someone signing in with a mobile
// number who got the wrong password would see "Incorrect email or
// password" despite never having typed an email anywhere on the page, a
// genuinely confusing message. identifierType is an optional third
// argument specifically for this - every existing caller (Google
// sign-in, password reset, Settings' own password-change flows - none
// of which have a phone/email choice at all) omits it and keeps working
// exactly as before.
const PHONE_AWARE_OVERRIDES = {
    'auth/user-not-found': 'No account found with that mobile number.',
    'auth/invalid-credential': 'Incorrect mobile number or password.',
    'auth/invalid-email': 'That mobile number doesn\'t look valid.',
};

// Resolves a real, raw Firebase error to the best available honest
// message: the mapped message when the real code is known, otherwise
// the real, raw error code itself (rather than falling straight to a
// fully generic string) - a genuinely unmapped code should still tell
// the person something concrete and actionable, not force them to open
// devtools to find out what actually happened. err.message is checked
// before the final, truly-generic fallback since it's sometimes more
// descriptive than a bare code for non-Firebase errors (e.g. a real
// network-layer failure with no .code at all).
export const getAuthErrorMessage = (err, identifierType) => {
    const code = err && err.code ? err.code : '';
    if (identifierType === 'phone' && code && PHONE_AWARE_OVERRIDES[code]) return PHONE_AWARE_OVERRIDES[code];
    if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
    if (code) return `Firebase error: ${code}`;
    if (err && err.message) return err.message;
    return 'Something went wrong. Please try again.';
};
