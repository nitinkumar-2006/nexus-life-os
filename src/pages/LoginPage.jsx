// src/pages/LoginPage.jsx
//
// Only ever rendered when Firebase IS configured (see App entry point) and
// no user is currently signed in. Local-only installs never see this page.
//
// Supports Email OR Mobile Number as the sign-in identifier. Firebase's own
// Phone provider is OTP/SMS-only (no password support) - phone sign-in
// here instead maps the number to a deterministic synthetic email (see
// utils/phoneAuth.js) and authenticates through Firebase's already-
// configured Email/Password provider underneath, so it genuinely works
// today with zero extra Firebase console setup or SMS cost. "Password/PIN"
// from the original spec is delivered as: a real password here on first
// sign-in, plus an optional Quick Sign-In PIN (Settings > Security) that
// re-unlocks an already-signed-in session on this same device afterwards
// without retyping the password - see AppRoot.jsx's QuickPinUnlockScreen.
// A PIN can't stand in for the very first sign-in itself, since there's no
// live session yet for it to unlock.
import { useState } from 'react';
import { Mail, Phone, Lock, User as UserIcon, LogIn, UserPlus, AlertCircle, KeyRound, X, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getAuthErrorMessage } from '../utils/authErrorMessages.js';
import { isValidPhoneNumber, phoneToSyntheticEmail } from '../utils/phoneAuth.js';
import { resolveAuthEmailForIdentifier, registerPrimaryIdentifier } from '../utils/accountLinking.js';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';

// A real, minimal "G" mark (not a generic icon-font glyph) so the button
// reads as genuinely "Google" at a glance, matching the multi-color brand
// mark rather than a plain monochrome icon.
const GoogleGlyph = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/>
    </svg>
);

const glassInputStyle = (hasError) => ({
    width: '100%', padding: '13px 14px 13px 42px', borderRadius: '14px',
    border: `1px solid ${hasError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
    background: 'rgba(0,0,0,0.22)', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s ease, background 0.15s ease',
});

const LoginPage = () => {
    const { signup, login, loginWithGoogle, resetPassword } = useAuth();
    const isMobile = useIsMobile();
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [identifierType, setIdentifierType] = useState('email'); // 'email' | 'phone'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    // Pre-filled with the +91 country code so most users never have to
    // type it themselves - still fully editable for anyone outside India.
    const [phone, setPhone] = useState('+91 ');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Separate from isSubmitting so the two buttons never fight over one
    // shared "Please wait..." state - a person could otherwise start the
    // password form, decide to use Google instead, and see stale loading
    // state left over from whichever attempt they abandoned.
    const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetStatus, setResetStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
    const [resetError, setResetError] = useState('');

    // Desktop only, per explicit request - avoids Google's OAuth popup
    // redirect awkwardness on mobile browsers/WebViews (small viewport,
    // easy to lose the popup, harder to complete 2FA) rather than
    // attempting a mobile-specific redirect flow. Email/phone + password
    // and Quick Sign-In PIN already cover mobile sign-in completely.
    const handleGoogleSignIn = async () => {
        setError('');
        setIsGoogleSubmitting(true);
        try {
            await loginWithGoogle();
        } catch (err) {
            // A user closing the popup themselves is a real, common,
            // benign action - surfaced as the same honest error text
            // authErrorMessages.js already maps it to, not styled as a
            // harsher failure than it is.
            setError(getAuthErrorMessage(err));
        } finally {
            setIsGoogleSubmitting(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetStatus('sending');
        try {
            await resetPassword(resetEmail);
            setResetStatus('sent');
        } catch (err) {
            setResetError(getAuthErrorMessage(err));
            setResetStatus('error');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Real, explicit validation before ever touching Firebase - a bad
        // phone number would otherwise just surface as a confusing
        // "invalid email" error from Firebase itself, since it's the
        // synthetic mapped address that actually gets rejected.
        if (identifierType === 'phone' && !isValidPhoneNumber(phone)) {
            setError('Enter a valid mobile number (7-15 digits, with country code).');
            return;
        }

        // The account's own primary identifier, exactly as before - always
        // a valid fallback even when nothing's been linked (the normal,
        // common case), and when there's no signal either way (offline,
        // Firestore unreachable) below.
        const legacyDerivedEmail = identifierType === 'phone' ? phoneToSyntheticEmail(phone) : email.trim();
        const rawIdentifier = identifierType === 'phone' ? phone : email.trim();

        setIsSubmitting(true);
        try {
            if (mode === 'signup') {
                const newUser = await signup(legacyDerivedEmail, password, name);
                // Best-effort, deliberately not awaited-with-blocking-error-
                // handling beyond its own internal try/catch (see
                // accountLinking.js) - a brand-new account already exists by
                // this point regardless of whether this succeeds.
                registerPrimaryIdentifier(rawIdentifier, identifierType, legacyDerivedEmail, newUser.uid);
            } else {
                // Resolves a LINKED identifier (added later from Settings/
                // Profile) to the real account it was linked to - e.g.
                // someone who originally signed up with email now signing
                // in with the mobile number they linked afterward. Falls
                // straight through to the exact same behavior as before
                // whenever nothing is linked or the lookup itself can't
                // complete, so this can only ever add capability, never
                // regress the existing sign-in path.
                const linked = await resolveAuthEmailForIdentifier(rawIdentifier, identifierType);
                await login(linked?.authEmail || legacyDerivedEmail, password);
            }
        } catch (err) {
            setError(getAuthErrorMessage(err, identifierType));
        } finally {
            // Always clears, on every path (success falls through to
            // AppRoot's Gate swapping this page out entirely; failure
            // needs the form usable again immediately) - this is the
            // actual fix for "Please wait..." ever getting stuck.
            setIsSubmitting(false);
        }
    };

    const switchIdentifier = (nextType) => {
        setIdentifierType(nextType);
        setError('');
    };

    return (
        <div
            style={{
                minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'radial-gradient(circle at 30% 20%, #1e293b 0%, #0f0f17 60%)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                padding: '20px', boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
            }}
        >
            <style>{`
                @keyframes nexusLoginOrbFloat1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.08); } }
                @keyframes nexusLoginOrbFloat2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-24px,24px) scale(1.05); } }
                @keyframes nexusLoginFormIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
                @media (prefers-reduced-motion: reduce) {
                    .nexus-login-orb { animation: none !important; }
                    .nexus-login-form { animation: none !important; }
                }
            `}</style>

            <div className="nexus-login-orb" style={{ position: 'absolute', top: '-10%', left: '-8%', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%)', filter: 'blur(10px)', animation: 'nexusLoginOrbFloat1 14s ease-in-out infinite', pointerEvents: 'none' }} />
            <div className="nexus-login-orb" style={{ position: 'absolute', bottom: '-12%', right: '-10%', width: '420px', height: '420px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)', filter: 'blur(10px)', animation: 'nexusLoginOrbFloat2 16s ease-in-out infinite', pointerEvents: 'none' }} />

            <form
                onSubmit={handleSubmit}
                className="nexus-login-form"
                style={{
                    width: 'min(400px, 100%)', background: 'rgba(27, 27, 47, 0.6)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '26px', padding: 'clamp(24px, 6vw, 40px)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(24px) saturate(140%)', WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                    display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1,
                    animation: 'nexusLoginFormIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/nexus-logo.svg" alt="Nexus" style={{ width: '56px', height: '56px', objectFit: 'contain', background: 'transparent' }} />
                    </div>
                    {/* Same gradient wordmark treatment as the boot splash
                        (AppSplashScreen.jsx / index.html) - "Nexus" in the
                        logo's own gradient, "OS" kept muted/plain for the
                        same visual hierarchy, so the icon and its name
                        read as one cohesive brand on this page too. */}
                    <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>
                        <span style={{
                            background: 'linear-gradient(90deg, #38BDF8 0%, #A78BFA 50%, #F472B6 100%)',
                            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                        }}>Nexus</span>{' '}
                        <span style={{ color: '#94A3B8', fontWeight: '700' }}>OS</span>
                    </h1>
                    <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, textAlign: 'center' }}>
                        {mode === 'login' ? 'Sign in to sync your data across devices.' : 'Create an account to enable cloud sync.'}
                    </p>
                </div>

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#FCA5A5', fontSize: '13px', fontWeight: '600' }}>
                        <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
                    </div>
                )}

                {mode === 'signup' && (
                    <div>
                        <label htmlFor="login-page-name" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}><UserIcon size={13} /> Full Name</label>
                        <input id="login-page-name" name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nitin Kumar" style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.22)', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                )}

                {/* Email / Mobile Number segmented toggle */}
                <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[{ id: 'email', label: 'Email', icon: Mail }, { id: 'phone', label: 'Mobile Number', icon: Phone }].map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => switchIdentifier(opt.id)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                padding: '10px 8px', borderRadius: '11px', border: 'none', cursor: 'pointer',
                                fontSize: '13px', fontWeight: '700', fontFamily: 'inherit',
                                background: identifierType === opt.id ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'transparent',
                                color: identifierType === opt.id ? '#fff' : '#94A3B8',
                                transition: 'background 0.15s ease, color 0.15s ease',
                            }}
                        >
                            <opt.icon size={14} /> {opt.label}
                        </button>
                    ))}
                </div>

                {identifierType === 'email' ? (
                    <div>
                        <label htmlFor="login-page-email" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}><Mail size={13} /> Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={16} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input id="login-page-email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={glassInputStyle(false)} />
                        </div>
                    </div>
                ) : (
                    <div>
                        <label htmlFor="login-page-phone" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}><Phone size={13} /> Mobile Number</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={16} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input id="login-page-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" style={glassInputStyle(false)} />
                        </div>
                    </div>
                )}

                <div>
                    <label htmlFor="login-page-password" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}><Lock size={13} /> Password</label>
                    <div style={{ position: 'relative' }}>
                        <Lock size={16} color="#64748B" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input id="login-page-password" name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={glassInputStyle(false)} />
                    </div>
                    {mode === 'signup' && <PasswordStrengthIndicator password={password} />}
                    {mode === 'login' && identifierType === 'email' && (
                        <button
                            type="button"
                            onClick={() => { setResetEmail(email); setResetStatus('idle'); setResetError(''); setShowForgotPassword(true); }}
                            style={{ background: 'transparent', border: 'none', color: '#818CF8', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0, marginTop: '8px' }}
                        >
                            Forgot Password?
                        </button>
                    )}
                    {mode === 'login' && identifierType === 'phone' && (
                        <p style={{ fontSize: '11px', color: '#64748B', marginTop: '8px', lineHeight: '1.4' }}>
                            Password reset isn't available for mobile number sign-in yet - sign in with your email instead if you need to reset it.
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '700', fontSize: '15px', cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.7 : 1, marginTop: '6px', minHeight: '48px' }}
                >
                    {isSubmitting ? (
                        <Loader2 size={17} style={{ animation: 'spin 0.8s linear infinite' }} />
                    ) : mode === 'login' ? <LogIn size={17} /> : <UserPlus size={17} />}
                    {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
                </button>

                {/* Desktop-only Google Sign-in - see handleGoogleSignIn above
                    for why this is hidden on mobile. Works for both login
                    and signup: Firebase's own signInWithPopup call already
                    handles a brand-new vs returning Google identity as one
                    real call (see AuthContext.jsx's loginWithGoogle), so
                    this doesn't need its own mode branch. */}
                {!isMobile && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>or</span>
                            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                        </div>
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isGoogleSubmitting}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '13px', background: 'rgba(255,255,255,0.95)', color: '#1F2937', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px', fontWeight: '700', fontSize: '14px', cursor: isGoogleSubmitting ? 'default' : 'pointer', opacity: isGoogleSubmitting ? 0.7 : 1, minHeight: '48px' }}
                        >
                            {isGoogleSubmitting ? <Loader2 size={17} style={{ animation: 'spin 0.8s linear infinite' }} /> : <GoogleGlyph />}
                            {isGoogleSubmitting ? 'Please wait...' : 'Continue with Google'}
                        </button>
                    </>
                )}

                <button
                    type="button"
                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '13px', cursor: 'pointer', fontWeight: '600', padding: '4px', minHeight: '36px' }}
                >
                    {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
            </form>

            {showForgotPassword && (
                <div
                    onClick={() => setShowForgotPassword(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 'min(360px, 100%)', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '16px',
                            boxSizing: 'border-box',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><KeyRound size={16} /> Reset Password</h2>
                                <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>Enter your email and we'll send you a reset link.</p>
                            </div>
                            <button type="button" onClick={() => setShowForgotPassword(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', flexShrink: 0 }}><X size={18} /></button>
                        </div>

                        {resetStatus === 'sent' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', color: '#6EE7B7', fontSize: '13px', fontWeight: '600' }}>
                                <CheckCircle size={16} /> Password reset link sent to your email
                            </div>
                        ) : (
                            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {resetError && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#FCA5A5', fontSize: '13px', fontWeight: '600' }}>
                                        <AlertCircle size={16} /> {resetError}
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="reset-password-email" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}><Mail size={13} /> Email</label>
                                    <input id="reset-password-email" name="resetEmail" type="email" autoComplete="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@example.com" style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <button
                                    type="submit"
                                    disabled={resetStatus === 'sending'}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: resetStatus === 'sending' ? 'default' : 'pointer', opacity: resetStatus === 'sending' ? 0.7 : 1 }}
                                >
                                    {resetStatus === 'sending' ? 'Sending...' : 'Send Reset Link'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;
