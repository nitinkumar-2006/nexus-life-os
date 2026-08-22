// src/components/WeatherGauges.jsx
//
// Small, reusable SVG gauges for the Weather Hub's detail metric cards -
// no charting library, just real geometry driven by real values (UV,
// humidity, real-feel temperature, pressure, wind direction, sunrise/
// sunset progress). Every gauge is a pure function of its numeric props;
// none of them fetch or fabricate anything themselves.

const polarToCartesian = (cx, cy, r, angleDeg) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
};

// Arc from startDeg to endDeg, always sweeping clockwise (SVG's y-down
// angle convention) - used both for the gauge's static background track
// (a fixed 270deg sweep, leaving a 90deg gap at the bottom) and its live
// progress arc (0 to 270deg * progress).
const describeArc = (cx, cy, r, startDeg, endDeg) => {
    const start = polarToCartesian(cx, cy, r, startDeg);
    const end = polarToCartesian(cx, cy, r, endDeg);
    const largeArcFlag = Math.abs(endDeg - startDeg) <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
};

const GAUGE_START_DEG = 135;
const GAUGE_SWEEP_DEG = 270;

// A 270deg ring gauge (gap at the bottom) - the one shared shape behind
// UV, Humidity, Real Feel, and Pressure on the Weather Hub, each just
// passing different colors/progress/center content.
export const CircularGauge = ({
    size = 84,
    strokeWidth = 8,
    progress = 0, // 0-1, already clamped by the caller
    trackColor = 'var(--surface-inset)',
    progressColor = 'var(--accent)',
    gradientStops, // optional [{ offset: '0%', color }], overrides progressColor
    showDot = true,
    centerIcon = null,
    gaugeId, // required when gradientStops is set, must be unique per instance
}) => {
    const r = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const clamped = Math.max(0, Math.min(1, progress));
    const endDeg = GAUGE_START_DEG + GAUGE_SWEEP_DEG * clamped;
    const trackPath = describeArc(cx, cy, r, GAUGE_START_DEG, GAUGE_START_DEG + GAUGE_SWEEP_DEG);
    const progressPath = clamped > 0 ? describeArc(cx, cy, r, GAUGE_START_DEG, endDeg) : null;
    const dotPos = polarToCartesian(cx, cy, r, endDeg);
    const strokeRef = gradientStops ? `url(#${gaugeId})` : progressColor;

    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {gradientStops && (
                    <defs>
                        <linearGradient id={gaugeId} x1="0%" y1="0%" x2="100%" y2="0%">
                            {gradientStops.map((s) => <stop key={s.offset} offset={s.offset} stopColor={s.color} />)}
                        </linearGradient>
                    </defs>
                )}
                <path d={trackPath} fill="none" stroke={trackColor} strokeWidth={strokeWidth} strokeLinecap="round" />
                {progressPath && (
                    <path d={progressPath} fill="none" stroke={strokeRef} strokeWidth={strokeWidth} strokeLinecap="round" />
                )}
                {showDot && clamped > 0 && (
                    <circle cx={dotPos.x} cy={dotPos.y} r={strokeWidth / 2 + 1.5} fill={gradientStops ? gradientStops[gradientStops.length - 1].color : progressColor} stroke="var(--bg-surface)" strokeWidth="2" />
                )}
            </svg>
            {centerIcon && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {centerIcon}
                </div>
            )}
        </div>
    );
};

// Compass rose with a needle pointing toward windDirection (meteorological
// convention: degrees clockwise from true north, the direction the wind is
// blowing FROM - the same convention Open-Meteo's own wind_direction_10m
// field uses).
export const WindCompassGauge = ({ size = 84, windDirection = 0, color = 'var(--accent)' }) => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;
    const labelR = r + 10;
    const needleLen = r - 4;
    const tip = polarToCartesian(cx, cy, needleLen, windDirection - 90);
    const tail = polarToCartesian(cx, cy, needleLen * 0.45, windDirection - 90 + 180);

    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-inset)" strokeWidth="6" />
                <line x1={tail.x} y1={tail.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
                <circle cx={tip.x} cy={tip.y} r="3.5" fill={color} />
                <circle cx={cx} cy={cy} r="3" fill="var(--text-muted)" />
            </svg>
            {[['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([label, deg]) => {
                const pos = polarToCartesian(cx, cy, labelR, deg - 90);
                return (
                    <span key={label} style={{ position: 'absolute', left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)' }}>
                        {label}
                    </span>
                );
            })}
        </div>
    );
};

// Real moon-phase silhouette via the standard "two overlapping discs, clipped
// to a circle" technique: a dark disc and a light disc of the same radius,
// the light one shifted horizontally by an amount derived from the real
// illuminated fraction - at illumination=1 the shift is 0 (discs coincide,
// fully lit), at illumination=0 the shift is a full diameter (no overlap,
// fully dark), and waxing/waning flips which side grows the light from.
// This is the conventional way every moon-phase icon is drawn; it isn't a
// simplification that loses accuracy, just a rendering technique for a
// genuinely-computed illumination fraction (see getMoonPhase in
// WeatherContext.jsx).
export const MoonPhaseIcon = ({ size = 64, illumination = 1, waxing = true, id = 'moon' }) => {
    const r = size / 2;
    const k = Math.max(0, Math.min(1, illumination));
    const dx = 2 * r * (1 - k) * (waxing ? 1 : -1);
    const clipId = `moon-phase-clip-${id}`;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <defs>
                <clipPath id={clipId}>
                    <circle cx={r} cy={r} r={r} />
                </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
                <circle cx={r} cy={r} r={r} fill="#1E293B" />
                <circle cx={r + dx} cy={r} r={r} fill="#F1F5F9" />
            </g>
            <circle cx={r} cy={r} r={r - 0.5} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        </svg>
    );
};

// A sunrise -> sunset arc with a marker at the sun's current position along
// it (0 = at sunrise, 1 = at/after sunset) - real progress, computed by the
// caller from the actual current time vs. real sunrise/sunset strings, not
// a decorative animation.
export const SunArcGauge = ({ width = 140, height = 60, progress = 0 }) => {
    const cx = width / 2;
    const cy = height - 4;
    const r = height - 10;
    const clamped = Math.max(0, Math.min(1, progress));
    const arcPath = describeArc(cx, cy, r, 180, 360);
    const markerAngle = 180 + 180 * clamped;
    const markerPos = polarToCartesian(cx, cy, r, markerAngle);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            <path d={arcPath} fill="none" stroke="var(--surface-inset)" strokeWidth="4" strokeLinecap="round" />
            <path
                d={describeArc(cx, cy, r, 180, markerAngle)}
                fill="none" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round"
            />
            <circle cx={markerPos.x} cy={markerPos.y} r="5" fill="#F59E0B" stroke="var(--bg-surface)" strokeWidth="2" />
        </svg>
    );
};
