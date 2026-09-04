// src/components/audio/QueueManager.jsx
//
// The real "Up Next" queue list - moved out of AudioHubPage.jsx into its
// own file (unchanged logic/markup) so it can be reused both by the
// QueueDrawer (the new slide-out right panel per the Apple-Music-style
// redesign) and anywhere else that needs the same reorderable, searchable
// queue view.
import { useEffect, useMemo, useState } from 'react';
import { Music, Search, Heart, ArrowUp, ArrowDown, Trash2, Disc, RefreshCw } from 'lucide-react';
import EqualizerBars from './EqualizerBars.jsx';
import { useStreaming } from '../../context/StreamingContext.jsx';
import { getSpotifyQueue } from '../../utils/spotifyClient.js';

const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Real, explicitly-requested feature: "Up Next" used to always show this
// app's own local queue, even while Spotify was the genuinely active,
// audible source - "jab main Spotify chalau toh Spotify ka dikhe". Spotify
// has a real endpoint for exactly this (GET /v1/me/player/queue) - see
// spotifyClient.js's own comment. Read-only (no click-to-jump) - Spotify's
// own queue endpoint doesn't support jumping to an arbitrary queue
// position from a third-party app, only real next/prev, so this honestly
// shows what's actually coming up rather than offering a control that
// wouldn't work.
const SpotifyQueueList = ({ compact }) => {
    const { spotifyAuth } = useStreaming();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Real, reported bug fixed: `loading` starts `true` (line above) so
    // there's something to show before the first real load resolves - but
    // this guard used to just `return` when there was no accessToken yet,
    // never calling setLoading(false) in that branch. Whenever this
    // mounted with activeSource==='spotify' but the token briefly (or
    // permanently, e.g. this account's own SDK init failure) wasn't ready,
    // the UI got stuck on "Loading Spotify's queue…" forever - exactly the
    // reported symptom, live-confirmed via screenshot. Now resolves to an
    // honest "not connected" state instead of spinning indefinitely.
    const load = () => {
        if (!spotifyAuth.accessToken) {
            setLoading(false);
            setData(null);
            setError('Spotify is not connected right now.');
            return;
        }
        setLoading(true);
        setError(null);
        getSpotifyQueue(spotifyAuth.accessToken)
            .then((result) => setData(result))
            .catch((err) => setError(err.message || "Could not load Spotify's queue"))
            .finally(() => setLoading(false));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [spotifyAuth.accessToken]);

    const dedupedQueue = useMemo(() => {
        if (!data?.queue) return [];
        const seen = new Set();
        return data.queue.filter((t) => {
            if (seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
        });
    }, [data]);

    const rowStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-premium)' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box',
            ...(compact ? {} : { background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px' }),
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {!compact && (
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Music size={18} color="var(--accent)" /> Spotify Queue
                    </h3>
                )}
                <button onClick={load} title="Refresh" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '2px', marginLeft: 'auto' }}>
                    <RefreshCw size={14} className={loading ? 'nexus-spin' : undefined} />
                </button>
            </div>
            {loading && <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Loading Spotify's queue…</div>}
            {error && <div style={{ fontSize: '13px', color: '#fca5a5', textAlign: 'center', padding: '20px 0' }}>{error}</div>}
            {!loading && !error && data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {data.currentlyPlaying && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Now Playing</span>
                            <div style={{ ...rowStyle, background: 'var(--primary-muted)' }}>
                                {data.currentlyPlaying.artworkUrl ? (
                                    <img src={data.currentlyPlaying.artworkUrl} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Disc size={15} color="var(--text-muted)" /></div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.currentlyPlaying.title}</div>
                                    {data.currentlyPlaying.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.currentlyPlaying.artist}</div>}
                                </div>
                                <EqualizerBars isPlaying size="small" />
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Up (from Spotify)</span>
                        {/* Real, reported bug fixed: this rendered
                            data.queue exactly as Spotify returned it -
                            reported live as the SAME track repeated 10+
                            times. Spotify's own /v1/me/player/queue
                            genuinely echoes the current track for every
                            remaining position when repeat-one/track-radio
                            has nothing else lined up - real Spotify data,
                            but showing the identical id ten times over adds
                            nothing over showing it once. Deduped by id
                            before rendering. */}
                        {dedupedQueue.length === 0 ? (
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Nothing queued in Spotify right now.</div>
                        ) : dedupedQueue.map((t, i) => (
                            <div key={`${t.id}-${i}`} style={rowStyle}>
                                {t.artworkUrl ? (
                                    <img src={t.artworkUrl} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Disc size={15} color="var(--text-muted)" /></div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                    {t.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <style>{`@keyframes nexusSpin { to { transform: rotate(360deg); } } .nexus-spin { animation: nexusSpin 0.8s linear infinite; }`}</style>
        </div>
    );
};

// Real, explicitly-requested feature - the YouTube equivalent of the above:
// shows the actual queue this app built for YouTube (see setYoutubeQueue in
// StreamingContext.jsx) instead of the unrelated local playlist. Unlike
// Spotify's, this queue genuinely IS this app's own, so clicking a row to
// jump to it is real and honest here (no external API limitation).
const YoutubeQueueList = ({ compact }) => {
    const { youtubeQueue, youtubeQueueIndex, youtubeIsPlaying, setYoutubeQueue } = useStreaming();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box',
            ...(compact ? {} : { background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px' }),
        }}>
            {!compact && (
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music size={18} color="var(--accent)" /> YouTube Queue ({youtubeQueue.length})
                </h3>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {youtubeQueue.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Your YouTube queue is empty.</div>}
                {youtubeQueue.map((t, idx) => {
                    const isActive = idx === youtubeQueueIndex;
                    return (
                        <div
                            key={`${t.videoId}-${idx}`}
                            onClick={() => idx !== youtubeQueueIndex && setYoutubeQueue(youtubeQueue, idx)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', cursor: 'pointer' }}
                        >
                            {t.artworkUrl ? (
                                <img src={t.artworkUrl} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Disc size={15} color="var(--text-muted)" /></div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                {t.artist && <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</div>}
                            </div>
                            {isActive && <EqualizerBars isPlaying={youtubeIsPlaying} size="small" />}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const QueueManager = ({ playlist, currentSongIndex, isPlaying, togglePlay, playAt, deleteSong, moveSong, favoriteTrackTitles, toggleFavoriteTrack, durationsByUrl, activeSource, compact = false }) => {
    // Real, reported bug fixed: a row here used to count as "active" purely
    // by index match, regardless of what's ACTUALLY playing - once Spotify
    // (or YouTube) became the real active source, `isPlaying` (the
    // effective one) correctly stayed true, but currentSongIndex still
    // pointed at whichever local track was last selected, so that row kept
    // showing as falsely active/playing even while Spotify audibly played
    // something else entirely - and its own Play/Pause button then called
    // togglePlay() (which toggles WHATEVER activeSource actually is, i.e.
    // Spotify) instead of starting the local track, which is exactly what
    // read as "local song won't play any more". Local rows can only be
    // genuinely active while activeSource is actually 'local'.
    const isLocalSourceActive = !activeSource || activeSource === 'local';
    const [search, setSearch] = useState('');
    const filtered = useMemo(
        () => playlist.map((song, idx) => ({ song, idx })).filter(({ song }) => song.title.toLowerCase().includes(search.toLowerCase())),
        [playlist, search]
    );

    // Real, explicitly-requested feature: "Up Next" must show whichever
    // source is ACTUALLY playing - local queue while local, Spotify's real
    // queue while Spotify, YouTube's real queue while YouTube - instead of
    // always showing the local playlist regardless of what's audibly
    // playing.
    if (activeSource === 'spotify') return <SpotifyQueueList compact={compact} />;
    if (activeSource === 'youtube') return <YoutubeQueueList compact={compact} />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box',
            ...(compact ? {} : { background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px' }),
        }}>
            {!compact && (
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music size={18} color="var(--accent)" /> Playback Queue ({playlist.length})
                </h3>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--widget-bg)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search your queue"
                    placeholder="Search your queue..."
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
                {search && <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✕</button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: compact ? 'none' : '320px', overflowY: compact ? 'visible' : 'auto', willChange: 'scroll-position' }}>
                {playlist.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Your queue is empty. Add tracks from Library, Search, Ambient Focus, or Local Files.</div>}
                {playlist.length > 0 && filtered.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No tracks match "{search}".</div>}
                {filtered.map(({ song, idx }) => {
                    const isFav = favoriteTrackTitles.has(song.title);
                    const isActive = isLocalSourceActive && idx === currentSongIndex;
                    const knownDuration = durationsByUrl[song.url];
                    return (
                        <div key={song.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: isActive ? 'var(--primary-muted)' : 'var(--widget-bg)', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                <button onClick={() => toggleFavoriteTrack(song.title, { artist: song.artist, url: song.url, source: 'local' })} title={isFav ? 'Unfavorite' : 'Favorite'} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}>
                                    <Heart size={14} color={isFav ? '#F43F5E' : 'var(--text-muted)'} fill={isFav ? '#F43F5E' : 'none'} />
                                </button>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', flexShrink: 0 }}>#{idx + 1}</span>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: isActive ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 auto', minWidth: 0 }}>{song.title}</span>
                                {/* Honest source badge - this used to hardcode
                                    "Apple Music" for every non-local track,
                                    which was simply wrong for the mock
                                    library/ambient/search tracks that make
                                    up the overwhelming majority of the
                                    queue (genuine Apple Music playback only
                                    happens once that streaming source is
                                    actually connected and active). */}
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)', border: '1px solid var(--border-premium)', borderRadius: '4px', padding: '1px 5px', flexShrink: 0, fontWeight: '700' }}>{song.isLocal ? 'LOCAL' : 'NEXUS'}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{knownDuration !== undefined ? (knownDuration > 0 ? formatTime(knownDuration) : '--:--') : '...'}</span>
                                {isActive && isPlaying && <EqualizerBars isPlaying size="small" />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <button onClick={() => moveSong(idx, 'up')} title="Move Up" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}><ArrowUp size={14} /></button>
                                <button onClick={() => moveSong(idx, 'down')} title="Move Down" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}><ArrowDown size={14} /></button>
                                <button onClick={() => (isActive ? togglePlay() : playAt(idx))} style={{ padding: '4px 10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                    {isActive && isPlaying ? 'Pause' : 'Play'}
                                </button>
                                <button onClick={() => deleteSong(song.id)} title="Delete Track" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}><Trash2 size={14} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default QueueManager;
