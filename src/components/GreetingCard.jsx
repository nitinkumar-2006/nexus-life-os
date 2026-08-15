// src/components/GreetingCard.jsx
import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Hand, Sun, Play, Pause, SkipForward, SkipBack, Music, ListMusic } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioPlayerContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';

const GreetingCard = ({ setActiveTab }) => {
    const isMobile = useIsMobile();
    const [currentTime, setCurrentTime] = useState(new Date());

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
    const { currentTrack, isPlaying, togglePlay, next, prev, playbackError } = useAudioPlayer();

    // Real, live temperature for the device's actual location (not a fixed
    // hardcoded city) - shared with DynamicBackground's sky/rain/cloud
    // visuals via the same context, so they can never disagree.
    const { temperature } = useWeather();

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

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 4 && hour < 12) return "Good Morning";
        if (hour >= 12 && hour < 17) return "Good Afternoon";
        if (hour >= 17 && hour < 22) return "Good Evening";
        return "Good Night";
    };

    const formatDate = (date) => {
        if (!date || Number.isNaN(new Date(date).getTime())) return '';
        return new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
                    <span style={{ fontSize: isMobile ? '11px' : '13px', background: 'var(--primary-muted)', color: 'var(--accent)', padding: isMobile ? '3px 10px' : '4px 12px', borderRadius: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Hand size={14} /> Personal OS Active
                    </span>
                </div>
                <h1 style={{ fontSize: isMobile ? '22px' : '30px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{getGreeting()}, {firstName}</span> <span>👋</span>
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <p
                        onClick={() => { if (typeof setActiveTab === 'function') setActiveTab('Calendar'); }}
                        title="Open Calendar"
                        style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer' }}
                    >
                        <Calendar size={15} /> {formatDate(currentTime)}
                    </p>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                        <Sun size={15} color="var(--accent)" /> {temperature !== null ? `${temperature}°C` : '--°C'}
                    </span>
                </div>
            </div>

            {/* Middle Section: Music Player Widget */}
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
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <div style={{ padding: '10px', background: 'var(--primary-muted)', color: 'var(--primary)', borderRadius: '12px' }}>
                    <Music size={20} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: '13px', fontWeight: '700', color: playbackError ? '#EF4444' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {playbackError || currentTrack.title}
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

            {/* Right Section: Clock */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', gap: '12px', flexShrink: 0 }}>
                <Clock size={isMobile ? 22 : 28} color="var(--accent)" />
                <div style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', letterSpacing: '0.5px', lineHeight: '1' }}>
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: is12Hour })}
                </div>
            </div>
        </div>
    );
};

export default GreetingCard;