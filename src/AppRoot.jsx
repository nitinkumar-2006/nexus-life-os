// src/AppRoot.jsx
//
// Sits above DashboardLayout and decides what to render based on auth
// state. When Firebase isn't configured (see src/firebase/config.js), this
// renders DashboardLayout directly - byte-for-byte the same behavior the
// app always had, no login screen, nothing changes for local-only users.
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { CloudSyncProvider } from './context/CloudSyncContext.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import BiometricLockScreen from './components/BiometricLockScreen.jsx';
import { isBiometricLockEnabled } from './utils/biometricAuth.js';

const Gate = () => {
    const { user, isConfigured, isLoading } = useAuth();
    // Deliberately session-only (not persisted) - every fresh app
    // launch/resume must genuinely re-request the biometric check,
    // the entire point of a lock screen. Checked before the
    // isConfigured branch below: biometric lock is a real
    // device-level security feature, independent of cloud account
    // status, so it must apply the same way whether or not Firebase
    // is configured - a local-only user who enabled it in Settings
    // still needs to see this gate.
    const [isBiometricUnlocked, setIsBiometricUnlocked] = useState(false);

    if (isBiometricLockEnabled() && !isBiometricUnlocked) {
        return <BiometricLockScreen onUnlock={() => setIsBiometricUnlocked(true)} />;
    }

    if (!isConfigured) {
        // Local-only mode: unchanged from before Firebase was added.
        return <DashboardLayout />;
    }

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f17', color: '#94A3B8', fontFamily: '-apple-system, sans-serif', fontSize: '14px' }}>
                Loading...
            </div>
        );
    }

    if (!user) {
        return <LoginPage />;
    }

    return (
        <CloudSyncProvider>
            <DashboardLayout />
        </CloudSyncProvider>
    );
};

const AppRoot = () => (
    <AuthProvider>
        <Gate />
    </AuthProvider>
);

export default AppRoot;
