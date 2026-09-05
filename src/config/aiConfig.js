// src/config/aiConfig.js
//
// Same real pattern already used for Spotify/YouTube in
// streamingConfig.js: a real, working default so the app functions the
// moment anyone downloads it, with a Settings-page value (when the user
// sets their own) always taking priority. See readAiProviderSettings()
// in utils/aiProviderRouter.js and AIPage.jsx's own equivalent for where
// this is actually applied.
//
// Real, worth understanding before changing this: a key embedded in a
// browser bundle or a compiled APK is NOT a secret in the way a
// server-side key is - anyone can find it via devtools' Network tab or
// by decompiling the APK, no matter how it's obfuscated. This is a
// deliberate, informed choice (same one being made for the app's own
// Google Cloud project), not an oversight, with two real mitigations
// actually available:
//   1. In Google Cloud Console (console.cloud.google.com/apis/
//      credentials), open this key and set "Application restrictions" -
//      HTTP referrers for the deployed web domain, and Android apps
//      (package name + SHA-1 fingerprint) for the APK. This stops the
//      key from working at all if copied out and called from anywhere
//      else, even though the raw string itself is still visible.
//   2. Set a billing/usage alert (and, for Gemini specifically, a hard
//      daily quota cap) on this key in Cloud Console - a shared default
//      key used by every install of the app has real, shared usage this
//      one key alone absorbs, not per-user isolated usage.
export const GEMINI_API_KEY_FALLBACK = 'AQ.Ab8RN6KrdxW6ij5qXA5MnJtet_Pru4BEonAtOWLhQGRf3kW6sQ';
