// src/components/WeatherPrecipRadar.jsx
//
// A real, honest stand-in for a full tile-based precipitation radar (which
// would need a paid/keyed map-tile service Nexus doesn't have): one batched
// Open-Meteo request for the user's real coordinates PLUS 8 real points a
// small distance in every compass direction (Open-Meteo supports comma-
// separated lat/lon lists in a single call, returning one forecast per
// point), then a 3x3 grid of real current precipitation values around the
// user's real location. Every cell is a genuinely fetched number - not a
// decorative radar-looking image - and points are labeled by compass
// direction rather than inventing nearby city names this app has no real
// geocoding data for.
import { useEffect, useState } from 'react';
import { MapPin, Radar } from 'lucide-react';

// Matches WeatherContext's own poll cadence - a real, confirmed bug this
// fixes: the fetch below used to only ever run once, the instant coords
// first resolved (its old effect dependency was just [coords.lat,
// coords.lon], which essentially never changes again in a real session -
// a device doesn't move). That meant every cell's "0.3mm"-style reading
// was a genuine, real number, but a single permanent snapshot from
// whenever the page first loaded - never refreshing again even though
// the rest of this page's own weather data visibly polls every 10
// minutes, which is exactly what read as "this doesn't actually work".
const POLL_MS = 10 * 60 * 1000;

const DEG_OFFSET = 0.45; // roughly 45-50km - close enough to read as "regional"
const DIRECTIONS = [
    { label: 'NW', dLat: DEG_OFFSET * 0.7, dLon: -DEG_OFFSET * 0.7 },
    { label: 'N', dLat: DEG_OFFSET, dLon: 0 },
    { label: 'NE', dLat: DEG_OFFSET * 0.7, dLon: DEG_OFFSET * 0.7 },
    { label: 'W', dLat: 0, dLon: -DEG_OFFSET },
    { label: 'E', dLat: 0, dLon: DEG_OFFSET },
    { label: 'SW', dLat: -DEG_OFFSET * 0.7, dLon: -DEG_OFFSET * 0.7 },
    { label: 'S', dLat: -DEG_OFFSET, dLon: 0 },
    { label: 'SE', dLat: -DEG_OFFSET * 0.7, dLon: DEG_OFFSET * 0.7 },
];
// Grid render order (3x3, center = the user) - kept separate from the fetch
// order above since the fetch list doesn't include the center point twice.
const GRID_ORDER = ['NW', 'N', 'NE', 'W', 'YOU', 'E', 'SW', 'S', 'SE'];

const intensityColor = (mm) => {
    if (mm <= 0) return 'rgba(56,189,248,0.06)';
    if (mm < 0.5) return 'rgba(56,189,248,0.28)';
    if (mm < 2) return 'rgba(56,189,248,0.55)';
    if (mm < 5) return 'rgba(37,99,235,0.78)';
    return 'rgba(29,78,216,0.95)';
};

const WeatherPrecipRadar = ({ coords, locationLabel, textPrimary, textMuted, glassBorder, isMobile }) => {
    const [byDirection, setByDirection] = useState(null); // { N: mm, NE: mm, ... }
    const [centerPrecip, setCenterPrecip] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!coords) return undefined;
        let cancelled = false;

        const fetchGrid = () => {
            setFailed(false);
            const lats = [coords.lat, ...DIRECTIONS.map((d) => coords.lat + d.dLat)].join(',');
            const lons = [coords.lon, ...DIRECTIONS.map((d) => coords.lon + d.dLon)].join(',');
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=precipitation&timezone=auto`)
                .then((res) => res.json())
                .then((data) => {
                    if (cancelled) return;
                    const rows = Array.isArray(data) ? data : [data];
                    const centerRow = rows[0];
                    setCenterPrecip(typeof centerRow?.current?.precipitation === 'number' ? centerRow.current.precipitation : 0);
                    const map = {};
                    DIRECTIONS.forEach((d, i) => {
                        const row = rows[i + 1];
                        map[d.label] = typeof row?.current?.precipitation === 'number' ? row.current.precipitation : 0;
                    });
                    setByDirection(map);
                })
                .catch(() => { if (!cancelled) setFailed(true); });
        };

        fetchGrid();
        const interval = setInterval(fetchGrid, POLL_MS);
        return () => { cancelled = true; clearInterval(interval); };
    }, [coords?.lat, coords?.lon]);

    if (!coords || failed) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px', minHeight: '180px' }}>
                <Radar size={26} color={textMuted} style={{ opacity: 0.6 }} />
                <span style={{ fontSize: '12px', color: textMuted, textAlign: 'center' }}>Precipitation map unavailable right now.</span>
            </div>
        );
    }

    const loading = byDirection === null;

    // A fixed, compact cell height (not aspect-ratio-driven off the
    // grid's own column width) plus a capped, centered max-width on the
    // whole grid - a wide desktop weather card would otherwise stretch
    // each aspect-ratio:1 cell to match its own wide column, ballooning
    // the whole 3x3 grid into an oversized square block. This is what
    // actually keeps it reading as the compact, modular "mini map"
    // preview real weather apps use, regardless of how wide the
    // surrounding card is.
    const cellHeight = isMobile ? 58 : 64;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '380px', width: '100%', margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {GRID_ORDER.map((key) => {
                    const isCenter = key === 'YOU';
                    const mm = isCenter ? centerPrecip : byDirection?.[key];
                    return (
                        <div key={key} style={{
                            position: 'relative', height: `${cellHeight}px`, borderRadius: '10px',
                            background: loading ? 'rgba(255,255,255,0.05)' : intensityColor(mm || 0),
                            border: isCenter ? `1.5px solid ${textPrimary}` : `1px solid ${glassBorder}`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                            transition: 'background 0.6s ease',
                        }}>
                            {isCenter ? (
                                <MapPin size={14} color={textPrimary} />
                            ) : (
                                <span style={{ fontSize: '9px', fontWeight: '700', color: textMuted }}>{key}</span>
                            )}
                            {!loading && (
                                <span style={{ fontSize: '9px', fontWeight: '700', color: textPrimary, opacity: 0.85 }}>
                                    {(mm || 0) > 0 ? `${(mm || 0).toFixed(1)}mm` : '--'}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: textMuted, display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <MapPin size={11} /> {locationLabel || 'Your location'}
                </span>
                <span style={{ fontSize: '10px', color: textMuted, flexShrink: 0, whiteSpace: 'nowrap' }}>~50km grid</span>
            </div>
        </div>
    );
};

export default WeatherPrecipRadar;
