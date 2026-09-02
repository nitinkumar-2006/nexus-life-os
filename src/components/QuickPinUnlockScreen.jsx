// src/components/QuickPinUnlockScreen.jsx
//
// Rendered by AppRoot.jsx in place of the dashboard whenever a Quick
// Sign-In PIN is configured (see SettingsPage's Security card) and this
// session hasn't unlocked it yet. The Firebase session underneath is
// already genuinely signed in - this screen only ever gates whether the
// UI shows it, exactly like BiometricLockScreen already does for
// fingerprint/face. "Sign in differently" falls back to a real sign-out,
// landing on LoginPage's actual email/phone + password form - this screen
// never tries to verify identity against Firebase itself, only against
// the local PIN hash.
import { useState } from 'react';
import { KeyRound, AlertCircle, LogOut } from 'lucide-react';
import { verifyQuickPin } from '../utils/quickPin.js';

const QuickPinUnlockScreen = ({ onUnlock, onUseDifferentAccount }) => {
    const [pinInput, setPinInput] = useState('');
    const [error, setError] = useState('');
    const [checking, setChecking] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setChecking(true);
        setError('');
        try {
            const ok = await verifyQuickPin(pinInput);
            if (ok) {
                onUnlock();
            } else {
                setError('Incorrect PIN. Try again.');
                setPinInput('');
            }
        } catch (err) {
            setError('Could not verify PIN right now. Please try again.');
        } finally {
            setChecking(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f0f17', gap: '20px', padding: '20px', boxSizing: 'border-box' }}>
            <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8',
            }}>
                <KeyRound size={32} />
            </div>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>Welcome back</h2>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>Enter your Quick Sign-In PIN to continue.</p>
            </div>
            <form onSubmit={handleSubmit} style={{ width: '280px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label htmlFor="quick-pin-unlock-input" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>4-digit Quick Sign-In PIN</label>
                <input
                    id="quick-pin-unlock-input"
                    name="quickPinUnlock"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    autoComplete="off"
                    autoFocus
                    value={pinInput}
                    onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                    placeholder="••••"
                    style={{ width: '100%', textAlign: 'center', letterSpacing: '8px', fontSize: '20px', padding: '14px', borderRadius: '12px', border: `1px solid ${error ? '#EF4444' : 'rgba(255,255,255,0.15)'}`, background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#FCA5A5', fontSize: '13px', fontWeight: '600' }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}
                <button
                    type="submit"
                    disabled={pinInput.length !== 4 || checking}
                    style={{ padding: '12px', background: pinInput.length === 4 ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: pinInput.length === 4 ? 'pointer' : 'default' }}
                >
                    {checking ? 'Checking...' : 'Unlock'}
                </button>
                <button
                    type="button"
                    onClick={onUseDifferentAccount}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#6B7280', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: '4px' }}
                >
                    <LogOut size={13} /> Sign in with a different account
                </button>
            </form>
        </div>
    );
};

export default QuickPinUnlockScreen;
