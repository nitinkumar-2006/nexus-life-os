// src/components/audio/QueueManager.jsx
//
// The real "Up Next" queue list - moved out of AudioHubPage.jsx into its
// own file (unchanged logic/markup) so it can be reused both by the
// QueueDrawer (the new slide-out right panel per the Apple-Music-style
// redesign) and anywhere else that needs the same reorderable, searchable
// queue view.
import { useMemo, useState } from 'react';
import { Music, Search, Heart, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import EqualizerBars from './EqualizerBars.jsx';

const formatTime = (seconds) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
