// src/components/audio/FloatingBottomPlayer.jsx
//
// Replaces MiniPlayerBar entirely. A compact, pill-shaped card that floats
// ABOVE the page content (position: absolute against AudioHubPage's own
// relative container, not part of normal flex flow) instead of being
// glued full-width to the bottom edge - per the redesign spec, it must
// never push page content up.
//
// Layout matches the real Apple Music web player's own bottom bar exactly
// (per direct side-by-side screenshot comparison, explicit "same size,
// same position for every feature" request): a single slim row, THREE
// columns - Left = transport controls (Shuffle/Prev/Play/Next/Repeat),
// Center = small artwork + title/artist with its own thin progress line
// directly underneath (only as wide as that text block, not the whole
// pill), Right = Lyrics/Queue/Volume(/More) utility icons. No equalizer
// bars or extra chrome next to the title - that visual wasn't in the
// reference and the request was explicit: no extra clutter.
//
// Background uses the same --popover-bg token every other small anchored
// popover in this app relies on (see the header-dropdown blur-floor fix) -
// real, reported feedback that --bg-surface's own near-transparency (by
// design, for cards sitting flush against page content) let scrolled
// content bleed through and made the player's own text illegible. This
// stays a real, always-solid-enough fill instead.
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1,
    Disc, MessageSquare, ListMusic, Volume2, VolumeX, Volume1, MoreHorizontal, Maximize2,
} from 'lucide-react';
import VolumePopup from './VolumePopup.jsx';
import QueueDrawer from './QueueDrawer.jsx';
import LyricsOverlay from './LyricsOverlay.jsx';
import TrackOptionsMenu from './TrackOptionsMenu.jsx';
import FullPlayerView from './FullPlayerView.jsx';
import { makeFavoriteKey } from '../../context/AudioPlayerContext.jsx';

const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Same deterministic-gradient approach AudioHubPage.jsx's own playlist
// tiles use (duplicated, not imported, to keep this component self-
// contained) - gives the small square "album art" a distinct look per
// track instead of one flat color for everything.
const GRADIENT_PALETTE = [
    ['#6366F1', '#8B5CF6'], ['#F97316', '#EC4899'], ['#10B981', '#3B82F6'],
    ['#EAB308', '#F97316'], ['#8B5CF6', '#EC4899'], ['#06B6D4', '#6366F1'],
];
const gradientForTrack = (title) => {
    const safe = title && typeof title === 'string' && title.length > 0 ? title : 'default';
    let hash = 0;
    for (let i = 0; i < safe.length; i++) hash = (hash * 31 + safe.charCodeAt(i)) >>> 0;
    const [a, b] = GRADIENT_PALETTE[hash % GRADIENT_PALETTE.length];
    return `linear-gradient(135deg, ${a}, ${b})`;
};

// Small flat icon button - Apple's own reference uses plain icons with no
// resting background/border (not circled chips), just a light hover fill.
// `active` buttons (Shuffle/Repeat when toggled on) skip the hover class
// so hovering them never fights their own accent color.
const iconBtnStyle = (extra = {}) => ({
    background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '6px', borderRadius: '8px', flexShrink: 0,
    ...extra,
});

const FloatingBottomPlayer = ({
    currentTrack, isPlaying, togglePlay, next, prev, isMobile,
    favoriteTrackTitles, toggleFavoriteTrack, volume, isMuted, toggleMute, setVolume,
    currentTime, duration, seek,
    shuffleEnabled, toggleShuffle, repeatMode, cycleRepeatMode,
    deleteSong, queueProps,
}) => {
    const [volumeOpen, setVolumeOpen] = useState(false);
    const [artworkHovered, setArtworkHovered] = useState(false);
    const [queueOpen, setQueueOpen] = useState(false);
    const [lyricsOpen, setLyricsOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [progressHovered, setProgressHovered] = useState(false);
    const [fullPlayerOpen, setFullPlayerOpen] = useState(false);

    const volumeBtnRef = useRef(null);
    const moreBtnRef = useRef(null);

    // Real fix: must compute the exact same source/artist-aware key
    // toggleFavoriteTrack now stores (see makeFavoriteKey's own comment in
    // AudioPlayerContext.jsx) - checking bare title alone would show every
    // same-titled track as already favorited even when only one is.
    const isFav = favoriteTrackTitles.has(makeFavoriteKey(currentTrack.title, currentTrack.source || (currentTrack.isLocal ? 'local' : undefined), currentTrack.artist));
    const safeDuration = duration && isFinite(duration) ? duration : 0;
    const clampedTime = Math.min(currentTime, safeDuration);
    const progressPct = safeDuration > 0 ? (clampedTime / safeDuration) * 100 : 0;

    const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
    const repeatActive = repeatMode === 'one' || repeatMode === 'all';
    const VolIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    const commonPlayerProps = {
        currentTrack, isPlaying, togglePlay, next, prev,
        favoriteTrackTitles, toggleFavoriteTrack, volume, isMuted, toggleMute, setVolume,
        currentTime, duration, seek,
        shuffleEnabled, toggleShuffle, repeatMode, cycleRepeatMode,
        deleteSong, queueProps,
    };

    return createPortal(
        <div style={{
            // Real, reported bug fixed: this component used to be mounted
            // ONLY inside AudioHubPage.jsx, positioned against that page's
            // own relative container - so it (and playback control
            // entirely) visually vanished the instant you navigated to any
            // OTHER page while a track kept playing ("song play karte
            // jaana hi... bottom audio ka mobile bhi humein... hat jaa
            // raha hai"), even though the underlying <audio> element (a
            // real, separate persistent-root context) never actually
            // stopped. It's now mounted once at the app root
            // (DashboardLayout.jsx's own GlobalAudioMiniPlayer, not this
            // page), so it stays visible across every tab - matching how
            // a real reference app's own mini-player behaves. `position:
            // fixed` alone isn't enough once mounted from an ancestor this
            // deep (DynamicBackground and a few other cards further up
            // use backdrop-filter/transform, either of which becomes the
            // real containing block for a `position:fixed` descendant
            // instead of the viewport - the same class of bug this app's
            // other overlays already portal past) - createPortal into
            // document.body (same established pattern as QueueDrawer/
            // LyricsOverlay/FullPlayerView/VolumePopup/TrackOptionsMenu)
            // guarantees it always escapes to the true viewport instead.
            // Desktop now genuinely floats above the FULL viewport
            // (centered against the whole window, not just AudioHubPage's
            // own content column) - a real, accepted trade-off: slightly
            // off-center from just the content area while the desktop
            // Sidebar is expanded, in exchange for actually staying
            // visible on every other page, which matters far more.
            position: 'fixed',
            left: isMobile ? 0 : '50%', right: isMobile ? 0 : undefined,
            transform: isMobile ? 'none' : 'translateX(-50%)',
            bottom: isMobile ? 'var(--mobile-tabbar-height, 68px)' : '20px',
            width: isMobile ? '100%' : 'min(668px, calc(100% - 40px))',
            zIndex: 100,
        }}>
            <div style={{
                // Explicit request: this player must stay premium dark
                // glassmorphism ALWAYS, not follow --popover-bg's own
                // near-solid-white fill (+ dark text) during the Dynamic
                // theme's Dawn/Day sky phases - a real, deliberate choice
                // for every OTHER popover in this app, just not the right
                // look for this one specifically, per this explicit
                // correction. A local CSS-custom-property override (not a
                // global variables.css change) means every var(--text-
                // primary)/var(--border-premium)/etc. reference already
                // used throughout this file resolves to a fixed dark-glass
                // palette regardless of sky phase, without touching each
                // one individually. Portaled overlays (QueueDrawer,
                // LyricsOverlay, FullPlayerView, VolumePopup,
                // TrackOptionsMenu) render into document.body via
                // createPortal, so they're NOT DOM descendants of this div
                // and correctly keep following the theme/sky-phase as
                // normal - this override only ever reaches the visible
                // mini-player pill itself, matching the actual complaint's
                // own scope.
                background: 'rgba(15, 23, 42, 0.6)',
                '--text-primary': '#FFFFFF', '--text-secondary': 'rgba(255,255,255,0.75)',
                '--text-muted': 'rgba(255,255,255,0.55)', '--border-premium': 'rgba(255,255,255,0.14)',
                '--widget-bg': 'rgba(255,255,255,0.08)', '--bg-surface': 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(max(var(--glass-blur, 20px), 20px)) saturate(180%)',
                WebkitBackdropFilter: 'blur(max(var(--glass-blur, 20px), 20px)) saturate(180%)',
                // Mobile no longer has ANY side/bottom border or radius -
                // a docked bar reads as continuous with MobileTabBar.jsx
                // directly below it (which itself has no radius and only
                // a borderTop divider, no side/bottom border either), not
                // as a separate card sitting on top of it. Matched byte-
                // for-byte against that file's own borderTop treatment so
                // the two really do read as one joined dock, not two
                // stacked cards with a visible seam between them.
                border: isMobile ? 'none' : '1px solid var(--border-premium)',
                borderTop: isMobile ? '1px solid var(--border-premium)' : undefined,
                borderRadius: isMobile ? 0 : '9999px',
                // No elevation shadow on mobile - a flush-docked bar has
                // no "floating above the page" to imply, and the desktop
                // pill's own shadow (kept, unchanged) only ever made sense
                // for something that genuinely floats over content there.
                boxShadow: isMobile ? 'none' : '0 12px 32px rgba(0,0,0,0.3)', boxSizing: 'border-box',
                overflow: 'visible', position: 'relative',
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px',
                    // Exact 54px row height on desktop per the explicit
                    // follow-up spec (matched against Apple's own
                    // computed style). Mobile is now a single real row too
                    // (see the radius comment above) with a real, fixed
                    // height matching Spotify's own mini bar proportions,
                    // not the old auto-height stacked layout.
                    height: isMobile ? '56px' : '54px', boxSizing: 'border-box',
                    padding: isMobile ? '0 12px' : '0 18px',
                }}>
                    {/* Transport controls - LEFT on desktop (unchanged,
                        matches the real Apple Music web player this whole
                        row's desktop layout is modeled on), but RIGHT on
                        mobile: a real, reported mismatch against every
                        actual reference app cited this session (Spotify/
                        Apple Music's own mobile mini-players) - all of
                        them put the artwork+title on the LEFT (where a
                        flexible, truncating text block naturally belongs)
                        and the fixed-width transport controls on the
                        RIGHT, the opposite of what this had. Pure `order`
                        swap (CSS flex reordering, not a DOM/JSX
                        duplication) - desktop's own explicit order:0 is
                        identical to unset, so its layout is byte-for-byte
                        unchanged. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '2px' : '6px', flexShrink: 0, order: isMobile ? 2 : 0 }}>
                        {/* Shuffle/Repeat now show on mobile too - a real,
                            explicit request: they used to be desktop-only,
                            with no way to reach either from the phone at
                            all. Same real toggleShuffle/cycleRepeatMode
                            this row's desktop buttons already use, just no
                            longer hidden. */}
                        <button onClick={toggleShuffle} title="Shuffle" className={shuffleEnabled ? '' : 'nexus-audio-icon-btn'} style={iconBtnStyle(shuffleEnabled ? { color: 'var(--primary)' } : { padding: isMobile ? '4px' : '6px' })}>
                            <Shuffle size={isMobile ? 14 : 15} />
                        </button>
                        <button onClick={prev} title="Previous" className="nexus-audio-icon-btn" style={iconBtnStyle({ color: 'var(--text-primary)', padding: isMobile ? '4px' : '6px' })}>
                            <SkipBack size={16} fill="currentColor" />
                        </button>
                        <button
                            onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '2px' : '4px', flexShrink: 0 }}
                        >
                            {isPlaying ? <Pause size={isMobile ? 22 : 24} fill="currentColor" /> : <Play size={isMobile ? 22 : 24} fill="currentColor" style={{ marginLeft: '2px' }} />}
                        </button>
                        <button onClick={next} title="Next" className="nexus-audio-icon-btn" style={iconBtnStyle({ color: 'var(--text-primary)', padding: isMobile ? '4px' : '6px' })}>
                            <SkipForward size={16} fill="currentColor" />
                        </button>
                        <button onClick={cycleRepeatMode} title={`Repeat: ${repeatMode}`} className={repeatActive ? '' : 'nexus-audio-icon-btn'} style={iconBtnStyle(repeatActive ? { color: 'var(--primary)' } : { padding: isMobile ? '4px' : '6px' })}>
                            <RepeatIcon size={isMobile ? 14 : 15} />
                        </button>
                    </div>

                    {/* CENTER - CORRECTED after live-inspecting
                        music.apple.com with a real track actually playing
                        (not a screenshot): `.player-lcd`'s real structure
                        is a 3-column top row - `__artwork` (34x34) |
                        `__metadata` (title/artist, flex:1) | `__after-
                        metadata` (the "..." more-options button, moved
                        here from the right icon cluster below - confirmed
                        `position:static`, a genuine flex child of this
                        SAME row, not part of the separate Lyrics/Queue/
                        Volume cluster) - followed by ONE separate,
                        genuinely FULL-WIDTH progress row underneath
                        spanning the artwork's own left edge all the way
                        to the more-button's right edge (real measured
                        rects: artwork 715-749, metadata 757-1033, more-
                        button 1041-1077, progress track 715-1077 - i.e.
                        progress spans under the artwork and the more-
                        button too, not confined to just the text block as
                        it was before this correction). */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', order: isMobile ? 1 : 0 }}>
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <button
                                onClick={() => setFullPlayerOpen(true)}
                                onMouseEnter={() => setArtworkHovered(true)}
                                onMouseLeave={() => setArtworkHovered(false)}
                                title="Expand to full player" aria-label="Expand to full player"
                                style={{
                                    // Real, reported follow-up: 42px read as
                                    // too large relative to the rest of the
                                    // bar - settled on 36px, still a real
                                    // step up from the old 30px (closer to
                                    // Spotify's own proportions) without
                                    // overpowering the row.
                                    width: isMobile ? '36px' : '34px', height: isMobile ? '36px' : '34px', borderRadius: isMobile ? '8px' : '6px',
                                    // Real, reported bug: this always showed a
                                    // generated gradient + generic Disc icon,
                                    // even for a track (Spotify search results,
                                    // Saavn, YouTube) that has a real cover
                                    // image right there in currentTrack.artworkUrl
                                    // - never once read. Falls back to the
                                    // gradient only when there's genuinely no
                                    // real image (local files never have one).
                                    background: currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl}) center/cover` : gradientForTrack(currentTrack.title),
                                    border: 'none', padding: 0, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.85)', flexShrink: 0,
                                    position: 'relative', overflow: 'hidden',
                                }}
                            >
                                {!currentTrack.artworkUrl && (
                                    <Disc size={isMobile ? 14 : 16} style={{ opacity: artworkHovered ? 0.25 : 1, transition: 'opacity 0.15s ease' }} />
                                )}
                                {/* A real cover image needs its own dark
                                    scrim behind the hover icon (a plain
                                    white icon alone can vanish against a
                                    bright cover) - the gradient fallback
                                    never needed one since the Disc icon
                                    above already just fades in place. */}
                                {currentTrack.artworkUrl && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: artworkHovered ? 1 : 0, transition: 'opacity 0.15s ease' }} />
                                )}
                                {!isMobile && (
                                    <Maximize2 size={13} color="#fff" style={{ position: 'absolute', opacity: artworkHovered ? 1 : 0, transition: 'opacity 0.15s ease', pointerEvents: 'none' }} />
                                )}
                            </button>

                            <div
                                style={{ flex: 1, minWidth: 0, position: 'relative', cursor: isMobile ? 'pointer' : 'default' }}
                                // Mobile-only: tapping the title/artist text
                                // now also expands the full player, not just
                                // the small 36px artwork square next to it -
                                // a real, confirmed report that tapping the
                                // bar (as a whole, the way a real reference
                                // app's own mini-player works) should open
                                // it, not just one small icon most people
                                // wouldn't think to tap specifically. Scoped
                                // to mobile only - desktop's own progress-bar
                                // hover/scrub interaction already lives on
                                // this exact area (see below), so adding a
                                // click-to-expand there too would fight it.
                                onClick={isMobile ? () => setFullPlayerOpen(true) : undefined}
                            >
                                {/* Title/artist block - on progress-bar
                                    hover this whole block fades/blurs and
                                    the elapsed/remaining times overlay
                                    directly ON TOP of it (same spot, higher
                                    stacking), at its extreme left/right
                                    edges. */}
                                <div style={{
                                    opacity: !isMobile && progressHovered ? 0.2 : 1,
                                    filter: !isMobile && progressHovered ? 'blur(1.5px)' : 'none',
                                    transition: 'opacity 0.15s ease, filter 0.15s ease',
                                }}>
                                    <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }}>{currentTrack.title}</div>
                                    {/* CORRECTED after live-inspecting
                                        Apple's own real site (not a
                                        screenshot): the artist line is
                                        never replaced. Apple's actual
                                        volume control (`.chrome-volume`)
                                        is its own small, always-present
                                        28px circular button; clicking it
                                        toggles a `.chrome-volume--
                                        expanded` class that reveals an
                                        absolutely-positioned pill-shaped
                                        track (`.chrome-volume__slider`,
                                        `position:absolute; inset-inline-
                                        end:-4px`) expanding LEFTWARD out
                                        of the button itself via
                                        `transform:scaleX()` - it never
                                        touches this text block at all.
                                        See the volume button below for
                                        the actual popup. */}
                                    {currentTrack.artist && (
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.3' }}>{currentTrack.artist}</div>
                                    )}
                                </div>
                                {!isMobile && (
                                    <>
                                        <span style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--text-primary)', fontWeight: '800', fontVariantNumeric: 'tabular-nums', opacity: progressHovered ? 1 : 0, transition: 'opacity 0.15s ease', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{formatTime(clampedTime)}</span>
                                        <span style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--text-primary)', fontWeight: '800', fontVariantNumeric: 'tabular-nums', opacity: progressHovered ? 1 : 0, transition: 'opacity 0.15s ease', pointerEvents: 'none', whiteSpace: 'nowrap' }}>{safeDuration > 0 ? `-${formatTime(Math.max(0, safeDuration - clampedTime))}` : '--:--'}</span>
                                    </>
                                )}
                            </div>

                            {/* "..." More Options - MOVED here from the
                                right icon cluster, matching Apple's real,
                                confirmed structure exactly (see the block
                                comment above). */}
                            {!isMobile && (
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    <button ref={moreBtnRef} onClick={() => setMoreOpen((v) => !v)} title="More Options" className="nexus-audio-icon-btn" style={iconBtnStyle(moreOpen ? { background: 'var(--widget-bg)' } : {})}>
                                        <MoreHorizontal size={15} />
                                    </button>
                                    {moreOpen && (
                                        <TrackOptionsMenu
                                            anchorRef={moreBtnRef}
                                            onClose={() => setMoreOpen(false)}
                                            isFavorite={isFav}
                                            currentTrack={currentTrack}
                                            onToggleFavorite={() => toggleFavoriteTrack(currentTrack.title, { artist: currentTrack.artist, url: currentTrack.url, uri: currentTrack.uri, source: currentTrack.source || (currentTrack.isLocal ? 'local' : undefined), artworkUrl: currentTrack.artworkUrl })}
                                            onRemoveFromQueue={currentTrack.id ? () => deleteSong(currentTrack.id) : null}
                                            onViewCredits={() => setLyricsOpen(true)}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Thin scrubber - now genuinely spans the FULL
                            row width (under the artwork and the more-
                            button too), not just the text block, matching
                            the real measured `.player-lcd__progress`
                            (715-1077, same span as the row above it). */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : 0 }}>
                            {/* Real, explicit request: mobile has no hover
                                state, so the desktop "times only appear
                                while hovering the bar" treatment left
                                mobile with literally no elapsed/remaining
                                display at all - these two labels flank the
                                bar and are always visible there instead. */}
                            {isMobile && (
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatTime(clampedTime)}</span>
                            )}
                            <div
                                onMouseEnter={() => setProgressHovered(true)}
                                onMouseLeave={() => setProgressHovered(false)}
                                style={{ position: 'relative', flex: 1, minWidth: 0, height: '10px', display: 'flex', alignItems: 'center' }}
                            >
                                <div style={{ position: 'absolute', left: 0, right: 0, height: progressHovered ? '4px' : '3px', borderRadius: '3px', background: 'var(--border-premium)', overflow: 'hidden', transition: 'height 0.15s ease' }}>
                                    <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--primary)', transition: 'width 1s linear' }} />
                                </div>
                                <input
                                    type="range" min={0} max={safeDuration} step="0.1"
                                    value={clampedTime}
                                    onChange={(e) => seek(parseFloat(e.target.value))}
                                    aria-label="Seek"
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}
                                />
                            </div>
                            {isMobile && (
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{safeDuration > 0 ? `-${formatTime(Math.max(0, safeDuration - clampedTime))}` : '--:--'}</span>
                            )}
                        </div>
                    </div>

                    {/* RIGHT - utility icons. CORRECTED: only Lyrics,
                        Queue, Volume live here now - the "..." More button
                        moved into the center LCD row above, matching
                        Apple's own real, live-confirmed structure (see the
                        comment on the center column). Volume's popup
                        mechanism was verified by live-inspecting
                        music.apple.com's actual DOM/CSS (not a
                        screenshot): clicking the button reveals a small
                        pill-shaped track that fans out to its own LEFT
                        (`placement="left"` below) - the button itself
                        never moves, and the artist-line text is never
                        touched. flexShrink:0 on the volume button's own
                        wrapper keeps its position fixed as the anchor
                        point regardless of the popup being open. */}
                    {!isMobile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, position: 'relative' }}>
                            <button onClick={() => setLyricsOpen((v) => !v)} title="Lyrics" className="nexus-audio-icon-btn" style={iconBtnStyle(lyricsOpen ? { background: 'var(--widget-bg)' } : {})}>
                                <MessageSquare size={15} />
                            </button>
                            <button onClick={() => setQueueOpen((v) => !v)} title="Up Next" className="nexus-audio-icon-btn" style={iconBtnStyle(queueOpen ? { background: 'var(--widget-bg)' } : {})}>
                                <ListMusic size={15} />
                            </button>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                <button
                                    ref={volumeBtnRef}
                                    onClick={() => setVolumeOpen((v) => !v)} title="Volume"
                                    className="nexus-audio-icon-btn" style={iconBtnStyle(volumeOpen ? { background: 'var(--widget-bg)' } : {})}
                                >
                                    <VolIcon size={15} />
                                </button>
                                {volumeOpen && (
                                    <VolumePopup
                                        placement="left"
                                        anchorRef={volumeBtnRef}
                                        volume={volume} isMuted={isMuted} setVolume={setVolume} toggleMute={toggleMute}
                                        onClose={() => setVolumeOpen(false)}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            <LyricsOverlay isOpen={lyricsOpen} onClose={() => setLyricsOpen(false)} currentTrack={currentTrack} />
            <QueueDrawer isOpen={queueOpen} onClose={() => setQueueOpen(false)} {...queueProps} />
            <FullPlayerView isOpen={fullPlayerOpen} onClose={() => setFullPlayerOpen(false)} {...commonPlayerProps} />
        </div>,
        document.body
    );
};

export default FloatingBottomPlayer;
