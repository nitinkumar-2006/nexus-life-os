// src/pages/SettingsPage.jsx
import { useState, useEffect, useRef } from 'react';
import { 
    Sliders, Save, 
    CheckCircle, AlertTriangle, Shield, Download, Upload, Bell, 
    Cloud, Monitor, Volume2, VolumeX, Play, HardDrive,
    LayoutDashboard, Trash2, DollarSign, Activity, LogOut, RefreshCw, CloudOff,
    Check, X, Music, Lock, Unlock, Edit3, Mail, Thermometer, Sparkles,
    Image, ImagePlus, LayoutGrid, BookOpen, ChevronDown,
    Clock, ClipboardList, CalendarDays, Utensils, RotateCcw,
    Link2, Phone, Cpu, User, ArrowUpRight, Type, Search, Mic, Key, FileType, Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getAuthErrorMessage } from '../utils/authErrorMessages.js';
import PasswordStrengthIndicator from '../components/PasswordStrengthIndicator.jsx';
import { useAudioPlayer } from '../context/AudioPlayerContext.jsx';
import { useStreaming } from '../context/StreamingContext.jsx';
import { useCloudSync } from '../context/CloudSyncContext.jsx';
import { useSoundSettings, useSoundActions, SOUND_CHANNELS } from '../context/SoundSettingsContext.jsx';
import { getUiClickUrl, getTaskAlertUrl } from '../utils/noiseSynth.js';
import { hashPin, isPinConfigured, isValidPinInput, verifyPin } from '../utils/pinSecurity.js';
import { encryptBackupPayload, decryptBackupPayload, isEncryptedBackupPayload } from '../utils/backupEncryption.js';
import { isBiometricSupported, isBiometricLockEnabled, registerBiometric, disableBiometricLock } from '../utils/biometricAuth.js';
import { isValidPhoneNumber, isSyntheticPhoneEmail, syntheticEmailToPhone } from '../utils/phoneAuth.js';
import { linkIdentifierToAccount, unlinkIdentifierFromAccount, getLinkedIdentifiers } from '../utils/accountLinking.js';
import { doc, deleteDoc } from 'firebase/firestore';
import { GLASS_ACCENT_TINTS } from '../constants/glassAccentTints.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import VoiceAssistantSettings from '../components/VoiceAssistantSettings.jsx';
import TourGuide from '../components/TourGuide.jsx';
import { hasSeenTour } from '../hooks/useTourGuide.js';
import { TOUR_STEPS } from '../constants/tourSteps.js';
import { WALLPAPER_OPTIONS, WALLPAPER_CATEGORIES } from '../constants/wallpaperOptions.js';
import { FONT_OPTIONS, FONT_CATEGORIES, DEFAULT_FONT_ID, getFontOption } from '../constants/fontOptions.js';
import { loadFontStylesheet, preloadFontsForPreview } from '../utils/fontLoader.js';
import { saveCustomFontBlob, getCustomFontBlob, deleteCustomFontBlob } from '../utils/customFontStorage.js';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { SAAVN_API_BASE_URL_FALLBACK } from '../config/streamingConfig.js';
import { searchSaavnSongs } from '../utils/saavnClient.js';
import SettingsLayout from '../components/settings/SettingsLayout.jsx';
import SettingsProfileHeader from '../components/settings/SettingsProfileHeader.jsx';
import SettingCard from '../components/settings/SettingCard.jsx';

// Real wallpaper presets - each preview gradient genuinely matches its
// actual, corresponding component in AlternateBackgrounds.jsx, not an
// arbitrary decorative color.
import { db, isFirebaseConfigured } from '../firebase/config.js';

// Real, stable, module-scope components - NOT redefined inside SettingsPage
// on every render. They previously were, which meant React saw a
// brand-new component type every single render of the page and fully
// unmounted + remounted every toggle switch and every sound card (not
// just re-rendering them) - destroying internal state each time
// (SoundChannelCard's own uploadError, for one) and doing far more DOM
// work than a normal re-render would. Both now pull their own data via
// hooks instead of closing over the parent's variables, which is what
// makes moving them out here possible without changing their behavior.
// Real CSS classes (settingsLayout.css) instead of the previous fully
// inline-styled implementation - same exact props/behavior (including
// the real UI-click sound), now with a genuine subtle glow while
// active instead of a flat color swap.
const ToggleSwitch = ({ checked, onChange, compact = false }) => {
    const { playChannelSound } = useSoundActions();
    const fire = () => { playChannelSound('uiFeedback', getUiClickUrl); onChange(!checked); };
    return (
        <div
            role="switch"
            aria-checked={checked}
            tabIndex={0}
            onClick={fire}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
            }}
            className={`settings-toggle${compact ? ' is-compact' : ''}${checked ? ' is-checked' : ''}`}
        >
            <div className="settings-toggle-knob" />
        </div>
    );
};

// Fixes the reported slider jitter at its actual root cause: every
// setChannelVolume call updates context state, which triggers a
// synchronous JSON.stringify + localStorage.setItem of the WHOLE settings
// object (see the persistence effect in SoundSettingsContext.jsx) - fine
// for one call, but a native range input's onChange can fire dozens of
// times per second during a fast drag, and localStorage.setItem is a
// genuinely blocking operation. Doing that on every single pixel of
// movement is what read as choppy/laggy dragging.
//
// The fix: the slider's DISPLAYED position comes from local state that
// updates instantly on every pointer/input event, completely decoupled
// from the expensive side effect. The real value (which drives context,
// localStorage, and any live-playing audio like the Rain Audio loop) is
// only pushed at most once per animation frame via requestAnimationFrame -
// imperceptibly different from instant for both what the eye sees and
// what a continuously-playing sound hears, but a massive reduction in how
// often the expensive write actually happens. A guaranteed final flush on
// pointer-up/cancel means the very last value is never lost to the
// throttle, and native pointer events (not just onChange) are what make
// this "robust" to mouse, touch, and pen input alike, not just mouse
// clicks.
const SmoothVolumeSlider = ({ value, onChange, disabled, id, ariaLabel }) => {
    const [localValue, setLocalValue] = useState(value);
    const rafRef = useRef(null);
    const isDraggingRef = useRef(false);

    // Stay in sync with the real value when nothing is actively being
    // dragged (e.g. the very first mount, or the value changing from
    // somewhere else entirely) - but never let an external update fight
    // the user's own in-progress drag.
    useEffect(() => {
        if (!isDraggingRef.current) setLocalValue(value);
    }, [value]);

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    const handleChange = (e) => {
        const newValue = Number(e.target.value) / 100;
        setLocalValue(newValue); // instant, every event, however fast they fire
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => onChange(newValue));
    };

    const commitNow = (e) => {
        isDraggingRef.current = false;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        onChange(Number(e.target.value) / 100);
    };

    return (
        <>
            {id && (
                <label htmlFor={id} style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{ariaLabel || 'Volume'}</label>
            )}
            <input
                id={id}
                type="range" min="0" max="100" step="1"
                value={Math.round(localValue * 100)}
                disabled={disabled}
                onPointerDown={() => { isDraggingRef.current = true; }}
                onChange={handleChange}
                onPointerUp={commitNow}
                onPointerCancel={commitNow}
                // touchAction: 'none' is load-bearing on mobile (especially
                // inside Capacitor's Android WebView) - without it, a
                // horizontal finger-drag on this small thumb can be
                // reinterpreted as an attempt to vertically scroll the
                // Settings page instead of dragging the slider, since this
                // whole page scrolls and the browser's default touch
                // handling arbitrates that ambiguity in favor of scrolling.
                style={{ width: '72px', accentColor: 'var(--primary)', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', height: '4px', touchAction: 'none' }}
            />
        </>
    );
};

// Generalized version of SmoothVolumeSlider above - identical smooth-drag
// mechanics and exact visual styling (same width, accentColor, height,
// cursor/opacity states), but accepts a real min/max/step and returns
// the raw value rather than a hardcoded 0-1 float, so it works for any
// range (pixels, alpha, etc).
const SmoothRangeSlider = ({ value, min, max, step, onChange, disabled, width = '140px', id, ariaLabel }) => {
    const [localValue, setLocalValue] = useState(value);
    const rafRef = useRef(null);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        if (!isDraggingRef.current) setLocalValue(value);
    }, [value]);

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    const handleChange = (e) => {
        const newValue = Number(e.target.value);
        setLocalValue(newValue);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => onChange(newValue));
    };

    const commitNow = (e) => {
        isDraggingRef.current = false;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        onChange(Number(e.target.value));
    };

    return (
        <>
            {id && (
                <label htmlFor={id} style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{ariaLabel || 'Value'}</label>
            )}
            <input
                id={id}
                type="range" min={min} max={max} step={step}
                value={localValue}
                disabled={disabled}
                onPointerDown={() => { isDraggingRef.current = true; }}
                onChange={handleChange}
                onPointerUp={commitNow}
                onPointerCancel={commitNow}
                // See SmoothVolumeSlider's identical comment above -
                // touchAction: 'none' stops a finger-drag on this small
                // thumb from being swallowed as a page-scroll gesture on
                // mobile/Capacitor WebView.
                style={{ width, accentColor: 'var(--primary)', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', height: '4px', touchAction: 'none' }}
            />
        </>
    );
};
// Test-sound source per channel, for the "Test" button next to each slider
// - lets a channel's current volume/mute be heard immediately without
// waiting for the real triggering event (a toggle click elsewhere, a task
// completion). Both UI Feedback and Task Alerts sounds are cached and
// reused, so no blob-URL cleanup is needed. A
// plain module-level object - never needs to be recreated per render even
// now that it's outside the component too.
const CHANNEL_DEFAULT_SOUND = {
    uiFeedback: getUiClickUrl,
    taskAlerts: getTaskAlertUrl,
};

// One compact ROW per channel now, not a tall card - just icon, label,
// mute, the smooth-dragging volume slider, a live percentage, Test, and a
// "Manage" button that opens the detailed picker/upload modal below. The
// custom-sound list and upload control used to live inline in every card;
// moving them into an on-demand modal is what makes four channels fit as
// simple rows in one compact section instead of four separate tall cards.
const SoundChannelCard = ({ channelKey, icon, onManage }) => {
    const isMobile = useIsMobile();
    const { settings: soundSettings, setChannelVolume, setChannelMuted, playChannelSound } = useSoundSettings();
    const meta = SOUND_CHANNELS[channelKey];
    const channel = soundSettings[channelKey];

    const handleTestChannel = () => {
        playChannelSound(channelKey, CHANNEL_DEFAULT_SOUND[channelKey]);
    };

    const iconButtonStyle = {
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px',
        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '7px',
        color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: '0 1 auto' }}>
                {icon}
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: '72px' }} title={meta.label}>{meta.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <ToggleSwitch compact checked={!channel.muted} onChange={(val) => setChannelMuted(channelKey, !val)} />
                {channel.muted ? <VolumeX size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} /> : <Volume2 size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />}
                <SmoothVolumeSlider
                    id={`sound-channel-volume-${channelKey}`}
                    ariaLabel={`${meta.label} volume`}
                    value={channel.volume}
                    disabled={channel.muted}
                    onChange={(v) => setChannelVolume(channelKey, v)}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', width: '26px', textAlign: 'right', fontWeight: '700', flexShrink: 0 }}>
                    {channel.muted ? '--' : `${Math.round(channel.volume * 100)}%`}
                </span>
                {!isMobile && (
                <button onClick={handleTestChannel} title={`Test ${meta.label}`} style={iconButtonStyle}>
                    <Play size={11} />
                </button>
                )}
                <button onClick={onManage} title={`Manage ${meta.label} sounds`} style={iconButtonStyle}>
                    <Music size={11} />
                </button>
            </div>
        </div>
    );
};

// The "expandable drawer or modal" - the detailed Built-in/Custom picker
// and upload control that used to live inline in every card, now scoped
// to whichever ONE channel the user clicked Manage on. Matches the app's
// existing modal convention (fixed dark overlay + centered glass panel,
// click-outside or Escape to close) rather than inventing a new pattern.
const ManageSoundsModal = ({ channelKey, icon, onClose }) => {
    const {
        settings: soundSettings, customSounds, uploadCustomSound,
        deleteCustomSound, selectActiveSound, previewCustomSound,
    } = useSoundSettings();
    const meta = SOUND_CHANNELS[channelKey];
    const channel = soundSettings[channelKey];
    const sounds = customSounds[channelKey] || [];
    const fileInputId = `upload-modal-${channelKey}`;
    const [uploadError, setUploadError] = useState('');

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same filename later
        if (!file) return;
        const result = await uploadCustomSound(channelKey, file);
        setUploadError(result.ok ? '' : result.error);
    };

    const pickerRowStyle = (active) => ({
        display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer',
        background: active ? 'var(--primary-muted)' : 'var(--widget-bg)',
        border: `1px solid ${active ? 'var(--primary)' : 'var(--border-premium)'}`,
    });

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
            onClick={onClose}
        >
            <div
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '440px', maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '20px' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {icon}
                        <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Manage {meta.label}</h3>
                    </div>
                    <button onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{meta.description}</span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div onClick={() => selectActiveSound(channelKey, 'default')} style={pickerRowStyle(channel.activeSoundId === 'default')}>
                        {channel.activeSoundId === 'default' ? <Check size={14} color="var(--primary)" /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--text-muted)', flexShrink: 0 }} />}
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', flex: 1 }}>Built-in sound</span>
                    </div>
                    {sounds.length === 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No custom sounds uploaded yet.</div>
                    )}
                    {sounds.map((sound) => (
                        <div key={sound.id} onClick={() => selectActiveSound(channelKey, sound.id)} style={pickerRowStyle(channel.activeSoundId === sound.id)}>
                            {channel.activeSoundId === sound.id ? <Check size={14} color="var(--primary)" /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--text-muted)', flexShrink: 0 }} />}
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sound.name}>{sound.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); previewCustomSound(sound.id); }} title="Preview" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', flexShrink: 0 }}><Play size={13} /></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteCustomSound(channelKey, sound.id); }} title="Delete" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px', display: 'flex', flexShrink: 0 }}><Trash2 size={13} /></button>
                        </div>
                    ))}
                </div>

                <label htmlFor={fileInputId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px dashed var(--border-premium)', borderRadius: '12px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                    <Upload size={14} /> Upload custom sound
                    <input id={fileInputId} name={fileInputId} type="file" accept="audio/*" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
                {uploadError && <span style={{ fontSize: '11px', color: '#EF4444' }}>{uploadError}</span>}
            </div>
        </div>
    );
};

// The real, complete set of modules a user can choose to lock - id values
// match DashboardLayout.jsx's own switch statement exactly (case 'Home',
// case 'Finance', etc.), so settings.lockedModules is immediately usable
// by a real enforcement check (lockedModules.includes(activeTab)) without
// any translation layer. Labels are the friendly names these modules are
// referred to by elsewhere in the app.
const LOCKABLE_MODULES = [
    { id: 'Home', label: 'Home Dashboard' },
    { id: 'Planner', label: 'Planner Command Center' },
    { id: 'Daily Table', label: 'Daily Timetable' },
    { id: 'Study', label: 'Study Hub' },
    { id: 'Syllabus', label: 'Syllabus Tracker' },
    { id: 'Gym', label: 'Gym & Fitness' },
    { id: 'Diet', label: 'Diet & Nutrition' },
    { id: 'Finance', label: 'Finance Hub' },
    { id: 'Calendar', label: 'Calendar' },
    { id: 'Analytics', label: 'Analytics' },
    { id: 'AI', label: 'AI Assistant' },
    { id: 'Profile', label: 'Profile' },
    { id: 'Settings', label: 'Settings' },
    { id: 'audio_hub', label: 'Audio & Focus Hub' },
];

// A real PIN challenge, not a cosmetic gate - verifies the entered PIN
// against the actual stored hash via the same verifyPin() used anywhere
// else a PIN is checked. Only calls onVerified() when the hash genuinely
// matches; a wrong PIN shows a real error and lets the user retry rather
// than silently failing or (worse) unlocking anyway.
const PinVerifyModal = ({ fieldLabel, storedPinHash, onVerified, onClose }) => {
    const [enteredPin, setEnteredPin] = useState('');
    const [error, setError] = useState('');
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (enteredPin.length !== 4 || checking) return;
        setChecking(true);
        try {
            const isCorrect = await verifyPin(enteredPin, storedPinHash);
            if (isCorrect) {
                onVerified();
            } else {
                setError('Incorrect PIN. Try again.');
                setEnteredPin('');
            }
        } catch (err) {
            setError('Could not verify PIN right now. Please try again.');
        } finally {
            setChecking(false);
        }
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 220000 }}
            onClick={onClose}
        >
            <form
                onSubmit={handleSubmit}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '340px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}
                onClick={(e) => e.stopPropagation()}
            >
                <Lock size={26} color="var(--accent)" />
                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Verify PIN</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enter your OS Lock PIN to edit {fieldLabel}</span>
                </div>
                <label htmlFor="pin-verify-modal-input" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Enter your OS Lock PIN to edit {fieldLabel}</label>
                <input
                    id="pin-verify-modal-input"
                    name="pinVerifyModalInput"
                    type="password" inputMode="numeric" maxLength="4" autoFocus
                    value={enteredPin}
                    onChange={(e) => { setEnteredPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                    style={{ width: '120px', padding: '12px', borderRadius: '12px', border: `1px solid ${error ? '#EF4444' : 'var(--border-premium)'}`, background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '22px', letterSpacing: '10px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
                />
                {error && <span style={{ fontSize: '11px', color: '#EF4444' }}>{error}</span>}
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button
                        type="submit"
                        disabled={enteredPin.length !== 4 || checking}
                        style={{
                            flex: 1, padding: '10px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none',
                            borderRadius: '10px', fontWeight: '700', fontSize: '13px', fontFamily: 'inherit',
                            cursor: (enteredPin.length !== 4 || checking) ? 'default' : 'pointer',
                            opacity: (enteredPin.length !== 4 || checking) ? 0.6 : 1,
                        }}
                    >
                        {checking ? 'Verifying…' : 'Unlock'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Prompts for the real AES-256-GCM passphrase used to encrypt (export) or
// decrypt (import) a full-data backup - see utils/backupEncryption.js.
// Deliberately a passphrase, not the 4-digit App Lock PIN: it protects the
// exported FILE itself (which can leave the device entirely - a shared
// drive, email, cloud storage), a different threat model than the PIN's
// "someone picks up this unlocked device", and reusing a 4-digit PIN as an
// AES key source would make the file trivial to brute-force offline.
const BackupPassphraseModal = ({ mode, onSubmit, onClose }) => {
    const [passphrase, setPassphrase] = useState('');
    const [confirmPassphrase, setConfirmPassphrase] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const isExport = mode === 'export';

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        if (passphrase.length < 6) { setError('Use at least 6 characters.'); return; }
        if (isExport && passphrase !== confirmPassphrase) { setError('Passphrases do not match.'); return; }
        setBusy(true);
        setError('');
        try {
            await onSubmit(passphrase);
        } catch (err) {
            setError(isExport ? 'Could not encrypt the backup. Please try again.' : 'Incorrect passphrase, or this file is corrupted.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 220000 }} onClick={onClose}>
            <form onSubmit={handleSubmit} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '360px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <Lock size={26} color="var(--accent)" />
                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{isExport ? 'Encrypt This Backup' : 'Enter Backup Passphrase'}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {isExport ? 'Choose a passphrase to encrypt your data. You will need it to restore this file - Nexus never stores it.' : 'This backup file is encrypted. Enter the passphrase you set when it was exported.'}
                    </span>
                </div>
                <label htmlFor="backup-passphrase-input" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Passphrase</label>
                <input
                    id="backup-passphrase-input" name="backupPassphrase" type="password" autoFocus autoComplete="off"
                    placeholder="Passphrase (min. 6 characters)"
                    value={passphrase} onChange={(e) => { setPassphrase(e.target.value); setError(''); }}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${error ? '#EF4444' : 'var(--border-premium)'}`, background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                {isExport && (
                    <>
                        <label htmlFor="backup-passphrase-confirm-input" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Confirm passphrase</label>
                        <input
                            id="backup-passphrase-confirm-input" name="backupPassphraseConfirm" type="password" autoComplete="off"
                            placeholder="Confirm passphrase"
                            value={confirmPassphrase} onChange={(e) => { setConfirmPassphrase(e.target.value); setError(''); }}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${error ? '#EF4444' : 'var(--border-premium)'}`, background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </>
                )}
                {error && <span style={{ fontSize: '11px', color: '#EF4444' }}>{error}</span>}
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="submit" disabled={busy} style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                        {busy ? (isExport ? 'Encrypting…' : 'Decrypting…') : (isExport ? 'Encrypt & Download' : 'Unlock Backup')}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Wraps any credential field with a real mask/edit-icon/PIN-challenge/
// unlock lifecycle. When no PIN is configured at all, there's nothing to
// protect the field WITH, so it renders directly editable - locking a
// field behind a PIN that doesn't exist would just make it permanently
// inaccessible, not secure. Once a PIN exists, the field starts masked;
// clicking the pencil icon opens a real PIN challenge, and the actual
// editable content (passed as children) only ever renders after a correct
// PIN is verified.
// Explicit request: every credential row here used to render fully
// expanded, always, regardless of whether the service was even in use -
// "sab khula khula dikhta hai", cluttering the page with input fields for
// services most people never touch. Replaces the old LockedApiField (PIN-
// gated collapse only) with a genuinely collapsed-by-default row for every
// field, PIN or no PIN:
// - Not yet connected: a small ON/OFF toggle (the exact same ToggleSwitch
//   component/style Saavn's own "enable this service" row already uses,
//   per explicit reference) - flip it on to reveal the real input fields,
//   off to hide them again without losing anything typed.
// - Already connected: a compact row with just a pencil/edit icon (the
//   same affordance the old PIN-locked view already had) - click it to
//   reopen the fields for editing.
// - Auto-collapses itself the instant a field goes from not-yet-confirmed
//   to confirmed (a real Confirm click just succeeded) - "daalne ke baad
//   hide ho jaaye" - so a fresh save always settles back into the compact
//   pencil-edit state without a separate manual step.
// PIN-gating (when the user HAS set up a security PIN) still applies on
// top of this exactly as before - opening either affordance asks for the
// PIN first if one is configured, unchanged from the old behavior.
const CollapsibleApiField = ({ label, isConnected, pinConfigured, storedPinHash, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const wasConnectedRef = useRef(isConnected);

    useEffect(() => {
        if (isConnected && !wasConnectedRef.current) {
            setIsOpen(false);
        }
        wasConnectedRef.current = isConnected;
    }, [isConnected]);

    const requestOpen = () => {
        if (pinConfigured) {
            setShowPinModal(true);
            return;
        }
        setIsOpen(true);
    };

    if (isOpen) {
        return (
            <div>
                {children}
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', padding: 0,
                        background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                >
                    <ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} /> Collapse
                </button>
            </div>
        );
    }

    return (
        <div>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px',
                borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', boxSizing: 'border-box',
            }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: isConnected ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        {isConnected && <Check size={11} />}
                        {isConnected ? 'Connected' : 'Not Connected'}
                    </div>
                </div>
                {isConnected ? (
                    <button
                        type="button"
                        onClick={requestOpen}
                        title={`Edit ${label}`}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', padding: '2px', flexShrink: 0 }}
                    >
                        <Edit3 size={15} />
                    </button>
                ) : (
                    <ToggleSwitch checked={false} onChange={requestOpen} compact />
                )}
            </div>
            {showPinModal && (
                <PinVerifyModal
                    fieldLabel={label}
                    storedPinHash={storedPinHash}
                    onVerified={() => { setIsOpen(true); setShowPinModal(false); }}
                    onClose={() => setShowPinModal(false)}
                />
            )}
        </div>
    );
};

// Replaces window.confirm with a real, custom confirmation dialog -
// destructive-styled (red) confirm button since every use of this in
// Settings is a genuine data-wiping action, making the consequence
// visually obvious rather than only text-implied.
const SettingsConfirmModal = ({ title, message, onConfirm, onCancel, forceGlass = false }) => {
    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 220000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className={forceGlass ? 'nexus-glass-modal' : undefined}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '26px', width: '100%', maxWidth: '360px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
                <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{title}</strong>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{message}</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={onCancel} style={{ flex: 1, padding: '10px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="button" onClick={onConfirm} style={{ flex: 1, padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Confirm</button>
                </div>
            </div>
        </div>
    );
};


// A single, clean, collapsible top-level category - the YouTube-style
// "Settings menu" shape this whole page now follows: one accordion per
// real concern (modules, security, display, audio, system/data) instead
// of a dozen same-weight cards all visible on one long, congested page.
// Every sub-card already inside each category (e.g. GitHub/Spotify inside
// Security, or Cloud Sync inside System Defaults) keeps its own existing
// look untouched - this only adds the outer grouping, spacing, and the
// collapse/expand affordance around them.

const SettingsPage = ({ setActiveTab, onMobileOverlayChange }) => {
    const isMobile = useIsMobile();
    // Contextual first-visit tour (see TourGuide.jsx) - mobile only, same
    // scoping as every other page's own tour this pass.
    const [showTour, setShowTour] = useState(() => isMobile && !hasSeenTour('settings'));
    // Split-pane category state for the redesigned layout - each real
    // settings card below (unchanged content, unchanged handlers) is
    // grouped into whichever of these it actually belongs to. Grouped by
    // real content, not a literal copy of the request's own illustrative
    // "e.g." category names: there's no genuine "About" section in this
    // app to put behind that label, so Backup & Data (cloud backup,
    // export, factory reset) takes its place, and General absorbs Module
    // Manager + System Defaults rather than forcing either into a
    // category it doesn't really belong to.
    const [activeCategory, setActiveCategory] = useState('account');
    const SETTINGS_CATEGORIES = [
        { id: 'account', label: 'Account', icon: User },
        { id: 'general', label: 'General', icon: LayoutDashboard },
        { id: 'appearance', label: 'Appearance', icon: Monitor },
        { id: 'glassmorphism', label: 'Glassmorphism', icon: Sparkles },
        { id: 'typography', label: 'Typography', icon: Type },
        { id: 'audio', label: 'Audio', icon: Music },
        { id: 'security', label: 'Security & Privacy', icon: Shield },
        { id: 'api', label: 'API Integrations', icon: Key },
        { id: 'backup', label: 'Backup & Data', icon: Cloud },
    ];
    const { user, isConfigured, logout, login, signup, loginWithGoogle, changePassword } = useAuth();
    const { volume, setVolume: setLocalVolume, isMuted, toggleMute, crossfadeEnabled, setCrossfadeEnabled } = useAudioPlayer();
    // Real, reported bug: this slider only ever touched the local <audio>
    // element - Spotify's Web Playback SDK has its own, completely
    // separate volume, so dragging this had zero effect while Spotify was
    // the active, playing source. Both are updated together now - the
    // local volume so it's ready the moment playback switches back to a
    // local/Saavn track, and Spotify's own SDK volume so it takes effect
    // immediately if Spotify is what's actually playing right now.
    const { activeSource: activeStreamingSource, spotifySetVolume } = useStreaming();
    const setVolume = (v) => {
        setLocalVolume(v);
        if (activeStreamingSource === 'spotify') spotifySetVolume(v);
    };
    const { isSyncing, syncStatus, syncError, lastSyncedAt, pushToCloud, pullFromCloud } = useCloudSync();
    const [activeSyncDirection, setActiveSyncDirection] = useState(null); // null | 'push' | 'pull'
    useEffect(() => { if (!isSyncing) setActiveSyncDirection(null); }, [isSyncing]);

    // Which channel's Manage Sounds modal is open, if any - a deliberate,
    // infrequent user action (not a per-pixel drag event), so holding this
    // in SettingsPage's own state doesn't reintroduce the kind of
    // performance concern the volume slider needed fixing for.
    const [manageSoundsChannel, setManageSoundsChannel] = useState(null);

    const defaultSettings = {
        landingPage: 'Home Dashboard',
        timeFormat: '12 Hour (AM/PM)',
        themeMode: 'night',
        accentColor: 'Neon Blue',
        aiFrequency: 'High (Proactive)',
        aiMemory: true,
        appPin: '',
        lockedModules: [],
        waterReminders: true,
        focusModeAutoReply: false,
        githubToken: '',
        githubTokenConfirmed: false,
        appleMusicToken: '',
        appleMusicTokenConfirmed: false,
        spotifyClientId: '',
        spotifyClientSecret: '',
        spotifyCredConfirmed: false,
        openaiApiKey: '',
        openaiApiKeyConfirmed: false,
        geminiApiKey: '',
        geminiApiKeyConfirmed: false,
        youtubeApiKey: '',
        youtubeApiKeyConfirmed: false,
        saavnEnabled: false,
        saavnApiBaseUrl: '',
        saavnApiBaseUrlConfirmed: false,
        grokApiKey: '',
        grokApiKeyConfirmed: false,
        deepseekApiKey: '',
        deepseekApiKeyConfirmed: false,
        performanceMode: false,
        // Off by default (opt-in) - matches VoiceAssistantSettings.jsx's
        // and AIDailyBriefingCard.jsx's own defaults exactly. This copy
        // matters even though this page doesn't read it back out: several
        // writes below persist this whole `settings` object wholesale
        // (PIN-hash migration, theme sync, ...), so if this default ever
        // drifted to `true` it would silently bake an explicit "on" into
        // nexus_global_settings for a user who never touched the switch,
        // the moment they so much as opened Settings.
        aiVoiceAssistantEnabled: false,
        aiVoiceLanguage: 'en',
        aiVoiceURI: '',
        aiVoiceVolume: 1,
        aiVoiceRate: 1,
        aiVoiceAutoPlay: false,
        autoBackupFreq: 'Weekly',
        weightUnit: 'kg',
        temperatureUnit: '°C',
        liquidUnit: 'L',
        glassBlur: 20,
        glassOpacity: 3,
        osBrightness: 100,
        glassAccentTint: 'default',
        glassAnimationsEnabled: true,
        fontFamily: DEFAULT_FONT_ID,
        customFonts: [],
        wallpaper: 'sky',
        widgetShowStudy: true,
        widgetShowGym: true,
        widgetShowFinance: true,
        widgetShowTimetable: true,
        widgetShowPlanner: true,
        widgetShowCalendar: true,
        widgetShowDiet: true,
        performanceSaverMode: false,
        activeModules: {
            planner: true, study: true, gym: true, diet: true, finance: true, calendar: true, analytics: true, ai: true
        }
    };

    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('nexus_global_settings');
        const currentTheme = localStorage.getItem('nexus_theme') || 'night';
        if (saved) {
            try { return { ...defaultSettings, ...JSON.parse(saved), themeMode: currentTheme }; } catch (e) { return defaultSettings; }
        }
        return defaultSettings;
    });
    // The real, shared currency value - GlobalUserSettingsContext now owns
    // this the same way it already owns monthlyBudgetCap/dailyHydrationGoal
    // (see that file's own comment on the real, confirmed silo this fixes:
    // this page's own dropdown used to write settings.currency here, but
    // every actual place a currency is displayed - Finance, the AI daily
    // briefing, exported reports - read a completely separate value and
    // never saw it change). The dropdown below now reads/writes this
    // shared value directly instead.
    const { settings: globalSettings, updateSetting: updateGlobalSetting } = useGlobalSettings();

    // Applies the real glass customization settings as live CSS custom
    // properties - this is what makes the sliders/toggle genuinely
    // control the app's actual rendering, not just display a value.
    // glassOpacity is stored as an integer 1-15 (hundredths) since a
    // plain HTML range input only reports whole numbers; converted to
    // the real 0.01-0.15 alpha here. That upper bound is deliberate: this
    // app's entire glass aesthetic is already very subtle (0.03 by
    // default) - going toward 1.0 would render as opaque and defeat the
    // glassmorphism look this section exists to let the user tune.
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--glass-blur', `${settings.glassBlur}px`);
        root.style.setProperty('--nexus-user-glass-alpha', (settings.glassOpacity / 100).toFixed(3));
        // Read by the wallpaper background layers (DynamicBackground.jsx/
        // AlternateBackgrounds.jsx) as filter: brightness(var(--os-
        // brightness)). Applied there rather than on .nexus-app-shell
        // itself (the alternative the task allowed) - that shell is an
        // ancestor of the fixed-position Sidebar/mobile nav, and filter
        // (like backdrop-filter/transform) creates a new containing block
        // for position:fixed descendants, which would silently detach
        // them from the real viewport. The wallpaper layers are plain
        // siblings of the shell instead, so brightening/dimming them
        // carries no such risk while still affecting the dominant visual
        // surface every glass panel already shows through.
        // CSS brightness() is a flat per-channel multiplier, so raising it
        // past 1.0 clips any pixel already near-white (the sun/moon discs'
        // hottest core, cloud highlights) straight to pure white - erasing
        // the soft multi-stop falloff that makes them read as glowing
        // rather than flat. Verified empirically: at the raw 150% this
        // slider allows, DynamicBackground.jsx's sun disc and night sky
        // gradient - both already correct at 100% - visibly flatten into
        // exactly the "flat saturated" / "harsh circle" look a wallpaper-
        // realism bug report described. Dampening only the >100% half (JS
        // curve, not a CSS clamp, so `--os-brightness` stays a plain
        // number every filter: brightness() consumer can use as-is) keeps
        // the slider genuinely useful for brightening while keeping that
        // brightening inside a range the gradients can absorb without
        // clipping. Dimming (<100%) only pulls channels toward 0, which
        // never clips, so it's left linear.
        const rawBrightness = settings.osBrightness / 100;
        const effectiveBrightness = rawBrightness > 1 ? 1 + (rawBrightness - 1) * 0.4 : rawBrightness;
        root.style.setProperty('--os-brightness', effectiveBrightness.toFixed(2));
        const tint = GLASS_ACCENT_TINTS.find((t) => t.id === settings.glassAccentTint) || GLASS_ACCENT_TINTS[0];
        if (tint.rgb) {
            // Overrides the real, core color variables the whole app already
            // uses for buttons, active tab indicators, icons, and highlights
            // - this is what makes picking a tint genuinely reach "all glass
            // cards, active tabs, and highlights" instantly, not just a
            // narrow, decorative glow effect.
            root.style.setProperty('--primary', tint.swatch);
            root.style.setProperty('--primary-rgb', tint.rgb);
            root.style.setProperty('--accent', tint.swatch);
            root.style.setProperty('--nexus-glass-glow-rgb', tint.rgb);
            root.style.setProperty('--nexus-glass-glow-alpha', '0.35');
        } else {
            // "Default" - remove every override so the active theme's own
            // --primary/--accent values genuinely take back over, rather
            // than leaving a stale color behind.
            root.style.removeProperty('--primary');
            root.style.removeProperty('--primary-rgb');
            root.style.removeProperty('--accent');
            root.style.setProperty('--nexus-glass-glow-alpha', '0');
        }
        root.classList.toggle('nexus-motion-off', !settings.glassAnimationsEnabled);
    }, [settings.glassBlur, settings.glassOpacity, settings.osBrightness, settings.glassAccentTint, settings.glassAnimationsEnabled]);

    // Applies the real, live typography choice - loads the actual font
    // stylesheet it needs (Google Fonts, Fontshare, or nothing at all for
    // a real system font - see utils/fontLoader.js), then sets
    // --font-primary as a live inline style on <html>, the same
    // "wins over every theme's own stylesheet default" convention
    // --nexus-user-glass-alpha above already uses. This is what makes
    // picking a font in Settings apply instantly, everywhere, with no
    // reload - every element in the app already inherits font-family from
    // this one variable (see style.css's own `* { font-family:
    // var(--font-primary) }` rule).
    useEffect(() => {
        const customFont = (settings.customFonts || []).find((f) => f.id === settings.fontFamily);
        if (customFont) {
            // A real, uploaded font's FontFace is never persisted by the
            // browser itself across a reload (document.fonts starts empty
            // every fresh load) - re-registering it from its own real
            // bytes in IndexedDB before applying --font-primary is what
            // makes the choice survive a reload at all, not just the
            // current tab session. Skips the re-fetch/re-register if it's
            // already loaded (e.g. switching back and forth without a
            // reload in between).
            (async () => {
                const alreadyRegistered = Array.from(document.fonts).some((f) => f.family === customFont.familyName);
                if (!alreadyRegistered) {
                    try {
                        const arrayBuffer = await getCustomFontBlob(customFont.id);
                        if (arrayBuffer) {
                            const fontFace = new FontFace(customFont.familyName, arrayBuffer);
                            await fontFace.load();
                            document.fonts.add(fontFace);
                        }
                    } catch (e) { /* the font simply won't render as custom this time - the stack's own fallback below still applies */ }
                }
                document.documentElement.style.setProperty('--font-primary', `'${customFont.familyName}', -apple-system, BlinkMacSystemFont, sans-serif`);
            })();
            return;
        }
        const option = getFontOption(settings.fontFamily);
        loadFontStylesheet(option);
        document.documentElement.style.setProperty('--font-primary', option.stack);
    }, [settings.fontFamily, settings.customFonts]);

    // One-time migration: a PIN saved before this change would still be
    // sitting in localStorage as the raw 4 digits, not a hash. Detects
    // that (anything non-empty that isn't already a 64-char SHA-256 hex
    // string) and re-hashes it in place, so an existing user's
    // already-configured PIN keeps working correctly against verifyPin
    // rather than silently failing to match once it's actually checked.
    useEffect(() => {
        const current = settings.appPin;
        const looksAlreadyHashed = !current || /^[0-9a-f]{64}$/.test(current);
        if (looksAlreadyHashed) return;
        (async () => {
            try {
                const migratedHash = await hashPin(current);
                setSettings((prev) => {
                    const next = { ...prev, appPin: migratedHash };
                    localStorage.setItem('nexus_global_settings', JSON.stringify(next));
                    return next;
                });
                // Same shared-blob data-loss fix as the other writers in
                // this file - a one-time migration write is still a write
                // CloudSync needs to know about.
                window.dispatchEvent(new Event('storage'));
            } catch (err) {
                // Non-fatal - the legacy plain-text PIN just stays
                // unmigrated this session; the app remains fully usable,
                // and this will be retried on the next mount.
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [isSaved, setIsSaved] = useState(false);
    const [wallpaperExpanded, setWallpaperExpanded] = useState(false);
    const [wallpaperCategoryFilter, setWallpaperCategoryFilter] = useState('All');
    const [customImageExpanded, setCustomImageExpanded] = useState(false);
    const [customWallpaperImage, setCustomWallpaperImage] = useState(() => {
        try { return localStorage.getItem('nexus_custom_wallpaper_image') || ''; } catch (e) { return ''; }
    });
    const [customImageError, setCustomImageError] = useState('');
    const [customImageProcessing, setCustomImageProcessing] = useState(false);
    const customImageInputRef = useRef(null);
    const [accentExpanded, setAccentExpanded] = useState(false);
    const [fontExpanded, setFontExpanded] = useState(false);
    const [fontSearchQuery, setFontSearchQuery] = useState('');
    const [customFontExpanded, setCustomFontExpanded] = useState(false);
    const [customFontError, setCustomFontError] = useState('');
    const [customFontProcessing, setCustomFontProcessing] = useState(false);
    const customFontInputRef = useRef(null);
    // Real filtering (not a decorative search box) - matches on the font's
    // own display name, grouped back into its real category for the
    // picker's sectioned layout below.
    const filteredFontsByCategory = FONT_CATEGORIES
        .map((category) => ({
            category,
            fonts: FONT_OPTIONS.filter((f) => f.category === category && f.label.toLowerCase().includes(fontSearchQuery.trim().toLowerCase())),
        }))
        .filter((group) => group.fonts.length > 0);

    // Only fetches every OTHER font's real stylesheet once the picker
    // itself is actually opened (a deliberate, infrequent action) - so a
    // genuine live "this is what Playfair Display looks like" preview per
    // option doesn't cost anything on every normal page load, only when
    // someone is actually browsing the library. Batched into a handful of
    // consolidated requests (see fontLoader.js) rather than one request
    // per font, since the library is 130+ fonts now.
    useEffect(() => {
        if (!fontExpanded) return;
        preloadFontsForPreview(FONT_OPTIONS);
    }, [fontExpanded]);

    const [passwordExpanded, setPasswordExpanded] = useState(false);
    const [cacheSize, setCacheSize] = useState('0.0');
    // The PIN input is bound to this local draft, never to settings.appPin
    // directly - once saved, that field holds a SHA-256 hash, not the raw
    // PIN, so there's nothing meaningful to redisplay in the input anyway.
    // pinTouched distinguishes "the user never interacted with this field"
    // (must preserve whatever PIN is already configured) from "the user
    // explicitly cleared it" (must actually disable the lock) - without
    // this distinction, saving ANY other setting would silently wipe an
    // existing PIN every time, since the draft always starts empty.
    //
    // Stored as 4 separate box values (not one string) so a real 4-box
    // PIN entry UI - one digit per box, auto-advancing focus, backspace
    // jumps back a box - can render each box directly from its own
    // slot without a middle deletion shifting later digits left (which
    // joining/re-splitting a single string on every keystroke would
    // cause). pinDraft below is only the flattened form the existing
    // save/validation logic (handleSavePin, isValidPinInput) actually
    // needs - never fed back into rendering the boxes themselves.
    const [pinBoxValues, setPinBoxValues] = useState(['', '', '', '']);
    const pinDraft = pinBoxValues.join('');
    const pinInputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
    const [pinTouched, setPinTouched] = useState(false);
    const [pinError, setPinError] = useState('');
    const [biometricSupported] = useState(() => isBiometricSupported());
    const [biometricEnabled, setBiometricEnabled] = useState(() => isBiometricLockEnabled());
    const [biometricStatus, setBiometricStatus] = useState('idle'); // 'idle' | 'registering' | 'error'
    const [biometricError, setBiometricError] = useState('');
    // 'idle' | 'checking' | 'connected' | 'invalid' | 'error'
    const [githubTokenStatus, setGithubTokenStatus] = useState('idle');
    const [githubUsername, setGithubUsername] = useState('');

    // Real, confirmed gap this closes: this only ever merged in
    // `themeMode` from the separate 'nexus_theme' key, so if this page was
    // already open when an update to ANY other field arrived from
    // elsewhere - most importantly a cloud-synced change pushed from a
    // second device via CloudSyncContext's own live onSnapshot listener,
    // which already writes the full 'nexus_global_settings' blob to
    // localStorage and dispatches this exact 'nexus_settings_updated'
    // event via applyCloudData - the visible UI here (the Gemini API key
    // field, wallpaper picker, font, glass sliders, everything) stayed
    // silently stale until the user navigated away and back or reloaded.
    // Re-reading and merging the full saved object (not just theme) is
    // what actually makes "log in on a new device and your key/settings
    // are just there, instantly, no re-entry" true for a session that's
    // already sitting open on this page, not only for a fresh mount.
    // Safe against clobbering an in-flight local edit: every field here
    // already persists to localStorage synchronously inside handleChange
    // itself (not a separate effect), so by the time this event's own
    // dispatch runs (always after that same synchronous write - see
    // handleChange below), localStorage already reflects this page's own
    // latest local edit too, not stale data.
    // True only for the exact synchronous duration handleChange's own
    // dispatch below is running - the same "don't re-absorb my own echo"
    // guard CloudSyncContext.jsx already uses (isPullingRef) for the
    // identical shape of problem. Without this, every single call to
    // handleChange (every keystroke, toggle, and - critically - every
    // requestAnimationFrame tick while dragging the Blur/Opacity sliders,
    // see SmoothRangeSlider above) re-triggered this exact listener on
    // its own dispatch, which then did a redundant full JSON.parse +
    // whole-object setSettings on top of the state update handleChange
    // had just already made correctly - real, measurable double work on
    // every single settings change, worst during a slider drag where it
    // compounds up to 60x/second. The guard is what makes this listener
    // fire ONLY for its actual, intended purpose: an update that
    // genuinely came from outside this component (a cloud-synced change
    // arriving via CloudSyncContext's onSnapshot listener, or another
    // browser tab), which is the only case where the local `settings`
    // state could actually be stale.
    const isLocalChangeRef = useRef(false);

    useEffect(() => {
        const syncFromExternalUpdate = () => {
            if (isLocalChangeRef.current) return;
            const currentTheme = localStorage.getItem('nexus_theme') || 'night';
            const saved = localStorage.getItem('nexus_global_settings');
            if (!saved) {
                setSettings((prev) => ({ ...prev, themeMode: currentTheme }));
                return;
            }
            try {
                setSettings({ ...defaultSettings, ...JSON.parse(saved), themeMode: currentTheme });
            } catch (e) {
                setSettings((prev) => ({ ...prev, themeMode: currentTheme }));
            }
        };
        window.addEventListener('nexus_theme_changed', syncFromExternalUpdate);
        window.addEventListener('nexus_settings_updated', syncFromExternalUpdate);

        return () => {
            window.removeEventListener('nexus_theme_changed', syncFromExternalUpdate);
            window.removeEventListener('nexus_settings_updated', syncFromExternalUpdate);
        };
    }, []);

    // Auto-Backup Frequency is now driven entirely by the one, single
    // authoritative scheduler in CloudSyncContext.jsx - this page's own
    // Settings dropdown still controls it (writes to nexus_global_settings,
    // which that scheduler reads), but the actual scheduling/firing logic
    // no longer lives here too. A real, confirmed duplicate of this exact
    // effect previously also lived in this file, independently calling the
    // same pushToCloud on its own separate tracking (React state here vs a
    // localStorage timestamp there) - two uncoordinated schedulers both
    // able to fire a cloud write around the same time is a genuine
    // race-condition/duplicate-call risk, and part of what this app's own
    // sync engine repair fixed.

    const handleChange = (key, value) => {
        // Computed directly from the current, closure-captured settings
        // rather than inside setSettings' own updater function - keeping
        // the localStorage.setItem side-effect below at the top level of
        // handleChange itself, not inside a state updater, which React
        // expects to be pure and can, in principle, invoke more than once
        // per logical update.
        const next = { ...settings, [key]: value };
        setSettings(next);
        // Every general preference now persists the instant it changes -
        // the previous version only did this for a special-cased subset
        // (autoBackupFreq/landingPage/timeFormat); this generalizes that
        // same, already-proven pattern to every key so nothing needs a
        // separate Apply Changes click to actually stick.
        localStorage.setItem('nexus_global_settings', JSON.stringify(next));

        isLocalChangeRef.current = true;

        if (key === 'themeMode') {
            document.documentElement.setAttribute('data-theme', value);
            localStorage.setItem('nexus_theme', value);
            window.dispatchEvent(new Event('nexus_theme_changed'));
        }

        // Every other page/component that reacts to settings changes
        // (the sidebar's module visibility, StreamingContext's credential
        // state, etc.) already listens for this one event - dispatching
        // it here for every change is what makes an instant update
        // actually take effect live elsewhere in the app immediately,
        // not just inside this page's own React state.
        window.dispatchEvent(new Event('nexus_settings_updated'));
        // Real, confirmed gap this closes: CloudSyncContext's own
        // debounced auto-push listener (the actual mechanism that pushes
        // any local change to Firestore within ~3s) only ever listens
        // for the native 'storage' event - handleChange never dispatched
        // it, meaning NO Settings change (a toggle, theme, font, or API
        // key) ever triggered a real-time cloud push at all. The only
        // way a Settings change previously reached the cloud was the
        // coarse 5-minute periodic backup, or by coincidentally riding
        // along with an unrelated page's own 'storage' dispatch. This
        // one line is what actually makes "instant, silent auto-save...
        // localStorage + real-time cloud sync" true for every field in
        // this file, matching the same two-event dispatch pattern
        // already used elsewhere in this same file (see the PIN/backup/
        // account-linking handlers below).
        window.dispatchEvent(new Event('storage'));

        isLocalChangeRef.current = false;

        // Changing a credential field's own value invalidates any prior
        // confirmation of it - the "Connected" badge must reflect the
        // value that's actually saved, never a stale confirmation left
        // over from a different value that's since been edited.
        const CONFIRM_FLAG_FOR = {
            githubToken: 'githubTokenConfirmed',
            appleMusicToken: 'appleMusicTokenConfirmed',
            spotifyClientId: 'spotifyCredConfirmed',
            spotifyClientSecret: 'spotifyCredConfirmed',
            openaiApiKey: 'openaiApiKeyConfirmed',
            geminiApiKey: 'geminiApiKeyConfirmed',
            youtubeApiKey: 'youtubeApiKeyConfirmed',
            grokApiKey: 'grokApiKeyConfirmed',
            deepseekApiKey: 'deepseekApiKeyConfirmed',
            saavnApiBaseUrl: 'saavnApiBaseUrlConfirmed',
        };
        if (CONFIRM_FLAG_FOR[key]) {
            const withConfirmCleared = { ...next, [CONFIRM_FLAG_FOR[key]]: false };
            setSettings(withConfirmCleared);
            localStorage.setItem('nexus_global_settings', JSON.stringify(withConfirmCleared));
        }
    };

    // The real "Confirm" action for a credential field - immediately
    // persists both the field's current value and its confirmed flag
    // together (same immediate-persist pattern as autoBackupFreq/
    // themeMode above), so the "Connected" badge and the underlying
    // saved value can never drift out of sync with each other.
    const confirmApiField = (confirmKey) => {
        setSettings((prev) => {
            const next = { ...prev, [confirmKey]: true };
            localStorage.setItem('nexus_global_settings', JSON.stringify(next));
            return next;
        });
        // StreamingContext has no shared React state with this page - the
        // only way it can know a credential was just confirmed is this
        // same event-based sync the rest of the app already uses for
        // cross-component settings changes (see themeMode above).
        window.dispatchEvent(new Event('nexus_settings_updated'));
        // Real, reported bug: CloudSync's own local-change listener only
        // PUSHES a change after a 3-second debounce (see
        // AUTO_PUSH_DEBOUNCE_MS in CloudSyncContext.jsx) - a refresh inside
        // that window kills the pending push before it ever fires, and the
        // fresh page load's own one-shot "pull once per sign-in" effect
        // then pulls back the OLD cloud data (still missing this
        // confirmation) and applies it, silently reverting a Confirm click
        // that felt instant. A field the user just explicitly clicked
        // Confirm on is exactly the kind of action that shouldn't be at
        // the mercy of that debounce window - pushed immediately instead
        // of waiting for it. (Safe to call even when CloudSync isn't
        // configured/signed-in - pushToCloud no-ops silently in that case,
        // same as every other caller of it in this file.)
        pushToCloud();
    };

    const handleModuleToggle = (moduleKey) => {
        // Real bug fix: the side effects below (localStorage write, the
        // real event dispatch Sidebar.jsx listens for) used to live
        // INSIDE this setSettings updater function - a React state
        // updater is expected to be a pure function of prev state, and
        // synchronously dispatching a DOM event from inside one lets that
        // event's own listener (Sidebar's setActiveModules) run while
        // React is still mid-render/commit for THIS component, which is
        // exactly the real "Cannot update a component while rendering a
        // different component" warning this produced. Computing the next
        // value once, then setting state and firing the side effects as
        // two separate, ordinary statements, is what actually fixes it.
        const nextActiveModules = { ...settings.activeModules, [moduleKey]: !settings.activeModules[moduleKey] };
        setSettings(prev => ({ ...prev, activeModules: nextActiveModules }));
        // Immediate persist, matching themeMode/autoBackupFreq - module
        // visibility directly controls what's in the sidebar RIGHT NOW,
        // so it can't wait on a separate Save Changes click. The
        // sidebar already has a real listener for this exact event
        // (see sidebar.jsx's nexus_settings_updated handler) - this is
        // the missing half that was never actually firing it.
        const globalSettings = JSON.parse(localStorage.getItem('nexus_global_settings')) || {};
        globalSettings.activeModules = nextActiveModules;
        localStorage.setItem('nexus_global_settings', JSON.stringify(globalSettings));
        window.dispatchEvent(new Event('nexus_settings_updated'));
        // Real, reported data-loss bug (same root cause as header.jsx's
        // theme-cycle button - see its own comment): this write to the
        // SHARED nexus_global_settings blob never told CloudSync a local
        // change was pending, so an incoming cloud pull landing right
        // after could silently overwrite the WHOLE blob - unrelated
        // fields like API keys included - with a stale snapshot. Every
        // writer to this shared key must dispatch 'storage', not just
        // its own more specific event, or CloudSync's own guard never
        // engages for it.
        window.dispatchEvent(new Event('storage'));
    };

    // Toggles a single module in/out of the set requiring the OS Lock PIN.
    // settings.lockedModules stays a real array of the exact module ids a
    // future lock-screen gate would check against - no separate
    // enable/disable flag needed, since an empty array already honestly
    // means "nothing is locked".
    const toggleLockedModule = (moduleId) => {
        setSettings((prev) => {
            const current = prev.lockedModules || [];
            const next = current.includes(moduleId)
                ? current.filter((id) => id !== moduleId)
                : [...current, moduleId];
            const nextSettings = { ...prev, lockedModules: next };
            localStorage.setItem('nexus_global_settings', JSON.stringify(nextSettings));
            return nextSettings;
        });
        // Same real data-loss bug, same fix, as header.jsx's theme-cycle
        // button and handleModuleToggle above - this write to the SHARED
        // nexus_global_settings blob previously dispatched nothing at
        // all, leaving CloudSync's local-change guard completely unaware
        // a write just happened here.
        window.dispatchEvent(new Event('storage'));
    };

    const calculateCache = () => {
        let totalBytes = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalBytes += (localStorage[key].length + key.length) * 2;
            }
        }
        setCacheSize(totalBytes > 0 ? (totalBytes / 1024).toFixed(2) : '0.0');
    };

    useEffect(() => { calculateCache(); }, []);

    // Validates the GitHub token against the real GitHub API (GET
    // /user with the token as a Bearer credential) and surfaces the
    // actual connection status - not just "a value is saved" but "this
    // value genuinely authenticates right now". Debounced 700ms after
    // typing stops, both to avoid firing a request on every keystroke and
    // to respect GitHub's API rate limits. `cancelled` guards against a
    // slower, now-stale request's response landing after a newer one -
    // without it, quickly editing the token could show a status that
    // doesn't match what's currently actually typed.
    useEffect(() => {
        const token = settings.githubToken.trim();
        if (!token) {
            setGithubTokenStatus('idle');
            setGithubUsername('');
            return undefined;
        }
        let cancelled = false;
        setGithubTokenStatus('checking');
        const timeoutId = setTimeout(() => {
            fetch('https://api.github.com/user', {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
            })
                .then(async (res) => {
                    if (cancelled) return;
                    if (res.ok) {
                        const data = await res.json();
                        setGithubUsername(data.login || '');
                        setGithubTokenStatus('connected');
                    } else {
                        setGithubUsername('');
                        setGithubTokenStatus('invalid');
                    }
                })
                .catch(() => {
                    if (cancelled) return;
                    setGithubUsername('');
                    setGithubTokenStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.githubToken]);

    // Apple Music: validates the developer token against a real, public
    // Apple Music catalog endpoint (a single well-known song lookup) that
    // needs no user authorization - a valid, correctly-signed, unexpired
    // token gets a 200; anything else means the token is bad. Same
    // debounced, race-safe pattern as the GitHub check above.
    const [appleMusicTokenStatus, setAppleMusicTokenStatus] = useState('idle');
    useEffect(() => {
        const token = settings.appleMusicToken.trim();
        if (!token) {
            setAppleMusicTokenStatus('idle');
            return undefined;
        }
        let cancelled = false;
        setAppleMusicTokenStatus('checking');
        const timeoutId = setTimeout(() => {
            fetch('https://api.music.apple.com/v1/catalog/us/songs/203709340', {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then((res) => {
                    if (cancelled) return;
                    setAppleMusicTokenStatus(res.ok ? 'connected' : 'invalid');
                })
                .catch(() => {
                    if (cancelled) return;
                    setAppleMusicTokenStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.appleMusicToken]);

    // Spotify: validates the Client ID + Secret PAIR together via the real
    // Client Credentials token flow - this only succeeds if both values
    // are genuine and actually match each other (unlike a format check on
    // either one alone), so a 200 here means the pair truly authenticates
    // with Spotify's own servers right now.
    const [spotifyCredStatus, setSpotifyCredStatus] = useState('idle');
    useEffect(() => {
        const id = settings.spotifyClientId.trim();
        const secret = settings.spotifyClientSecret.trim();
        if (!id || !secret) {
            setSpotifyCredStatus('idle');
            return undefined;
        }
        let cancelled = false;
        setSpotifyCredStatus('checking');
        const timeoutId = setTimeout(() => {
            fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `grant_type=client_credentials&client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}`,
            })
                .then((res) => {
                    if (cancelled) return;
                    setSpotifyCredStatus(res.ok ? 'connected' : 'invalid');
                })
                .catch(() => {
                    if (cancelled) return;
                    setSpotifyCredStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.spotifyClientId, settings.spotifyClientSecret]);

    // OpenAI: validates the key against the real /v1/models list endpoint -
    // a lightweight, read-only call (no completion/generation request, so
    // it doesn't spend meaningful credits) that only succeeds with a
    // genuine, live key. Same debounced, race-safe pattern as GitHub above.
    const [openaiKeyStatus, setOpenaiKeyStatus] = useState('idle');
    useEffect(() => {
        const key = settings.openaiApiKey.trim();
        if (!key) {
            setOpenaiKeyStatus('idle');
            return undefined;
        }
        let cancelled = false;
        setOpenaiKeyStatus('checking');
        const timeoutId = setTimeout(() => {
            fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${key}` },
            })
                .then((res) => {
                    if (cancelled) return;
                    setOpenaiKeyStatus(res.ok ? 'connected' : 'invalid');
                })
                .catch(() => {
                    if (cancelled) return;
                    setOpenaiKeyStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.openaiApiKey]);

    // Gemini: validates the key against the real /v1beta/models list
    // endpoint (Google's own documented way to check a key without
    // spending generation quota) - same debounced, race-safe pattern.
    const [geminiKeyStatus, setGeminiKeyStatus] = useState('idle');
    useEffect(() => {
        const key = settings.geminiApiKey.trim();
        if (!key) {
            setGeminiKeyStatus('idle');
            return undefined;
        }
        let cancelled = false;
        setGeminiKeyStatus('checking');
        const timeoutId = setTimeout(() => {
            fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`)
                .then((res) => {
                    if (cancelled) return;
                    setGeminiKeyStatus(res.ok ? 'connected' : 'invalid');
                })
                .catch(() => {
                    if (cancelled) return;
                    setGeminiKeyStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.geminiApiKey]);

    // YouTube: validates against videos.list?chart=mostPopular - a real,
    // genuine call (proves the key is valid AND the YouTube Data API v3
    // is actually enabled on it) that costs exactly 1 quota unit, versus
    // the 100 units a real search.list call costs. Checking the key on
    // every keystroke with a search call would burn a meaningful chunk
    // of the free daily 10,000-unit quota just to type it in - this is
    // the actual reason a *different* endpoint is used here than the
    // syllabus resource search itself later calls.
    const [youtubeKeyStatus, setYoutubeKeyStatus] = useState('idle');
    useEffect(() => {
        const key = settings.youtubeApiKey.trim();
        if (!key) {
            setYoutubeKeyStatus('idle');
            return undefined;
        }
        let cancelled = false;
        setYoutubeKeyStatus('checking');
        const timeoutId = setTimeout(() => {
            fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=${encodeURIComponent(key)}`)
                .then((res) => {
                    if (cancelled) return;
                    setYoutubeKeyStatus(res.ok ? 'connected' : 'invalid');
                })
                .catch(() => {
                    if (cancelled) return;
                    setYoutubeKeyStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.youtubeApiKey]);

    // Saavn has no credential to validate - what actually needs checking
    // is whether the configured mirror (the default, or whatever's typed
    // into saavnApiBaseUrl below) is reachable at all right now. Unlike
    // every other field on this page, "invalid" isn't really a possible
    // outcome here (there's no key format to get wrong) - only "reachable"
    // or "not reachable", so this runs a real, tiny search.songs call
    // (the exact same client function the Audio Hub search itself uses)
    // rather than just checking the field is non-empty. handleChange
    // already writes every keystroke straight to localStorage, so by the
    // time this debounce fires, searchSaavnSongs (which reads the base
    // URL from that same localStorage value) is genuinely testing what
    // was just typed, not a stale value.
    const [saavnBaseUrlStatus, setSaavnBaseUrlStatus] = useState('idle');
    useEffect(() => {
        if (!settings.saavnEnabled) { setSaavnBaseUrlStatus('idle'); return undefined; }
        let cancelled = false;
        setSaavnBaseUrlStatus('checking');
        const timeoutId = setTimeout(() => {
            searchSaavnSongs('test', { limit: 1 })
                .then((results) => {
                    if (cancelled) return;
                    // A mirror that's up but genuinely returns zero results
                    // for a common word like "test" would be very unusual -
                    // treated as a real, working connection either way,
                    // since the request itself succeeded end-to-end.
                    setSaavnBaseUrlStatus('connected');
                })
                .catch(() => {
                    if (cancelled) return;
                    setSaavnBaseUrlStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.saavnEnabled, settings.saavnApiBaseUrl]);

    // Grok (xAI): xAI's own API is OpenAI-compatible (same request/
    // response shape, same /v1/models list endpoint convention) - same
    // debounced, race-safe verification pattern as OpenAI above, just
    // pointed at api.x.ai instead.
    const [grokKeyStatus, setGrokKeyStatus] = useState('idle');
    useEffect(() => {
        const key = settings.grokApiKey.trim();
        if (!key) {
            setGrokKeyStatus('idle');
            return undefined;
        }
        let cancelled = false;
        setGrokKeyStatus('checking');
        const timeoutId = setTimeout(() => {
            fetch('https://api.x.ai/v1/models', {
                headers: { Authorization: `Bearer ${key}` },
            })
                .then((res) => {
                    if (cancelled) return;
                    setGrokKeyStatus(res.ok ? 'connected' : 'invalid');
                })
                .catch(() => {
                    if (cancelled) return;
                    setGrokKeyStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.grokApiKey]);

    // DeepSeek: also an OpenAI-compatible REST API - same pattern again.
    const [deepseekKeyStatus, setDeepseekKeyStatus] = useState('idle');
    useEffect(() => {
        const key = settings.deepseekApiKey.trim();
        if (!key) {
            setDeepseekKeyStatus('idle');
            return undefined;
        }
        let cancelled = false;
        setDeepseekKeyStatus('checking');
        const timeoutId = setTimeout(() => {
            fetch('https://api.deepseek.com/v1/models', {
                headers: { Authorization: `Bearer ${key}` },
            })
                .then((res) => {
                    if (cancelled) return;
                    setDeepseekKeyStatus(res.ok ? 'connected' : 'invalid');
                })
                .catch(() => {
                    if (cancelled) return;
                    setDeepseekKeyStatus('error');
                });
        }, 700);
        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [settings.deepseekApiKey]);

    // The PIN genuinely needs its own, explicit save step - unlike every
    // other preference on this page, it requires async hashing and
    // 4-digit validation before it's safe to persist, so it can't just
    // save instantly on every keystroke the way a slider or toggle can.
    // Every other setting already saves itself the moment it changes,
    // via handleChange above.
    const handleSavePin = async (e) => {
        e.preventDefault();
        if (!pinTouched) return;

        if (!isValidPinInput(pinDraft)) {
            setPinError('PIN must be exactly 4 digits, or left blank to disable the lock.');
            return; // block the save - never persist a half-valid PIN
        }
        let resolvedPin;
        try {
            resolvedPin = pinDraft === '' ? '' : await hashPin(pinDraft);
        } catch (err) {
            setPinError('Could not save PIN right now. Please try again.');
            return; // block the save - never persist without resolving the PIN
        }

        // Same real read-modify-write + isLocalChangeRef guard pattern as
        // handleChange above - a genuine, confirmed bug without it: this
        // used to do the localStorage.setItem INSIDE the setSettings
        // updater function (which can run more than once, and more
        // importantly runs asynchronously relative to the dispatch right
        // below), so by the time nexus_settings_updated fired,
        // localStorage hadn't actually been written yet - the page's own
        // syncFromExternalUpdate listener then re-read the STALE saved
        // blob and overwrote the just-saved PIN straight back to
        // "Disabled", live-confirmed: the PIN hash was genuinely in
        // localStorage, but the visible "Enabled" badge and Protected
        // Modules section never appeared because this state update raced
        // itself and lost.
        const next = { ...settings, appPin: resolvedPin };
        setSettings(next);
        localStorage.setItem('nexus_global_settings', JSON.stringify(next));
        isLocalChangeRef.current = true;
        window.dispatchEvent(new Event('nexus_settings_updated'));
        window.dispatchEvent(new Event('storage'));
        isLocalChangeRef.current = false;

        setPinBoxValues(['', '', '', '']);
        setPinTouched(false);
        setPinError('');
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
    };

    // A real "forgot PIN" flow, not just a suggestion to remember it -
    // there's genuinely no server-side recovery possible (appPin only
    // ever stores a one-way SHA-256 hash, see pinSecurity.js), so the
    // only honest recovery is resetting the lock outright and letting
    // the user set a fresh PIN afterward. The Protected Modules section
    // already hides itself once neither a PIN nor biometric is
    // configured (see its own condition below), so this can't leave
    // anything in an orphaned "locked with no way to unlock" state.
    const handleForgotPin = () => {
        if (!window.confirm('Reset your PIN? This turns off PIN lock immediately - you can set a new one any time after.')) return;
        // Same isLocalChangeRef-guarded write as handleSavePin above -
        // see its own comment for the exact race this avoids.
        const next = { ...settings, appPin: '' };
        setSettings(next);
        localStorage.setItem('nexus_global_settings', JSON.stringify(next));
        isLocalChangeRef.current = true;
        window.dispatchEvent(new Event('nexus_settings_updated'));
        window.dispatchEvent(new Event('storage'));
        isLocalChangeRef.current = false;

        setPinBoxValues(['', '', '', '']);
        setPinTouched(false);
        setPinError('');
    };

    // A real, immediate manual lock - reloading is what actually forces
    // this: AppRoot.jsx's Gate component decides whether to show the
    // lock screen from its own local isBiometricUnlocked/
    // isQuickPinUnlocked state, which only exists in memory and is
    // always false again on a fresh mount - a genuine full reload (not
    // a client-side route change) is what makes that happen correctly,
    // without needing a new cross-component "please re-lock now" signal
    // built just for this button.
    const handleLockNow = () => {
        window.location.reload();
    };

    // Stored under its own dedicated localStorage key, deliberately
    // separate from nexus_global_settings - that key is a small shared
    // JSON blob every settings writer merges into (never replaces), and
    // a multi-hundred-KB image data URL has no business bloating every
    // future read/write of it. `wallpaper: 'custom-image'` in the real
    // settings blob is just an id, same as any other wallpaper id - the
    // actual pixels live here instead. window.Image (not the bare
    // `Image` identifier) is deliberate: this file already imports an
    // `Image` icon from lucide-react at the top, which would otherwise
    // silently shadow the real DOM Image constructor.
    const handleCustomImageFile = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setCustomImageError('Please choose an image file (PNG, JPG, or WEBP).');
            return;
        }
        setCustomImageError('');
        setCustomImageProcessing(true);
        const reader = new FileReader();
        reader.onload = () => {
            const img = new window.Image();
            img.onload = () => {
                // Downscale + re-encode as JPEG before saving - a raw phone
                // photo can be several MB, comfortably enough to blow past
                // localStorage's per-origin quota once base64-inflated by
                // ~33%. Capping the longer edge at 1920px and re-encoding
                // at 0.85 quality keeps this to a reliably small size
                // while staying sharp at any real wallpaper viewing size.
                const maxDim = 1920;
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                try {
                    localStorage.setItem('nexus_custom_wallpaper_image', dataUrl);
                    setCustomWallpaperImage(dataUrl);
                    // Separate event from nexus_settings_updated - the
                    // `wallpaper` id can stay 'custom-image' across a
                    // photo REPLACE (same id, new pixels), which the
                    // regular settings-sync listener in DashboardLayout
                    // deliberately skips re-rendering for when the id
                    // itself hasn't changed. This event is what tells the
                    // already-mounted background layer to re-read the
                    // new image in that exact case.
                    window.dispatchEvent(new Event('nexus_custom_wallpaper_updated'));
                    handleChange('wallpaper', 'custom-image');
                } catch (e) {
                    setCustomImageError('That photo is too large to save. Try a smaller image.');
                }
                setCustomImageProcessing(false);
            };
            img.onerror = () => {
                setCustomImageError('Could not read that image. Try a different file.');
                setCustomImageProcessing(false);
            };
            img.src = reader.result;
        };
        reader.onerror = () => {
            setCustomImageError('Could not read that file.');
            setCustomImageProcessing(false);
        };
        reader.readAsDataURL(file);
    };

    const handleUseCustomImage = () => {
        if (customWallpaperImage) handleChange('wallpaper', 'custom-image');
    };

    const handleRemoveCustomImage = () => {
        try { localStorage.removeItem('nexus_custom_wallpaper_image'); } catch (e) { /* nothing to clean up */ }
        setCustomWallpaperImage('');
        setCustomImageError('');
        window.dispatchEvent(new Event('nexus_custom_wallpaper_updated'));
        if (settings.wallpaper === 'custom-image') handleChange('wallpaper', 'sky');
    };

    // Real, working custom font upload - a genuine FontFace loaded from
    // the user's own file (not a preview/mockup), immediately applied
    // app-wide via the same --font-primary variable the curated library
    // uses, and persisted (the raw bytes in IndexedDB, see
    // customFontStorage.js; just the {id, label, familyName} metadata in
    // the regular settings blob) so it's still there next time the font-
    // application effect above runs.
    const MAX_FONT_FILE_BYTES = 5 * 1024 * 1024;
    const handleCustomFontFile = async (file) => {
        if (!file) return;
        if (!/\.(ttf|otf|woff2?|ttc)$/i.test(file.name)) {
            setCustomFontError('Please choose a .ttf, .otf, .woff, or .woff2 font file.');
            return;
        }
        if (file.size > MAX_FONT_FILE_BYTES) {
            setCustomFontError('That font file is too large (max 5MB).');
            return;
        }
        setCustomFontError('');
        setCustomFontProcessing(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const id = `custom_${Date.now()}`;
            const familyName = `NexusCustom_${id}`;
            const fontFace = new FontFace(familyName, arrayBuffer);
            await fontFace.load();
            document.fonts.add(fontFace);
            await saveCustomFontBlob(id, arrayBuffer);
            const label = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Custom Font';
            const nextCustomFonts = [...(settings.customFonts || []), { id, label, fileName: file.name, familyName }];
            const next = { ...settings, customFonts: nextCustomFonts, fontFamily: id };
            setSettings(next);
            localStorage.setItem('nexus_global_settings', JSON.stringify(next));
            isLocalChangeRef.current = true;
            window.dispatchEvent(new Event('nexus_settings_updated'));
            window.dispatchEvent(new Event('storage'));
            isLocalChangeRef.current = false;
        } catch (e) {
            setCustomFontError('Could not load that font file - it may be corrupted or an unsupported format.');
        } finally {
            setCustomFontProcessing(false);
        }
    };

    const handleRemoveCustomFont = async (id) => {
        try { await deleteCustomFontBlob(id); } catch (e) { /* nothing to clean up */ }
        const nextCustomFonts = (settings.customFonts || []).filter((f) => f.id !== id);
        const wasActive = settings.fontFamily === id;
        const next = { ...settings, customFonts: nextCustomFonts, fontFamily: wasActive ? DEFAULT_FONT_ID : settings.fontFamily };
        setSettings(next);
        localStorage.setItem('nexus_global_settings', JSON.stringify(next));
        isLocalChangeRef.current = true;
        window.dispatchEvent(new Event('nexus_settings_updated'));
        window.dispatchEvent(new Event('storage'));
        isLocalChangeRef.current = false;
    };

    const handlePinBoxChange = (index, rawValue) => {
        const digit = rawValue.replace(/\D/g, '').slice(-1) || '';
        setPinBoxValues((prev) => {
            const next = [...prev];
            next[index] = digit;
            return next;
        });
        setPinTouched(true);
        setPinError('');
        if (digit && index < 3) pinInputRefs[index + 1].current?.focus();
    };

    const handlePinBoxKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !pinBoxValues[index] && index > 0) {
            pinInputRefs[index - 1].current?.focus();
        }
    };

    const handleToggleBiometric = async () => {
        if (biometricEnabled) {
            disableBiometricLock();
            setBiometricEnabled(false);
            return;
        }
        setBiometricStatus('registering');
        setBiometricError('');
        try {
            await registerBiometric(user?.email);
            setBiometricEnabled(true);
            setBiometricStatus('idle');
        } catch (err) {
            // Registration was genuinely cancelled or failed - the
            // toggle stays off, since optimistically flipping it on
            // before the device has actually confirmed a credential
            // would leave a "locked but no real credential exists"
            // state a person could never unlock.
            setBiometricError(err.message || 'Could not enable biometric lock on this device.');
            setBiometricStatus('error');
        }
    };


    const [settingsConfirm, setSettingsConfirm] = useState(null); // null | { title, message, onConfirm }
    const [settingsToast, setSettingsToast] = useState(null); // null | { message, type: 'success' | 'error' }
    useEffect(() => {
        if (!settingsToast) return undefined;
        const timeoutId = setTimeout(() => setSettingsToast(null), 3000);
        return () => clearTimeout(timeoutId);
    }, [settingsToast]);

    const handleClearSpecific = async (modulePrefixes, moduleName) => {
        const prefixes = Array.isArray(modulePrefixes) ? modulePrefixes : [modulePrefixes];
        setSettingsConfirm({
            title: 'Clear Module Data',
            message: `Are you sure you want to clear all data for ${moduleName}? This cannot be undone.`,
            onConfirm: async () => {
                setSettingsConfirm(null);
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (prefixes.some((prefix) => k.includes(prefix))) keysToRemove.push(k);
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                // Without this, a signed-in user's cloud copy would still have the
                // old data, and the automatic pull-on-login would silently
                // restore it right after their next sign-in - undoing the clear.
                if (isFirebaseConfigured() && user) {
                    await pushToCloud();
                }
                calculateCache();
                setSettingsToast({ message: `${moduleName} data cleared successfully!`, type: 'success' });
                // The native browser 'storage' event never fires for
                // changes made by the same tab that made them - only for
                // other tabs/windows of the same origin. This app's own,
                // already-established convention for same-tab reactivity
                // is to manually dispatch a plain Event named 'storage'
                // (not a real StorageEvent) after any localStorage write;
                // TaskRegistryContext (and every other consumer that reads
                // Planner/Finance/Gym/Study data for the dashboard) already
                // listens for exactly this, so the cleared state reflects
                // live everywhere immediately - no page reload needed.
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new Event('nexus_settings_updated'));
            },
        });
    };

    const [pendingAction, setPendingAction] = useState(null); // null | 'export' | 'import' | 'factoryReset'
    const [pendingImportData, setPendingImportData] = useState(null);
    // null | { mode: 'export' } | { mode: 'import', encryptedPayload }
    const [passphraseModal, setPassphraseModal] = useState(null);

    // Real state for the email/password sign-in form - AuthContext's
    // login/signup functions already existed and worked, but nothing in
    // the UI ever actually called them; this is what closes that gap.
    const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [authLoading, setAuthLoading] = useState(false);
    const [pwCurrentPassword, setPwCurrentPassword] = useState('');
    const [pwNewPassword, setPwNewPassword] = useState('');
    const [pwConfirmPassword, setPwConfirmPassword] = useState('');
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);

    // Linked Sign-In Methods - lets an already-signed-in account attach
    // its OTHER identifier (email if it signed up via phone, phone if it
    // signed up via email) via utils/accountLinking.js, so logging in
    // with either one afterward reaches this exact same account.
    const [linkedExpanded, setLinkedExpanded] = useState(false);
    const [linkedIdentifiers, setLinkedIdentifiers] = useState({});
    const [linkDraft, setLinkDraft] = useState('');
    const [linkError, setLinkError] = useState('');
    const [linkSuccess, setLinkSuccess] = useState(false);
    const [linkLoading, setLinkLoading] = useState(false);

    // Firebase's own error codes are technical (auth/wrong-password,
    // auth/email-already-in-use, etc.) - this maps the ones a real user is
    // actually likely to hit into honest, plain-language messages, and
    // falls back to the raw message for anything unexpected rather than
    // hiding it.

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        if (!authEmail.trim() || !authPassword) return;
        setAuthError('');
        setAuthLoading(true);
        try {
            if (authMode === 'signup') {
                await signup(authEmail.trim(), authPassword);
            } else {
                await login(authEmail.trim(), authPassword);
            }
            setAuthEmail('');
            setAuthPassword('');
        } catch (err) {
            setAuthError(getAuthErrorMessage(err));
        } finally {
            setAuthLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setAuthError('');
        setAuthLoading(true);
        try {
            await loginWithGoogle();
        } catch (err) {
            // A user closing the popup themselves is a real, common,
            // benign action (not an actual error) - shown as a quiet,
            // honest status rather than styled as a failure.
            setAuthError(getAuthErrorMessage(err));
        } finally {
            setAuthLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwError('');
        setPwSuccess(false);
        if (pwNewPassword.length < 6) {
            setPwError('New password should be at least 6 characters.');
            return;
        }
        if (pwNewPassword !== pwConfirmPassword) {
            setPwError('New password and confirmation don\'t match.');
            return;
        }
        setPwLoading(true);
        try {
            await changePassword(pwCurrentPassword, pwNewPassword);
            setPwCurrentPassword('');
            setPwNewPassword('');
            setPwConfirmPassword('');
            setPwSuccess(true);
        } catch (err) {
            setPwError(getAuthErrorMessage(err));
        } finally {
            setPwLoading(false);
        }
    };

    // Whichever of email/phone this account did NOT sign up with - the
    // only one it makes sense to offer linking for. isSyntheticPhoneEmail
    // tells apart "this account's real Firebase email IS a phone number
    // in disguise" (primary = phone, offer linking an email) from "this
    // account's real Firebase email is a genuine email" (primary = email,
    // offer linking a phone).
    const primaryIsPhone = user ? isSyntheticPhoneEmail(user.email) : false;
    const missingLinkType = primaryIsPhone ? 'email' : 'phone';

    // Pre-fills +91 the moment this field's own role becomes "link a
    // phone number" - same convenience as LoginPage's own phone input.
    // Only ever fires once per account (missingLinkType is fixed for a
    // given account's whole session), and only touches an empty draft -
    // never overwrites anything already typed.
    useEffect(() => {
        if (missingLinkType === 'phone' && linkDraft === '') setLinkDraft('+91 ');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [missingLinkType]);

    const handleLinkIdentifier = async (e) => {
        e.preventDefault();
        setLinkError('');
        setLinkSuccess(false);
        if (missingLinkType === 'phone' && !isValidPhoneNumber(linkDraft)) {
            setLinkError('Enter a valid mobile number (7-15 digits, with country code).');
            return;
        }
        if (missingLinkType === 'email' && !linkDraft.trim()) {
            setLinkError('Enter a valid email address.');
            return;
        }
        setLinkLoading(true);
        try {
            await linkIdentifierToAccount(linkDraft.trim(), missingLinkType, user);
            setLinkedIdentifiers((prev) => ({ ...prev, [missingLinkType]: linkDraft.trim() }));
            setLinkDraft('');
            setLinkSuccess(true);
            setTimeout(() => setLinkSuccess(false), 3000);
        } catch (err) {
            setLinkError(err.message || 'Could not link that right now. Please try again.');
        } finally {
            setLinkLoading(false);
        }
    };

    const handleUnlinkIdentifier = async (type) => {
        const value = linkedIdentifiers[type];
        if (!value) return;
        setLinkError('');
        setLinkLoading(true);
        try {
            await unlinkIdentifierFromAccount(value, type, user);
            setLinkedIdentifiers((prev) => { const next = { ...prev }; delete next[type]; return next; });
        } catch (err) {
            setLinkError(err.message || 'Could not remove that link right now. Please try again.');
        } finally {
            setLinkLoading(false);
        }
    };

    // Loads whatever's already linked to this account the moment a real
    // session exists, so the section shows real, current state rather
    // than starting blank until the user happens to expand it.
    useEffect(() => {
        if (!isConfigured || !user) { setLinkedIdentifiers({}); return; }
        let cancelled = false;
        getLinkedIdentifiers(user.uid).then((linked) => { if (!cancelled) setLinkedIdentifiers(linked); });
        return () => { cancelled = true; };
    }, [isConfigured, user]);

    const handleFactoryReset = async () => {
        setSettingsConfirm({
            title: '⚠️ Danger Zone',
            message: "This permanently erases all local and cloud data — the OS will reset to a blank state.",
            forceGlass: true,
            onConfirm: async () => {
                setSettingsConfirm(null);
                // Delete the cloud copy first (while we still have the user's
                // uid available) so a factory reset is genuinely clean on every
                // device, not just this one - otherwise logging back in would
                // silently restore the "deleted" data right back.
                if (isFirebaseConfigured() && user) {
                    try {
                        await deleteDoc(doc(db, 'nexusUsers', user.uid));
                    } catch (e) {
                        /* if this fails (e.g. offline), the local wipe still proceeds */
                    }
                }
                localStorage.clear();
                // localStorage.clear() never touches IndexedDB - without this, locally
                // imported audio files' actual bytes would silently survive a "factory
                // reset" even though their playlist entries are gone.
                try {
                    if (window.indexedDB && indexedDB.deleteDatabase) {
                        indexedDB.deleteDatabase('nexus_audio_db');
                    }
                } catch (e) {
                    /* non-fatal - the reset still proceeds */
                }
                // Re-apply the default theme immediately and reset this
                // page's own settings state back to defaults - a page
                // reload used to handle both of these implicitly. Every
                // other page/component that reads any module's data
                // already handles the empty/zero-data case honestly, so
                // dispatching the same events used elsewhere (matching
                // pullFromCloud's and applyImportedData's pattern above)
                // correctly reflects the now-wiped state live everywhere,
                // no reload required.
                document.documentElement.setAttribute('data-theme', 'night');
                setSettings(defaultSettings);
                calculateCache();
                setSettingsToast({ message: 'Factory reset complete. The OS has returned to a blank state.', type: 'success' });
                window.dispatchEvent(new Event('nexus_profile_updated'));
                window.dispatchEvent(new Event('nexus_settings_updated'));
                window.dispatchEvent(new Event('nexus_theme_changed'));
                window.dispatchEvent(new Event('storage'));
            },
        });
    };

    // Entry point every "Export Backup" call site already used - now opens
    // the real passphrase prompt instead of exporting immediately.
    // performEncryptedExport below does the actual work once a passphrase
    // is chosen.
    const handleExportData = () => {
        setPassphraseModal({ mode: 'export' });
    };

    // The real export - collects every real localStorage key (identical
    // scope to the original plain-JSON export), then encrypts the whole
    // JSON blob with AES-256-GCM (see utils/backupEncryption.js) before
    // it ever touches disk. Thrown errors (extremely rare - a genuine
    // crypto.subtle failure) propagate to BackupPassphraseModal's own
    // catch, which shows a real error instead of silently downloading
    // nothing.
    const performEncryptedExport = async (passphrase) => {
        const allData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            allData[key] = localStorage.getItem(key);
        }
        const encryptedPayload = await encryptBackupPayload(JSON.stringify(allData), passphrase);
        const blob = new Blob([JSON.stringify(encryptedPayload)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", url);
        downloadAnchor.setAttribute("download", `NexusOS_Backup_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(url);
        setPassphraseModal(null);
        setSettingsToast({ message: 'Encrypted backup downloaded.', type: 'success' });
    };

    // Shared by both real import paths (a legacy unencrypted backup file,
    // or a freshly-decrypted one) - PIN-gates the actual destructive
    // localStorage overwrite exactly like before, so encryption is
    // additive, not a replacement for the existing PIN protection.
    const proceedWithImportedData = (importedData) => {
        if (isPinConfigured(settings.appPin)) {
            setPendingImportData(importedData);
            setPendingAction('import');
        } else {
            applyImportedData(importedData);
        }
    };

    // Reading and parsing the file is not itself destructive - only
    // actually applying it (wiping localStorage and repopulating it) is,
    // so only that second step is gated behind PIN verification below.
    const handleImportData = (e) => {
        const fileReader = new FileReader();
        if (e.target.files[0]) {
            fileReader.readAsText(e.target.files[0], "UTF-8");
            fileReader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (isEncryptedBackupPayload(parsed)) {
                        setPassphraseModal({ mode: 'import', encryptedPayload: parsed });
                    } else {
                        proceedWithImportedData(parsed);
                    }
                } catch (err) {
                    setSettingsToast({ message: 'Invalid backup file format!', type: 'error' });
                }
            };
            // A genuine OS/permissions-level read failure (not a bad JSON
            // body - onload's own try/catch above already handles that)
            // previously left the user with zero feedback at all: no
            // toast, nothing selected, nothing to explain why the import
            // silently did nothing.
            fileReader.onerror = () => {
                setSettingsToast({ message: 'Could not read that file. Please try again.', type: 'error' });
            };
        }
        e.target.value = ''; // allow re-selecting the same filename later
    };

    // The real decrypt step for an encrypted backup file - a wrong
    // passphrase throws (AES-GCM's own auth tag fails to verify), which
    // propagates to BackupPassphraseModal's catch and shows a real error
    // rather than importing garbage.
    const performDecryptedImport = async (passphrase) => {
        const decryptedJson = await decryptBackupPayload(passphraseModal.encryptedPayload, passphrase);
        const importedData = JSON.parse(decryptedJson);
        setPassphraseModal(null);
        proceedWithImportedData(importedData);
    };

    const applyImportedData = (importedData) => {
        localStorage.clear();
        for (let key in importedData) {
            localStorage.setItem(key, importedData[key]);
        }
        // Re-apply the theme attribute immediately - a page reload used to
        // handle this implicitly via the app's own initial-load logic
        // reading nexus_theme from localStorage. Without a reload, the DOM
        // still reflects whatever theme was active before the import, not
        // the restored one, unless this is done explicitly.
        const restoredTheme = importedData['nexus_theme'] || 'night';
        document.documentElement.setAttribute('data-theme', restoredTheme);
        // Re-sync this page's own settings state too - it only ever read
        // localStorage once on mount, so it has no way to notice the
        // wholesale import that just happened underneath it otherwise.
        const savedSettings = JSON.parse(importedData['nexus_global_settings'] || 'null');
        if (savedSettings) setSettings({ ...defaultSettings, ...savedSettings, themeMode: restoredTheme });
        calculateCache();
        setSettingsToast({ message: 'System Backup restored!', type: 'success' });
        // Same, already-proven pattern pullFromCloud uses for the exact
        // same kind of operation (a bulk localStorage overwrite) - every
        // other page/component that reads Planner/Finance/Gym/Study/
        // profile/settings data already listens for these, so the import
        // reflects live everywhere immediately, no reload required.
        window.dispatchEvent(new Event('nexus_profile_updated'));
        window.dispatchEvent(new Event('nexus_settings_updated'));
        window.dispatchEvent(new Event('nexus_theme_changed'));
        window.dispatchEvent(new Event('storage'));
    };

    // The one place all three high-risk actions actually run, only ever
    // reached after a genuine correct PIN match (or immediately, if no
    // PIN is configured at all - there's nothing to gate an action behind
    // a PIN that doesn't exist, that would just permanently block these
    // actions rather than secure them).
    const runPendingAction = () => {
        if (pendingAction === 'export') handleExportData();
        if (pendingAction === 'factoryReset') handleFactoryReset();
        if (pendingAction === 'import' && pendingImportData) applyImportedData(pendingImportData);
        setPendingAction(null);
        setPendingImportData(null);
    };

    const requestHighRiskAction = (action) => {
        if (isPinConfigured(settings.appPin)) {
            setPendingAction(action);
        } else if (action === 'export') {
            handleExportData();
        } else if (action === 'factoryReset') {
            handleFactoryReset();
        }
        // 'import' with no PIN configured is triggered directly from
        // handleImportData above instead, since that path already has the
        // freshly-parsed file data in hand at that point.
    };

    return (
        <div className="settings-shell" style={{ paddingBottom: '60px' }}>
            {showTour && <TourGuide tourId="settings" steps={TOUR_STEPS.settings} onFinish={() => setShowTour(false)} />}

            <SettingsLayout
                categories={SETTINGS_CATEGORIES}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
                onMobileOverlayChange={onMobileOverlayChange}
                header={(
                    <>
                        <h1 className="settings-page-title">Settings Hub</h1>
                        <SettingsProfileHeader user={user} cacheSize={cacheSize} settings={settings} setActiveTab={setActiveTab} />
                    </>
                )}
            >
                {activeCategory === 'account' && (
                <SettingCard icon={User} title="Account & Profile Preferences" subtitle="Connected sign-in, cloud account, and your full profile" tourId="settings-account" defaultOpen>
                    <button
                        type="button"
                        onClick={() => setActiveTab && setActiveTab('Profile')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '14px 18px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', cursor: 'pointer', width: '100%', fontFamily: 'inherit', textAlign: 'left' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                            <User size={16} color="var(--accent)" />
                            <div style={{ minWidth: 0 }}>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Manage Full Profile</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avatar, bio, headline, and social links</span>
                            </div>
                        </div>
                        <ArrowUpRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    </button>

                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '12px' }}><Cloud size={20} color="var(--accent)" /><h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>Cloud Sync & Account Management</h3></div>

                    {isConfigured && user ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)', flexShrink: 0, display: 'inline-block' }} />
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Signed in as <strong style={{ color: 'var(--text-primary)' }}>{isSyntheticPhoneEmail(user.email) ? syntheticEmailToPhone(user.email) : user.email}</strong> - manage sync status and sign out below.</span>
                            </div>

                            {/* Real password create/update section - only
                                shown once signed in. The "Current Password"
                                field is only shown for a user who genuinely
                                already has a real password credential
                                linked (user.providerData contains
                                'password') - a Google-only user has no
                                current password to provide, so this is
                                genuinely their first time setting one, not
                                changing an existing one. */}
                            <div style={{ borderTop: '1px solid var(--border-premium)', paddingTop: '16px', marginTop: '4px' }}>
                                {/* Collapsible accordion header - precisely
                                    matches the Custom Background / Productivity
                                    Widget accordion template above: same icon
                                    placement, same ChevronDown rotation/
                                    transition, same hover behavior, so this
                                    section reads as visually consistent with
                                    every other collapsible in this module.
                                    Defaults closed (passwordExpanded starts
                                    false) so this form doesn't clutter the
                                    page until the user genuinely wants it. */}
                                <button
                                    type="button"
                                    onClick={() => setPasswordExpanded((v) => !v)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                                        fontFamily: 'inherit', marginBottom: passwordExpanded ? '10px' : 0,
                                    }}
                                >
                                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                        <Lock size={14} color="var(--accent)" /> {user.providerData.some((p) => p.providerId === 'password') ? 'Change Password' : 'Set a Password'}
                                    </h4>
                                    <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: passwordExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                                </button>
                                {passwordExpanded && (
                                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {user.providerData.some((p) => p.providerId === 'password') && (
                                        <input
                                            id="settings-pw-current" name="current-password" type="password" autoComplete="current-password" aria-label="Current password"
                                            placeholder="Current password" value={pwCurrentPassword}
                                            onChange={(e) => { setPwCurrentPassword(e.target.value); setPwError(''); setPwSuccess(false); }}
                                            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        />
                                    )}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <input
                                            id="settings-pw-new" name="new-password" type="password" autoComplete="new-password" aria-label="New password"
                                            placeholder="New password" value={pwNewPassword}
                                            onChange={(e) => { setPwNewPassword(e.target.value); setPwError(''); setPwSuccess(false); }}
                                            style={{ flex: '1 1 160px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        />
                                        <input
                                            id="settings-pw-confirm" name="confirm-new-password" type="password" autoComplete="new-password" aria-label="Confirm new password"
                                            placeholder="Confirm new password" value={pwConfirmPassword}
                                            onChange={(e) => { setPwConfirmPassword(e.target.value); setPwError(''); setPwSuccess(false); }}
                                            style={{ flex: '1 1 160px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        />
                                    </div>
                                    <PasswordStrengthIndicator password={pwNewPassword} />
                                    {pwError && <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{pwError}</span>}
                                    {pwSuccess && <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '600' }}>Password updated successfully.</span>}
                                    <button
                                        type="submit"
                                        disabled={pwLoading || !pwNewPassword || !pwConfirmPassword}
                                        style={{
                                            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '10px',
                                            background: (pwLoading || !pwNewPassword || !pwConfirmPassword) ? 'var(--widget-bg)' : 'var(--primary)',
                                            color: (pwLoading || !pwNewPassword || !pwConfirmPassword) ? 'var(--text-muted)' : 'var(--text-on-primary)',
                                            border: (pwLoading || !pwNewPassword || !pwConfirmPassword) ? '1px solid var(--border-premium)' : 'none',
                                            fontWeight: '700', fontSize: '12px', fontFamily: 'inherit',
                                            cursor: (pwLoading || !pwNewPassword || !pwConfirmPassword) ? 'default' : 'pointer',
                                        }}
                                    >
                                        {pwLoading ? 'Updating…' : 'Update Password'}
                                    </button>
                                </form>
                                )}
                            </div>

                            {/* Linked Sign-In Methods - real cross-credential
                                account linking (utils/accountLinking.js). The
                                account's own primary identifier (whichever it
                                actually signed up with) is never offered for
                                removal here - unlinking it would permanently
                                strand the account with no way back to its own
                                original sign-in method. Same collapsible-
                                accordion visual pattern as Change Password
                                above, so this reads as one consistent family
                                of sections rather than a bolted-on extra. */}
                            <div style={{ borderTop: '1px solid var(--border-premium)', paddingTop: '16px', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setLinkedExpanded((v) => !v)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                                        fontFamily: 'inherit', marginBottom: linkedExpanded ? '10px' : 0,
                                    }}
                                >
                                    <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                        <Link2 size={14} color="var(--accent)" /> Linked Sign-In Methods
                                    </h4>
                                    <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: linkedExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                                </button>
                                {linkedExpanded && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {primaryIsPhone ? <Phone size={13} /> : <Mail size={13} />}
                                            Primary: <strong style={{ color: 'var(--text-primary)' }}>{primaryIsPhone ? syntheticEmailToPhone(user.email) : user.email}</strong>
                                        </div>

                                        {linkedIdentifiers[missingLinkType] ? (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px' }}>
                                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                    {missingLinkType === 'phone' ? <Phone size={13} /> : <Mail size={13} />}
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkedIdentifiers[missingLinkType]}</span>
                                                </span>
                                                <button
                                                    type="button" onClick={() => handleUnlinkIdentifier(missingLinkType)} disabled={linkLoading}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: linkLoading ? 'default' : 'pointer', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleLinkIdentifier} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                <input
                                                    id="settings-link-identifier" name="linkIdentifier"
                                                    type={missingLinkType === 'phone' ? 'tel' : 'email'}
                                                    inputMode={missingLinkType === 'phone' ? 'tel' : 'email'}
                                                    autoComplete={missingLinkType === 'phone' ? 'tel' : 'email'}
                                                    aria-label={missingLinkType === 'phone' ? 'Mobile number to link' : 'Email to link'}
                                                    placeholder={missingLinkType === 'phone' ? '98765 43210' : 'you@example.com'}
                                                    value={linkDraft}
                                                    onChange={(e) => { setLinkDraft(e.target.value); setLinkError(''); }}
                                                    style={{ flex: '1 1 180px', minWidth: 0, padding: '10px 14px', borderRadius: '10px', border: `1px solid ${linkError ? '#EF4444' : 'var(--border-premium)'}`, background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                                />
                                                <button
                                                    type="submit" disabled={linkLoading || !linkDraft.trim()}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '10px',
                                                        background: (linkLoading || !linkDraft.trim()) ? 'var(--widget-bg)' : 'var(--primary)',
                                                        color: (linkLoading || !linkDraft.trim()) ? 'var(--text-muted)' : 'var(--text-on-primary)',
                                                        border: (linkLoading || !linkDraft.trim()) ? '1px solid var(--border-premium)' : 'none',
                                                        fontWeight: '700', fontSize: '12px', fontFamily: 'inherit',
                                                        cursor: (linkLoading || !linkDraft.trim()) ? 'default' : 'pointer', flexShrink: 0,
                                                    }}
                                                >
                                                    <Link2 size={13} /> {linkLoading ? 'Linking…' : `Link ${missingLinkType === 'phone' ? 'Number' : 'Email'}`}
                                                </button>
                                            </form>
                                        )}
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {missingLinkType === 'phone'
                                                ? 'Link a mobile number so you can sign in with either your email or this number, using the same password.'
                                                : 'Link an email so you can sign in with either your mobile number or this email, using the same password.'}
                                        </span>
                                        {linkError && <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{linkError}</span>}
                                        {linkSuccess && <span style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle size={13} /> Linked successfully.</span>}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : isConfigured ? (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <form onSubmit={handleAuthSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>{authMode === 'signup' ? 'Create a Cloud Account' : 'Sign In to Cloud Sync'}</strong>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {authMode === 'signup' ? 'Sign up to back up and sync your data across devices.' : 'Sign in to enable backup and sync across devices.'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px' }}>
                                        <Mail size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                        <input
                                            id="settings-auth-email" name="email" type="email" autoComplete="email" aria-label="Email"
                                            placeholder="Email" value={authEmail}
                                            onChange={(e) => { setAuthEmail(e.target.value); setAuthError(''); }}
                                            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ flex: '1 1 160px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px' }}>
                                        <Lock size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                        <input
                                            id="settings-auth-password" name="password" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} aria-label="Password"
                                            placeholder="Password" value={authPassword}
                                            onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }}
                                            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                    <button
                                        type="submit"
                                        disabled={authLoading || !authEmail.trim() || !authPassword}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px',
                                            background: (authLoading || !authEmail.trim() || !authPassword) ? 'var(--widget-bg)' : 'var(--primary)',
                                            color: (authLoading || !authEmail.trim() || !authPassword) ? 'var(--text-muted)' : 'var(--text-on-primary)',
                                            border: (authLoading || !authEmail.trim() || !authPassword) ? '1px solid var(--border-premium)' : 'none',
                                            fontWeight: '700', fontSize: '13px', fontFamily: 'inherit',
                                            cursor: (authLoading || !authEmail.trim() || !authPassword) ? 'default' : 'pointer',
                                        }}
                                    >
                                        {authLoading ? 'Please wait…' : authMode === 'signup' ? 'Register' : 'Login'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setAuthMode((m) => (m === 'signup' ? 'login' : 'signup')); setAuthError(''); }}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        {authMode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Create one'}
                                    </button>
                                </div>
                            </form>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flex: 1, height: '1px', background: 'var(--border-premium)' }} />
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', letterSpacing: '0.5px' }}>OR</span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--border-premium)' }} />
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={authLoading}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '10px 20px', borderRadius: '12px',
                                    background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)',
                                    fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', cursor: authLoading ? 'default' : 'pointer', opacity: authLoading ? 0.6 : 1,
                                }}
                            >
                                {/* Real, official Google "G" mark colors - not a
                                    single-tone icon, since Google's own brand
                                    guidelines call for the full multi-color mark
                                    on a "Sign in with Google" button. */}
                                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
                                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                                    <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.8 14-5.5l-6.4-5.4C29.5 34.8 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.6 39.6 16.3 44 24 44z" />
                                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.4 5.4C40.8 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
                                </svg>
                                Continue with Google
                            </button>

                            {authError && <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{authError}</span>}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <CloudOff size={16} color="var(--text-muted)" />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cloud sync isn't configured yet - all data stays on this device.</span>
                        </div>
                    )}
                    </div>

                    <div style={{ marginTop: '10px', padding: '20px', background: isConfigured ? 'rgba(99, 102, 241, 0.06)' : 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        {isConfigured && user ? (
                            <>
                                <div>
                                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        {/* Real, visual status indicator - green while
                                            healthy, red during a genuine sync error, so
                                            this reads unambiguously as a live status
                                            light at a glance. */}
                                        <span style={{
                                            width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                                            background: syncStatus === 'error' ? '#EF4444' : '#10B981',
                                            boxShadow: syncStatus === 'error' ? '0 0 6px rgba(239, 68, 68, 0.6)' : '0 0 6px rgba(16, 185, 129, 0.6)',
                                        }} />
                                        Synced as {user.email}
                                    </strong>
                                    <span style={{ fontSize: '12px', color: syncStatus === 'error' ? '#EF4444' : 'var(--text-secondary)', fontWeight: syncStatus === 'error' ? '700' : '400' }}>
                                        {syncStatus === 'error'
                                            ? `Sync Error - Retry${syncError ? ` (${syncError})` : ''}`
                                            : isSyncing ? 'Syncing…' : lastSyncedAt ? `Last synced ${lastSyncedAt.toLocaleTimeString()}.` : 'Not synced yet.'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {/* Real, reported bug fixed: this used to be
                                        labeled "Sync Now" (sounds like "fetch/restore
                                        my data") but actually called pushToCloud (send
                                        LOCAL state TO the cloud, overwriting whatever
                                        was there) - a genuinely dangerous mislabel. The
                                        real pull action (pullFromCloud) used to be
                                        hidden entirely unless syncStatus was already
                                        'error' - useless for the actual real-world case
                                        that matters ("my data looks wrong/missing" is
                                        NOT the same technical state as a sync
                                        transport error; the sync mechanism can be
                                        reporting perfectly healthy while still holding
                                        wrong data). Both directions are now always
                                        visible, unambiguously labeled by direction, and
                                        confirm before running - each one overwrites
                                        whichever side it targets, and that needs to be
                                        a deliberate choice, not a guess based on a
                                        vague button name. */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm('Pull from Cloud will REPLACE your data on THIS device with whatever is currently saved in the cloud. Any local changes not yet synced will be lost. Continue?')) pullFromCloud();
                                        }}
                                        disabled={isSyncing}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: syncStatus === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'var(--surface-inset)', color: syncStatus === 'error' ? '#EF4444' : 'var(--text-primary)', border: syncStatus === 'error' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: isSyncing ? 'default' : 'pointer', opacity: isSyncing ? 0.6 : 1 }}
                                    ><RotateCcw size={15} /> {isSyncing ? 'Pulling…' : 'Pull from Cloud'}</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm('Push to Cloud will REPLACE the cloud copy with whatever is currently on THIS device. If this device is missing data, this will overwrite the cloud with that missing data too. Continue?')) pushToCloud();
                                        }}
                                        disabled={isSyncing}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'var(--surface-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: isSyncing ? 'default' : 'pointer', opacity: isSyncing ? 0.6 : 1 }}
                                    ><RefreshCw size={15} /> {isSyncing ? 'Pushing…' : 'Push to Cloud'}</button>
                                    <button type="button" onClick={logout} title="Sign Out" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: 'var(--surface-inset)', color: '#EF4444', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}><LogOut size={15} /> Sign Out</button>
                                </div>
                            </>
                        ) : isConfigured ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Cloud size={16} color="var(--text-muted)" />
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Not signed in yet - use the Cloud Sync &amp; Account Management card above to log in or create an account.
                                </span>
                            </div>
                        ) : (
                            <div>
                                <strong style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><CloudOff size={16} color="var(--text-muted)" /> Cloud Sync Not Configured</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Running in local-only mode - all data stays on this device. Add your Firebase project credentials to src/firebase/config.js to enable cross-device sync.
                                </span>
                            </div>
                        )}
                    </div>
                </SettingCard>
                )}

                {activeCategory === 'general' && (
                <>
                <SettingCard icon={Sliders} title="System Defaults" subtitle="Currency, weight, and temperature units" defaultOpen>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
                        <div><label htmlFor="currency" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><DollarSign size={14}/> Currency</label>
                            <select id="currency" name="currency" value={globalSettings.currencySymbol} onChange={(e) => updateGlobalSetting('currencySymbol', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}><option value="₹" style={{ background: 'var(--surface-inset)' }}>₹ INR</option><option value="$" style={{ background: 'var(--surface-inset)' }}>$ USD</option><option value="€" style={{ background: 'var(--surface-inset)' }}>€ EUR</option></select>
                        </div>
                        <div><label htmlFor="weightUnit" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><Activity size={14}/> Weight Unit</label>
                            <select id="weightUnit" name="weightUnit" value={settings.weightUnit} onChange={(e) => handleChange('weightUnit', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}><option value="kg" style={{ background: 'var(--surface-inset)' }}>Kilograms (kg)</option><option value="lbs" style={{ background: 'var(--surface-inset)' }}>Pounds (lbs)</option></select>
                        </div>
                        <div><label htmlFor="temperatureUnit" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><Thermometer size={14}/> Temperature Unit</label>
                            <select id="temperatureUnit" name="temperatureUnit" value={settings.temperatureUnit} onChange={(e) => handleChange('temperatureUnit', e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}><option value="°C" style={{ background: 'var(--surface-inset)' }}>Celsius (°C)</option><option value="°F" style={{ background: 'var(--surface-inset)' }}>Fahrenheit (°F)</option></select>
                        </div>
                    </div>
                </SettingCard>

                <SettingCard icon={LayoutDashboard} title="OS Module Manager" subtitle="Toggle which Hubs are active across the OS" tourId="settings-modules" defaultOpen>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        {Object.keys(settings.activeModules).map(mod => (
                            <div key={mod} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{mod} Hub</strong>
                                <ToggleSwitch checked={settings.activeModules[mod]} onChange={() => handleModuleToggle(mod)} />
                            </div>
                        ))}
                    </div>
                </SettingCard>

                {/* Same grid-of-boxes treatment as OS Module Manager above,
                    per explicit request, instead of a plain stacked list -
                    7 items lays out as 4+3 in the same
                    minmax(200px, 1fr) auto-fit grid. */}
                <SettingCard icon={LayoutGrid} title="Productivity Widget Customization" subtitle="Show or hide each category's items on the Home dashboard queue">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><BookOpen size={16} color="var(--text-secondary)" /><strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Study Tracker</strong></div>
                            <ToggleSwitch checked={settings.widgetShowStudy} onChange={(v) => handleChange('widgetShowStudy', v)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Activity size={16} color="var(--text-secondary)" /><strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Gym Split</strong></div>
                            <ToggleSwitch checked={settings.widgetShowGym} onChange={(v) => handleChange('widgetShowGym', v)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><DollarSign size={16} color="var(--text-secondary)" /><strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Finance Overview</strong></div>
                            <ToggleSwitch checked={settings.widgetShowFinance} onChange={(v) => handleChange('widgetShowFinance', v)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Clock size={16} color="var(--text-secondary)" /><strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Daily Timetable</strong></div>
                            <ToggleSwitch checked={settings.widgetShowTimetable} onChange={(v) => handleChange('widgetShowTimetable', v)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ClipboardList size={16} color="var(--text-secondary)" /><strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Planner Tasks</strong></div>
                            <ToggleSwitch checked={settings.widgetShowPlanner} onChange={(v) => handleChange('widgetShowPlanner', v)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><CalendarDays size={16} color="var(--text-secondary)" /><strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Calendar Schedule</strong></div>
                            <ToggleSwitch checked={settings.widgetShowCalendar} onChange={(v) => handleChange('widgetShowCalendar', v)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Utensils size={16} color="var(--text-secondary)" /><strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Nutrition / Diet</strong></div>
                            <ToggleSwitch checked={settings.widgetShowDiet} onChange={(v) => handleChange('widgetShowDiet', v)} />
                        </div>
                    </div>
                </SettingCard>
                </>
                )}

                {activeCategory === 'security' && (
                <SettingCard icon={Shield} title="Security" subtitle="App lock, PIN, and biometrics" defaultOpen>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Lock size={14} color={isPinConfigured(settings.appPin) ? 'var(--success)' : 'var(--text-muted)'} />
                                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>App PIN</strong>
                            </div>
                            <span style={{
                                fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px',
                                background: isPinConfigured(settings.appPin) ? 'rgba(16, 185, 129, 0.12)' : 'var(--widget-bg)',
                                color: isPinConfigured(settings.appPin) ? 'var(--success)' : 'var(--text-muted)',
                            }}>
                                {isPinConfigured(settings.appPin) ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        {/* One PIN, one setup flow - previously two nearly-
                            identical "type a 4-digit PIN" sections (this one
                            for locking individual modules while already
                            inside the app, a separate "Quick Sign-In PIN"
                            below for skipping your password on this device)
                            asked for what looked like the same thing twice.
                            Setting a PIN here now does both jobs at once -
                            see utils/quickPin.js for how QuickPinUnlockScreen
                            reads this exact same value. */}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            One PIN unlocks the app on this device and gates the modules you choose below.
                        </span>

                        {/* 4-box entry - real per-digit boxes with
                            auto-advance and backspace-to-previous, not one
                            plain masked text field. */}
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', padding: '4px 0' }}>
                            {[0, 1, 2, 3].map((i) => (
                                <input
                                    key={i}
                                    ref={pinInputRefs[i]}
                                    type="password" inputMode="numeric" maxLength={1}
                                    aria-label={`PIN digit ${i + 1}`}
                                    value={pinBoxValues[i]}
                                    onChange={(e) => handlePinBoxChange(i, e.target.value)}
                                    onKeyDown={(e) => handlePinBoxKeyDown(i, e)}
                                    style={{
                                        width: '46px', height: '50px', textAlign: 'center', fontSize: '20px', fontWeight: '800',
                                        borderRadius: '12px', border: `1px solid ${pinError ? '#EF4444' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', outline: 'none',
                                    }}
                                />
                            ))}
                        </div>
                        {pinError && <span style={{ fontSize: '11px', color: '#EF4444', textAlign: 'center' }}>{pinError}</span>}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '28px' }}>
                                {pinTouched && (
                                    <button
                                        type="button" onClick={handleSavePin}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                                    >
                                        <Save size={13} /> Save PIN
                                    </button>
                                )}
                                {isSaved && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '700', color: 'var(--success)' }}>
                                        <CheckCircle size={13} /> Saved
                                    </span>
                                )}
                            </div>
                            {/* A real "forgot PIN" flow - there's no server-
                                side recovery possible (appPin only ever
                                stores a one-way hash), so this honestly
                                resets the lock rather than pretending a
                                forgotten PIN can be recovered. */}
                            {isPinConfigured(settings.appPin) && (
                                <button
                                    type="button" onClick={handleForgotPin}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}
                                >
                                    Forgot PIN?
                                </button>
                            )}
                        </div>
                    </div>

                    {(isPinConfigured(settings.appPin) || biometricEnabled) && (
                        <button
                            type="button" onClick={handleLockNow}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                            title="Immediately require your PIN or biometric again"
                        >
                            <Lock size={14} /> Lock App Now
                        </button>
                    )}

                    {(isPinConfigured(settings.appPin) || biometricEnabled) && (
                        <div style={{ borderTop: '1px solid var(--border-premium)', paddingTop: '14px' }}>
                            <div style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>Protected Modules</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '10px' }}>
                                Choose which pages require a PIN or biometric unlock to open{(settings.lockedModules || []).length === 0 ? ' - none selected yet, so nothing is currently locked' : ''}.
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {LOCKABLE_MODULES.map((mod) => {
                                    const isLocked = (settings.lockedModules || []).includes(mod.id);
                                    return (
                                        <button
                                            key={mod.id}
                                            type="button"
                                            onClick={() => toggleLockedModule(mod.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '7px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                                                cursor: 'pointer', fontFamily: 'inherit',
                                                background: isLocked ? 'var(--primary)' : 'var(--widget-bg)',
                                                color: isLocked ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                                                border: `1px solid ${isLocked ? 'var(--primary)' : 'var(--border-premium)'}`,
                                            }}
                                        >
                                            {isLocked ? <Lock size={11} /> : <Unlock size={11} />}
                                            {mod.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {biometricSupported && (
                        <div style={{ borderTop: '1px solid var(--border-premium)', paddingTop: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                                <div style={{ minWidth: 0 }}>
                                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>Biometric Lock</strong>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Require fingerprint or face unlock to open the app</span>
                                </div>
                                <ToggleSwitch checked={biometricEnabled} onChange={handleToggleBiometric} />
                            </div>
                            {biometricStatus === 'registering' && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Follow your device's own prompt to confirm...</span>
                            )}
                            {biometricStatus === 'error' && biometricError && (
                                <span style={{ fontSize: '11px', color: '#EF4444', display: 'block', marginTop: '8px' }}>{biometricError}</span>
                            )}
                        </div>
                    )}
                </SettingCard>
                )}

                {activeCategory === 'api' && (
                <>
                <SettingCard icon={Key} title="Media & Developer API Integrations" subtitle="GitHub, Apple Music, Spotify, and Saavn" defaultOpen>
                    <CollapsibleApiField label="GitHub API Token" pinConfigured={isPinConfigured(settings.appPin)} storedPinHash={settings.appPin} isConnected={settings.githubTokenConfirmed}>
                        <div>
                            <label htmlFor="githubToken" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>GitHub API Token</span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.githubTokenConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px',
                                }}>
                                    {settings.githubTokenConfirmed && <Check size={13} />}
                                    {settings.githubTokenConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="githubToken" name="githubToken" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                    value={settings.githubToken} onChange={(e) => handleChange('githubToken', e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${(githubTokenStatus === 'invalid' || githubTokenStatus === 'error') ? '#EF4444' : githubTokenStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('githubTokenConfirmed')}
                                    disabled={githubTokenStatus !== 'connected' || settings.githubTokenConfirmed}
                                    title={settings.githubTokenConfirmed ? 'Already saved' : githubTokenStatus === 'connected' ? 'Save this token' : 'Token must validate successfully before it can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px',
                                        background: (githubTokenStatus === 'connected' && !settings.githubTokenConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (githubTokenStatus === 'connected' && !settings.githubTokenConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(githubTokenStatus === 'connected' && !settings.githubTokenConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', flexShrink: 0,
                                        cursor: (githubTokenStatus === 'connected' && !settings.githubTokenConfirmed) ? 'pointer' : 'default',
                                        opacity: (githubTokenStatus === 'connected' && !settings.githubTokenConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.githubTokenConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            <span style={{ fontSize: '11px', color: (githubTokenStatus === 'invalid' || githubTokenStatus === 'error') ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {githubTokenStatus === 'checking' && 'Checking…'}
                                {githubTokenStatus === 'connected' && !settings.githubTokenConfirmed && `Verified as @${githubUsername} - click Confirm to save`}
                                {githubTokenStatus === 'connected' && settings.githubTokenConfirmed && `Connected as @${githubUsername}`}
                                {githubTokenStatus === 'invalid' && 'Invalid token'}
                                {githubTokenStatus === 'error' && 'Could not reach GitHub to verify'}
                                {githubTokenStatus === 'idle' && 'Enter a token to verify it'}
                            </span>
                        </div>
                    </CollapsibleApiField>

                    <CollapsibleApiField label="Apple Music API Token" pinConfigured={isPinConfigured(settings.appPin)} storedPinHash={settings.appPin} isConnected={settings.appleMusicTokenConfirmed}>
                        <div>
                            <label htmlFor="appleMusicToken" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>Apple Music API Token</span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.appleMusicTokenConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px',
                                }}>
                                    {settings.appleMusicTokenConfirmed && <Check size={13} />}
                                    {settings.appleMusicTokenConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="appleMusicToken" name="appleMusicToken" type="password" placeholder="Developer JWT token"
                                    value={settings.appleMusicToken} onChange={(e) => handleChange('appleMusicToken', e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${(appleMusicTokenStatus === 'invalid' || appleMusicTokenStatus === 'error') ? '#EF4444' : appleMusicTokenStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('appleMusicTokenConfirmed')}
                                    disabled={appleMusicTokenStatus !== 'connected' || settings.appleMusicTokenConfirmed}
                                    title={settings.appleMusicTokenConfirmed ? 'Already saved' : appleMusicTokenStatus === 'connected' ? 'Save this token' : 'Token must validate successfully before it can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px',
                                        background: (appleMusicTokenStatus === 'connected' && !settings.appleMusicTokenConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (appleMusicTokenStatus === 'connected' && !settings.appleMusicTokenConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(appleMusicTokenStatus === 'connected' && !settings.appleMusicTokenConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', flexShrink: 0,
                                        cursor: (appleMusicTokenStatus === 'connected' && !settings.appleMusicTokenConfirmed) ? 'pointer' : 'default',
                                        opacity: (appleMusicTokenStatus === 'connected' && !settings.appleMusicTokenConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.appleMusicTokenConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            <span style={{ fontSize: '11px', color: (appleMusicTokenStatus === 'invalid' || appleMusicTokenStatus === 'error') ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {appleMusicTokenStatus === 'checking' && 'Checking…'}
                                {appleMusicTokenStatus === 'connected' && !settings.appleMusicTokenConfirmed && 'Token verified - click Confirm to save'}
                                {appleMusicTokenStatus === 'connected' && settings.appleMusicTokenConfirmed && 'Token valid and connected'}
                                {appleMusicTokenStatus === 'invalid' && 'Invalid token'}
                                {appleMusicTokenStatus === 'error' && 'Could not reach Apple Music to verify'}
                                {appleMusicTokenStatus === 'idle' && 'Enter a token to verify it'}
                            </span>
                        </div>
                    </CollapsibleApiField>

                    <CollapsibleApiField label="Spotify Client ID & Secret" pinConfigured={isPinConfigured(settings.appPin)} storedPinHash={settings.appPin} isConnected={settings.spotifyCredConfirmed}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>Spotify Client ID & Secret</span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.spotifyCredConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px',
                                }}>
                                    {settings.spotifyCredConfirmed && <Check size={13} />}
                                    {settings.spotifyCredConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <input
                                    id="spotifyClientId" name="spotifyClientId" type="password" placeholder="Client ID" aria-label="Spotify Client ID"
                                    value={settings.spotifyClientId} onChange={(e) => handleChange('spotifyClientId', e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${(spotifyCredStatus === 'invalid' || spotifyCredStatus === 'error') ? '#EF4444' : spotifyCredStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <input
                                    id="spotifyClientSecret" name="spotifyClientSecret" type="password" placeholder="Client Secret" aria-label="Spotify Client Secret"
                                    value={settings.spotifyClientSecret} onChange={(e) => handleChange('spotifyClientSecret', e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${(spotifyCredStatus === 'invalid' || spotifyCredStatus === 'error') ? '#EF4444' : spotifyCredStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('spotifyCredConfirmed')}
                                    disabled={spotifyCredStatus !== 'connected' || settings.spotifyCredConfirmed}
                                    title={settings.spotifyCredConfirmed ? 'Already saved' : spotifyCredStatus === 'connected' ? 'Save these credentials' : 'Credentials must validate successfully before they can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px 16px', borderRadius: '12px',
                                        background: (spotifyCredStatus === 'connected' && !settings.spotifyCredConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (spotifyCredStatus === 'connected' && !settings.spotifyCredConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(spotifyCredStatus === 'connected' && !settings.spotifyCredConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit',
                                        cursor: (spotifyCredStatus === 'connected' && !settings.spotifyCredConfirmed) ? 'pointer' : 'default',
                                        opacity: (spotifyCredStatus === 'connected' && !settings.spotifyCredConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.spotifyCredConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            <span style={{ fontSize: '11px', color: (spotifyCredStatus === 'invalid' || spotifyCredStatus === 'error') ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {spotifyCredStatus === 'checking' && 'Checking…'}
                                {spotifyCredStatus === 'connected' && !settings.spotifyCredConfirmed && 'Credentials verified - click Confirm to save'}
                                {spotifyCredStatus === 'connected' && settings.spotifyCredConfirmed && 'Credentials valid and connected'}
                                {spotifyCredStatus === 'invalid' && 'Invalid credentials'}
                                {spotifyCredStatus === 'error' && 'Could not reach Spotify to verify'}
                                {spotifyCredStatus === 'idle' && 'Enter both fields to verify'}
                            </span>
                        </div>
                    </CollapsibleApiField>

                    {/* Saavn (unofficial JioSaavn API) - needs no secret key at
                        all (every public mirror of this reverse-engineered API
                        is unauthenticated), so this isn't a LockedApiField/PIN
                        situation. What DOES need checking, the same way every
                        other field above checks its own key, is whether the
                        mirror itself is actually reachable right now - these
                        community-run deployments are frequently taken down and
                        redeployed at a new URL with no notice. Confirmed live
                        while building this: the default mirror below, plus
                        several other commonly-referenced ones (saavn.me,
                        saavn.dev, and this project's own documented reference
                        deployment), do not currently resolve or respond at
                        all - toggling this on will very likely show "Could not
                        connect" until a working mirror is pasted in below. */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', marginTop: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Music size={16} color="var(--text-secondary)" />
                            <div>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Saavn Music Search</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unofficial JioSaavn API - no credentials needed, but the mirror below must actually respond</span>
                            </div>
                        </div>
                        <ToggleSwitch checked={settings.saavnEnabled} onChange={(v) => handleChange('saavnEnabled', v)} />
                    </div>
                    {settings.saavnEnabled && (
                        <div style={{ marginTop: '12px' }}>
                            <label htmlFor="saavnApiBaseUrl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>Saavn API Base URL <span style={{ fontWeight: '500', color: 'var(--text-muted)' }}>(the server address search requests go to - not a secret)</span></span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.saavnApiBaseUrlConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px', flexShrink: 0,
                                }}>
                                    {settings.saavnApiBaseUrlConfirmed && <Check size={13} />}
                                    {settings.saavnApiBaseUrlConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="saavnApiBaseUrl" name="saavnApiBaseUrl" type="text"
                                    placeholder={`${SAAVN_API_BASE_URL_FALLBACK} (default - update if this mirror goes down)`}
                                    value={settings.saavnApiBaseUrl} onChange={(e) => handleChange('saavnApiBaseUrl', e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${saavnBaseUrlStatus === 'error' ? '#EF4444' : saavnBaseUrlStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('saavnApiBaseUrlConfirmed')}
                                    disabled={saavnBaseUrlStatus !== 'connected' || settings.saavnApiBaseUrlConfirmed}
                                    title={settings.saavnApiBaseUrlConfirmed ? 'Already saved' : saavnBaseUrlStatus === 'connected' ? 'Save this base URL' : 'The mirror must respond successfully before this can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px',
                                        background: (saavnBaseUrlStatus === 'connected' && !settings.saavnApiBaseUrlConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (saavnBaseUrlStatus === 'connected' && !settings.saavnApiBaseUrlConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(saavnBaseUrlStatus === 'connected' && !settings.saavnApiBaseUrlConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', flexShrink: 0,
                                        cursor: (saavnBaseUrlStatus === 'connected' && !settings.saavnApiBaseUrlConfirmed) ? 'pointer' : 'default',
                                        opacity: (saavnBaseUrlStatus === 'connected' && !settings.saavnApiBaseUrlConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.saavnApiBaseUrlConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            <span style={{ fontSize: '11px', color: saavnBaseUrlStatus === 'error' ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {saavnBaseUrlStatus === 'checking' && 'Checking - running a real test search against this mirror…'}
                                {saavnBaseUrlStatus === 'connected' && !settings.saavnApiBaseUrlConfirmed && 'Mirror responded successfully - click Confirm to save'}
                                {saavnBaseUrlStatus === 'connected' && settings.saavnApiBaseUrlConfirmed && 'Mirror responded successfully - Saavn search is live'}
                                {saavnBaseUrlStatus === 'error' && 'Could not reach this mirror - it may be down or moved. Leave blank to retry the default, or paste a different working URL (or your own self-hosted instance).'}
                                {saavnBaseUrlStatus === 'idle' && 'Leave blank to use the default mirror shown above.'}
                            </span>
                        </div>
                    )}

                    {/* YouTube playback status - read-only here (the actual key
                        lives in the AI & Learning card below, shared with the
                        Syllabus Hub's own video search) so both music
                        providers this card is about have a visible presence
                        together, without duplicating the real input field
                        and risking the two copies drifting out of sync. */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--widget-bg)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', marginTop: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Video size={16} color="var(--text-secondary)" />
                            <div>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>YouTube Music Search</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uses the YouTube Data API Key below in AI &amp; Learning API Integrations</span>
                            </div>
                        </div>
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            color: settings.youtubeApiKeyConfirmed ? 'var(--success)' : 'var(--text-muted)',
                            fontWeight: '700', fontSize: '12px',
                        }}>
                            {settings.youtubeApiKeyConfirmed && <Check size={13} />}
                            {settings.youtubeApiKeyConfirmed ? 'Connected' : 'Not Connected'}
                        </span>
                    </div>
                </SettingCard>

                <SettingCard icon={Cpu} title="AI & Learning API Integrations" subtitle="Chat providers and the Syllabus Hub's YouTube search">
                    <CollapsibleApiField label="OpenAI (ChatGPT) API Key" pinConfigured={isPinConfigured(settings.appPin)} storedPinHash={settings.appPin} isConnected={settings.openaiApiKeyConfirmed}>
                        <div>
                            <label htmlFor="openaiApiKey" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>OpenAI (ChatGPT) API Key</span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.openaiApiKeyConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px',
                                }}>
                                    {settings.openaiApiKeyConfirmed && <Check size={13} />}
                                    {settings.openaiApiKeyConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="openaiApiKey" name="openaiApiKey" type="password" placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
                                    value={settings.openaiApiKey} onChange={(e) => handleChange('openaiApiKey', e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${settings.openaiApiKeyConfirmed ? 'var(--success)' : (openaiKeyStatus === 'invalid' || openaiKeyStatus === 'error') ? '#EF4444' : openaiKeyStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('openaiApiKeyConfirmed')}
                                    disabled={openaiKeyStatus !== 'connected' || settings.openaiApiKeyConfirmed}
                                    title={settings.openaiApiKeyConfirmed ? 'Already saved' : openaiKeyStatus === 'connected' ? 'Save this key' : 'Key must validate successfully before it can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px',
                                        background: (openaiKeyStatus === 'connected' && !settings.openaiApiKeyConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (openaiKeyStatus === 'connected' && !settings.openaiApiKeyConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(openaiKeyStatus === 'connected' && !settings.openaiApiKeyConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', flexShrink: 0,
                                        cursor: (openaiKeyStatus === 'connected' && !settings.openaiApiKeyConfirmed) ? 'pointer' : 'default',
                                        opacity: (openaiKeyStatus === 'connected' && !settings.openaiApiKeyConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.openaiApiKeyConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            {/* Once a key is genuinely confirmed (settings.openaiApiKeyConfirmed,
                                the real persisted "this is a trusted key" flag),
                                that always wins over the live re-check's own
                                status here - openaiKeyStatus re-runs a real
                                network call to OpenAI on every mount (see the
                                effect above), and confirmed live that this can
                                land on 'invalid'/'error' on a fresh page load
                                for a perfectly good, already-confirmed key
                                (a transient network hiccup, a CORS/referrer
                                restriction on the key itself, a slow response
                                racing the debounce) - which used to show a
                                scary red "Invalid API key" directly under a
                                field whose own badge still said "Connected",
                                a genuinely confusing contradiction. */}
                            <span style={{ fontSize: '11px', color: !settings.openaiApiKeyConfirmed && (openaiKeyStatus === 'invalid' || openaiKeyStatus === 'error') ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {settings.openaiApiKeyConfirmed ? 'Key valid and connected' : (
                                    <>
                                        {openaiKeyStatus === 'checking' && 'Checking…'}
                                        {openaiKeyStatus === 'connected' && 'Key verified - click Confirm to save'}
                                        {openaiKeyStatus === 'invalid' && 'Invalid API key'}
                                        {openaiKeyStatus === 'error' && 'Could not reach OpenAI to verify'}
                                        {openaiKeyStatus === 'idle' && 'Enter a key to verify it'}
                                    </>
                                )}
                            </span>
                        </div>
                    </CollapsibleApiField>

                    <CollapsibleApiField label="Google (Gemini) API Key" pinConfigured={isPinConfigured(settings.appPin)} storedPinHash={settings.appPin} isConnected={settings.geminiApiKeyConfirmed}>
                        <div>
                            <label htmlFor="geminiApiKey" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>Google (Gemini) API Key</span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.geminiApiKeyConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px',
                                }}>
                                    {settings.geminiApiKeyConfirmed && <Check size={13} />}
                                    {settings.geminiApiKeyConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="geminiApiKey" name="geminiApiKey" type="password" placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxx"
                                    value={settings.geminiApiKey} onChange={(e) => handleChange('geminiApiKey', e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${settings.geminiApiKeyConfirmed ? 'var(--success)' : (geminiKeyStatus === 'invalid' || geminiKeyStatus === 'error') ? '#EF4444' : geminiKeyStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('geminiApiKeyConfirmed')}
                                    disabled={geminiKeyStatus !== 'connected' || settings.geminiApiKeyConfirmed}
                                    title={settings.geminiApiKeyConfirmed ? 'Already saved' : geminiKeyStatus === 'connected' ? 'Save this key' : 'Key must validate successfully before it can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px',
                                        background: (geminiKeyStatus === 'connected' && !settings.geminiApiKeyConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (geminiKeyStatus === 'connected' && !settings.geminiApiKeyConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(geminiKeyStatus === 'connected' && !settings.geminiApiKeyConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', flexShrink: 0,
                                        cursor: (geminiKeyStatus === 'connected' && !settings.geminiApiKeyConfirmed) ? 'pointer' : 'default',
                                        opacity: (geminiKeyStatus === 'connected' && !settings.geminiApiKeyConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.geminiApiKeyConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            {/* Same "an already-confirmed key always wins over
                                the live re-check" reasoning as OpenAI above. */}
                            <span style={{ fontSize: '11px', color: !settings.geminiApiKeyConfirmed && (geminiKeyStatus === 'invalid' || geminiKeyStatus === 'error') ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {settings.geminiApiKeyConfirmed ? 'Key valid and connected' : (
                                    <>
                                        {geminiKeyStatus === 'checking' && 'Checking…'}
                                        {geminiKeyStatus === 'connected' && 'Key verified - click Confirm to save'}
                                        {geminiKeyStatus === 'invalid' && 'Invalid API key'}
                                        {geminiKeyStatus === 'error' && 'Could not reach Gemini to verify'}
                                        {geminiKeyStatus === 'idle' && 'Enter a key to verify it'}
                                    </>
                                )}
                            </span>
                        </div>
                    </CollapsibleApiField>

                    {/* Optional - the Syllabus Hub's YouTube resource search
                        works with zero configuration (a real "Search on
                        YouTube" link for every topic), this key only
                        upgrades that to real embeddable video cards with
                        genuine thumbnails/titles from Google's own API. */}
                    <CollapsibleApiField label="YouTube Data API Key" pinConfigured={isPinConfigured(settings.appPin)} storedPinHash={settings.appPin} isConnected={settings.youtubeApiKeyConfirmed}>
                        <div>
                            <label htmlFor="youtubeApiKey" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>YouTube Data API Key <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>(optional)</span></span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.youtubeApiKeyConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px',
                                }}>
                                    {settings.youtubeApiKeyConfirmed && <Check size={13} />}
                                    {settings.youtubeApiKeyConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="youtubeApiKey" name="youtubeApiKey" type="password" placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxx"
                                    value={settings.youtubeApiKey} onChange={(e) => handleChange('youtubeApiKey', e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${settings.youtubeApiKeyConfirmed ? 'var(--success)' : (youtubeKeyStatus === 'invalid' || youtubeKeyStatus === 'error') ? '#EF4444' : youtubeKeyStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('youtubeApiKeyConfirmed')}
                                    disabled={youtubeKeyStatus !== 'connected' || settings.youtubeApiKeyConfirmed}
                                    title={settings.youtubeApiKeyConfirmed ? 'Already saved' : youtubeKeyStatus === 'connected' ? 'Save this key' : 'Key must validate successfully before it can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px',
                                        background: (youtubeKeyStatus === 'connected' && !settings.youtubeApiKeyConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (youtubeKeyStatus === 'connected' && !settings.youtubeApiKeyConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(youtubeKeyStatus === 'connected' && !settings.youtubeApiKeyConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', flexShrink: 0,
                                        cursor: (youtubeKeyStatus === 'connected' && !settings.youtubeApiKeyConfirmed) ? 'pointer' : 'default',
                                        opacity: (youtubeKeyStatus === 'connected' && !settings.youtubeApiKeyConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.youtubeApiKeyConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            {/* Same "an already-confirmed key always wins over
                                the live re-check" reasoning as OpenAI/Gemini
                                above. */}
                            <span style={{ fontSize: '11px', color: !settings.youtubeApiKeyConfirmed && (youtubeKeyStatus === 'invalid' || youtubeKeyStatus === 'error') ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {settings.youtubeApiKeyConfirmed ? 'Key valid and connected' : (
                                    <>
                                        {youtubeKeyStatus === 'checking' && 'Checking…'}
                                        {youtubeKeyStatus === 'connected' && 'Key verified - click Confirm to save'}
                                        {youtubeKeyStatus === 'invalid' && 'Invalid key, or YouTube Data API v3 isn\'t enabled for it'}
                                        {youtubeKeyStatus === 'error' && 'Could not reach YouTube to verify'}
                                        {youtubeKeyStatus === 'idle' && 'Optional - powers real video cards in the Syllabus Hub, and YouTube search/playback in Audio Hub. Without it, a working YouTube search link is used instead.'}
                                    </>
                                )}
                            </span>
                        </div>
                    </CollapsibleApiField>

                    {/* Same priority/treatment as OpenAI/Gemini above, per
                        explicit request - Grok (xAI) is an OpenAI-compatible
                        REST API, so this reuses the identical verification
                        and confirm-flow pattern, just pointed at api.x.ai. */}
                    <CollapsibleApiField label="Grok (xAI) API Key" pinConfigured={isPinConfigured(settings.appPin)} storedPinHash={settings.appPin} isConnected={settings.grokApiKeyConfirmed}>
                        <div>
                            <label htmlFor="grokApiKey" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>Grok (xAI) API Key <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>(optional)</span></span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.grokApiKeyConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px',
                                }}>
                                    {settings.grokApiKeyConfirmed && <Check size={13} />}
                                    {settings.grokApiKeyConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="grokApiKey" name="grokApiKey" type="password" placeholder="xai-xxxxxxxxxxxxxxxxxxxx"
                                    value={settings.grokApiKey} onChange={(e) => handleChange('grokApiKey', e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${settings.grokApiKeyConfirmed ? 'var(--success)' : (grokKeyStatus === 'invalid' || grokKeyStatus === 'error') ? '#EF4444' : grokKeyStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('grokApiKeyConfirmed')}
                                    disabled={grokKeyStatus !== 'connected' || settings.grokApiKeyConfirmed}
                                    title={settings.grokApiKeyConfirmed ? 'Already saved' : grokKeyStatus === 'connected' ? 'Save this key' : 'Key must validate successfully before it can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px',
                                        background: (grokKeyStatus === 'connected' && !settings.grokApiKeyConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (grokKeyStatus === 'connected' && !settings.grokApiKeyConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(grokKeyStatus === 'connected' && !settings.grokApiKeyConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', flexShrink: 0,
                                        cursor: (grokKeyStatus === 'connected' && !settings.grokApiKeyConfirmed) ? 'pointer' : 'default',
                                        opacity: (grokKeyStatus === 'connected' && !settings.grokApiKeyConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.grokApiKeyConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            <span style={{ fontSize: '11px', color: !settings.grokApiKeyConfirmed && (grokKeyStatus === 'invalid' || grokKeyStatus === 'error') ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {settings.grokApiKeyConfirmed ? 'Key valid and connected' : (
                                    <>
                                        {grokKeyStatus === 'checking' && 'Checking…'}
                                        {grokKeyStatus === 'connected' && 'Key verified - click Confirm to save'}
                                        {grokKeyStatus === 'invalid' && 'Invalid key'}
                                        {grokKeyStatus === 'error' && 'Could not reach xAI to verify'}
                                        {grokKeyStatus === 'idle' && 'Optional - lets the AI Hub use Grok as a chat provider.'}
                                    </>
                                )}
                            </span>
                        </div>
                    </CollapsibleApiField>

                    {/* DeepSeek - also OpenAI-compatible, same pattern again. */}
                    <CollapsibleApiField label="DeepSeek API Key" pinConfigured={isPinConfigured(settings.appPin)} storedPinHash={settings.appPin} isConnected={settings.deepseekApiKeyConfirmed}>
                        <div>
                            <label htmlFor="deepseekApiKey" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <span>DeepSeek API Key <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>(optional)</span></span>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '5px',
                                    color: settings.deepseekApiKeyConfirmed ? 'var(--success)' : 'var(--text-muted)',
                                    fontWeight: '700', fontSize: '12px',
                                }}>
                                    {settings.deepseekApiKeyConfirmed && <Check size={13} />}
                                    {settings.deepseekApiKeyConfirmed ? 'Connected' : 'Not Connected'}
                                </span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    id="deepseekApiKey" name="deepseekApiKey" type="password" placeholder="sk-xxxxxxxxxxxxxxxxxxxx"
                                    value={settings.deepseekApiKey} onChange={(e) => handleChange('deepseekApiKey', e.target.value)}
                                    style={{
                                        flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: '12px',
                                        border: `1px solid ${settings.deepseekApiKeyConfirmed ? 'var(--success)' : (deepseekKeyStatus === 'invalid' || deepseekKeyStatus === 'error') ? '#EF4444' : deepseekKeyStatus === 'connected' ? 'var(--success)' : 'var(--border-premium)'}`,
                                        background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => confirmApiField('deepseekApiKeyConfirmed')}
                                    disabled={deepseekKeyStatus !== 'connected' || settings.deepseekApiKeyConfirmed}
                                    title={settings.deepseekApiKeyConfirmed ? 'Already saved' : deepseekKeyStatus === 'connected' ? 'Save this key' : 'Key must validate successfully before it can be confirmed'}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px',
                                        background: (deepseekKeyStatus === 'connected' && !settings.deepseekApiKeyConfirmed) ? 'var(--primary)' : 'var(--widget-bg)',
                                        color: (deepseekKeyStatus === 'connected' && !settings.deepseekApiKeyConfirmed) ? 'var(--text-on-primary)' : 'var(--text-muted)',
                                        border: `1px solid ${(deepseekKeyStatus === 'connected' && !settings.deepseekApiKeyConfirmed) ? 'var(--primary)' : 'var(--border-premium)'}`,
                                        fontWeight: '700', fontSize: '13px', fontFamily: 'inherit', flexShrink: 0,
                                        cursor: (deepseekKeyStatus === 'connected' && !settings.deepseekApiKeyConfirmed) ? 'pointer' : 'default',
                                        opacity: (deepseekKeyStatus === 'connected' && !settings.deepseekApiKeyConfirmed) ? 1 : 0.6,
                                    }}
                                >
                                    <Check size={14} /> {settings.deepseekApiKeyConfirmed ? 'Confirmed' : 'Confirm'}
                                </button>
                            </div>
                            <span style={{ fontSize: '11px', color: !settings.deepseekApiKeyConfirmed && (deepseekKeyStatus === 'invalid' || deepseekKeyStatus === 'error') ? '#EF4444' : 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                                {settings.deepseekApiKeyConfirmed ? 'Key valid and connected' : (
                                    <>
                                        {deepseekKeyStatus === 'checking' && 'Checking…'}
                                        {deepseekKeyStatus === 'connected' && 'Key verified - click Confirm to save'}
                                        {deepseekKeyStatus === 'invalid' && 'Invalid key'}
                                        {deepseekKeyStatus === 'error' && 'Could not reach DeepSeek to verify'}
                                        {deepseekKeyStatus === 'idle' && 'Optional - lets the AI Hub use DeepSeek as a chat provider.'}
                                    </>
                                )}
                            </span>
                        </div>
                    </CollapsibleApiField>
                </SettingCard>
                </>
                )}

                {activeCategory === 'appearance' && (
                <SettingCard icon={Monitor} title="Display & Environment" subtitle="Theme, startup, and visual adjustments" tourId="settings-display" defaultOpen>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '10px' : '0' }}>
                        <div><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>System Theme</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Choose your visual environment</span></div>
                        <select id="themeMode" name="themeMode" aria-label="System Theme" value={settings.themeMode} onChange={(e) => handleChange('themeMode', e.target.value)} style={{ width: isMobile ? '100%' : 'auto', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer', fontWeight: '600', boxSizing: isMobile ? 'border-box' : 'content-box' }}>
                            <option value="night" style={{ background: 'var(--surface-inset)' }}>🌙 Dark Mode</option>
                            <option value="comfort" style={{ background: 'var(--surface-inset)' }}>👁️ Eye Comfort</option>
                            <option value="day" style={{ background: 'var(--surface-inset)' }}>☀️ Light Mode</option>
                            <option value="dynamic" style={{ background: 'var(--surface-inset)' }}>🌦️ Dynamic</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '10px' : '0' }}>
                        <div><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Startup Launchpad</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Default screen on boot</span></div>
                        <select id="landingPage" name="landingPage" aria-label="Startup Launchpad" value={settings.landingPage} onChange={(e) => handleChange('landingPage', e.target.value)} style={{ width: isMobile ? '100%' : 'auto', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer', fontWeight: '600', boxSizing: isMobile ? 'border-box' : 'content-box' }}>
                            <option value="Home Dashboard" style={{ background: 'var(--surface-inset)' }}>Home Dashboard</option><option value="Planner" style={{ background: 'var(--surface-inset)' }}>Planner Matrix</option><option value="Study Hub" style={{ background: 'var(--surface-inset)' }}>Study Hub</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '10px' : '0' }}>
                        <div><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Time Format</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Clock display setting</span></div>
                        <select id="timeFormat" name="timeFormat" aria-label="Time Format" value={settings.timeFormat} onChange={(e) => handleChange('timeFormat', e.target.value)} style={{ width: isMobile ? '100%' : 'auto', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer', fontWeight: '600', boxSizing: isMobile ? 'border-box' : 'content-box' }}>
                            <option value="12 Hour (AM/PM)" style={{ background: 'var(--surface-inset)' }}>12 Hour (AM/PM)</option><option value="24 Hour" style={{ background: 'var(--surface-inset)' }}>24 Hour</option>
                        </select>
                    </div>

                    {/* Moved back from Glassmorphism, per explicit request -
                        that section is now scoped to genuinely
                        glass-specific controls only (Blur, Opacity,
                        Wallpaper); Brightness/Accent/Animations are
                        general visual-environment adjustments that
                        belong here instead. */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px 16px',
                    }}>
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Brightness Adjustment</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Overall brightness of the wallpaper and glass panels</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            <SmoothRangeSlider id="os-brightness-slider" ariaLabel="Brightness adjustment" value={settings.osBrightness} min={50} max={150} step={1} onChange={(v) => handleChange('osBrightness', v)} />
                            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '800', fontFamily: 'monospace', width: '46px', textAlign: 'center', background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: '7px', padding: '4px 0' }}>{settings.osBrightness}%</span>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: accentExpanded ? '12px' : 0,
                        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px 16px',
                    }}>
                        <button
                            type="button"
                            onClick={() => setAccentExpanded((v) => !v)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: '100%', fontFamily: 'inherit', textAlign: 'left',
                            }}
                        >
                            <div style={{ minWidth: 0 }}><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Accent / Tint</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Glass border & glow color - {GLASS_ACCENT_TINTS.length - 1} vibrant options</span></div>
                            <ChevronDown size={16} color="var(--text-secondary)" style={{ transform: accentExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                        </button>
                        {accentExpanded && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(30px, 1fr))', gap: '10px' }}>
                            {GLASS_ACCENT_TINTS.map((tint) => (
                                <button
                                    key={tint.id} type="button" title={tint.label}
                                    onClick={() => handleChange('glassAccentTint', tint.id)}
                                    style={{
                                        width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', padding: 0,
                                        background: tint.swatch, justifySelf: 'center',
                                        boxShadow: settings.glassAccentTint === tint.id
                                            ? 'inset 0 0 0 2px rgba(255,255,255,0.6), 0 0 0 2px var(--bg-surface), 0 0 0 4px var(--text-primary), 0 2px 10px rgba(0,0,0,0.35)'
                                            : 'inset 0 0 0 1px rgba(255,255,255,0.25), 0 1px 4px rgba(0,0,0,0.25)',
                                        border: 'none',
                                        transition: 'box-shadow 0.18s ease, transform 0.18s ease',
                                        transform: settings.glassAccentTint === tint.id ? 'scale(1.1)' : 'scale(1)',
                                    }}
                                />
                            ))}
                        </div>
                        )}
                    </div>

                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
                        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px 16px',
                    }}>
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Animations & Motion</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>UI transitions and render performance</span></div>
                        <ToggleSwitch checked={settings.glassAnimationsEnabled} onChange={(v) => handleChange('glassAnimationsEnabled', v)} />
                    </div>

                    {/* Merged in from its own separate "Performance /
                        Battery Saver Mode" card, per explicit request -
                        one Appearance card, one open/close, not two
                        separate cards to expand every time.
                        Relabeled per real, direct feedback: this toggle
                        already does genuine, real battery-saving work
                        (see style.css's own html.nexus-battery-saver
                        rules - it forces --glass-blur down to 4px
                        everywhere, including the wallpaper layer, and
                        freezes every CSS animation/transition across the
                        whole app to near-zero, both of which are real,
                        meaningful reductions in per-frame GPU compositing
                        work) - the old "Reduce Blur & Motion" name just
                        never told the user THAT was the actual point, so
                        nobody watching their battery drain would have any
                        reason to think this toggle was the fix for it. */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
                        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px 16px',
                    }}>
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Battery Saver Mode</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cuts blur and freezes animations everywhere to reduce battery drain - real power savings, not just a visual setting</span></div>
                        <ToggleSwitch checked={settings.performanceSaverMode} onChange={(v) => handleChange('performanceSaverMode', v)} />
                    </div>
                </SettingCard>
                )}

                {/* Glassmorphism - scoped to genuinely glass-specific
                    rendering controls only, per explicit request: Blur
                    Intensity, Transparency/Opacity, and the Wallpaper
                    picker (custom backgrounds render THROUGH these same
                    glass panels). System Theme, Brightness, Accent/Tint,
                    and Animations & Motion all moved back to Appearance -
                    general visual-environment adjustments, not
                    specifically "glass" ones. */}
                {activeCategory === 'glassmorphism' && (
                <>
                <SettingCard icon={Sparkles} title="Glassmorphism & Visual Customization" subtitle="Live-tunes the glass rendering across the OS" defaultOpen>
                    <div style={{
                        background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px',
                        padding: '24px', display: 'flex', flexDirection: 'column', gap: '4px',
                        boxShadow: '0 0 0 1px rgba(var(--primary-rgb), 0.06), 0 0 32px rgba(var(--primary-rgb), 0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
                    position: 'relative', overflow: 'hidden',
                }}>
                    {/* Faint top sheen - a single, quiet gradient line rather
                        than a busy decorative border, keeping the "one
                        signature element" (the glow) as the actual focal
                        point. No separate icon/title header here anymore -
                        this box's own SettingCard already carries that,
                        so a second copy directly below it would just be a
                        duplicate. */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(var(--primary-rgb), 0.5), transparent)' }} />

                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px 16px', marginTop: '6px',
                    }}>
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Blur Intensity</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Backdrop blur radius on glass panels</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            <SmoothRangeSlider id="glass-blur-slider" ariaLabel="Blur intensity" value={settings.glassBlur} min={0} max={40} step={1} onChange={(v) => handleChange('glassBlur', v)} />
                            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '800', fontFamily: 'monospace', width: '46px', textAlign: 'center', background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: '7px', padding: '4px 0' }}>{settings.glassBlur}px</span>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px 16px', marginTop: '10px', marginBottom: '2px',
                    }}>
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Transparency / Opacity</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fill opacity of glass panels</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                            <SmoothRangeSlider id="glass-opacity-slider" ariaLabel="Transparency / opacity" value={settings.glassOpacity} min={1} max={15} step={1} onChange={(v) => handleChange('glassOpacity', v)} />
                            <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '800', fontFamily: 'monospace', width: '46px', textAlign: 'center', background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.2)', borderRadius: '7px', padding: '4px 0' }}>{settings.glassOpacity}%</span>
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: wallpaperExpanded ? '18px' : 0 }}>
                    <button
                        type="button"
                        onClick={() => setWallpaperExpanded((v) => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                            borderBottom: wallpaperExpanded ? '1px solid var(--border-premium)' : 'none', paddingBottom: wallpaperExpanded ? '12px' : 0,
                            fontFamily: 'inherit',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px 10px', flexWrap: 'wrap' }}>
                            <Image size={20} color="var(--accent)" style={{ flexShrink: 0 }} />
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Custom Background / Wallpaper</h3>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                                {WALLPAPER_OPTIONS.find((wp) => wp.id === settings.wallpaper)?.label || 'Animated Sky'}
                            </span>
                        </div>
                        <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: wallpaperExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                    </button>

                    {wallpaperExpanded && (
                        <>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-8px' }}>
                                {WALLPAPER_OPTIONS.length} themes - applies instantly across the whole OS, no reload needed.
                            </span>

                            {/* Category filter chips - a flat 150+-item grid is unusable even
                                inside a scroll box, so this narrows it down first. Horizontally
                                scrollable (not wrapped) so it stays a single compact row on
                                mobile instead of eating vertical space the scroll box below needs. */}
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px', marginTop: '-4px' }}>
                                {WALLPAPER_CATEGORIES.map((cat) => {
                                    const active = wallpaperCategoryFilter === cat;
                                    return (
                                        <button
                                            key={cat} type="button"
                                            onClick={() => setWallpaperCategoryFilter(cat)}
                                            style={{
                                                flexShrink: 0, padding: isMobile ? '5px 10px' : '6px 12px',
                                                borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                                                fontSize: isMobile ? '11px' : '12px', fontWeight: '700', whiteSpace: 'nowrap',
                                                background: active ? 'var(--primary)' : 'var(--widget-bg)',
                                                color: active ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                                                border: active ? '1px solid var(--primary)' : '1px solid var(--border-premium)',
                                                transition: 'background 0.15s ease, color 0.15s ease',
                                            }}
                                        >
                                            {cat}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Dedicated scrollable viewport - fixed max-height so this box
                                never forces the whole Settings page to stretch to fit 150+
                                cards. Slim inner right padding keeps the (already globally
                                thin, 6px) scrollbar from overlapping the last column's cards. */}
                            <div style={{ maxHeight: isMobile ? '360px' : '420px', overflowY: 'auto', paddingRight: '4px' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(120px, 1fr))',
                                    gap: isMobile ? '8px' : '12px',
                                }}>
                                    {WALLPAPER_OPTIONS.filter((wp) => wallpaperCategoryFilter === 'All' || wp.category === wallpaperCategoryFilter).map((wp) => {
                                        const active = settings.wallpaper === wp.id;
                                        return (
                                            <button
                                                key={wp.id} type="button"
                                                onClick={() => handleChange('wallpaper', wp.id)}
                                                title={wp.label}
                                                style={{
                                                    display: 'flex', flexDirection: 'column', gap: isMobile ? '5px' : '8px',
                                                    padding: isMobile ? '6px' : '10px', minWidth: 0,
                                                    background: 'var(--widget-bg)', borderRadius: isMobile ? '11px' : '14px', cursor: 'pointer', textAlign: 'left',
                                                    border: active ? '2px solid var(--primary)' : '2px solid var(--border-premium)',
                                                    boxShadow: active ? '0 0 0 3px rgba(var(--primary-rgb), 0.15)' : 'none',
                                                    transition: 'border 0.15s ease, box-shadow 0.15s ease',
                                                }}
                                            >
                                                <div style={{ width: '100%', height: isMobile ? '38px' : '52px', borderRadius: '9px', background: wp.preview, position: 'relative', overflow: 'hidden' }}>
                                                    {active && (
                                                        <div style={{ position: 'absolute', top: '6px', right: '6px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Check size={12} color="var(--text-on-primary)" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </div>
                                                <span style={{
                                                    fontSize: isMobile ? '10px' : '12px', fontWeight: '700', color: 'var(--text-primary)',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {wp.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* A genuinely separate section, not another entry inside the
                    theme-library grid above - per explicit request, this
                    lives alongside Custom Background / Wallpaper rather than
                    merged into it. */}
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: customImageExpanded ? '16px' : 0, marginTop: '18px' }}>
                    <button
                        type="button"
                        onClick={() => setCustomImageExpanded((v) => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                            borderBottom: customImageExpanded ? '1px solid var(--border-premium)' : 'none', paddingBottom: customImageExpanded ? '12px' : 0,
                            fontFamily: 'inherit',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px 10px', flexWrap: 'wrap' }}>
                            <ImagePlus size={20} color="var(--accent)" style={{ flexShrink: 0 }} />
                            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Your Own Wallpaper</h3>
                            {settings.wallpaper === 'custom-image' && (
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>Active</span>
                            )}
                        </div>
                        <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: customImageExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                    </button>

                    {customImageExpanded && (
                        <>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-4px' }}>
                                Upload a photo from your device and use it as the wallpaper - PNG, JPG, or WEBP.
                            </span>

                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{
                                    width: '96px', height: '96px', borderRadius: '14px', flexShrink: 0,
                                    // backgroundImage (longhand), not the background shorthand -
                                    // this div also sets backgroundSize/backgroundPosition below,
                                    // and mixing the shorthand with a longhand sub-property in the
                                    // same style object is a real React warning (the shorthand
                                    // silently resets the longhand as part of applying itself).
                                    backgroundColor: 'var(--widget-bg)',
                                    backgroundImage: customWallpaperImage ? `url(${customWallpaperImage})` : 'none',
                                    backgroundSize: 'cover', backgroundPosition: 'center',
                                    border: '1px solid var(--border-premium)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {!customWallpaperImage && <ImagePlus size={26} color="var(--text-muted)" />}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 200px' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            onClick={() => customImageInputRef.current?.click()}
                                            disabled={customImageProcessing}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '9px 16px', borderRadius: '10px', cursor: customImageProcessing ? 'default' : 'pointer',
                                                background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none',
                                                fontFamily: 'inherit', fontSize: '13px', fontWeight: '700',
                                                opacity: customImageProcessing ? 0.6 : 1,
                                            }}
                                        >
                                            <Upload size={15} /> {customImageProcessing ? 'Processing...' : customWallpaperImage ? 'Replace Photo' : 'Upload Photo'}
                                        </button>

                                        {customWallpaperImage && settings.wallpaper !== 'custom-image' && (
                                            <button
                                                type="button"
                                                onClick={handleUseCustomImage}
                                                style={{
                                                    padding: '9px 16px', borderRadius: '10px', cursor: 'pointer',
                                                    background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)',
                                                    fontFamily: 'inherit', fontSize: '13px', fontWeight: '700',
                                                }}
                                            >
                                                Use as Wallpaper
                                            </button>
                                        )}

                                        {customWallpaperImage && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveCustomImage}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '9px 16px', borderRadius: '10px', cursor: 'pointer',
                                                    background: 'transparent', color: 'var(--danger)', border: '1px solid var(--border-premium)',
                                                    fontFamily: 'inherit', fontSize: '13px', fontWeight: '700',
                                                }}
                                            >
                                                <Trash2 size={14} /> Remove
                                            </button>
                                        )}
                                    </div>

                                    <input
                                        ref={customImageInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
                                        style={{ display: 'none' }}
                                        onChange={(e) => { handleCustomImageFile(e.target.files?.[0]); e.target.value = ''; }}
                                    />

                                    {customImageError ? (
                                        <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '600' }}>{customImageError}</span>
                                    ) : (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            Resized and compressed automatically before saving.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                </SettingCard>
                </>
                )}

                {activeCategory === 'typography' && (
                <SettingCard icon={Type} title="Typography & Styling" subtitle={`App-wide font, chosen from a ${FONT_OPTIONS.length}-font curated library`} defaultOpen>
                    {/* Live preview - genuinely rendered in the currently
                        selected font (real --font-primary, not a mockup),
                        so the effect of a choice is visible immediately. */}
                    <div style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Preview - {getFontOption(settings.fontFamily).label}</span>
                        <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }}>Nexus Life OS</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-primary)' }}>The quick brown fox jumps over the lazy dog - 0123456789</span>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: fontExpanded ? '16px' : 0, marginTop: '14px' }}>
                        <button
                            type="button"
                            onClick={() => setFontExpanded((v) => !v)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                                borderBottom: fontExpanded ? '1px solid var(--border-premium)' : 'none', paddingBottom: fontExpanded ? '12px' : 0,
                                fontFamily: 'inherit',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px 10px', flexWrap: 'wrap' }}>
                                <Type size={20} color="var(--accent)" style={{ flexShrink: 0 }} />
                                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Browse Font Library</h3>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                                    {getFontOption(settings.fontFamily).label}
                                </span>
                            </div>
                            <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: fontExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                        </button>

                        {fontExpanded && (
                            <>
                                <div style={{ position: 'relative' }}>
                                    <Search size={15} style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <label htmlFor="font-search-input" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Search fonts</label>
                                    <input
                                        id="font-search-input" name="fontSearch" type="text" placeholder={`Search ${FONT_OPTIONS.length} fonts...`}
                                        value={fontSearchQuery} onChange={(e) => setFontSearchQuery(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div style={{ maxHeight: '440px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', paddingRight: '4px' }}>
                                    {filteredFontsByCategory.length === 0 && (
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No fonts match "{fontSearchQuery}".</span>
                                    )}
                                    {filteredFontsByCategory.map((group) => (
                                        <div key={group.category} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{group.category}</span>
                                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                                                {group.fonts.map((font) => {
                                                    const active = settings.fontFamily === font.id;
                                                    return (
                                                        <button
                                                            key={font.id} type="button"
                                                            onClick={() => handleChange('fontFamily', font.id)}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                                                padding: '12px 14px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                                                                background: 'var(--widget-bg)',
                                                                border: active ? '2px solid var(--primary)' : '1px solid var(--border-premium)',
                                                                boxShadow: active ? '0 0 0 3px rgba(var(--primary-rgb), 0.15)' : 'none',
                                                                transition: 'border 0.15s ease, box-shadow 0.15s ease',
                                                            }}
                                                        >
                                                            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', fontFamily: font.stack, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{font.label}</span>
                                                            {active && (
                                                                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                    <Check size={12} color="var(--text-on-primary)" strokeWidth={3} />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Real, working custom font upload - a genuine
                        FontFace loaded from the user's own file, not a
                        preview. Its own separate collapsible box, mirroring
                        Browse Font Library's own layout, rather than being
                        squeezed into that grid as a fake extra "font". */}
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: customFontExpanded ? '16px' : 0, marginTop: '14px' }}>
                        <button
                            type="button"
                            onClick={() => setCustomFontExpanded((v) => !v)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, width: '100%',
                                borderBottom: customFontExpanded ? '1px solid var(--border-premium)' : 'none', paddingBottom: customFontExpanded ? '12px' : 0,
                                fontFamily: 'inherit',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px 10px', flexWrap: 'wrap' }}>
                                <FileType size={20} color="var(--accent)" style={{ flexShrink: 0 }} />
                                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Upload Your Own Font</h3>
                                {(settings.customFonts || []).length > 0 && (
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
                                        {settings.customFonts.length} uploaded
                                    </span>
                                )}
                            </div>
                            <ChevronDown size={18} color="var(--text-secondary)" style={{ transform: customFontExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
                        </button>

                        {customFontExpanded && (
                            <>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-4px' }}>
                                    Bring your own .ttf, .otf, .woff, or .woff2 file (from Google Fonts or anywhere else) - applies instantly, everywhere, just like the curated library above.
                                </span>

                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => customFontInputRef.current?.click()}
                                        disabled={customFontProcessing}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '9px 16px', borderRadius: '10px', cursor: customFontProcessing ? 'default' : 'pointer',
                                            background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none',
                                            fontFamily: 'inherit', fontSize: '13px', fontWeight: '700',
                                            opacity: customFontProcessing ? 0.6 : 1,
                                        }}
                                    >
                                        <Upload size={15} /> {customFontProcessing ? 'Loading...' : 'Upload Font File'}
                                    </button>
                                    <input
                                        ref={customFontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2"
                                        style={{ display: 'none' }}
                                        onChange={(e) => { handleCustomFontFile(e.target.files?.[0]); e.target.value = ''; }}
                                    />
                                </div>

                                {customFontError && <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '600' }}>{customFontError}</span>}

                                {(settings.customFonts || []).length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {settings.customFonts.map((font) => {
                                            const active = settings.fontFamily === font.id;
                                            return (
                                                <div
                                                    key={font.id}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                                        padding: '12px 14px', borderRadius: '12px',
                                                        background: 'var(--widget-bg)',
                                                        border: active ? '2px solid var(--primary)' : '1px solid var(--border-premium)',
                                                        boxShadow: active ? '0 0 0 3px rgba(var(--primary-rgb), 0.15)' : 'none',
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleChange('fontFamily', font.id)}
                                                        style={{
                                                            flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', gap: '10px', padding: 0, fontFamily: 'inherit',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', fontFamily: `'${font.familyName}', var(--font-primary)`, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {font.label}
                                                        </span>
                                                        {active && (
                                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                <Check size={12} color="var(--text-on-primary)" strokeWidth={3} />
                                                            </div>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCustomFont(font.id)}
                                                        title="Remove this font"
                                                        aria-label={`Remove ${font.label}`}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', flexShrink: 0, display: 'flex' }}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </SettingCard>
                )}

                {activeCategory === 'audio' && (
                <>
                <SettingCard icon={Music} title="Master Audio Mixer & Channels" subtitle="UI sounds, task alerts, and playback volume" defaultOpen>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Live volume and mute per channel - drag applies instantly. Tap the note icon to manage custom sounds.</span>
                    <SoundChannelCard channelKey="uiFeedback" icon={<Sliders size={14} color="var(--accent)" />} onManage={() => setManageSoundsChannel('uiFeedback')} />
                    <SoundChannelCard channelKey="taskAlerts" icon={<Bell size={14} color="var(--accent)" />} onManage={() => setManageSoundsChannel('taskAlerts')} />

                    {/* Master Volume - the real, shared Music/Audio player
                        volume (not a UI-sound channel), separated visually
                        from the rows above since it drives a genuinely
                        different thing: whatever track is actually playing
                        in the Audio Hub, in real time, both ways. */}
                    <div style={{ borderTop: '1px solid var(--border-premium)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <Play size={14} color="var(--accent)" />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Master Volume</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· Music &amp; Audio player</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-main)', padding: '10px 16px', borderRadius: '14px', border: '1px solid var(--border-premium)' }}>
                            <button
                                type="button" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
                            >
                                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>
                            <SmoothRangeSlider
                                id="master-volume-slider" ariaLabel="Master volume"
                                value={volume} min="0" max="1" step="0.05" width="100%"
                                onChange={(v) => setVolume(v)}
                            />
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '32px', textAlign: 'right', fontWeight: '700', flexShrink: 0 }}>
                                {isMuted ? '--' : `${Math.round(volume * 100)}%`}
                            </span>
                        </div>
                    </div>

                    {/* Off by default - see AudioPlayerContext.jsx's own
                        comment on why: this was previously invisible,
                        always-on behavior that read as "audio glitches /
                        two tracks playing at once" with zero explanation.
                        Still a real, working feature for anyone who wants
                        it - just opt-in and clearly labeled now. */}
                    <div style={{ borderTop: '1px solid var(--border-premium)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <div style={{ minWidth: 0 }}>
                            <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>Crossfade Between Tracks</strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Smoothly blend into the next track over 4 seconds instead of a clean cut</span>
                        </div>
                        <ToggleSwitch checked={crossfadeEnabled} onChange={() => setCrossfadeEnabled((v) => !v)} />
                    </div>
                </SettingCard>

                {/* The real master ON/OFF for the whole AI Daily Briefing
                    feature, plus voice/language/rate/auto-play - all real
                    controls, shared with (and always in sync with) the
                    equivalent panel inside the AI page's own sidebar
                    (see AISidebar.jsx) via VoiceAssistantSettings.jsx, so
                    this section and that one can never drift apart. */}
                <SettingCard icon={Mic} title="Voice Assistant" subtitle="AI Daily Briefing's on/off switch, voice, and language">
                    <VoiceAssistantSettings />
                </SettingCard>
                </>
                )}

                {activeCategory === 'backup' && (
                <SettingCard icon={Cloud} title="Automation & Backup" subtitle="Cloud backup schedule, local export, and factory reset" defaultOpen>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div><strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block' }}>Auto-Backup Frequency</strong><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automatically back up to the cloud this often while the app is open</span></div>
                        <select id="autoBackupFreq" name="autoBackupFreq" aria-label="Auto-Backup Frequency" value={settings.autoBackupFreq} onChange={(e) => handleChange('autoBackupFreq', e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer', fontWeight: '600', boxSizing: 'border-box' }}>
                            <option value="Daily" style={{ background: 'var(--surface-inset)' }}>Daily</option><option value="Weekly" style={{ background: 'var(--surface-inset)' }}>Weekly</option><option value="Monthly" style={{ background: 'var(--surface-inset)' }}>Monthly</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {!isConfigured || !user
                                ? 'Sign in above to enable cloud backup.'
                                : isSyncing
                                    ? 'Backing up…'
                                    : lastSyncedAt
                                        ? `Last backed up ${lastSyncedAt.toLocaleString()}.`
                                        : 'Not backed up yet.'}
                        </span>
                        {/* A failed Backup Now / Restore Data used to be
                            completely silent here - the button just reverted
                            to its idle label with zero indication anything
                            went wrong, so "I restored but my data never
                            came back" was genuinely undiagnosable (a
                            Firestore write can fail for real reasons this
                            app doesn't otherwise guard against, e.g. the
                            combined backup - avatar image included -
                            exceeding Firestore's 1MB per-document limit).
                            Surfacing the real syncError here, matching the
                            exact error-text convention already used
                            elsewhere on this page, is what makes a genuine
                            failure visible instead of indistinguishable
                            from "nothing changed because everything was
                            already up to date". */}
                        {syncStatus === 'error' && syncError && (
                            <span style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>
                                {activeSyncDirection === 'pull' ? 'Restore failed: ' : 'Backup failed: '}{syncError}
                            </span>
                        )}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => { setActiveSyncDirection('push'); pushToCloud(); }}
                                disabled={!isConfigured || !user || isSyncing}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 12px',
                                    background: 'var(--surface-inset)', color: 'var(--text-primary)',
                                    border: '1px solid var(--border-premium)', borderRadius: '12px',
                                    fontWeight: '700', fontSize: '13px', fontFamily: 'inherit',
                                    cursor: (!isConfigured || !user || isSyncing) ? 'default' : 'pointer',
                                    opacity: (!isConfigured || !user || isSyncing) ? 0.6 : 1,
                                    minWidth: 0,
                                }}
                            >
                                <RefreshCw size={15} /> {activeSyncDirection === 'push' && isSyncing ? 'Backing Up…' : 'Backup Now'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettingsConfirm({
                                    title: 'Restore from Cloud',
                                    message: 'This will overwrite your local data with your most recent cloud backup. Any changes made only on this device since your last backup will be lost. Continue?',
                                    onConfirm: () => {
                                        setSettingsConfirm(null);
                                        setActiveSyncDirection('pull');
                                        pullFromCloud();
                                    },
                                })}
                                disabled={!isConfigured || !user || isSyncing}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 12px',
                                    background: 'var(--surface-inset)', color: 'var(--text-primary)',
                                    border: '1px solid var(--border-premium)', borderRadius: '12px',
                                    fontWeight: '700', fontSize: '13px', fontFamily: 'inherit',
                                    cursor: (!isConfigured || !user || isSyncing) ? 'default' : 'pointer',
                                    opacity: (!isConfigured || !user || isSyncing) ? 0.6 : 1,
                                    minWidth: 0,
                                }}
                            >
                                <Download size={15} /> {activeSyncDirection === 'pull' && isSyncing ? 'Restoring…' : 'Restore Data'}
                            </button>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-premium)', paddingBottom: '12px' }}><HardDrive size={20} color="var(--accent)" /><h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>Storage & Data Management</h3></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Local Cache Usage</strong>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700' }}>{cacheSize} KB</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'var(--surface-inset)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-premium)' }}>
                                {/* Genuinely proportional now - was previously a fixed 15% width
                                    regardless of the real byte count above it. 5120 KB (5MB) is the
                                    conservative, commonly-enforced localStorage quota most browsers
                                    apply per origin, so this reads as "how full is my actual quota"
                                    rather than an arbitrary scale. */}
                                <div style={{ width: `${Math.min(100, (parseFloat(cacheSize) / 5120) * 100)}%`, height: '100%', background: 'var(--accent)' }}></div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button onClick={() => requestHighRiskAction('export')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--surface-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}><Download size={16} /> Export Backup</button>
                            <label htmlFor="importData" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--surface-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}><Upload size={16} /> Import Data<input id="importData" name="importData" type="file" accept=".json" onChange={handleImportData} style={{ display: 'none' }} /></label>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                        <button onClick={() => handleClearSpecific('nexus_planner', 'Planner Tasks')} style={{ padding: '8px 14px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Clear Planner Data</button>
                        <button onClick={() => handleClearSpecific('nexus_finance', 'Finance')} style={{ padding: '8px 14px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Clear Finance Data</button>
                        <button onClick={() => handleClearSpecific('nexus_gym', 'Gym')} style={{ padding: '8px 14px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Clear Gym Data</button>
                        <button onClick={() => handleClearSpecific(['nexus_study', 'nexus_syllabus'], 'Study')} style={{ padding: '8px 14px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Clear Study Data</button>
                        <button onClick={() => handleClearSpecific('nexus_timetable', 'Daily Timetable')} style={{ padding: '8px 14px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Clear Timetable Data</button>
                        <button onClick={() => handleClearSpecific('nexus_calendar', 'Calendar')} style={{ padding: '8px 14px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Clear Calendar Data</button>
                        {/* Analytics has no localStorage of its own (confirmed
                            by grepping the entire codebase) - it's a pure,
                            derived view over exactly these 5 other modules'
                            own data. Honestly names all 5 in the confirmation
                            dialog's own module name, rather than a misleadingly
                            narrow "Analytics" label that would hide the real
                            scope of what this button actually wipes. */}
                        <button onClick={() => handleClearSpecific(['nexus_planner', 'nexus_study', 'nexus_syllabus', 'nexus_gym', 'nexus_finance', 'nexus_calendar'], 'Analytics (Planner, Study, Gym, Finance & Calendar source data)')} style={{ padding: '8px 14px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Clear Analytics Data</button>
                    </div>

                    <div style={{ marginTop: '10px', padding: '20px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div><strong style={{ fontSize: '15px', color: '#EF4444', display: 'block', marginBottom: '4px' }}>Factory Reset OS</strong><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Wipes all configurations, profiles, and module data permanently.</span></div>
                        <button type="button" onClick={() => requestHighRiskAction('factoryReset')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}><Trash2 size={16} /> Factory Reset Data</button>
                    </div>
                    </div>
                </SettingCard>
                )}
            </SettingsLayout>

            {manageSoundsChannel && (
                <ManageSoundsModal
                    channelKey={manageSoundsChannel}
                    icon={{
                        uiFeedback: <Sliders size={18} color="var(--accent)" />,
                        taskAlerts: <Bell size={18} color="var(--accent)" />,
                    }[manageSoundsChannel]}
                    onClose={() => setManageSoundsChannel(null)}
                />
            )}
            {pendingAction && (
                <PinVerifyModal
                    fieldLabel={{ export: 'Export Backup', import: 'Import Data', factoryReset: 'Factory Reset' }[pendingAction]}
                    storedPinHash={settings.appPin}
                    onVerified={runPendingAction}
                    onClose={() => { setPendingAction(null); setPendingImportData(null); }}
                />
            )}
            {passphraseModal && (
                <BackupPassphraseModal
                    mode={passphraseModal.mode}
                    onSubmit={passphraseModal.mode === 'export' ? performEncryptedExport : performDecryptedImport}
                    onClose={() => setPassphraseModal(null)}
                />
            )}
            {settingsConfirm && (
                <SettingsConfirmModal
                    title={settingsConfirm.title}
                    message={settingsConfirm.message}
                    onConfirm={settingsConfirm.onConfirm}
                    onCancel={() => setSettingsConfirm(null)}
                    forceGlass={settingsConfirm.forceGlass}
                />
            )}
            {settingsToast && (
                <div style={{
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 230000,
                    background: 'var(--bg-surface)', border: `1px solid ${settingsToast.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-premium)'}`, borderRadius: '14px',
                    padding: '12px 20px', boxShadow: 'var(--premium-shadow)', color: 'var(--text-primary)',
                    fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    {settingsToast.type === 'error' ? <AlertTriangle size={15} color="#EF4444" /> : <CheckCircle size={15} color="var(--success)" />}
                    {settingsToast.message}
                </div>
            )}
        </div>
    );
};

export default SettingsPage;