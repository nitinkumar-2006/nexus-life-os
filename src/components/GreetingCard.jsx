// src/components/GreetingCard.jsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Clock, Calendar, Hand, Sun, Moon, CloudSun, CloudMoon, CloudLightning, CloudSunRain, CloudMoonRain, Play, Pause, SkipForward, SkipBack, Music, ListMusic,
    ThumbsUp, Handshake, Smile, SmilePlus, Laugh, Heart, Sparkles, Sparkle, Star, Sunrise, Sunset, Cloud, CloudRain, CloudSnow, Rainbow, Wind, Snowflake,
    Umbrella, Waves, Mountain, TreePine, Flower, Flower2, Leaf, Clover, Bird, Cat, Dog, Fish, Rabbit, Squirrel, Turtle, Coffee, Cake, Candy, Cherry, Apple,
    Pizza, Sandwich, IceCreamCone, Camera, BookOpen, Palette, Headphones, PartyPopper, Gift, Trophy, Award, Crown, Gem, Rocket, Flame,
    Wand2, Compass, MapPin, Target, Anchor, Feather, Drama, Sailboat, Medal, Puzzle, Gauge, Diamond, Flag, Ribbon, Badge, BadgeCheck,
    HeartHandshake, HandHeart, HandMetal, Guitar, Piano, Drum, Radio, Tv, Gamepad2, Dice5, Key, Lightbulb, BatteryCharging, Wifi, Bluetooth,
    Globe, Map, Earth, Telescope, Binoculars, Glasses, Watch, Bookmark, Tag, Ticket, Wallet, Banknote, Coins, PiggyBank, ShoppingBag, Package,
    Mail, Send, MessageCircle, PhoneCall, Megaphone, Bell, BellRing, AlarmClock, Hourglass, Timer, CalendarCheck, CheckCircle, BadgePlus,
    Plane, Car, Bike, Bus, Train, Ship, Sprout, Wheat, Carrot, Egg, Croissant, Cookie, Donut, Soup, Salad, Milk, Baby, PawPrint, Bone,
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useCloudSync } from '../context/CloudSyncContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { WALLPAPER_OPTIONS } from '../constants/wallpaperOptions.js';
import { CheckCircle as CheckCircleIcon, Cloud as CloudIcon, Palette as PaletteIcon, Bot as BotIcon, ArrowUpRight } from 'lucide-react';

// A real, big, curated set of icons reasonable to greet someone with -
// the SAME lucide-react icon set already used everywhere else in this
// app (the header, the sidebar, the clock next to this very card), not
// colorful Unicode emoji. Per explicit feedback: Unicode emoji render
// inconsistently across systems (some genuinely showed up as blurry/
// split glyphs) and read as visually inconsistent with the rest of
// this app's own icon language - a real, valid consistency complaint,
// not just a style preference. Deliberately large (130+) per an
// explicit follow-up request that the original 56 wasn't enough
// variety - organized loosely by theme (hands/expressions, celestial/
// weather, nature/animals, food, music/hobbies, achievements/objects,
// travel, communication) rather than alphabetically, so browsing the
// grid still feels intentional instead of a random dump.
const GREETING_ICON_OPTIONS = [
    { id: 'Hand', Icon: Hand }, { id: 'ThumbsUp', Icon: ThumbsUp }, { id: 'Handshake', Icon: Handshake },
    { id: 'HeartHandshake', Icon: HeartHandshake }, { id: 'HandHeart', Icon: HandHeart }, { id: 'HandMetal', Icon: HandMetal },
    { id: 'Smile', Icon: Smile }, { id: 'SmilePlus', Icon: SmilePlus }, { id: 'Laugh', Icon: Laugh }, { id: 'Heart', Icon: Heart },
    { id: 'Sparkles', Icon: Sparkles }, { id: 'Sparkle', Icon: Sparkle }, { id: 'Star', Icon: Star },
    { id: 'Sun', Icon: Sun }, { id: 'Sunrise', Icon: Sunrise }, { id: 'Sunset', Icon: Sunset }, { id: 'Moon', Icon: Moon },
    { id: 'Cloud', Icon: Cloud }, { id: 'CloudRain', Icon: CloudRain }, { id: 'CloudSnow', Icon: CloudSnow },
    { id: 'Rainbow', Icon: Rainbow }, { id: 'Wind', Icon: Wind }, { id: 'Snowflake', Icon: Snowflake }, { id: 'Umbrella', Icon: Umbrella },
    { id: 'Waves', Icon: Waves }, { id: 'Mountain', Icon: Mountain }, { id: 'TreePine', Icon: TreePine }, { id: 'Globe', Icon: Globe },
    { id: 'Earth', Icon: Earth }, { id: 'Map', Icon: Map }, { id: 'Compass', Icon: Compass }, { id: 'MapPin', Icon: MapPin },
    { id: 'Flower', Icon: Flower }, { id: 'Flower2', Icon: Flower2 }, { id: 'Leaf', Icon: Leaf }, { id: 'Clover', Icon: Clover },
    { id: 'Sprout', Icon: Sprout }, { id: 'Wheat', Icon: Wheat }, { id: 'Carrot', Icon: Carrot },
    { id: 'Bird', Icon: Bird }, { id: 'Cat', Icon: Cat }, { id: 'Dog', Icon: Dog }, { id: 'Fish', Icon: Fish },
    { id: 'Rabbit', Icon: Rabbit }, { id: 'Squirrel', Icon: Squirrel }, { id: 'Turtle', Icon: Turtle }, { id: 'PawPrint', Icon: PawPrint },
    { id: 'Bone', Icon: Bone }, { id: 'Baby', Icon: Baby },
    { id: 'Coffee', Icon: Coffee }, { id: 'Cake', Icon: Cake }, { id: 'Candy', Icon: Candy }, { id: 'Cherry', Icon: Cherry },
    { id: 'Apple', Icon: Apple }, { id: 'Pizza', Icon: Pizza }, { id: 'Sandwich', Icon: Sandwich }, { id: 'IceCreamCone', Icon: IceCreamCone },
    { id: 'Egg', Icon: Egg }, { id: 'Croissant', Icon: Croissant }, { id: 'Cookie', Icon: Cookie }, { id: 'Donut', Icon: Donut },
    { id: 'Soup', Icon: Soup }, { id: 'Salad', Icon: Salad }, { id: 'Milk', Icon: Milk },
    { id: 'Music', Icon: Music }, { id: 'Guitar', Icon: Guitar }, { id: 'Piano', Icon: Piano }, { id: 'Drum', Icon: Drum },
    { id: 'Radio', Icon: Radio }, { id: 'Headphones', Icon: Headphones }, { id: 'Camera', Icon: Camera }, { id: 'Tv', Icon: Tv },
    { id: 'Gamepad2', Icon: Gamepad2 }, { id: 'Dice5', Icon: Dice5 }, { id: 'Palette', Icon: Palette }, { id: 'BookOpen', Icon: BookOpen },
    { id: 'Glasses', Icon: Glasses }, { id: 'Watch', Icon: Watch }, { id: 'Telescope', Icon: Telescope }, { id: 'Binoculars', Icon: Binoculars },
    { id: 'PartyPopper', Icon: PartyPopper }, { id: 'Gift', Icon: Gift }, { id: 'Trophy', Icon: Trophy }, { id: 'Award', Icon: Award },
    { id: 'Crown', Icon: Crown }, { id: 'Gem', Icon: Gem }, { id: 'Diamond', Icon: Diamond }, { id: 'Medal', Icon: Medal },
    { id: 'Badge', Icon: Badge }, { id: 'BadgeCheck', Icon: BadgeCheck }, { id: 'BadgePlus', Icon: BadgePlus }, { id: 'Ribbon', Icon: Ribbon },
    { id: 'Flag', Icon: Flag }, { id: 'CheckCircle', Icon: CheckCircle }, { id: 'Puzzle', Icon: Puzzle }, { id: 'Wand2', Icon: Wand2 },
    { id: 'Rocket', Icon: Rocket }, { id: 'Flame', Icon: Flame }, { id: 'Lightbulb', Icon: Lightbulb }, { id: 'Key', Icon: Key },
    { id: 'Gauge', Icon: Gauge }, { id: 'Anchor', Icon: Anchor }, { id: 'Feather', Icon: Feather }, { id: 'Drama', Icon: Drama },
    { id: 'Plane', Icon: Plane }, { id: 'Car', Icon: Car }, { id: 'Bike', Icon: Bike }, { id: 'Bus', Icon: Bus },
    { id: 'Train', Icon: Train }, { id: 'Ship', Icon: Ship }, { id: 'Sailboat', Icon: Sailboat },
    { id: 'Mail', Icon: Mail }, { id: 'Send', Icon: Send }, { id: 'MessageCircle', Icon: MessageCircle }, { id: 'PhoneCall', Icon: PhoneCall },
    { id: 'Megaphone', Icon: Megaphone }, { id: 'Bell', Icon: Bell }, { id: 'BellRing', Icon: BellRing }, { id: 'AlarmClock', Icon: AlarmClock },
    { id: 'Hourglass', Icon: Hourglass }, { id: 'Timer', Icon: Timer }, { id: 'CalendarCheck', Icon: CalendarCheck },
    { id: 'Wifi', Icon: Wifi }, { id: 'Bluetooth', Icon: Bluetooth }, { id: 'BatteryCharging', Icon: BatteryCharging },
    { id: 'Bookmark', Icon: Bookmark }, { id: 'Tag', Icon: Tag }, { id: 'Ticket', Icon: Ticket }, { id: 'Wallet', Icon: Wallet },
    { id: 'Banknote', Icon: Banknote }, { id: 'Coins', Icon: Coins }, { id: 'PiggyBank', Icon: PiggyBank },
    { id: 'ShoppingBag', Icon: ShoppingBag }, { id: 'Package', Icon: Package },
];
const GREETING_ICON_KEY = 'nexus_greeting_icon';
// A second, independent icon preference for the "Personal OS Active"
// badge specifically - deliberately its own key/state, not the same one
// the greeting-name icon already uses. Those two icons serve genuinely
// different purposes (a personal/fun touch next to your name vs. a
// system-status glyph on the diagnostics badge) - a user picking a food
// emoji for one shouldn't be forced to also see it on the other.
const STATUS_ICON_KEY = 'nexus_status_icon';

// Shared by both the greeting-name icon picker and the status-badge icon
// picker below - the exact same 130+-icon grid/portal/positioning, just
// pointed at a different selected-id/onSelect pair. Extracted once a real
// second caller existed, rather than duplicating this ~50-line block.
const IconPickerPopover = ({ position, isMobile, selectedId, onSelect, onClose, title }) => createPortal(
    <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999 }} />
        <div style={{
            position: 'fixed', top: position.top, left: position.left, zIndex: 10000,
            width: isMobile ? '260px' : '320px', maxWidth: '80vw',
            background: 'rgba(15, 15, 26, 0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-premium)', borderRadius: '16px',
            padding: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {title}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                {GREETING_ICON_OPTIONS.map(({ id, Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        title={id}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '8px', borderRadius: '10px', cursor: 'pointer',
                            background: id === selectedId ? 'var(--primary-muted)' : 'transparent',
                            border: id === selectedId ? '1px solid var(--primary)' : '1px solid transparent',
                            lineHeight: 1,
                        }}
                    >
                        <Icon size={18} color={id === selectedId ? 'var(--accent)' : 'var(--text-secondary)'} />
                    </button>
                ))}
            </div>
        </div>
    </>,
    document.body,
);

// Real alternative phrasings for each time-of-day bucket, per explicit
// request - the SAME meaning/warmth as "Good Afternoon", just a
// different name for it (professional, motivational, more casual, ...),
// the same way many real apps let you pick a phrasing style rather than
// only ever showing one fixed string for a given hour. The first entry
// in each bucket is always the original default, so an unset preference
// renders byte-for-byte identical to before this feature existed.
const GREETING_PHRASE_OPTIONS = {
    morning: ['Good Morning', 'Rise and Shine', 'Morning', 'Top of the Morning', 'Hello, Early Bird', 'Bright Morning Ahead', 'Fresh Start'],
    afternoon: ['Good Afternoon', 'Good Day', 'Afternoon', 'Hope Your Day Is Going Well', 'Making Progress Today', 'Halfway There', 'Keep It Going'],
    evening: ['Good Evening', 'Evening', 'Winding Down', 'Hope You Had a Great Day', 'Evening, Champion', 'Time to Unwind'],
    night: ['Good Night', 'Late Night Hustle', 'Burning the Midnight Oil', 'Still Going Strong', 'Night Owl Mode', 'Rest Well Soon'],
};
const GREETING_PHRASE_KEY = 'nexus_greeting_phrases';

const getGreetingBucket = (hour = new Date().getHours()) => {
    if (hour >= 4 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
};

const readGreetingPhrasePrefs = () => {
    try { return JSON.parse(localStorage.getItem(GREETING_PHRASE_KEY) || '{}'); } catch (e) { return {}; }
};

const GreetingCard = ({ setActiveTab }) => {
    const isMobile = useIsMobile();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [greetingIconId, setGreetingIconId] = useState(() => localStorage.getItem(GREETING_ICON_KEY) || 'Hand');
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    // Real, measured screen position for the portaled picker below - not
    // needed until the picker is actually opened, computed fresh from
    // the trigger button's own live position each time.
    const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
    const iconButtonRef = useRef(null);
    const GreetingIcon = (GREETING_ICON_OPTIONS.find((opt) => opt.id === greetingIconId) || GREETING_ICON_OPTIONS[0]).Icon;

    const handleSelectGreetingIcon = (iconId) => {
        setGreetingIconId(iconId);
        localStorage.setItem(GREETING_ICON_KEY, iconId);
        setIsEmojiPickerOpen(false);
    };

    // The "Personal OS Active" badge's own icon - independent preference
    // (see STATUS_ICON_KEY's own comment above), opened from a control
    // inside the diagnostics popover rather than a second click target
    // crammed into the tiny badge itself (a real 14px icon sitting inside
    // an already-clickable button isn't a safe place for its own separate
    // click zone - browsers don't support nesting an interactive
    // <button> inside another one).
    const [statusIconId, setStatusIconId] = useState(() => localStorage.getItem(STATUS_ICON_KEY) || 'Hand');
    const [isStatusIconPickerOpen, setIsStatusIconPickerOpen] = useState(false);
    const [statusIconPickerPosition, setStatusIconPickerPosition] = useState({ top: 0, left: 0 });
    const statusIconButtonRef = useRef(null);
    const StatusIcon = (GREETING_ICON_OPTIONS.find((opt) => opt.id === statusIconId) || GREETING_ICON_OPTIONS[0]).Icon;

    const openStatusIconPicker = () => {
        const rect = statusIconButtonRef.current?.getBoundingClientRect();
        if (rect) setStatusIconPickerPosition({ top: rect.bottom + 8, left: rect.left });
        setIsStatusIconPickerOpen((v) => !v);
    };

    const handleSelectStatusIcon = (iconId) => {
        setStatusIconId(iconId);
        localStorage.setItem(STATUS_ICON_KEY, iconId);
        setIsStatusIconPickerOpen(false);
    };

    // Same real portal-picker pattern as the icon picker above - a
    // separate open flag/position/ref set since the two pickers are
    // independent controls that can each be triggered from their own
    // spot in the header line.
    const [greetingPhrasePrefs, setGreetingPhrasePrefs] = useState(readGreetingPhrasePrefs);
    const [isPhrasePickerOpen, setIsPhrasePickerOpen] = useState(false);
    const [phrasePickerPosition, setPhrasePickerPosition] = useState({ top: 0, left: 0 });
    const phraseButtonRef = useRef(null);

    const openPhrasePicker = () => {
        const rect = phraseButtonRef.current?.getBoundingClientRect();
        if (rect) setPhrasePickerPosition({ top: rect.bottom + 10, left: rect.left });
        setIsPhrasePickerOpen((v) => !v);
    };

    const handleSelectGreetingPhrase = (bucket, phrase) => {
        const next = { ...greetingPhrasePrefs, [bucket]: phrase };
        setGreetingPhrasePrefs(next);
        localStorage.setItem(GREETING_PHRASE_KEY, JSON.stringify(next));
        setIsPhrasePickerOpen(false);
    };

    // Rendered via a portal straight onto document.body (see below) -
    // not just a higher z-index - because a real, reported bug showed
    // this popover painting BEHIND a later, unrelated sibling section
    // further down the Home page (Master Schedule Flow & Active
    // Timeline). z-index only wins within its own stacking context;
    // nesting this deep inside GreetingCard's own tree meant a
    // completely separate sibling section elsewhere on the page could
    // still end up stacked above it regardless of how high this
    // z-index was set. Portaling to document.body sidesteps that
    // entirely - this is the standard, reliable fix for exactly this
    // class of bug, not a workaround.
    const openIconPicker = () => {
        const rect = iconButtonRef.current?.getBoundingClientRect();
        if (rect) setPickerPosition({ top: rect.bottom + 10, left: rect.left });
        setIsEmojiPickerOpen((v) => !v);
    };

    // Time Format: reads the real, saved preference and stays live via the
    // same settings-updated event convention every other cross-component
    // setting in this app already uses - previously this setting was
    // saved by Settings but the clock below always hardcoded hour12:true,
    // completely ignoring it.
    const [is12Hour, setIs12Hour] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
            return saved.timeFormat !== '24 Hour';
        } catch (e) {
            return true;
        }
    });
    useEffect(() => {
        const syncTimeFormat = () => {
            try {
                const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
                setIs12Hour(saved.timeFormat !== '24 Hour');
            } catch (e) { /* keep current value on malformed data */ }
        };
        window.addEventListener('nexus_settings_updated', syncTimeFormat);
        return () => window.removeEventListener('nexus_settings_updated', syncTimeFormat);
    }, []);

    const [userProfile, setUserProfile] = useState(() => {
        try { 
            const saved = localStorage.getItem('nexus_user_profile');
            return saved ? JSON.parse(saved) : { name: 'New User', avatarUrl: '' }; 
        } catch (e) { 
            return { name: 'New User', avatarUrl: '' }; 
        }
    });

    // This mini-player reads/controls the same global audio engine used by
    // the Audio Hub page and the Header dropdown - there is only ever one
    // <audio> element and one playback state for the whole app.
    const { currentTrack, isPlaying, togglePlay, next, prev, playbackError, hasEverPlayed } = useAudioPlayer();

    // Real, live temperature for the device's actual location (not a fixed
    // hardcoded city) - shared with DynamicBackground's sky/rain/cloud
    // visuals via the same context, so they can never disagree.
    const { temperature, weatherState } = useWeather();
    // WeatherContext always fetches/stores Celsius (Open-Meteo's own
    // default unit) - this is the one and only place it's converted to
    // Fahrenheit for display, per Settings' own Temperature Unit
    // preference, which previously had no reader anywhere in the app.
    const { settings: globalSettings } = useGlobalSettings();
    const useFahrenheit = globalSettings.temperatureUnit === '°F';

    // "Personal OS Active" used to be a plain, static badge with nothing
    // behind it - real, already-available system status (not invented
    // data) is what turns it into something worth clicking: the real
    // signed-in cloud sync state (CloudSyncContext, the same context the
    // Settings page's own Cloud Sync card reads), the real active theme/
    // wallpaper the user actually picked, and the real AI provider
    // preference (see AIPage.jsx's own 'local'-vs-provider logic).
    // useAuth (real, signed-in state) and useCloudSync (real, last-synced
    // timestamp) are two separate contexts - AuthProvider always wraps
    // the whole app so this is safe even in local-only mode (its own
    // createContext default reports isConfigured:false there), while
    // CloudSyncProvider only ever mounts once actually signed in
    // (CloudSyncContext's own createContext default covers every other
    // case safely too).
    const { user: cloudUser, isConfigured: cloudConfigured } = useAuth();
    const { lastSyncedAt } = useCloudSync();
    const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
    const [statusPopoverPosition, setStatusPopoverPosition] = useState({ top: 0, left: 0 });
    const statusButtonRef = useRef(null);
    const openStatusPopover = () => {
        const rect = statusButtonRef.current?.getBoundingClientRect();
        if (rect) setStatusPopoverPosition({ top: rect.bottom + 10, left: rect.left });
        setIsStatusPopoverOpen((v) => !v);
    };
    // The real active theme id lives under its own dedicated
    // 'nexus_theme' key (not inside the nexus_global_settings blob) -
    // the same source SettingsPage.jsx/header.jsx/DashboardLayout.jsx
    // themselves already read from, so this can never disagree with
    // what's actually rendering.
    const activeThemeLabel = { dynamic: 'Dynamic', night: 'Night', day: 'Day', light: 'Light', midnight: 'Midnight' }[
        (() => { try { return localStorage.getItem('nexus_theme') || 'night'; } catch (e) { return 'night'; } })()
    ] || 'Dynamic';
    const activeWallpaperId = (() => { try { return JSON.parse(localStorage.getItem('nexus_global_settings') || '{}').wallpaper || 'sky'; } catch (e) { return 'sky'; } })();
    const activeWallpaperLabel = WALLPAPER_OPTIONS.find((wp) => wp.id === activeWallpaperId)?.label || 'Animated Sky';
    const activeAiProvider = (() => {
        try {
            const pref = localStorage.getItem('nexus_ai_provider') || 'local';
            return { local: 'Local (no live AI)', gemini: 'Gemini', openai: 'ChatGPT', grok: 'Grok', deepseek: 'DeepSeek' }[pref] || 'Local (no live AI)';
        } catch (e) { return 'Local (no live AI)'; }
    })();
    const displayTemperature = temperature !== null
        ? Math.round(useFahrenheit ? (temperature * 9) / 5 + 32 : temperature)
        : null;

    // Real weatherState (from WeatherContext's own live WMO weather code,
    // cross-checked against real current precipitation so a technically-
    // "Cloudy" code can't hide genuine rain - shared with DynamicBackground's
    // sky) picks the actual condition icon; both 'clear' AND rain/drizzle
    // additionally split on real local time (same dawn/dusk boundary
    // DashboardLayout's own sky-phase clock uses), so a rainy night shows a
    // moon-with-rain glyph instead of the same plain rain cloud used at noon.
    const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
    const isNightNow = currentHour < 6.5 || currentHour >= 19.5;
    const WeatherIcon = weatherState === 'rain' ? (isNightNow ? CloudMoonRain : CloudSunRain)
        : weatherState === 'drizzle' ? (isNightNow ? CloudMoonRain : CloudSunRain)
        : weatherState === 'thunderstorm' ? CloudLightning
        // Real, confirmed gap this closes: 'cloudy' used to fall through to
        // the same flat Cloud glyph for both day and night - the one state
        // that never got the day/night treatment every other branch above
        // already has.
        : weatherState === 'cloudy' ? (isNightNow ? CloudMoon : CloudSun)
        : isNightNow ? Moon : Sun;

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleStorageUpdate = () => {
            const saved = localStorage.getItem('nexus_user_profile');
            if (saved) {
                try { setUserProfile(JSON.parse(saved)); } catch (e) { setUserProfile({ name: 'New User', avatarUrl: '' }); }
            } else {
                setUserProfile({ name: 'New User', avatarUrl: '' });
            }
        };
        window.addEventListener('nexus_profile_updated', handleStorageUpdate);
        window.addEventListener('nexus_settings_updated', handleStorageUpdate);
        window.addEventListener('storage', handleStorageUpdate);
        return () => {
            window.removeEventListener('nexus_profile_updated', handleStorageUpdate);
            window.removeEventListener('nexus_settings_updated', handleStorageUpdate);
            window.removeEventListener('storage', handleStorageUpdate);
        };
    }, []);

    const greetingBucket = getGreetingBucket(currentTime.getHours());
    const getGreeting = () => greetingPhrasePrefs[greetingBucket] || GREETING_PHRASE_OPTIONS[greetingBucket][0];

    // Desktop keeps the full "Wednesday, September 2, 2026" - real width
    // to spare there. Mobile gets the abbreviated "Wed, Sep 2, 2026" -
    // a real, reported bug was that the full-length version alone (before
    // the weather chip next to it even entered the picture) was often
    // already wide enough to force the weather onto its own second line
    // on a normal phone width, despite visibly empty space remaining
    // next to it - abbreviating the two longest parts (weekday, month)
    // is what actually buys back enough room for both to share one line.
    const formatDate = (date, abbreviated = false) => {
        if (!date || Number.isNaN(new Date(date).getTime())) return '';
        return new Date(date).toLocaleDateString('en-US', {
            weekday: abbreviated ? 'short' : 'long',
            month: abbreviated ? 'short' : 'long',
            day: 'numeric', year: 'numeric',
        });
    };

    const profileFullName = userProfile.name || 'New User';
    const firstName = profileFullName.trim().split(' ')[0] || 'User';

    return (
        <div style={{ 
            background: 'var(--bg-surface)', 
            border: '1px solid var(--border-premium)',
            borderRadius: '24px',
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', 
            alignItems: isMobile ? 'stretch' : 'center', 
            flexWrap: isMobile ? 'wrap' : 'nowrap', 
            gap: isMobile ? '18px' : '16px',
            padding: isMobile ? '20px' : '32px 40px', 
            boxShadow: 'var(--premium-shadow)',
            transition: 'background 0.3s ease, border 0.3s ease',
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* Left Section: Greeting with First Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Used to be a plain, inert status badge - now a real
                        one-tap system-status summary using data this app
                        already has (signed-in state, active theme/
                        wallpaper, which AI provider will actually answer),
                        not invented content. */}
                    <button
                        ref={statusButtonRef}
                        type="button"
                        onClick={openStatusPopover}
                        style={{
                            // Explicit request: this read as noticeably oversized
                            // next to everything else in the card on mobile -
                            // shrunk a step further than before (was 11px/3px
                            // 10px, still visibly the largest small-text element
                            // on the page).
                            fontSize: isMobile ? '10px' : '13px', background: 'var(--primary-muted)', color: 'var(--accent)',
                            padding: isMobile ? '3px 8px' : '4px 12px', borderRadius: '20px', fontWeight: '600',
                            display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px', border: 'none', cursor: 'pointer', font: 'inherit',
                        }}
                    >
                        <StatusIcon size={isMobile ? 11 : 14} /> Personal OS Active
                    </button>
                    {isStatusPopoverOpen && createPortal(
                        <>
                            <div onClick={() => setIsStatusPopoverOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999 }} />
                            <div style={{
                                position: 'fixed', top: statusPopoverPosition.top, left: statusPopoverPosition.left, zIndex: 10000,
                                width: isMobile ? '260px' : '290px', maxWidth: '85vw',
                                background: 'rgba(15, 15, 26, 0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid var(--border-premium)', borderRadius: '16px',
                                padding: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                                display: 'flex', flexDirection: 'column', gap: '10px',
                            }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    System Status
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <CloudIcon size={15} color={cloudConfigured && cloudUser ? '#10B981' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                            {cloudConfigured && cloudUser ? 'Synced' : 'Local Only'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {cloudConfigured && cloudUser
                                                ? (lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : cloudUser.email)
                                                : 'Data stays on this device'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <PaletteIcon size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{activeThemeLabel} Theme</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeWallpaperLabel}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <BotIcon size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>AI Mode</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{activeAiProvider}</div>
                                    </div>
                                </div>
                                {/* Icon customization lives here, inside the
                                    popover, rather than as a second click
                                    target on the tiny badge itself - a real
                                    <button> can't safely nest a second one
                                    inside it. */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-premium)' }}>
                                    <StatusIcon size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Status Icon</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customize this badge's icon</div>
                                    </div>
                                    <button
                                        ref={statusIconButtonRef}
                                        type="button"
                                        onClick={openStatusIconPicker}
                                        title="Change status icon"
                                        style={{
                                            background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '8px',
                                            padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700',
                                            cursor: 'pointer', font: 'inherit', flexShrink: 0,
                                        }}
                                    >
                                        Change
                                    </button>
                                </div>
                                {isStatusIconPickerOpen && (
                                    <IconPickerPopover
                                        position={statusIconPickerPosition}
                                        isMobile={isMobile}
                                        selectedId={statusIconId}
                                        onSelect={handleSelectStatusIcon}
                                        onClose={() => setIsStatusIconPickerOpen(false)}
                                        title="Choose your status icon"
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setIsStatusPopoverOpen(false); if (typeof setActiveTab === 'function') setActiveTab('Settings'); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        marginTop: '2px', padding: '9px', borderRadius: '10px', cursor: 'pointer',
                                        background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-primary)',
                                        font: 'inherit', fontSize: '13px', fontWeight: '700',
                                    }}
                                >
                                    Open Settings <ArrowUpRight size={14} />
                                </button>
                            </div>
                        </>,
                        document.body,
                    )}
                </div>
                <h1 style={{ fontSize: isMobile ? '22px' : '30px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Only the time-of-day phrase itself is clickable -
                        the first name right after it is real, fixed
                        profile data, not something a "pick a different
                        phrasing" control should ever touch. No underline
                        at all now, on hover or otherwise - a real,
                        reported request for a cleaner look; cursor:pointer
                        alone is still the real "this is interactive"
                        signal, matching the icon button right after it,
                        which never had an underline treatment either. */}
                    <button
                        ref={phraseButtonRef}
                        type="button"
                        onClick={openPhrasePicker}
                        title="Change greeting phrase"
                        style={{
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                            font: 'inherit', fontWeight: 'inherit', color: 'inherit', letterSpacing: 'inherit',
                            textDecoration: 'none',
                        }}
                    >
                        {getGreeting()}
                    </button>
                    <span>, {firstName}</span>
                    {isPhrasePickerOpen && createPortal(
                        <>
                            <div onClick={() => setIsPhrasePickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999 }} />
                            <div style={{
                                position: 'fixed', top: phrasePickerPosition.top, left: phrasePickerPosition.left, zIndex: 10000,
                                width: isMobile ? '240px' : '260px', maxWidth: '80vw',
                                background: 'rgba(15, 15, 26, 0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid var(--border-premium)', borderRadius: '16px',
                                padding: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                                display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto',
                            }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 6px' }}>
                                    Choose your greeting
                                </span>
                                {GREETING_PHRASE_OPTIONS[greetingBucket].map((phrase) => {
                                    const isSelected = getGreeting() === phrase;
                                    return (
                                        <button
                                            key={phrase}
                                            type="button"
                                            onClick={() => handleSelectGreetingPhrase(greetingBucket, phrase)}
                                            style={{
                                                textAlign: 'left', padding: '9px 10px', borderRadius: '10px', cursor: 'pointer',
                                                background: isSelected ? 'var(--primary-muted)' : 'transparent',
                                                border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                                                color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
                                                font: 'inherit', fontSize: '14px', fontWeight: isSelected ? '700' : '500',
                                            }}
                                        >
                                            {phrase}
                                        </button>
                                    );
                                })}
                            </div>
                        </>,
                        document.body,
                    )}
                    <button
                        ref={iconButtonRef}
                        type="button"
                        onClick={openIconPicker}
                        title="Change greeting icon"
                        style={{
                            background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px',
                            lineHeight: 1, borderRadius: '8px', display: 'flex', alignItems: 'center',
                        }}
                    >
                        <GreetingIcon size={isMobile ? 20 : 24} color="var(--accent)" />
                    </button>
                    {isEmojiPickerOpen && (
                        <IconPickerPopover
                            position={pickerPosition}
                            isMobile={isMobile}
                            selectedId={greetingIconId}
                            onSelect={handleSelectGreetingIcon}
                            onClose={() => setIsEmojiPickerOpen(false)}
                            title="Choose your greeting icon"
                        />
                    )}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', flexWrap: 'wrap' }}>
                    <p
                        onClick={() => { if (typeof setActiveTab === 'function') setActiveTab('Calendar'); }}
                        title="Open Calendar"
                        style={{ fontSize: isMobile ? '12px' : '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                        <Calendar size={isMobile ? 13 : 15} color="var(--accent)" /> {formatDate(currentTime, isMobile)}
                    </p>
                    <span
                        onClick={() => { if (typeof setActiveTab === 'function') setActiveTab('weather'); }}
                        title="Open Weather Hub"
                        style={{ fontSize: isMobile ? '12px' : '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', cursor: typeof setActiveTab === 'function' ? 'pointer' : 'default', whiteSpace: 'nowrap' }}
                    >
                        <WeatherIcon size={isMobile ? 13 : 15} color="var(--accent)" /> {displayTemperature !== null ? `${displayTemperature}${useFahrenheit ? '°F' : '°C'}` : `--${useFahrenheit ? '°F' : '°C'}`}
                    </span>
                </div>
            </div>

            {/* Middle Section: Music Player Widget - a flat, borderless-
                shadow chip (no inset shadow) so it reads as one continuous
                glass surface with the outer greeting card, not a separate
                object pressed into it. The previous inset shadow was the
                actual cause of the "stuck-on"/blocky look. */}
            <div style={{
                background: 'var(--widget-bg)',
                border: '1px solid var(--border-premium)',
                borderRadius: '16px',
                padding: isMobile ? '10px 14px' : '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                width: isMobile ? '100%' : '320px',
                flexShrink: 0,
                boxSizing: isMobile ? 'border-box' : 'content-box',
            }}>
                {/* Explicit request: this used to always be a generic
                    Music glyph, never the real track artwork - now a real
                    circular/oval "profile picture" for the current track
                    (matching the exact shape + fallback convention just
                    applied to the header's own Focus Audio Studio popup),
                    with the generic icon kept only as the true no-artwork
                    fallback. */}
                <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: hasEverPlayed && currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl}) center/cover` : 'var(--primary-muted)',
                    color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {!(hasEverPlayed && currentTrack.artworkUrl) && <Music size={18} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', flex: 1, minWidth: 0 }}>
                    {/* Real fix for a real, reported bug: "Lofi Focus Beats"
                        (the fresh-session default queue entry) used to show
                        here as if it were genuinely queued/playing even
                        before the user ever pressed Play. Now honestly
                        shows "Nothing playing" until hasEverPlayed flips
                        true (see AudioPlayerContext.jsx). */}
                    <strong style={{ fontSize: '13px', fontWeight: '700', color: playbackError ? '#EF4444' : hasEverPlayed ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {playbackError || (hasEverPlayed ? currentTrack.title : 'Nothing playing')}
                    </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={prev} title="Previous Song" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><SkipBack size={16} /></button>
                    <button onClick={togglePlay} title={isPlaying ? "Pause" : "Play"} style={{ background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '1px' }} />}
                    </button>
                    <button onClick={next} title="Next Song" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><SkipForward size={16} /></button>
                    
                    {/* Opens Full Page Audio Hub */}
                    <button 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            // Persist the route so a hard refresh also lands back on the Audio Hub.
                            localStorage.setItem('nexus_current_route', 'audio_hub');

                            // This is the actual mechanism that changes the view: calling the
                            // setActiveTab callback that was lifted up from DashboardLayout,
                            // through HomePage, and passed down as a prop to this component.
                            // React state (not a window event) is what DashboardLayout reads
                            // to decide which page to render, so this is what must be called.
                            if (typeof setActiveTab === 'function') {
                                setActiveTab('audio_hub');
                            }

                            // Kept as a secondary signal in case any other part of the app
                            // (e.g. a future listener) also wants to react to this event.
                            window.dispatchEvent(new CustomEvent('force_open_audio_hub'));
                        }} 
                        title="Manage Playlist & Queue"
                        data-tour-id="home-audio"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            padding: '6px',
                            marginLeft: '4px',
                        }}
                    >
                        <ListMusic size={18} />
                    </button>
                </div>
            </div>

            {/* Right Section: Clock - a real, reported second look at the
                mobile "boxed" treatment this used to have (matching the
                music player widget above it): a plain ambient readout
                doesn't need to compete for visual weight as its own
                separate card the way a genuinely interactive widget
                does, so mobile now gets the exact same plain, unboxed
                treatment desktop already had - just centered instead of
                left-aligned, since it's the lone element on its own row
                on a narrow screen. */}
            <div style={isMobile ? {
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%',
            } : { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', flexShrink: 0 }}>
                <Clock size={isMobile ? 18 : 28} color="var(--accent)" />
                <div style={{ fontSize: isMobile ? '16px' : '24px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', letterSpacing: '0.5px', lineHeight: '1' }}>
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: is12Hour })}
                </div>
            </div>
        </div>
    );
};

export default GreetingCard;