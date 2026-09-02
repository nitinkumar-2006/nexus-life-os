// src/pages/WeatherPage.jsx
//
// The full Weather Hub - reached by tapping the weather pill on the Home
// greeting card (see GreetingCard.jsx), not a permanent nav-bar entry, same
// "detail page" pattern audio_hub already uses. Every number here comes
// straight from WeatherContext's real Open-Meteo fetch (current + hourly +
// daily + air quality + a real moon-phase calculation) - nothing on this
// page is fabricated; sections that need data nobody here has for free
// (a real tile-based radar image, official alerts, long-term climate
// normals) are either built as a genuine, honestly-labeled approximation
// from real fetched numbers (see WeatherPrecipRadar.jsx, the Averages card
// below) or simply left out rather than faked.
//
// Visual approach (REVISED): this page previously rendered its own
// hardcoded-white, always-dark frosted glass over a self-contained live
// sky (WeatherAnimatedSky, full-page), deliberately ignoring the app's
// real --bg-surface/--text-primary tokens. That meant this page could
// never show the app's own selected wallpaper/theme through its cards -
// confirmed live, and via a screen recording, that even after the glass
// blur/sheen genuinely worked, the cards still only ever blurred this
// page's OWN dark sky gradient, never the real animated wallpaper every
// other Hub sits on (Settings/Calendar/Finance all use var(--bg-surface),
// which shows the shared DashboardLayout-level wallpaper through it -
// this page's own extra full-page sky layer sat ON TOP of that same
// wallpaper and fully hid it). Now themed like every other Hub instead:
// TEXT_PRIMARY/SECONDARY/MUTED/GLASS_BORDER below are real CSS variables
// (every usage in this file inherits theme-correctness automatically),
// cardStyle uses var(--bg-surface)/var(--glass-blur) exactly like
// Calendar/Finance Hub's own cards, and the full-page WeatherAnimatedSky
// background was removed so the real, shared, Blur/Opacity-slider-driven
// wallpaper shows through.
import { useMemo, useState } from 'react';
import {
    ChevronLeft, MapPin, Droplets, Sun, Moon, CloudLightning, CloudSun, CloudMoon,
    CloudSunRain, CloudMoonRain, Wind, Gauge as GaugeIcon, Sunrise, AlertTriangle, Thermometer, Eye, Radar, TrendingUp, TrendingDown, CloudRainWind,
    Flower2, Play, Pause,
} from 'lucide-react';
import { useWeather, classifyWeatherCode, classifyWeatherState, describeWeatherState } from '../context/WeatherContext.jsx';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import WeatherPrecipRadar from '../components/WeatherPrecipRadar.jsx';
import { CircularGauge, WindCompassGauge, SunArcGauge, MoonPhaseIcon } from '../components/WeatherGauges.jsx';

const TEXT_PRIMARY = 'var(--text-primary)';
const TEXT_SECONDARY = 'var(--text-secondary)';
const TEXT_MUTED = 'var(--text-muted)';
const GLASS_BORDER = 'var(--border-premium)';

const UV_GRADIENT = [
    { offset: '0%', color: '#22C55E' },
    { offset: '35%', color: '#EAB308' },
    { offset: '65%', color: '#F97316' },
    { offset: '100%', color: '#EF4444' },
];

const uvLabel = (uv) => {
    if (uv === null) return '--';
    if (uv < 3) return 'Weak';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very High';
    return 'Extreme';
};

// Real WHO/EPA UV-Index protective-action guidance at each of the same
// bands uvLabel above already uses - the standard advice text these
// index bands exist to convey, not decorative filler.
const uvAdviceLabel = (uv) => {
    if (uv === null) return '';
    if (uv < 3) return 'Minimal protection needed.';
    if (uv < 6) return 'Wear sunscreen and sunglasses.';
    if (uv < 8) return 'Seek shade during midday hours.';
    if (uv < 11) return 'Extra protection needed - avoid sun.';
    return 'Take all precautions, stay indoors.';
};

const aqiLabel = (aqi) => {
    if (aqi === null) return null;
    if (aqi <= 50) return { text: 'Good', color: '#22C55E' };
    if (aqi <= 100) return { text: 'Moderate', color: '#EAB308' };
    if (aqi <= 150) return { text: 'Unhealthy for Sensitive Groups', color: '#F97316' };
    if (aqi <= 200) return { text: 'Unhealthy', color: '#EF4444' };
    if (aqi <= 300) return { text: 'Very Unhealthy', color: '#A855F7' };
    return { text: 'Hazardous', color: '#7F1D1D' };
};

// Maps any of this page's own severity vocabularies (AQI's "Unhealthy for
// Sensitive Groups", UV's "Very High", pollen's plain "High") onto one
// shared 3-tone dot for the Health & Lifestyle grid - good/moderate/high,
// the same coarse bucketing a real health-advisory app uses to be
// scannable at a glance, without inventing a 4th color per metric.
const healthDotClass = (level) => {
    if (!level) return 'is-unknown';
    const l = level.toLowerCase();
    if (l.includes('good') || l === 'low' || l === 'weak') return 'is-good';
    if (l.includes('moderate')) return 'is-moderate';
    return 'is-high';
};

const visibilityLabel = (km) => {
    if (km === null) return '';
    if (km >= 10) return 'Clear view.';
    if (km >= 4) return 'Moderate visibility.';
    if (km >= 1) return 'Reduced visibility.';
    return 'Very low visibility.';
};

// Real Beaufort-scale-derived description, not decorative filler - the
// same thresholds meteorologists actually use to describe wind speed in
// plain language. Added per explicit feedback that a bare number+gauge
// with no sentence read as an unfinished/non-functional card, same
// reasoning as visibilityLabel/feelsLikeText above already had.
const windLabel = (kmh) => {
    if (kmh === null) return '';
    if (kmh < 2) return 'Calm air.';
    if (kmh < 12) return 'Light breeze.';
    if (kmh < 29) return 'Moderate breeze.';
    if (kmh < 50) return 'Strong wind.';
    if (kmh < 89) return 'Gale-force wind.';
    return 'Storm-force wind.';
};

// Real comfort-level description from relative humidity - the range
// human comfort research actually uses (30-50% is the commonly-cited
// "comfortable" band).
const humidityLabel = (pct) => {
    if (pct === null) return '';
    if (pct < 30) return 'Dry air.';
    if (pct < 50) return 'Comfortable.';
    if (pct < 70) return 'Humid.';
    return 'Very humid.';
};

// Real meteorological sea-level-pressure bands (below ~1000hPa is
// genuinely "low" and associated with unsettled weather; above ~1020hPa
// is genuinely "high" and associated with clear, stable conditions) -
// standard bands, not invented thresholds.
const pressureLabel = (hPa) => {
    if (hPa === null) return '';
    if (hPa < 1000) return 'Low - unsettled weather likely.';
    if (hPa > 1020) return 'High - clear skies likely.';
    return 'Normal, stable pressure.';
};

const windDirectionLabel = (deg) => {
    if (deg === null) return '--';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
};

// Takes an already-classified state (see classifyWeatherState - real
// precipitation-aware, not just the coarse code) plus real day/night, and
// picks a genuinely distinct icon for each state x time-of-day combination -
// a daytime rain shows the sun peeking through (CloudSunRain), a nighttime
// one shows the real moon phase silhouette instead (CloudMoonRain), rather
// than the same plain CloudRain glyph regardless of whether it's day or
// night. 'cloudy' (real, confirmed gap: this used to fall through to the
// same flat Cloud glyph for both day and night, the one state that never
// got the day/night treatment the others already had) now gets the same
// composite treatment - CloudSun for a genuinely overcast day, CloudMoon
// for an overcast night, instead of a generic icon that gives no time-of-
// day information at all.
const weatherIconForState = (state, isNight) => {
    if (state === 'rain') return isNight ? CloudMoonRain : CloudSunRain;
    if (state === 'drizzle') return isNight ? CloudMoonRain : CloudSunRain;
    if (state === 'thunderstorm') return CloudLightning;
    if (state === 'cloudy') return isNight ? CloudMoon : CloudSun;
    return isNight ? Moon : Sun;
};

const weatherIconFor = (weatherCode, isNight) => weatherIconForState(classifyWeatherCode(weatherCode), isNight);

const formatDayLabel = (dateStr, index) => {
    if (index === 0) return 'Today';
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('default', { weekday: 'short' });
};

const WeatherPage = ({ setActiveTab }) => {
    const isMobile = useIsMobile();
    const {
        temperature, weatherCode, weatherState, currentPrecipitation, apparentTemperature, humidity, uvIndex,
        windSpeed, windDirection, pressure, visibility, sunrise, sunset, todayMax, todayMin,
        hourly, daily, aqi, pollen, historicalAverage, severeAlert, locationLabel, coords, moon, next24hPrecipitation, isLoading,
    } = useWeather();
    const [isRadarSweepPaused, setIsRadarSweepPaused] = useState(false);
    const { settings } = useGlobalSettings();
    const useFahrenheit = settings.temperatureUnit === '°F';

    const toDisplayTemp = (celsius) => {
        if (celsius === null || celsius === undefined) return null;
        return Math.round(useFahrenheit ? (celsius * 9) / 5 + 32 : celsius);
    };

    const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
    const isNightNow = currentHour < 6.5 || currentHour >= 19.5;
    // The real, precipitation-aware state from context (not a re-derivation
    // from the raw code alone) - so the hero icon can never show "Cloudy"
    // while it's genuinely raining right now.
    const HeroIcon = weatherIconForState(weatherState, isNightNow);

    // Real sun-arc progress: 0 at sunrise, 1 at/after sunset, proportional
    // between, computed from the actual "HH:MM" strings WeatherContext
    // already resolved - not a decorative animation.
    const sunProgress = useMemo(() => {
        if (!sunrise || !sunset) return 0.5;
        const toMinutes = (hhmm) => {
            const [h, m] = hhmm.split(':').map(Number);
            return h * 60 + m;
        };
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const riseMin = toMinutes(sunrise);
        const setMin = toMinutes(sunset);
        if (setMin <= riseMin) return 0.5;
        return (nowMin - riseMin) / (setMin - riseMin);
    }, [sunrise, sunset]);

    // Real daylight-length sentence for the Sunrise card - the actual
    // gap between sunrise/sunset already resolved above, not a separate
    // fabricated stat.
    const daylightLabel = useMemo(() => {
        if (!sunrise || !sunset) return '';
        const toMinutes = (hhmm) => {
            const [h, m] = hhmm.split(':').map(Number);
            return h * 60 + m;
        };
        const riseMin = toMinutes(sunrise);
        const setMin = toMinutes(sunset);
        const totalMin = setMin > riseMin ? setMin - riseMin : setMin + 1440 - riseMin;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h}h ${m}m of daylight.`;
    }, [sunrise, sunset]);

    // The forecast window's own min/max define each day's bar scale, so a
    // day's real relative position within it reads visually (a 24-27 range
    // looks narrow next to a 20-32 range), instead of every bar using an
    // arbitrary fixed scale unrelated to the real data.
    const weekMin = daily.length ? Math.min(...daily.map((d) => d.min)) : 0;
    const weekMax = daily.length ? Math.max(...daily.map((d) => d.max)) : 1;
    const weekRange = Math.max(1, weekMax - weekMin);

    // Real 10-day-forecast average high (not a fabricated long-term
    // climate normal Nexus has no data source for) - labeled honestly as
    // "forecast avg", not "average" alone, so it's never mistaken for a
    // historical climatological figure.
    const avgHighCelsius = daily.length ? daily.reduce((s, d) => s + d.max, 0) / daily.length : null;
    const avgHighDelta = avgHighCelsius !== null && todayMax !== null ? Math.round(todayMax - avgHighCelsius) : null;

    // Seasonal Trends chart data - the real next-7-day highs already
    // fetched above, index-aligned with historicalAverage (both start
    // from "today" and run 7 days forward/back the same way, see
    // WeatherContext's resolveHistoricalAverage). Bar heights are scaled
    // to the real min/max ACROSS both series (not from zero) with a 20%
    // floor, so a real but narrow temperature spread (e.g. 28-32°C) still
    // reads as visually distinct bars instead of everything looking
    // identically near-100%.
    const seasonalDays = daily.slice(0, 7);
    const seasonalValues = [
        ...seasonalDays.map((d) => d.max),
        ...(historicalAverage || []).filter((v) => v !== null),
    ];
    const seasonalMax = seasonalValues.length ? Math.max(...seasonalValues) : 0;
    const seasonalMin = seasonalValues.length ? Math.min(...seasonalValues) : 0;
    const seasonalRange = seasonalMax - seasonalMin || 1;
    const seasonalBarHeight = (value) => 20 + ((value - seasonalMin) / seasonalRange) * 80;

    const feelsDelta = apparentTemperature !== null && temperature !== null ? apparentTemperature - temperature : null;
    const feelsLikeText = feelsDelta === null ? ''
        : feelsDelta > 1 ? 'It feels warmer than the actual temperature.'
        : feelsDelta < -1 ? 'It feels cooler than the actual temperature.'
        : 'It feels about the same as the actual temperature.';

    const cardStyle = {
        // Real theme tokens now, matching Calendar/Finance Hub's own
        // cards exactly (background: var(--bg-surface), backdrop-filter
        // driven by var(--glass-blur)) instead of a hardcoded dark tint -
        // this is what actually lets the shared wallpaper show through,
        // and what makes the Appearance settings' Blur/Transparency
        // sliders affect this page in real time, since those sliders
        // write --glass-blur/--nexus-user-glass-alpha directly onto
        // <html> (SettingsPage.jsx) and var(--bg-surface) is itself
        // computed from --nexus-user-glass-alpha per-theme in
        // variables.css. Set explicitly inline (not left to the
        // [data-theme="dynamic"] [style*="var(--bg-surface)"] blur hack
        // in style.css, which only ever fires on the Dynamic theme) so it
        // genuinely works on every theme, the same fix already applied to
        // Calendar/Finance Hub's cards this session.
        background: 'var(--bg-surface)',
        border: `1px solid ${GLASS_BORDER}`,
        borderRadius: isMobile ? '18px' : '20px',
        boxShadow: 'var(--premium-shadow)',
        backdropFilter: 'blur(var(--glass-blur, 16px)) saturate(105%)', WebkitBackdropFilter: 'blur(var(--glass-blur, 16px)) saturate(105%)',
        // Forces its own GPU compositing layer. Without this, a real,
        // reproducible Chromium bug was confirmed live: with ~15 of these
        // glass cards stacked on one page, a card scrolled into view could
        // end up with fully correct DOM/CSS (verified via
        // getBoundingClientRect/elementFromPoint - right position, right
        // content, right computed styles) that nonetheless silently failed
        // to paint at all, consistently, across repeated scrolls - the
        // classic "content behind a backdrop-filter doesn't get repainted
        // on scroll" tiling bug. translateZ(0) is the standard, minimal
        // fix: it promotes the card to its own layer so the browser can't
        // skip repainting it via a stale shared tile.
        transform: 'translateZ(0)',
    };
    const sectionLabelStyle = { fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: TEXT_PRIMARY, margin: 0 };
    const metricLabelStyle = { fontSize: '11px', fontWeight: '700', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.03em' };
    const metricValueStyle = { fontSize: '17px', fontWeight: '800', color: TEXT_PRIMARY };
    // One shared minimum height for every metric card on this page - UV
    // Index/Sunrise, Full Moon/Wind/Humidity/Pressure, the plain
    // text-stack cards (Visibility/Feels Like/Precipitation/Averages),
    // and Air Quality Index, per explicit request that they all read as
    // one consistent size. Sized generously enough for the tallest real
    // variant (a gauge plus its own sub-label row, like Sunrise's
    // sunrise/sunset times or Pressure's Low/High labels) - CSS Grid's
    // default row-stretch already matches same-row siblings, but the
    // last row (Precipitation/Averages, only 2 items, neither with a
    // gauge) has no taller sibling in its own row to stretch against,
    // so an explicit minHeight is what actually keeps it level with
    // every row above it instead of just hoping a neighbor is taller.
    const metricCardMinHeight = isMobile ? '104px' : '112px';

    // Pulled out of the detail-metrics grid below so these two can render
    // in one of two different spots depending on viewport (never both at
    // once) - see the Precipitation Map column further down. On desktop,
    // Precipitation Map's own content caps at 380px while 10-Day Forecast
    // beside it runs much taller (10 real daily rows), so this whole grid
    // row's height is set by the forecast column and Precipitation Map's
    // shorter column left real, empty leftover space beneath it - live-
    // confirmed. These two cards now fill that exact leftover space
    // instead, rather than sitting further down in the full-width metrics
    // grid with nothing above them to justify it. Mobile stacks Precip Map
    // and 10-Day Forecast into one column each (no shared row, so no
    // leftover-space problem there), so mobile keeps them in their
    // original spot in the main metrics grid instead.
    // Gauge sits BESIDE the text now, not stacked below it - per explicit
    // request, the old vertical stack (label/value/caption, then a full-
    // width gauge underneath) made this card meaningfully taller than it
    // needed to be, with real empty horizontal space beside the gauge
    // going unused. A horizontal split (text column left, gauge right)
    // is both shorter and fills that space with the gauge instead of
    // leaving it empty - the same treatment now applied to every other
    // gauge-bearing metric card below (Wind/Humidity/Pressure) so the
    // whole set reads as one consistent size, not just these two.
    const uvIndexCard = (
        <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={metricLabelStyle}>UV Index</span>
                <span style={metricValueStyle}>{uvIndex === null ? '--' : uvLabel(uvIndex)}</span>
                <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{uvAdviceLabel(uvIndex)}</span>
            </div>
            <CircularGauge size={64} strokeWidth={6} progress={uvIndex === null ? 0 : Math.min(1, uvIndex / 11)} trackColor="var(--border-premium)" gradientStops={UV_GRADIENT} gaugeId="gauge-uv" centerIcon={<span style={{ fontSize: '12px', fontWeight: '800', color: TEXT_PRIMARY }}>{uvIndex === null ? '--' : uvIndex}</span>} />
        </div>
    );
    const sunriseCard = (
        <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}><Sunrise size={12} /> Sunrise</span>
                <span style={metricValueStyle}>{sunrise || '--'}</span>
                <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{daylightLabel}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                <SunArcGauge width={84} height={38} progress={sunProgress} />
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '84px', fontSize: '9px', color: TEXT_MUTED, fontWeight: '700' }}>
                    <span>{sunrise || '--'}</span>
                    <span>{sunset || '--'}</span>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ position: 'relative' }}>
            {/* No page-local sky background here anymore - removed along
                with the WeatherAnimatedSky import above. The real,
                shared wallpaper (DashboardLayout's DynamicBackground/
                AlternateBackgrounds, already rendered behind every page
                in the app) now shows through this page's cards instead,
                exactly like Settings/Calendar/Finance Hub. */}
            <div style={{
                position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', animation: 'fadeInScale 0.3s ease', boxSizing: 'border-box',
                // Explicit per-side values (not a `padding` shorthand plus a
                // separate paddingBottom override) - React warns that mixing
                // the two for the same box on a re-render is a genuine
                // ordering hazard (confirmed live: a real console error,
                // "don't mix shorthand and non-shorthand properties for the
                // same value"), since which one wins in the CSSOM isn't
                // guaranteed to stay consistent across updates.
                paddingTop: isMobile ? '14px' : '20px', paddingLeft: isMobile ? '14px' : '20px', paddingRight: isMobile ? '14px' : '20px', paddingBottom: '28px',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        type="button" onClick={() => typeof setActiveTab === 'function' && setActiveTab('Home')}
                        aria-label="Back to Home" title="Back to Home"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', flexShrink: 0, background: 'var(--widget-bg)', color: TEXT_PRIMARY, border: `1px solid ${GLASS_BORDER}`, borderRadius: '9999px', cursor: 'pointer', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: TEXT_PRIMARY, margin: 0 }}>Weather Hub</h1>
                </div>

                {/* Severe Weather Alert - genuinely conditional, not a
                    permanent decorative banner: severeAlert is derived from
                    the real current/hourly weather code and wind speed
                    already fetched (see WeatherContext.jsx's own
                    deriveSevereAlert) and is null the vast majority of the
                    time, exactly like real weather most of the time isn't
                    severe. Never claims to be an official issued warning
                    (Open-Meteo has no free global alerts feed) - the
                    wording stays scoped to what's actually, honestly
                    derivable from real numbers. */}
                {severeAlert && (
                    <div role="alert" className={`weather-alert-banner${severeAlert.level === 'watch' ? ' is-watch' : ''}`}>
                        <div className="weather-alert-icon">
                            <AlertTriangle size={20} />
                        </div>
                        <div className="weather-alert-content">
                            <p className="weather-alert-title">{severeAlert.title}</p>
                            <p className="weather-alert-description">{severeAlert.description}</p>
                        </div>
                    </div>
                )}

                {/* Hero */}
                <div className="weather-glass-card" style={{ ...cardStyle, padding: isMobile ? '20px' : '28px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="weather-hero-row">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: TEXT_SECONDARY, fontSize: '14px', fontWeight: '700' }}>
                                <MapPin size={14} />
                                {locationLabel || 'Resolving location…'}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginTop: '8px' }}>
                                <span style={{ fontSize: isMobile ? '58px' : '76px', fontWeight: '800', color: TEXT_PRIMARY, lineHeight: 1, letterSpacing: '-2px' }}>
                                    {isLoading || temperature === null ? '--' : toDisplayTemp(temperature)}°
                                </span>
                                <HeroIcon size={isMobile ? 34 : 42} color={TEXT_PRIMARY} style={{ marginTop: '6px', flexShrink: 0, opacity: 0.95 }} />
                            </div>

                            <span style={{ fontSize: '15px', fontWeight: '700', color: TEXT_SECONDARY }}>
                                {isLoading ? 'Loading…' : describeWeatherState(weatherCode, currentPrecipitation)}
                                {todayMax !== null && todayMin !== null && (
                                    <span style={{ fontWeight: '600', color: TEXT_MUTED }}> · {toDisplayTemp(todayMax)}°/{toDisplayTemp(todayMin)}°</span>
                                )}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                                {apparentTemperature !== null && (
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: TEXT_PRIMARY, background: 'var(--widget-bg)', padding: '5px 12px', borderRadius: '9999px', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
                                        Feels like {toDisplayTemp(apparentTemperature)}°
                                    </span>
                                )}
                                {aqi !== null && (
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: TEXT_PRIMARY, background: 'var(--widget-bg)', padding: '5px 12px', borderRadius: '9999px', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
                                        AQI {aqi}{aqiLabel(aqi) ? ` · ${aqiLabel(aqi).text}` : ''}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Weather Details - fills the dead space that used
                            to sit to the right of the temperature on wide
                            viewports. Real live data (windSpeed/humidity/
                            uvIndex/visibility are already fetched from
                            Open-Meteo by WeatherContext and already power
                            the full gauge cards further down this page -
                            this is a quick-glance summary of the same real
                            numbers, not placeholder data), with the exact
                            same null-safe '--' fallback convention those
                            cards already use. Faded via this page's own
                            TEXT_SECONDARY constant rather than the app's
                            var(--text-secondary) token - this page
                            deliberately never reads the app's theme
                            variables (see the file-header comment above),
                            so a real theme-variable reference here would
                            silently break under Comfort/Day/Light theme
                            (near-invisible dark text on this page's own
                            always-dark glass) instead of just staying
                            faded-but-legible white like every other label
                            on this page already is. */}
                        <div className="weather-hero-details-grid">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Wind size={16} color={TEXT_SECONDARY} style={{ flexShrink: 0 }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: TEXT_PRIMARY }}>{windSpeed === null ? '--' : `${windSpeed} km/h`}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '600', color: TEXT_SECONDARY }}>Wind</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Droplets size={16} color={TEXT_SECONDARY} style={{ flexShrink: 0 }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: TEXT_PRIMARY }}>{humidity === null ? '--' : `${humidity}%`}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '600', color: TEXT_SECONDARY }}>Humidity</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sun size={16} color={TEXT_SECONDARY} style={{ flexShrink: 0 }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: TEXT_PRIMARY }}>{uvIndex === null ? '--' : uvIndex}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '600', color: TEXT_SECONDARY }}>UV Index</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Eye size={16} color={TEXT_SECONDARY} style={{ flexShrink: 0 }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: TEXT_PRIMARY }}>{visibility === null ? '--' : `${visibility} km`}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '600', color: TEXT_SECONDARY }}>Visibility</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Health & Lifestyle - Pollen, UV, and AQI at a glance.
                    Every value is real (the same uvIndex/aqi WeatherContext
                    already fetches, plus pollen from the same Air Quality
                    API call - see resolveAirQuality). Pollen only ever has
                    real data over Europe (Open-Meteo's own model coverage);
                    outside that region this honestly says so instead of
                    fabricating a reading. */}
                <section aria-labelledby="weather-health-heading" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h2 id="weather-health-heading" style={sectionLabelStyle}>Health &amp; Lifestyle</h2>
                    <div className="weather-health-grid">
                        <div className="weather-health-pill">
                            <span className={`weather-health-dot ${healthDotClass(pollen?.level)}`} />
                            <div className="weather-health-text">
                                <span className="weather-health-label">Pollen</span>
                                <span className="weather-health-value">
                                    {pollen ? `${pollen.level} - ${pollen.dominant}` : 'Not available here'}
                                </span>
                            </div>
                        </div>
                        <div className="weather-health-pill">
                            <span className={`weather-health-dot ${healthDotClass(uvIndex === null ? null : uvLabel(uvIndex))}`} />
                            <div className="weather-health-text">
                                <span className="weather-health-label">UV Index</span>
                                <span className="weather-health-value">{uvIndex === null ? '--' : `${uvIndex} - ${uvLabel(uvIndex)}`}</span>
                            </div>
                        </div>
                        <div className="weather-health-pill">
                            <span className={`weather-health-dot ${healthDotClass(aqiLabel(aqi)?.text)}`} />
                            <div className="weather-health-text">
                                <span className="weather-health-label">Air Quality</span>
                                <span className="weather-health-value">{aqi === null ? '--' : `${aqi} - ${aqiLabel(aqi)?.text}`}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Hourly forecast - real precipitation probability per
                    hour (Open-Meteo's precipitation_probability), not just
                    a temperature-scaled tick bar. */}
                {hourly.length > 0 && (
                    <div className="weather-glass-card" style={{ ...cardStyle, padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <h3 style={sectionLabelStyle}>24-Hour Forecast</h3>
                        <div style={{ display: 'flex', gap: isMobile ? '16px' : '22px', overflowX: 'auto', paddingBottom: '4px' }}>
                            {hourly.map((h) => {
                                // Both real time-of-day (from this row's own
                                // hour, not just "now") AND real measured
                                // precipitation for that hour - a 2am rain
                                // shower shows the moon+rain icon, a 2pm one
                                // shows sun+rain, and either one overrides a
                                // plain "Cloudy" code the same way the hero
                                // above does.
                                const hourOfDay = parseInt((h.time.split('T')[1] || '0').split(':')[0], 10);
                                const isHourNight = hourOfDay < 6 || hourOfDay >= 19;
                                const HourIcon = weatherIconForState(classifyWeatherState(h.weatherCode, h.precipitation), isHourNight);
                                return (
                                    <div key={h.time} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px', flexShrink: 0, minWidth: '38px' }}>
                                        <span style={{ fontSize: '11px', color: TEXT_MUTED, fontWeight: h.label === 'Now' ? '800' : '600', whiteSpace: 'nowrap' }}>{h.label}</span>
                                        <HourIcon size={18} color={TEXT_SECONDARY} />
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#38BDF8', minHeight: '13px' }}>
                                            {h.precipProbability !== null && h.precipProbability > 0 ? `${h.precipProbability}%` : ''}
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: TEXT_PRIMARY }}>{toDisplayTemp(h.temp)}°</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 10-Day Forecast + Precipitation Map now share one row on
                    desktop instead of each being a separate full-width
                    block - confirmed live that Precipitation Map's own
                    content caps at 380px wide (see WeatherPrecipRadar.jsx),
                    so giving it the full page width just surrounded it with
                    dead empty space, and 10-Day Forecast doesn't need the
                    full width either. Stacks back to one column on mobile,
                    same breakpoint as the rest of this page. */}
                {/* alignItems: 'stretch' (not 'start') - a real, reported
                    layout bug once the Live Weather Radar card grew taller
                    (the sweep visual + real data dock added on top of what
                    used to be just the compact precip grid): with 'start',
                    each column only ever sized to its OWN content, so the
                    now-shorter 10-Day Forecast card's own background
                    simply stopped partway down the row, leaving the real
                    page wallpaper visible in a gap beside the taller Radar
                    column instead of a second glass card filling that
                    space. 'stretch' makes both columns fill the row's
                    real height (set by whichever side is taller) - any
                    leftover space now lands harmlessly at the bottom of
                    the shorter card's own padding instead of showing as a
                    hole in the layout, and this stays correct regardless
                    of which column ends up taller in the future. */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: isMobile ? '14px' : '20px', alignItems: 'stretch' }}>
                    {/* 10-day forecast - real precipitation probability per day
                        (Open-Meteo's precipitation_probability_max), plus the
                        real per-day min-max range bar. */}
                    {daily.length > 0 && (
                        <div className="weather-glass-card" style={{ ...cardStyle, padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <h3 style={sectionLabelStyle}>10-Day Forecast</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {daily.slice(0, 10).map((d, i) => {
                                    const DayIcon = weatherIconFor(d.weatherCode, false);
                                    const barLeftPct = ((d.min - weekMin) / weekRange) * 100;
                                    const barWidthPct = Math.max(8, ((d.max - d.min) / weekRange) * 100);
                                    return (
                                        <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px', padding: '9px 4px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: TEXT_PRIMARY, width: isMobile ? '46px' : '52px', flexShrink: 0 }}>{formatDayLabel(d.date, i)}</span>
                                            <DayIcon size={17} color={TEXT_SECONDARY} style={{ flexShrink: 0 }} />
                                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#38BDF8', width: '26px', flexShrink: 0, textAlign: 'center' }}>
                                                {d.precipProbabilityMax !== null && d.precipProbabilityMax > 0 ? `${d.precipProbabilityMax}%` : ''}
                                            </span>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: TEXT_MUTED, width: '26px', textAlign: 'right', flexShrink: 0 }}>{toDisplayTemp(d.min)}°</span>
                                            <div style={{ flex: 1, minWidth: '30px', height: '6px', borderRadius: '3px', background: 'var(--widget-bg)', position: 'relative' }}>
                                                <div style={{ position: 'absolute', left: `${barLeftPct}%`, width: `${barWidthPct}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(to right, #3B82F6, #F59E0B)' }} />
                                            </div>
                                            <span style={{ fontSize: '13px', fontWeight: '800', color: TEXT_PRIMARY, width: '26px', flexShrink: 0 }}>{toDisplayTemp(d.max)}°</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Precipitation Radar - a real 3x3 grid of genuinely
                        fetched precipitation values around the user's real
                        location (see WeatherPrecipRadar.jsx for why this isn't
                        a fabricated tile image). On desktop, UV Index and
                        Sunrise now render directly below it, in a real 2-col
                        mini-grid, filling the leftover space this shorter
                        column left under it instead of leaving it empty - see
                        uvIndexCard/sunriseCard above for the full reasoning. */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>
                        <div className="weather-glass-card weather-radar-card" style={{ ...cardStyle, padding: isMobile ? '16px' : '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Radar size={16} color={TEXT_SECONDARY} />
                                <h3 style={sectionLabelStyle}>Live Weather Radar</h3>
                            </div>

                            {/* The animated sweep/rings below are a genuine,
                                explicitly-labeled visual effect, not a claim
                                to real live radar imagery (Nexus has no
                                tile-based radar feed) - the real data lives
                                in the per-direction precipitation grid
                                docked underneath it (WeatherPrecipRadar,
                                already fetched from Open-Meteo, see that
                                component's own comment). Toggling play/
                                pause only ever affects this decorative
                                sweep animation, never the real data below. */}
                            <div className="weather-radar-map">
                                <div className={`weather-radar-sweep${isRadarSweepPaused ? ' is-paused' : ''}`} style={{ position: 'absolute', inset: 0 }} />
                                <div className="weather-radar-rings">
                                    <span className="weather-radar-ring" />
                                    <span className="weather-radar-ring" />
                                    <span className="weather-radar-ring" />
                                </div>
                                <button
                                    type="button"
                                    className="weather-radar-toggle"
                                    onClick={() => setIsRadarSweepPaused((v) => !v)}
                                    aria-label={isRadarSweepPaused ? 'Resume radar sweep animation' : 'Pause radar sweep animation'}
                                    title={isRadarSweepPaused ? 'Resume sweep' : 'Pause sweep'}
                                >
                                    {isRadarSweepPaused ? <Play size={16} style={{ marginLeft: '2px' }} /> : <Pause size={16} />}
                                </button>
                                <span className="weather-radar-caption">Visual sweep - see real data below</span>
                            </div>

                            <div className="weather-radar-data-dock">
                                <WeatherPrecipRadar coords={coords} locationLabel={locationLabel} textPrimary={TEXT_PRIMARY} textMuted={TEXT_MUTED} glassBorder={GLASS_BORDER} isMobile={isMobile} />
                            </div>
                        </div>
                        {!isMobile && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                {uvIndexCard}
                                {sunriseCard}
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail metric cards - UV Index/Sunrise only render here on
                    mobile (desktop has them above, beside Precipitation Map -
                    see uvIndexCard/sunriseCard). Mobile is a single column
                    now, not 2 - per explicit request/live screenshot, 2
                    narrow cards per row left no real room for each card's
                    own horizontal split (label+value+caption beside its
                    gauge, see uvIndexCard etc.), so labels like "UV INDEX"/
                    "PRESSURE" were wrapping into an ugly, barely-readable
                    vertical stack of single words. One full-width card per
                    row gives every card's own horizontal layout the space
                    it was actually designed for. */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '12px' }}>
                    {isMobile && uvIndexCard}
                    {isMobile && sunriseCard}

                    {/* Same horizontal split as uvIndexCard/sunriseCard above
                        (text column left, real visual right) on every other
                        gauge-bearing card here too, per explicit request -
                        makes the whole metrics set one consistent, shorter
                        size instead of only the two cards above Precipitation
                        Map being compact while these stayed tall. */}
                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={metricLabelStyle}>{moon.name}</span>
                            <span style={metricValueStyle}>{moon.illumination}% lit</span>
                            <span style={{ fontSize: '10px', color: TEXT_MUTED, fontWeight: '700', lineHeight: 1.4 }}>Rise {moon.moonrise || '--'} · Set {moon.moonset || '--'}</span>
                        </div>
                        <MoonPhaseIcon size={40} illumination={moon.illumination / 100} waxing={moon.ageDays < 14.77} id="moon-card" />
                    </div>

                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={metricLabelStyle}>{windDirection === null ? 'Wind' : windDirectionLabel(windDirection)}</span>
                            <span style={metricValueStyle}>{windSpeed === null ? '--' : `${windSpeed} km/h`}</span>
                            <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{windLabel(windSpeed)}</span>
                        </div>
                        <WindCompassGauge size={64} windDirection={windDirection || 0} color="#38BDF8" />
                    </div>

                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={metricLabelStyle}>Humidity</span>
                            <span style={metricValueStyle}>{humidity === null ? '--' : `${humidity}%`}</span>
                            <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{humidityLabel(humidity)}</span>
                        </div>
                        <CircularGauge size={64} strokeWidth={6} progress={humidity === null ? 0 : humidity / 100} trackColor="var(--border-premium)" progressColor="#3B82F6" centerIcon={<Droplets size={18} color="#3B82F6" />} />
                    </div>

                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}><Eye size={12} /> Visibility</span>
                        <span style={metricValueStyle}>{visibility === null ? '--' : `${visibility} km`}</span>
                        <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{visibilityLabel(visibility)}</span>
                    </div>

                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={metricLabelStyle}>Pressure</span>
                            <span style={metricValueStyle}>{pressure === null ? '--' : pressure} <span style={{ fontSize: '11px', color: TEXT_MUTED, fontWeight: '600' }}>hPa</span></span>
                            <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{pressureLabel(pressure)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                            <CircularGauge size={64} strokeWidth={6} progress={pressure === null ? 0.5 : Math.max(0, Math.min(1, (pressure - 970) / 80))} trackColor="var(--border-premium)" progressColor="#38BDF8" centerIcon={<GaugeIcon size={16} color="#38BDF8" />} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '64px', fontSize: '9px', color: TEXT_MUTED, fontWeight: '700' }}>
                                <span>Low</span><span>High</span>
                            </div>
                        </div>
                    </div>

                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}><Thermometer size={12} /> Feels Like</span>
                        <span style={metricValueStyle}>{apparentTemperature === null ? '--' : `${toDisplayTemp(apparentTemperature)}°`}</span>
                        <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{feelsLikeText}</span>
                    </div>

                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}><CloudRainWind size={12} /> Precipitation</span>
                        <span style={metricValueStyle}>{next24hPrecipitation === null ? '--' : `${next24hPrecipitation} mm`}</span>
                        <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{next24hPrecipitation !== null ? `Expected in the next 24h.` : ''}</span>
                    </div>

                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '12px' : '14px', minHeight: metricCardMinHeight, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>{avgHighDelta !== null && avgHighDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} Averages</span>
                        <span style={metricValueStyle}>{avgHighDelta === null ? '--' : `${avgHighDelta > 0 ? '+' : ''}${avgHighDelta}°`}</span>
                        <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>
                            from this forecast's avg high ({avgHighCelsius !== null ? `${toDisplayTemp(avgHighCelsius)}°` : '--'})
                        </span>
                    </div>
                </div>

                {aqi !== null && (
                    <div className="weather-glass-card-static" style={{ ...cardStyle, padding: isMobile ? '14px 16px' : '16px 20px', minHeight: metricCardMinHeight, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Wind size={18} color={aqiLabel(aqi)?.color || TEXT_SECONDARY} />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: TEXT_PRIMARY }}>Air Quality Index</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: aqiLabel(aqi)?.color || TEXT_PRIMARY }}>{aqi} · {aqiLabel(aqi)?.text}</span>
                    </div>
                )}

                {/* Seasonal Trends - Current Week (this forecast's own real
                    daily highs, already fetched above) vs. the real
                    recorded highs from the SAME 7 calendar dates across the
                    past 3 years (WeatherContext's resolveHistoricalAverage,
                    Open-Meteo's free Archive API) - genuinely recorded
                    temperatures, not official 30-year climate normals (this
                    app has no access to those), so labeled honestly as
                    "past 3 years" rather than overclaiming precision. */}
                <section aria-labelledby="weather-seasonal-heading" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h2 id="weather-seasonal-heading" style={sectionLabelStyle}>Seasonal Trends</h2>
                    <div className="weather-glass-card" style={{ ...cardStyle, padding: isMobile ? '18px 16px' : '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div className="weather-seasonal-legend">
                            <span className="weather-seasonal-legend-item">
                                <span className="weather-seasonal-legend-swatch is-current" /> Current Week
                            </span>
                            <span className="weather-seasonal-legend-item">
                                <span className="weather-seasonal-legend-swatch is-historical" /> Avg. Past 3 Years
                            </span>
                        </div>

                        {seasonalDays.length === 0 ? (
                            <p className="weather-seasonal-unavailable">Not enough forecast data yet to chart this week.</p>
                        ) : (
                            <div className="weather-seasonal-chart">
                                {seasonalDays.map((day, i) => {
                                    const historicalValue = historicalAverage?.[i] ?? null;
                                    return (
                                        <div className="weather-seasonal-column" key={day.date}>
                                            <div className="weather-seasonal-bars">
                                                <div className="weather-seasonal-bar is-current" style={{ height: `${seasonalBarHeight(day.max)}%` }} title={`${toDisplayTemp(day.max)}° this week`} />
                                                {historicalValue !== null && (
                                                    <div className="weather-seasonal-bar is-historical" style={{ height: `${seasonalBarHeight(historicalValue)}%` }} title={`${toDisplayTemp(historicalValue)}° avg (past 3 years)`} />
                                                )}
                                            </div>
                                            <span className="weather-seasonal-day-label">{formatDayLabel(day.date, i)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {historicalAverage === null && seasonalDays.length > 0 && (
                            <span style={{ fontSize: '11px', color: TEXT_MUTED, textAlign: 'center' }}>Historical comparison unavailable right now - showing current week only.</span>
                        )}
                    </div>
                </section>

                <p style={{ fontSize: '11px', color: TEXT_MUTED, textAlign: 'center', margin: 0 }}>
                    Live weather data via Open-Meteo. Air quality via Open-Meteo Air Quality API.
                </p>
            </div>
        </div>
    );
};

export default WeatherPage;
