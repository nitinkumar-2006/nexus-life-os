// src/components/ProtectedModuleGate.jsx
//
// A real, working per-module protection gate - the actual enforcement
// this app's own existing "Protected Modules" toggles in Settings
// were missing entirely before this round: settings.lockedModules was
// genuinely never consumed anywhere outside SettingsPage.jsx itself,
// meaning the toggle UI was purely cosmetic and never actually gated
// access to anything. This component is what makes that real: wraps
// any module's own render in DashboardLayout.jsx, and shows a real
// unlock prompt (PIN and/or biometric, whichever this device actually
// has configured) instead of the module's own content, until the
// person genuinely proves they're allowed in.
//
// "Unlocked this session" state lives in the caller (DashboardLayout),
// not here - so switching between two protected tabs doesn't force a
// fresh challenge every single time, matching how AppRoot.jsx's own
// app-level biometric gate already behaves for the whole app.
import React, { useState } from 'react';
import { Lock, AlertCircle, Fingerprint, KeyRound } from 'lucide-react';
import { verifyPin, isPinConfigured } from '../utils/pinSecurity.js';
import { verifyBiometric, isBiometricLockEnabled, isBiometricSupported } from '../utils/biometricAuth.js';

const readAppPin = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || 'null');
        return saved?.appPin || '';
    } catch (e) {
        return '';
    }
};

const ProtectedModuleGate = ({ moduleId, moduleLabel, isLocked, isUnlockedThisSession, onUnlock, children }) => {
    const [mode, setMode] = useState('choose'); // 'choose' | 'pin' | 'biometric'
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinChecking, setPinChecking] = useState(false);
    const [bioStatus, setBioStatus] = useState('idle'); // 'idle' | 'checking' | 'failed'

    const appPin = readAppPin();
    const pinAvailable = isPinConfigured(appPin);
    const biometricAvailable = isBiometricLockEnabled() && isBiometricSupported();

    if (!isLocked || isUnlockedThisSession) return children;

    // Neither real unlock method is genuinely configured - this can
    // happen if a module was added to lockedModules before a PIN/
    // biometric was ever set up, or after one was later removed.
    // Blocking access with no possible way to unlock would be a real
    // dead end, not a security feature, so this module is treated as
    // genuinely unprotected rather than permanently inaccessible.
    if (!pinAvailable && !biometricAvailable) return children;

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        setPinChecking(true);
        setPinError('');
        const ok = await verifyPin(pinInput, appPin);
        setPinChecking(false);
        if (ok) {
            onUnlock(moduleId);
        } else {
            setPinError('Incorrect PIN. Try again.');
            setPinInput('');
        }
    };

    const handleBiometric = async () => {
        setBioStatus('checking');
        const ok = await verifyBiometric();
        if (ok) {
            onUnlock(moduleId);
        } else {
            setBioStatus('failed');
        }
    };

    // Genuinely skip the "choose a method" screen when only one real
    // method is available - asking someone to pick between "PIN" and
    // nothing isn't a real choice.
    const effectiveMode = mode === 'choose' && pinAvailable && !biometricAvailable ? 'pin'
        : mode === 'choose' && biometricAvailable && !pinAvailable ? 'biometric'
        : mode;

    return (
        <div style={{ minHeight: '60vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '40px 20px', boxSizing: 'border-box' }}>
            {effectiveMode === 'choose' && (
                <>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                        <Lock size={32} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{moduleLabel} is Protected</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Choose how you'd like to unlock this module.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setMode('pin')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <KeyRound size={16} /> Use PIN
                        </button>
                        <button onClick={() => { setMode('biometric'); handleBiometric(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                            <Fingerprint size={16} /> Use Biometric
                        </button>
                    </div>
                </>
            )}

            {effectiveMode === 'pin' && (
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                        <KeyRound size={28} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{moduleLabel} is Protected</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Enter your 4-digit PIN to continue.</p>
                    </div>
                    <form onSubmit={handlePinSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label htmlFor={`protected-module-pin-${moduleId}`} style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>4-digit PIN for {moduleLabel}</label>
                        <input
                            id={`protected-module-pin-${moduleId}`}
                            name={`protectedModulePin-${moduleId}`}
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            autoComplete="off"
                            autoFocus
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="••••"
                            style={{ width: '100%', textAlign: 'center', letterSpacing: '8px', fontSize: '20px', padding: '14px', borderRadius: '12px', border: `1px solid ${pinError ? '#EF4444' : 'var(--border-premium)'}`, background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {pinError && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#EF4444' }}>
                                <AlertCircle size={14} /> {pinError}
                            </div>
                        )}
                        <button type="submit" disabled={pinInput.length !== 4 || pinChecking} style={{ padding: '12px', background: pinInput.length === 4 ? 'var(--primary)' : 'var(--widget-bg)', color: pinInput.length === 4 ? 'var(--text-on-primary)' : 'var(--text-muted)', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: pinInput.length === 4 ? 'pointer' : 'default' }}>
                            {pinChecking ? 'Checking...' : 'Unlock'}
                        </button>
                        {biometricAvailable && (
                            <button type="button" onClick={() => { setMode('biometric'); setPinError(''); handleBiometric(); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                                Use biometric instead
                            </button>
                        )}
                    </form>
                </div>
            )}

            {effectiveMode === 'biometric' && (
                <>
                    <button
                        onClick={handleBiometric}
                        disabled={bioStatus === 'checking'}
                        style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', cursor: bioStatus === 'checking' ? 'default' : 'pointer' }}
                    >
                        <Fingerprint size={36} />
                    </button>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{moduleLabel} is Protected</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
                            {bioStatus === 'checking' ? 'Verifying...' : 'Tap the icon to unlock with your fingerprint or face.'}
                        </p>
                    </div>
                    {bioStatus === 'failed' && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', maxWidth: '320px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#EF4444', fontSize: '13px', fontWeight: '600', textAlign: 'left' }}>
                                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                                Biometric verification didn't complete - this can happen if your browser or device doesn't offer a fingerprint/face option here.
                            </div>
                            {pinAvailable && (
                                <button onClick={() => { setMode('pin'); setBioStatus('idle'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                                    <KeyRound size={14} /> Use PIN instead
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ProtectedModuleGate;
