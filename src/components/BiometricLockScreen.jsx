// src/components/BiometricLockScreen.jsx
//
// A real, working app-level lock screen - genuinely gates access to
// the whole dashboard until the device's own biometric check passes,
// mirroring how LoginPage.jsx already gates access before
// authentication. Rendered by AppRoot.jsx in place of DashboardLayout
// whenever biometric lock is enabled and this session hasn't yet
// been unlocked.
import React, { useState } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { verifyBiometric } from '../utils/biometricAuth.js';

const BiometricLockScreen = ({ onUnlock }) => {
    const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'failed'

    const handleUnlock = async () => {
        setStatus('checking');
        const ok = await verifyBiometric();
        if (ok) {
            onUnlock();
        } else {
            setStatus('failed');
        }
    };

    return (
        <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f0f17', gap: '24px', padding: '20px', boxSizing: 'border-box' }}>
            <button
                onClick={handleUnlock}
                disabled={status === 'checking'}
                style={{
                    width: '96px', height: '96px', borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: status === 'checking' ? 'default' : 'pointer', color: '#818CF8',
                }}
            >
                <Fingerprint size={44} />
            </button>
            <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', margin: 0 }}>Nexus Life OS is Locked</h2>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px' }}>
                    {status === 'checking' ? 'Verifying...' : 'Tap the icon to unlock with your fingerprint or face.'}
                </p>
            </div>
            {status === 'failed' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#FCA5A5', fontSize: '13px', fontWeight: '600' }}>
                    <AlertCircle size={16} /> Verification failed or cancelled. Try again.
                </div>
            )}
        </div>
    );
};

export default BiometricLockScreen;
