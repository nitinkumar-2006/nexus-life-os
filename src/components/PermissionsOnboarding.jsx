// src/components/PermissionsOnboarding.jsx
//
// First-launch permissions walkthrough for the native Android app -
// requests Location, Calendar, and SMS permissions one at a time, each
// with a plain-language reason shown BEFORE the real system dialog
// fires, rather than three back-to-back OS prompts with no context
// (the actual thing "clean, polite" is asking for here - most users
// reflexively deny a permission dialog they don't yet understand).
// Rendered once by DashboardLayout.jsx, gated on both
// Capacitor.isNativePlatform() (there is nothing to ask for in a browser
// tab) and a localStorage completion flag so it never reappears after
// the user has gone through it (or skipped it) once. Every "Allow"
// button advances to the next step regardless of what the user actually
// chose in the system dialog - a denial here isn't a dead end, it's
// exactly what the in-app Enable buttons on Home/Calendar/Finance still
// cover later.
import { useState } from 'react';
import { MapPin, Calendar as CalendarIcon, Sparkles, ChevronRight } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { requestDeviceCalendarPermission } from '../utils/nativeCalendarBridge.js';

export const PERMISSIONS_ONBOARDING_KEY = 'nexus_permissions_onboarding_completed';

// Real, confirmed bug fixed by removing the SMS step that used to live
// here: AndroidManifest.xml no longer declares READ_SMS/RECEIVE_SMS at
// all (removed as a Play Protect install-block fix), so tapping "Allow"
// on that step could never actually succeed - Android denies it
// immediately since the permission isn't even declared, confirmed live
// via the system's own "App was denied access to SMS" dialog. Offering
// a permission step that can only ever fail was a real, confusing
// first-launch experience, not a small cosmetic issue - see
// smsFinanceBridge.js's own isSmsFinanceBridgeAvailable() for the same
// fix applied to Finance's own SMS card.
const STEPS = [
    {
        id: 'location',
        icon: MapPin,
        title: 'Local Weather',
        body: "Nexus shows real, local weather on your Home screen and adapts the Dynamic theme's sky to match it. This only ever uses your approximate (city-level) location, never precise GPS.",
        request: async () => { await Geolocation.requestPermissions({ permissions: ['coarseLocation'] }); },
    },
    {
        id: 'calendar',
        icon: CalendarIcon,
        title: 'Calendar Sync',
        body: 'Nexus can read your device calendar to bring existing events straight into your Calendar Hub schedule - read-only, nothing is ever added or changed on your device calendar.',
        request: async () => { await requestDeviceCalendarPermission(); },
    },
];

const PermissionsOnboarding = ({ onComplete }) => {
    // -1 = welcome screen, 0..STEPS.length-1 = one screen per permission,
    // STEPS.length = the closing "All set" screen.
    const [stepIndex, setStepIndex] = useState(-1);
    const [isRequesting, setIsRequesting] = useState(false);

    const finish = () => {
        localStorage.setItem(PERMISSIONS_ONBOARDING_KEY, 'true');
        onComplete();
    };

    const advance = () => setStepIndex((i) => i + 1);

    const handleAllow = async () => {
        const step = STEPS[stepIndex];
        setIsRequesting(true);
        try {
            await step.request();
        } catch (e) {
            // A denied/unsupported permission is a normal, expected
            // outcome here, not a failure to surface - the in-app Enable
            // buttons on the relevant page are the real retry path.
        } finally {
            setIsRequesting(false);
            advance();
        }
    };

    const currentStep = stepIndex >= 0 && stepIndex < STEPS.length ? STEPS[stepIndex] : null;
    const isWelcome = stepIndex === -1;
    const isClosing = stepIndex === STEPS.length;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Permissions setup"
            style={{
                position: 'fixed', inset: 0, zIndex: 5000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(10, 10, 15, 0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                padding: '20px', boxSizing: 'border-box',
                paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))',
                paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
            }}
        >
            <div style={{
                // Real, confirmed bug: --bg-surface respects the user's
                // own glass-transparency slider, which can go low enough
                // to make this card's text visually collide with
                // whatever's behind it (confirmed via a real device
                // screenshot). --popover-bg is this app's own established,
                // solid-floor token for exactly this case - already used
                // by System Diagnostics/Audio Studio/Notifications for
                // the same reason.
                width: '100%', maxWidth: '380px', background: 'var(--popover-bg)', border: '1px solid var(--border-premium)',
                borderRadius: '24px', padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', textAlign: 'center',
            }}>
                {isWelcome && (
                    <>
                        <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--primary-muted)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={30} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '19px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Welcome to Nexus</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                                A couple of optional permissions unlock the full experience - local weather and calendar sync. You can allow or skip each one, and change your mind anytime in Settings.
                            </p>
                        </div>
                        <button
                            type="button" onClick={advance}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            Get Started <ChevronRight size={16} />
                        </button>
                    </>
                )}

                {currentStep && (
                    <>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {STEPS.map((s, i) => (
                                <div key={s.id} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= stepIndex ? 'var(--primary)' : 'var(--border-premium)', transition: 'background 0.2s ease' }} />
                            ))}
                        </div>
                        <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--primary-muted)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <currentStep.icon size={30} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{currentStep.title}</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>{currentStep.body}</p>
                        </div>
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                type="button" onClick={handleAllow} disabled={isRequesting}
                                style={{ width: '100%', padding: '13px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: isRequesting ? 'default' : 'pointer', opacity: isRequesting ? 0.7 : 1, fontFamily: 'inherit' }}
                            >
                                {isRequesting ? 'Requesting…' : 'Allow'}
                            </button>
                            <button
                                type="button" onClick={advance} disabled={isRequesting}
                                style={{ width: '100%', padding: '10px', background: 'transparent', color: 'var(--text-muted)', border: 'none', borderRadius: '9999px', fontWeight: '600', fontSize: '13px', cursor: isRequesting ? 'default' : 'pointer', fontFamily: 'inherit' }}
                            >
                                Skip for now
                            </button>
                        </div>
                    </>
                )}

                {isClosing && (
                    <>
                        <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={30} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '19px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>You're all set</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                                Head to Settings anytime to review or change these permissions.
                            </p>
                        </div>
                        <button
                            type="button" onClick={finish}
                            style={{ width: '100%', padding: '13px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            Continue to Nexus
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default PermissionsOnboarding;
