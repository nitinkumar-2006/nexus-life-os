// src/components/BiometricLockScreen.jsx
//
// A real, working app-level lock screen - genuinely gates access to
// the whole dashboard until the device's own biometric check passes,
// mirroring how LoginPage.jsx already gates access before
// authentication. Rendered by AppRoot.jsx in place of DashboardLayout
// whenever biometric lock is enabled and this session hasn't yet
// been unlocked.
//
// A real device video walkthrough showed a genuine, severe failure
// mode: inside a desktop app wrapper lacking a proper WebAuthn
// platform-authenticator bridge, the system passkey picker offers
// only "use your phone" (QR code) or "use a security key" - no Touch
// ID option at all - leaving a real user completely stranded with no
// way to unlock at all. A PIN fallback, only ever offered when a real
// PIN is already genuinely configured (offering to set a new one from
// the lock screen itself would be a real security hole, bypassing the
// lock without proving ownership), is the direct, responsible fix for
// that actual failure mode - not something that can be fixed by
// improving the WebAuthn call itself, since the underlying gap is in
// the desktop wrapper's own environment, outside this app's control.
import { useState } from 'react';
import { Fingerprint, AlertCircle, KeyRound } from 'lucide-react';
import { verifyBiometric } from '../utils/biometricAuth.js';
import { verifyPin, isPinConfigured } from '../utils/pinSecurity.js';

const readAppPin = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || 'null');
        return saved?.appPin || '';
    } catch (e) {
        return '';
    }
};

const BiometricLockScreen = ({ onUnlock }) => {
    const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'failed'
    const [showPinFallback, setShowPinFallback] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinChecking, setPinChecking] = useState(false);
    const appPin = readAppPin();
    const pinAvailable = isPinConfigured(appPin);

    const handleUnlock = async () => {
        setStatus('checking');
        const ok = await verifyBiometric();
        if (ok) {
            onUnlock();
        } else {
            setStatus('failed');
        }
    };

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        setPinChecking(true);
        setPinError('');
        const ok = await verifyPin(pinInput, appPin);
        setPinChecking(false);
        if (ok) {
            onUnlock();
        } else {
            setPinError('Incorrect PIN. Try again.');
            setPinInput('');
        }
    };

    return (
        <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f0f17', gap: '24px', padding: '20px', boxSizing: 'border-box' }}>
            {!showPinFallback && (
                <>
                    <button
                        onClick={handleUnlock}
                        disabled={status === 'checking'}
                        style={{
                            width: '96px', height: '96px', borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: status === 'checking' ? 'default' : 'pointer', color: '#818CF8',
                        }}
                    >
                        <Fingerprint size={44} />
                    </button>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>Nexus OS is Locked</h2>
                        <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>
                            {status === 'checking' ? 'Verifying...' : 'Tap the icon to unlock with your fingerprint or face.'}
                        </p>
                    </div>
                    {status === 'failed' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', maxWidth: '340px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#FCA5A5', fontSize: '13px', fontWeight: '600', textAlign: 'left' }}>
                                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                {pinAvailable
                                    ? "Biometric verification didn't complete - this can happen if your browser or device doesn't offer a fingerprint/face option here. Use your PIN instead, or try again."
                                    : "Biometric verification didn't complete - this can happen if your browser or device doesn't offer a fingerprint/face option here. Try again."}
                            </div>
                            {pinAvailable && (
                                <button
                                    onClick={() => setShowPinFallback(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#818CF8', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                                >
                                    <KeyRound size={14} /> Unlock with PIN instead
                                </button>
                            )}
                        </div>
                    )}
                    {status !== 'failed' && pinAvailable && (
                        <button
                            onClick={() => setShowPinFallback(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#6B7280', fontSize: '12px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                        >
                            <KeyRound size={13} /> Use PIN instead
                        </button>
                    )}
                </>
            )}

            {showPinFallback && (
                <div style={{ width: '280px', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8',
                    }}>
                        <KeyRound size={32} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>Enter your PIN</h2>
                        <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>Unlock Nexus OS with your 4-digit PIN.</p>
                    </div>
                    <form onSubmit={handlePinSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label htmlFor="biometric-lock-pin-fallback" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>4-digit PIN</label>
                        <input
                            id="biometric-lock-pin-fallback"
                            name="biometricLockPinFallback"
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            autoComplete="off"
                            autoFocus
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="••••"
                            style={{ width: '100%', textAlign: 'center', letterSpacing: '8px', fontSize: '20px', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.25)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {pinError && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#FCA5A5', fontSize: '13px', fontWeight: '600' }}>
                                <AlertCircle size={16} /> {pinError}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={pinInput.length !== 4 || pinChecking}
                            style={{ padding: '12px', background: pinInput.length === 4 ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: pinInput.length === 4 ? 'pointer' : 'default' }}
                        >
                            {pinChecking ? 'Checking...' : 'Unlock'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowPinFallback(false); setPinInput(''); setPinError(''); setStatus('idle'); }}
                            style={{ background: 'transparent', border: 'none', color: '#6B7280', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                            Back to fingerprint/face
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default BiometricLockScreen;

