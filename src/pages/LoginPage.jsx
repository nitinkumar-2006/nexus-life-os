// src/pages/LoginPage.jsx
//
// Only ever rendered when Firebase IS configured (see App entry point) and
// no user is currently signed in. Local-only installs never see this page.
import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, LogIn, UserPlus, AlertCircle, KeyRound, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getAuthErrorMessage } from '../utils/authErrorMessages.js';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator.jsx';

const LoginPage = () => {
    const { signup, login, loginWithGoogle, resetPassword } = useAuth();
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetStatus, setResetStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
    const [resetError, setResetError] = useState('');

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
        setIsSubmitting(true);
        try {
            if (mode === 'signup') {
                await signup(email, password, name);
            } else {
                await login(email, password);
            }
        } catch (err) {
            setError(getAuthErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setIsSubmitting(true);
        try {
            await loginWithGoogle();
        } catch (err) {
            setError(getAuthErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'radial-gradient(circle at 30% 20%, #1e293b 0%, #0f0f17 60%)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
        >
            <form
                onSubmit={handleSubmit}
                style={{
                    width: '380px', background: 'rgba(27, 27, 47, 0.85)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '24px', padding: '36px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', gap: '18px',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/nexus-logo.png" alt="Nexus" style={{ width: '56px', height: '56px', objectFit: 'contain', background: 'transparent', borderRadius: '14px' }} />
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: 0 }}>Nexus Life OS</h1>
                    <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, textAlign: 'center' }}>
                        {mode === 'login' ? 'Sign in to sync your data across devices.' : 'Create an account to enable cloud sync.'}
                    </p>
                </div>

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#FCA5A5', fontSize: '13px', fontWeight: '600' }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                {mode === 'signup' && (
                    <div>
                        <label htmlFor="login-page-name" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}><UserIcon size={13} /> Full Name</label>
                        <input id="login-page-name" name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nitin Kumar" style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                )}

                <div>
                    <label htmlFor="login-page-email" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}><Mail size={13} /> Email</label>
                    <input id="login-page-email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div>
                    <label htmlFor="login-page-password" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}><Lock size={13} /> Password</label>
                    <input id="login-page-password" name="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    {mode === 'signup' && <PasswordStrengthIndicator password={password} />}
                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={() => { setResetEmail(email); setResetStatus('idle'); setResetError(''); setShowForgotPassword(true); }}
                            style={{ background: 'transparent', border: 'none', color: '#818CF8', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0, marginTop: '8px' }}
                        >
                            Forgot Password?
                        </button>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.7 : 1, marginTop: '6px' }}
                >
                    {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                    {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', letterSpacing: '0.5px' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                </div>

                <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px',
                        background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', color: '#fff',
                        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', fontWeight: '700', fontSize: '14px',
                        cursor: isSubmitting ? 'default' : 'pointer', opacity: isSubmitting ? 0.7 : 1,
                    }}
                >
                    {/* Real, official Google "G" mark colors - Google's own
                        brand guidelines call for the full multi-color mark
                        on a "Sign in with Google" button, not a single-tone
                        icon. */}
                    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
                        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                        <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14-5.5l-6.4-5.4C29.5 34.8 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.6 39.6 16.3 44 24 44z" />
                        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.4 5.4C40.8 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
                    </svg>
                    Continue with Google
                </button>

                <button
                    type="button"
                    onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
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
                            width: '360px', maxWidth: '100%', background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '28px',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '16px',
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
