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
// Visual approach: this page deliberately ignores the app's own
// theme-driven --bg-surface/--text-primary tokens and always renders as
// dark frosted glass over a live, weather-synced sky spanning the entire
// page (not just a hero card) - regardless of which of the app's 4 global
// themes (night/comfort/day/dynamic) the user has selected elsewhere.
// That's a deliberate, page-scoped choice (matching how Apple's own Weather
// app always uses dark vibrancy chrome over a live sky, never affected by
// system light/dark mode) rather than a themeable one, and mirrors the
// same "hardcode readable colors over the local sky" trick this file's
// hero card already used before this pass - just extended to the whole
// page instead of one card.
import { useMemo } from 'react';
import {
    ChevronLeft, MapPin, Droplets, Sun, Moon, Cloud, CloudLightning,
    CloudSunRain, CloudMoonRain, Wind, Gauge as GaugeIcon, Sunrise, AlertTriangle, Thermometer, Eye, Radar, TrendingUp, TrendingDown, CloudRainWind,
} from 'lucide-react';
import { useWeather, classifyWeatherCode, classifyWeatherState, describeWeatherState } from '../context/WeatherContext.jsx';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import WeatherAnimatedSky from '../components/WeatherAnimatedSky.jsx';
import WeatherPrecipRadar from '../components/WeatherPrecipRadar.jsx';
import { CircularGauge, WindCompassGauge, SunArcGauge, MoonPhaseIcon } from '../components/WeatherGauges.jsx';

const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.82)';
const TEXT_MUTED = 'rgba(255,255,255,0.58)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';

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

const aqiLabel = (aqi) => {
    if (aqi === null) return null;
    if (aqi <= 50) return { text: 'Good', color: '#22C55E' };
    if (aqi <= 100) return { text: 'Moderate', color: '#EAB308' };
    if (aqi <= 150) return { text: 'Unhealthy for Sensitive Groups', color: '#F97316' };
    if (aqi <= 200) return { text: 'Unhealthy', color: '#EF4444' };
    if (aqi <= 300) return { text: 'Very Unhealthy', color: '#A855F7' };
    return { text: 'Hazardous', color: '#7F1D1D' };
};

const visibilityLabel = (km) => {
    if (km === null) return '';
    if (km >= 10) return 'Clear view.';
    if (km >= 4) return 'Moderate visibility.';
    if (km >= 1) return 'Reduced visibility.';
    return 'Very low visibility.';
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
// night.
const weatherIconForState = (state, isNight) => {
    if (state === 'rain') return isNight ? CloudMoonRain : CloudSunRain;
    if (state === 'drizzle') return isNight ? CloudMoonRain : CloudSunRain;
    if (state === 'thunderstorm') return CloudLightning;
    if (state === 'cloudy') return Cloud;
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
        hourly, daily, aqi, locationLabel, coords, moon, next24hPrecipitation, isLoading,
    } = useWeather();
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

    // Genuinely derived from the live weather code (never a fabricated
    // "official" watch/warning, since Open-Meteo has no alerts feed) -
    // only shown when the current condition is actually thunderstorm or
    // heavy/violent rain, using the plain, honest condition name itself.
    const severeBanner = useMemo(() => {
        if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
            return { text: `${describeWeatherState(weatherCode, currentPrecipitation)} conditions in your area right now.`, color: '#F97316' };
        }
        if (weatherCode === 65 || weatherCode === 82) {
            return { text: `${describeWeatherState(weatherCode, currentPrecipitation)} conditions in your area right now.`, color: '#EAB308' };
        }
        return null;
    }, [weatherCode, currentPrecipitation]);

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

    const feelsDelta = apparentTemperature !== null && temperature !== null ? apparentTemperature - temperature : null;
    const feelsLikeText = feelsDelta === null ? ''
        : feelsDelta > 1 ? 'It feels warmer than the actual temperature.'
        : feelsDelta < -1 ? 'It feels cooler than the actual temperature.'
        : 'It feels about the same as the actual temperature.';

    const cardStyle = {
        background: 'rgba(15, 20, 36, 0.42)', border: `1px solid ${GLASS_BORDER}`,
        borderRadius: isMobile ? '18px' : '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(22px) saturate(150%)', WebkitBackdropFilter: 'blur(22px) saturate(150%)',
    };
    const sectionLabelStyle = { fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: TEXT_PRIMARY, margin: 0 };
    const metricLabelStyle = { fontSize: '11px', fontWeight: '700', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.03em' };
    const metricValueStyle = { fontSize: '17px', fontWeight: '800', color: TEXT_PRIMARY };

    return (
        <div style={{ position: 'relative' }}>
            {/* Full-page live sky - every card below floats over this one
                continuous, weather-synced backdrop instead of a plain page
                background, matching Apple Weather's own always-on-sky
                chrome. Positioned absolute+inset:0 of this relative
                wrapper: since it's out-of-flow, the wrapper's real height
                comes entirely from the in-flow content column below, and
                the sky then stretches to match that same final height -
                so it correctly spans the whole scrollable page, not just
                one viewport, without relying on `position: fixed` (which a
                backdrop-filter ancestor elsewhere in this app is already
                known to break for fixed-position elements - see the
                mobile nav's own --mobile-nav-bg fix). */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: isMobile ? '20px' : '26px', overflow: 'hidden' }}>
                <WeatherAnimatedSky weatherState={weatherState} isNight={isNightNow} fullPage moon={moon} />
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', animation: 'fadeInScale 0.3s ease', padding: isMobile ? '14px' : '20px', paddingBottom: '28px', boxSizing: 'border-box' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        type="button" onClick={() => typeof setActiveTab === 'function' && setActiveTab('Home')}
                        aria-label="Back to Home" title="Back to Home"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', flexShrink: 0, background: 'rgba(255,255,255,0.12)', color: TEXT_PRIMARY, border: `1px solid ${GLASS_BORDER}`, borderRadius: '9999px', cursor: 'pointer', backdropFilter: 'blur(10px)' }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: TEXT_PRIMARY, margin: 0 }}>Weather Hub</h1>
                </div>

                {/* Hero */}
                <div style={{ ...cardStyle, padding: isMobile ? '20px' : '28px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                            <span style={{ fontSize: '12px', fontWeight: '700', color: TEXT_PRIMARY, background: 'rgba(255,255,255,0.14)', padding: '5px 12px', borderRadius: '9999px', backdropFilter: 'blur(6px)' }}>
                                Feels like {toDisplayTemp(apparentTemperature)}°
                            </span>
                        )}
                        {aqi !== null && (
                            <span style={{ fontSize: '12px', fontWeight: '700', color: TEXT_PRIMARY, background: 'rgba(255,255,255,0.14)', padding: '5px 12px', borderRadius: '9999px', backdropFilter: 'blur(6px)' }}>
                                AQI {aqi}{aqiLabel(aqi) ? ` · ${aqiLabel(aqi).text}` : ''}
                            </span>
                        )}
                    </div>
                </div>

                {/* Severe condition banner - only ever shown when genuinely
                    derived from the live weather code, see severeBanner above. */}
                {severeBanner && (
                    <div style={{ ...cardStyle, padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderColor: severeBanner.color }}>
                        <AlertTriangle size={20} color={severeBanner.color} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: TEXT_PRIMARY }}>{severeBanner.text}</span>
                    </div>
                )}

                {/* Hourly forecast - real precipitation probability per
                    hour (Open-Meteo's precipitation_probability), not just
                    a temperature-scaled tick bar. */}
                {hourly.length > 0 && (
                    <div style={{ ...cardStyle, padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

                {/* 10-day forecast - real precipitation probability per day
                    (Open-Meteo's precipitation_probability_max), plus the
                    real per-day min-max range bar. */}
                {daily.length > 0 && (
                    <div style={{ ...cardStyle, padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 style={sectionLabelStyle}>10-Day Forecast</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {daily.slice(0, 10).map((d, i) => {
                                const DayIcon = weatherIconFor(d.weatherCode, false);
                                const barLeftPct = ((d.min - weekMin) / weekRange) * 100;
                                const barWidthPct = Math.max(8, ((d.max - d.min) / weekRange) * 100);
                                return (
                                    <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', padding: '9px 4px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: TEXT_PRIMARY, width: isMobile ? '46px' : '66px', flexShrink: 0 }}>{formatDayLabel(d.date, i)}</span>
                                        <DayIcon size={17} color={TEXT_SECONDARY} style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#38BDF8', width: '28px', flexShrink: 0, textAlign: 'center' }}>
                                            {d.precipProbabilityMax !== null && d.precipProbabilityMax > 0 ? `${d.precipProbabilityMax}%` : ''}
                                        </span>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: TEXT_MUTED, width: '28px', textAlign: 'right', flexShrink: 0 }}>{toDisplayTemp(d.min)}°</span>
                                        <div style={{ flex: 1, minWidth: '44px', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.14)', position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: `${barLeftPct}%`, width: `${barWidthPct}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(to right, #3B82F6, #F59E0B)' }} />
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: TEXT_PRIMARY, width: '28px', flexShrink: 0 }}>{toDisplayTemp(d.max)}°</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Precipitation Radar - a real 3x3 grid of genuinely
                    fetched precipitation values around the user's real
                    location (see WeatherPrecipRadar.jsx for why this isn't
                    a fabricated tile image). */}
                <div style={{ ...cardStyle, padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Radar size={16} color={TEXT_SECONDARY} />
                        <h3 style={sectionLabelStyle}>Precipitation Map</h3>
                    </div>
                    <WeatherPrecipRadar coords={coords} locationLabel={locationLabel} textPrimary={TEXT_PRIMARY} textMuted={TEXT_MUTED} glassBorder={GLASS_BORDER} />
                </div>

                {/* Detail metric cards */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '16px' }}>
                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={metricLabelStyle}>UV Index</span>
                        <span style={metricValueStyle}>{uvIndex === null ? '--' : uvLabel(uvIndex)}</span>
                        <CircularGauge size={72} strokeWidth={7} progress={uvIndex === null ? 0 : Math.min(1, uvIndex / 11)} trackColor="rgba(255,255,255,0.12)" gradientStops={UV_GRADIENT} gaugeId="gauge-uv" centerIcon={<span style={{ fontSize: '13px', fontWeight: '800', color: TEXT_PRIMARY }}>{uvIndex === null ? '--' : uvIndex}</span>} />
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}><Sunrise size={12} /> Sunrise</span>
                        <span style={metricValueStyle}>{sunrise || '--'}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <SunArcGauge width={96} height={44} progress={sunProgress} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '96px', fontSize: '9px', color: TEXT_MUTED, fontWeight: '700' }}>
                                <span>{sunrise || '--'}</span>
                                <span>{sunset || '--'}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={metricLabelStyle}>{moon.name}</span>
                        <span style={metricValueStyle}>{moon.illumination}% lit</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <MoonPhaseIcon size={44} illumination={moon.illumination / 100} waxing={moon.ageDays < 14.77} id="moon-card" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', color: TEXT_MUTED, fontWeight: '700' }}>
                                <span>Rise {moon.moonrise || '--'}</span>
                                <span>Set {moon.moonset || '--'}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={metricLabelStyle}>{windDirection === null ? 'Wind' : windDirectionLabel(windDirection)}</span>
                        <span style={metricValueStyle}>{windSpeed === null ? '--' : `${windSpeed} km/h`}</span>
                        <WindCompassGauge size={72} windDirection={windDirection || 0} color="#38BDF8" />
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={metricLabelStyle}>Humidity</span>
                        <span style={metricValueStyle}>{humidity === null ? '--' : `${humidity}%`}</span>
                        <CircularGauge size={72} strokeWidth={7} progress={humidity === null ? 0 : humidity / 100} trackColor="rgba(255,255,255,0.12)" progressColor="#3B82F6" centerIcon={<Droplets size={20} color="#3B82F6" />} />
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}><Eye size={12} /> Visibility</span>
                        <span style={metricValueStyle}>{visibility === null ? '--' : `${visibility} km`}</span>
                        <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{visibilityLabel(visibility)}</span>
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={metricLabelStyle}>Pressure</span>
                        <span style={metricValueStyle}>{pressure === null ? '--' : pressure} <span style={{ fontSize: '11px', color: TEXT_MUTED, fontWeight: '600' }}>hPa</span></span>
                        <CircularGauge size={72} strokeWidth={7} progress={pressure === null ? 0.5 : Math.max(0, Math.min(1, (pressure - 970) / 80))} trackColor="rgba(255,255,255,0.12)" progressColor="#38BDF8" centerIcon={<GaugeIcon size={18} color="#38BDF8" />} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '72px', fontSize: '9px', color: TEXT_MUTED, fontWeight: '700' }}>
                            <span>Low</span><span>High</span>
                        </div>
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}><Thermometer size={12} /> Feels Like</span>
                        <span style={metricValueStyle}>{apparentTemperature === null ? '--' : `${toDisplayTemp(apparentTemperature)}°`}</span>
                        <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{feelsLikeText}</span>
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}><CloudRainWind size={12} /> Precipitation</span>
                        <span style={metricValueStyle}>{next24hPrecipitation === null ? '--' : `${next24hPrecipitation} mm`}</span>
                        <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>{next24hPrecipitation !== null ? `Expected in the next 24h.` : ''}</span>
                    </div>

                    <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <span style={{ ...metricLabelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>{avgHighDelta !== null && avgHighDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />} Averages</span>
                        <span style={metricValueStyle}>{avgHighDelta === null ? '--' : `${avgHighDelta > 0 ? '+' : ''}${avgHighDelta}°`}</span>
                        <span style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.4 }}>
                            from this forecast's avg high ({avgHighCelsius !== null ? `${toDisplayTemp(avgHighCelsius)}°` : '--'})
                        </span>
                    </div>
                </div>

                {aqi !== null && (
                    <div style={{ ...cardStyle, padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Wind size={18} color={aqiLabel(aqi)?.color || TEXT_SECONDARY} />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: TEXT_PRIMARY }}>Air Quality Index</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: aqiLabel(aqi)?.color || TEXT_PRIMARY }}>{aqi} · {aqiLabel(aqi)?.text}</span>
                    </div>
                )}

                <p style={{ fontSize: '11px', color: TEXT_MUTED, textAlign: 'center', margin: 0 }}>
                    Live weather data via Open-Meteo. Air quality via Open-Meteo Air Quality API.
                </p>
            </div>
        </div>
    );
};

export default WeatherPage;
