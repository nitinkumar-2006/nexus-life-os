// src/AppRoot.jsx
//
// Sits above DashboardLayout and decides what to render based on auth
// state. When Firebase isn't configured (see src/firebase/config.js), this
// renders DashboardLayout directly - byte-for-byte the same behavior the
// app always had, no login screen, nothing changes for local-only users.
import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { CloudSyncProvider } from './context/CloudSyncContext.jsx';
import { WeatherProvider } from './context/WeatherContext.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import BiometricLockScreen from './components/BiometricLockScreen.jsx';
import QuickPinUnlockScreen from './components/QuickPinUnlockScreen.jsx';
import AppSplashScreen from './components/AppSplashScreen.jsx';
import { isBiometricLockEnabled } from './utils/biometricAuth.js';
import { isQuickPinEnabled } from './utils/quickPin.js';

// A single, real cross-fade for every screen transition this gate makes
// (lock -> loading -> login -> dashboard, or straight to dashboard once
// already unlocked) - each branch below is rendered through this wrapper,
// keyed by `screenKey`, so React remounts (and replays the fade-in) on
// every genuine screen change instead of an instant, jarring swap. Not a
// true old-fades-out-while-new-fades-in dissolve (that needs both screens
// mounted at once, real extra complexity for marginal gain here) - a clean
// fade-in on the new screen already reads as smooth and removes every
// abrupt cut, which is the actual "zero flicker" requirement.
const GateTransition = ({ screenKey, children }) => (
    <div key={screenKey} style={{ animation: 'nexusGateFadeIn 0.35s ease' }}>
        {children}
        <style>{`@keyframes nexusGateFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
);

const Gate = () => {
    const { user, isConfigured, isLoading, logout } = useAuth();
    // Deliberately session-only (not persisted) - every fresh app
    // launch/resume must genuinely re-request the biometric check,
    // the entire point of a lock screen. Checked before the
    // isConfigured branch below: biometric lock is a real
    // device-level security feature, independent of cloud account
    // status, so it must apply the same way whether or not Firebase
    // is configured - a local-only user who enabled it in Settings
    // still needs to see this gate.
    const [isBiometricUnlocked, setIsBiometricUnlocked] = useState(false);
    // Same session-only pattern as biometric above - a real app re-open
    // must always re-request the Quick Sign-In PIN.
    const [isQuickPinUnlocked, setIsQuickPinUnlocked] = useState(false);

    if (isBiometricLockEnabled() && !isBiometricUnlocked) {
        return <GateTransition screenKey="biometric"><BiometricLockScreen onUnlock={() => setIsBiometricUnlocked(true)} /></GateTransition>;
    }

    if (!isConfigured) {
        // Local-only mode: unchanged from before Firebase was added.
        return <GateTransition screenKey="dashboard"><DashboardLayout /></GateTransition>;
    }

    if (isLoading) {
        // Same branded splash used for the pre-React-mount moment (see
        // index.html's own static #nexus-boot-splash) - Firebase's auth
        // check resolving is the only other real "still starting up" state
        // in this app, so it gets the identical screen instead of a plain
        // "Loading..." text on a bare background.
        return <GateTransition screenKey="loading"><AppSplashScreen /></GateTransition>;
    }

    if (!user) {
        return <GateTransition screenKey="login"><LoginPage /></GateTransition>;
    }

    // Only reachable once a real Firebase session already exists (the
    // `!user` branch above always wins first) - this never substitutes
    // for actual sign-in, it only gates whether that already-valid
    // session's UI is shown, exactly like the biometric gate above.
    if (isQuickPinEnabled() && !isQuickPinUnlocked) {
        return (
            <GateTransition screenKey="quickpin">
                <QuickPinUnlockScreen
                    onUnlock={() => setIsQuickPinUnlocked(true)}
                    onUseDifferentAccount={() => logout()}
                />
            </GateTransition>
        );
    }

    return (
        <GateTransition screenKey="dashboard-cloud">
            <CloudSyncProvider>
                <DashboardLayout />
            </CloudSyncProvider>
        </GateTransition>
    );
};

const AppRoot = () => (
    // WeatherProvider sits above the entire auth/lock gate (not inside
    // DashboardLayout, where it used to live) so the real weather fetch
    // starts the instant the app loads - in parallel with the user
    // completing biometric/PIN/sign-in, not only after they clear it. This
    // is safe to prefetch this early specifically because weather is
    // ambient, non-personal data (unlike profile/finance/cloud-synced
    // content, which correctly stay gated behind DashboardLayout only
    // mounting post-auth) - by the time the dashboard actually renders,
    // the fetch that used to only start THEN has often already resolved.
    <WeatherProvider>
        <AuthProvider>
            <Gate />
        </AuthProvider>
    </WeatherProvider>
);

export default AppRoot;
