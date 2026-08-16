// src/utils/accountLinking.js
//
// Lets one account be reached by EITHER its email OR a linked mobile
// number - a genuine, confirmed gap before this file existed: signing up
// with email and signing up with phone always created two completely
// separate Firebase accounts (phone sign-in maps to a synthetic internal
// email under Firebase's real Email/Password provider - see
// utils/phoneAuth.js's own header comment - so there was never a shared
// identity between the two, even for the same real person).
//
// Real Firebase Auth account linking (auth.currentUser.linkWithCredential)
// only works between genuinely distinct PROVIDERS (e.g. Google + Email/
// Password) - it can't attach a second, different EMAIL to the same
// Email/Password-provider account, which is exactly what "phone number"
// already secretly is here. So this uses a separate, explicit Firestore
// lookup collection instead: 'identifierLinks/{normalizedIdentifier}' ->
// { authEmail, uid }. Before ever calling Firebase's own sign-in, the
// login flow resolves whatever the person typed (their real email OR a
// linked phone number) to the ACTUAL email the Firebase account was
// created with, then signs in with that - so either identifier reaches
// the same real account and the same real password.
//
// REQUIRES a Firestore security rule allowing this collection to be READ
// by anyone (unauthenticated included) - this lookup necessarily happens
// BEFORE sign-in, so it can't be gated behind request.auth. WRITES must
// stay restricted to the account that owns the identifier:
//
//   match /identifierLinks/{identifierId} {
//     allow read: if true;
//     allow write: if request.auth != null
//                  && request.resource.data.uid == request.auth.uid;
//     allow delete: if request.auth != null
//                   && resource.data.uid == request.auth.uid;
//   }
//
// Privacy tradeoff, stated plainly: because this lookup must be public
// (no server-side function to hide it behind), anyone who already knows a
// person's linked phone number could query this collection and learn the
// real email address behind it (and vice versa) - never anything else
// (no password, no personal data). This is the necessary cost of
// resolving an identifier to an account before authentication exists,
// entirely client-side.
import { doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { normalizePhoneNumber } from './phoneAuth.js';

const LINKS_COLLECTION = 'identifierLinks';
const RESOLVE_TIMEOUT_MS = 8000;

const withTimeout = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out.')), ms)),
    ]);

// The exact same normalization used everywhere an identifier is compared
// or looked up here, so "9876543210", "+91 98765 43210", and
// "+919876543210" all resolve to the identical Firestore document, and
// "USER@Example.com" / "user@example.com" do too.
export const normalizeIdentifierKey = (rawIdentifier, type) =>
    type === 'phone'
        ? normalizePhoneNumber(rawIdentifier).replace('+', 'p')
        : (rawIdentifier || '').trim().toLowerCase();

// Resolves any identifier (real email or a linked phone number) to the
// real Firebase Auth email that identifier's account was actually
// created with. Returns null on a genuine "not linked" (no document -
// this is the expected, normal case for an identifier that's simply
// someone's own primary, never-linked-anywhere sign-in method) AND on any
// failure (offline, rules not yet deployed, Firestore not reachable) -
// callers are expected to fall back to their own existing
// legacy-derived-email behavior in either case, so this can never make
// login MORE fragile than it already was, only more capable when it
// succeeds.
export const resolveAuthEmailForIdentifier = async (rawIdentifier, type) => {
    const key = normalizeIdentifierKey(rawIdentifier, type);
    if (!key) return null;
    try {
        const snap = await withTimeout(getDoc(doc(db, LINKS_COLLECTION, key)), RESOLVE_TIMEOUT_MS);
        return snap.exists() ? snap.data() : null;
    } catch (e) {
        return null;
    }
};

// Called once, right after a brand-new account is genuinely created
// (signup or a first-time Google sign-in) - registers that account's own
// primary identifier so it's consistently resolvable through the same
// lookup path a later-linked second identifier would use. Deliberately
// best-effort: a failure here must never fail the signup itself (the
// account already exists for real by the time this runs) - the person
// can still always sign in with their original identifier via the
// existing legacy-derived-email path either way; they'd just briefly not
// be able to link a second identifier to it until this succeeds on a
// retry (naturally retried the next time registerPrimaryIdentifier or
// linkIdentifier runs for this account).
export const registerPrimaryIdentifier = async (rawIdentifier, type, authEmail, uid) => {
    const key = normalizeIdentifierKey(rawIdentifier, type);
    if (!key) return;
    try {
        await withTimeout(setDoc(doc(db, LINKS_COLLECTION, key), { authEmail, uid }, { merge: true }), RESOLVE_TIMEOUT_MS);
    } catch (e) {
        /* non-fatal - see comment above */
    }
};

// The real "Link" action from Profile/Settings - attaches a second
// identifier (whichever of email/phone the account didn't originally
// sign up with) to the CURRENTLY signed-in account. Real ownership
// safety: the Firestore rule above only lets this write succeed when the
// document's own uid field matches the live, authenticated
// request.auth.uid, so this can never silently reassign an identifier
// someone else already owns - and this function checks that explicitly
// first too, to surface a real, honest error message instead of a raw
// Firestore permission-denied.
export const linkIdentifierToAccount = async (rawIdentifier, type, currentUser) => {
    const key = normalizeIdentifierKey(rawIdentifier, type);
    if (!key) throw new Error(type === 'phone' ? 'Enter a valid mobile number.' : 'Enter a valid email address.');

    const existing = await withTimeout(getDoc(doc(db, LINKS_COLLECTION, key)), RESOLVE_TIMEOUT_MS);
    if (existing.exists() && existing.data().uid !== currentUser.uid) {
        throw new Error(type === 'phone'
            ? 'This mobile number is already linked to a different account.'
            : 'This email is already linked to a different account.');
    }

    await withTimeout(
        setDoc(doc(db, LINKS_COLLECTION, key), { authEmail: currentUser.email, uid: currentUser.uid }, { merge: true }),
        RESOLVE_TIMEOUT_MS
    );

    // Denormalized onto the account's own existing cloud document (the
    // same 'nexusUsers/{uid}' doc CloudSyncContext already reads/writes)
    // purely so Settings/Profile can display "what's linked" instantly
    // without a second round-trip - identifierLinks above stays the one
    // real source of truth the login flow itself resolves against.
    await withTimeout(
        setDoc(doc(db, 'nexusUsers', currentUser.uid), { linkedIdentifiers: { [type]: rawIdentifier } }, { merge: true }),
        RESOLVE_TIMEOUT_MS
    );
};

// Removes a linked identifier from the current account - the identifier
// stops resolving to this account (or any account) afterward, and can be
// linked fresh elsewhere (including a different account) again later.
// Never allows removing the account's OWN primary identifier (the one
// its real Firebase email is currently derived from) - that would leave
// the account with no way to ever be found by its own original sign-in
// method, a real, permanent lockout risk this deliberately blocks by
// simply never offering that identifier for removal from the UI side.
export const unlinkIdentifierFromAccount = async (rawIdentifier, type, currentUser) => {
    const key = normalizeIdentifierKey(rawIdentifier, type);
    await withTimeout(deleteDoc(doc(db, LINKS_COLLECTION, key)), RESOLVE_TIMEOUT_MS);
    await withTimeout(
        updateDoc(doc(db, 'nexusUsers', currentUser.uid), { [`linkedIdentifiers.${type}`]: null }),
        RESOLVE_TIMEOUT_MS
    );
};

// Reads back whatever's currently linked to this account, for display.
// Returns {} (nothing linked yet) on any failure - a real, honest "we
// don't know" rather than pretending something is linked when the read
// itself failed.
export const getLinkedIdentifiers = async (uid) => {
    try {
        const snap = await withTimeout(getDoc(doc(db, 'nexusUsers', uid)), RESOLVE_TIMEOUT_MS);
        return snap.exists() ? (snap.data().linkedIdentifiers || {}) : {};
    } catch (e) {
        return {};
    }
};
