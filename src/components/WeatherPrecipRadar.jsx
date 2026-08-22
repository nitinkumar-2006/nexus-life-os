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

const WeatherPrecipRadar = ({ coords, locationLabel, textPrimary, textMuted, glassBorder }) => {
    const [byDirection, setByDirection] = useState(null); // { N: mm, NE: mm, ... }
    const [centerPrecip, setCenterPrecip] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!coords) return undefined;
        let cancelled = false;
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
        return () => { cancelled = true; };
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {GRID_ORDER.map((key) => {
                    const isCenter = key === 'YOU';
                    const mm = isCenter ? centerPrecip : byDirection?.[key];
                    return (
                        <div key={key} style={{
                            position: 'relative', aspectRatio: '1', borderRadius: '12px',
                            background: loading ? 'rgba(255,255,255,0.05)' : intensityColor(mm || 0),
                            border: isCenter ? `1.5px solid ${textPrimary}` : `1px solid ${glassBorder}`,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                            transition: 'background 0.6s ease',
                        }}>
                            {isCenter ? (
                                <MapPin size={16} color={textPrimary} />
                            ) : (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: textMuted }}>{key}</span>
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
                <span style={{ fontSize: '10px', color: textMuted, flexShrink: 0 }}>Live precipitation, ~50km grid</span>
            </div>
        </div>
    );
};

export default WeatherPrecipRadar;
