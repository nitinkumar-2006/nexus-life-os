// src/pages/WeatherPage.jsx
//
// The full Weather Hub - reached by tapping the weather pill on the Home
// greeting card (see GreetingCard.jsx), not a permanent nav-bar entry,
// same "detail page" pattern audio_hub already uses. Every number here
// comes straight from WeatherContext's real Open-Meteo fetch (current +
// hourly + daily + air quality) - nothing on this page is fabricated;
// sections that need data WeatherContext doesn't have (e.g. a real
// meteorological-agency alert feed) are simply left out rather than faked.
import { useMemo } from 'react';
import {
    ChevronLeft, MapPin, Droplets, Sun, Moon, Cloud, CloudDrizzle, CloudRain, CloudLightning,
    Wind, Gauge as GaugeIcon, Sunrise, AlertTriangle, Thermometer,
} from 'lucide-react';
import { useWeather, classifyWeatherCode, describeWeatherCode } from '../context/WeatherContext.jsx';
import { useGlobalSettings } from '../context/GlobalUserSettingsContext.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import WeatherAnimatedSky from '../components/WeatherAnimatedSky.jsx';
import { CircularGauge, WindCompassGauge, SunArcGauge } from '../components/WeatherGauges.jsx';

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

const windDirectionLabel = (deg) => {
    if (deg === null) return '--';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
};

const weatherIconFor = (weatherCode, isNight) => {
    const state = classifyWeatherCode(weatherCode);
    if (state === 'rain') return CloudRain;
    if (state === 'drizzle') return CloudDrizzle;
    if (state === 'thunderstorm') return CloudLightning;
    if (state === 'cloudy') return Cloud;
    return isNight ? Moon : Sun;
};

const formatDayLabel = (dateStr, index) => {
    if (index === 0) return 'Today';
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('default', { weekday: 'short' });
};

const WeatherPage = ({ setActiveTab }) => {
    const isMobile = useIsMobile();
    const {
        temperature, weatherCode, weatherState, apparentTemperature, humidity, uvIndex,
        windSpeed, windDirection, pressure, sunrise, sunset, todayMax, todayMin,
        hourly, daily, aqi, locationLabel, isLoading,
    } = useWeather();
    const { settings } = useGlobalSettings();
    const useFahrenheit = settings.temperatureUnit === '°F';

    const toDisplayTemp = (celsius) => {
        if (celsius === null || celsius === undefined) return null;
        return Math.round(useFahrenheit ? (celsius * 9) / 5 + 32 : celsius);
    };
    const unitSuffix = useFahrenheit ? '°F' : '°C';

    const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
    const isNightNow = currentHour < 6.5 || currentHour >= 19.5;
    const HeroIcon = weatherIconFor(weatherCode, isNightNow);

    // Genuinely derived from the live weather code (never a fabricated
    // "official" watch/warning, since Open-Meteo has no alerts feed) -
    // only shown when the current condition is actually thunderstorm or
    // heavy/violent rain, using the plain, honest condition name itself.
    const severeBanner = useMemo(() => {
        if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
            return { text: `${describeWeatherCode(weatherCode)} conditions in your area right now.`, color: '#F97316' };
        }
        if (weatherCode === 65 || weatherCode === 82) {
            return { text: `${describeWeatherCode(weatherCode)} conditions in your area right now.`, color: '#EAB308' };
        }
        return null;
    }, [weatherCode]);

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

    // The week's own min/max define each day's bar scale, so a day's real
    // relative position within the week reads visually (a 24-27 range
    // looks narrow next to a 20-32 range), instead of every bar using an
    // arbitrary fixed scale unrelated to the real data.
    const weekMin = daily.length ? Math.min(...daily.map((d) => d.min)) : 0;
    const weekMax = daily.length ? Math.max(...daily.map((d) => d.max)) : 1;
    const weekRange = Math.max(1, weekMax - weekMin);

    const hourlyTemps = hourly.map((h) => h.temp);
    const hourlyMin = hourlyTemps.length ? Math.min(...hourlyTemps) : 0;
    const hourlyMax = hourlyTemps.length ? Math.max(...hourlyTemps) : 1;
    const hourlyRange = Math.max(1, hourlyMax - hourlyMin);

    const cardStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '18px' : '20px', boxShadow: 'var(--premium-shadow)' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', animation: 'fadeInScale 0.3s ease', paddingBottom: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                    type="button" onClick={() => typeof setActiveTab === 'function' && setActiveTab('Home')}
                    aria-label="Back to Home" title="Back to Home"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', flexShrink: 0, background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '9999px', cursor: 'pointer' }}
                >
                    <ChevronLeft size={18} />
                </button>
                <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Weather Hub</h1>
            </div>

            {/* Hero */}
            <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden', minHeight: isMobile ? '220px' : '260px' }}>
                <WeatherAnimatedSky weatherState={weatherState} isNight={isNightNow} />
                <div style={{ position: 'relative', zIndex: 2, padding: isMobile ? '20px' : '28px', display: 'flex', flexDirection: 'column', gap: '4px', height: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '700' }}>
                        <MapPin size={14} />
                        {locationLabel || 'Resolving location…'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginTop: '8px' }}>
                        <span style={{ fontSize: isMobile ? '58px' : '76px', fontWeight: '800', color: '#fff', lineHeight: 1, letterSpacing: '-2px' }}>
                            {isLoading || temperature === null ? '--' : toDisplayTemp(temperature)}°
                        </span>
                        <HeroIcon size={isMobile ? 34 : 42} color="#fff" style={{ marginTop: '6px', flexShrink: 0, opacity: 0.95 }} />
                    </div>

                    <span style={{ fontSize: '15px', fontWeight: '700', color: 'rgba(255,255,255,0.95)' }}>
                        {isLoading ? 'Loading…' : describeWeatherCode(weatherCode)}
                        {todayMax !== null && todayMin !== null && (
                            <span style={{ fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}> · {toDisplayTemp(todayMax)}°/{toDisplayTemp(todayMin)}°</span>
                        )}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {apparentTemperature !== null && (
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', background: 'rgba(255,255,255,0.16)', padding: '5px 12px', borderRadius: '9999px', backdropFilter: 'blur(6px)' }}>
                                Feels like {toDisplayTemp(apparentTemperature)}°
                            </span>
                        )}
                        {aqi !== null && (
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', background: 'rgba(255,255,255,0.16)', padding: '5px 12px', borderRadius: '9999px', backdropFilter: 'blur(6px)' }}>
                                AQI {aqi}{aqiLabel(aqi) ? ` · ${aqiLabel(aqi).text}` : ''}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Severe condition banner - only ever shown when genuinely
                derived from the live weather code, see severeBanner above. */}
            {severeBanner && (
                <div style={{ ...cardStyle, padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderColor: severeBanner.color }}>
                    <AlertTriangle size={20} color={severeBanner.color} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{severeBanner.text}</span>
                </div>
            )}

            {/* 24-hour forecast */}
            {hourly.length > 0 && (
                <div style={{ ...cardStyle, padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <h3 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>24-Hour Forecast</h3>
                    <div style={{ display: 'flex', gap: isMobile ? '18px' : '22px', overflowX: 'auto', paddingBottom: '4px' }}>
                        {hourly.map((h) => {
                            const HourIcon = weatherIconFor(h.weatherCode, false);
                            const barHeight = 4 + ((h.temp - hourlyMin) / hourlyRange) * 28;
                            return (
                                <div key={h.time} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0, minWidth: '36px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>{toDisplayTemp(h.temp)}°</span>
                                    <div style={{ width: '4px', height: '32px', display: 'flex', alignItems: 'flex-end' }}>
                                        <div style={{ width: '4px', height: `${barHeight}px`, borderRadius: '2px', background: 'linear-gradient(to top, var(--primary), var(--accent))' }} />
                                    </div>
                                    <HourIcon size={16} color="var(--text-secondary)" />
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' }}>{h.windSpeed} km/h</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: h.label === 'Now' ? '800' : '600', whiteSpace: 'nowrap' }}>{h.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 5-day forecast */}
            {daily.length > 0 && (
                <div style={{ ...cardStyle, padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>5-Day Forecast</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {daily.slice(0, 5).map((d, i) => {
                            const DayIcon = weatherIconFor(d.weatherCode, false);
                            const barLeftPct = ((d.min - weekMin) / weekRange) * 100;
                            const barWidthPct = Math.max(8, ((d.max - d.min) / weekRange) * 100);
                            return (
                                <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', padding: '10px 4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', width: isMobile ? '52px' : '70px', flexShrink: 0 }}>{formatDayLabel(d.date, i)}</span>
                                    <DayIcon size={18} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', width: '30px', textAlign: 'right', flexShrink: 0 }}>{toDisplayTemp(d.min)}°</span>
                                    <div style={{ flex: 1, minWidth: '50px', height: '6px', borderRadius: '3px', background: 'var(--surface-inset)', position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: `${barLeftPct}%`, width: `${barWidthPct}%`, height: '100%', borderRadius: '3px', background: 'linear-gradient(to right, #3B82F6, #F59E0B)' }} />
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', width: '30px', flexShrink: 0 }}>{toDisplayTemp(d.max)}°</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Detail metric gauges */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '16px' }}>
                <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>UV Index</span>
                    <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{uvIndex === null ? '--' : uvLabel(uvIndex)}</span>
                    <CircularGauge size={72} strokeWidth={7} progress={uvIndex === null ? 0 : Math.min(1, uvIndex / 11)} gradientStops={UV_GRADIENT} gaugeId="gauge-uv" centerIcon={<span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{uvIndex === null ? '--' : uvIndex}</span>} />
                </div>

                <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Humidity</span>
                    <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{humidity === null ? '--' : `${humidity}%`}</span>
                    <CircularGauge size={72} strokeWidth={7} progress={humidity === null ? 0 : humidity / 100} progressColor="#3B82F6" centerIcon={<Droplets size={20} color="#3B82F6" />} />
                </div>

                <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Real Feel</span>
                    <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{apparentTemperature === null ? '--' : `${toDisplayTemp(apparentTemperature)}°`}</span>
                    <CircularGauge size={72} strokeWidth={7} progress={apparentTemperature === null ? 0 : Math.max(0, Math.min(1, (apparentTemperature + 10) / 50))} progressColor="#F97316" centerIcon={<Thermometer size={20} color="#F97316" />} />
                </div>

                <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{windDirection === null ? 'Wind' : windDirectionLabel(windDirection)}</span>
                    <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{windSpeed === null ? '--' : `${windSpeed} km/h`}</span>
                    <WindCompassGauge size={72} windDirection={windDirection || 0} />
                </div>

                <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '5px' }}><Sunrise size={12} /> Sunrise</span>
                    <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{sunrise || '--'}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <SunArcGauge width={96} height={44} progress={sunProgress} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '96px', fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>
                            <span>{sunrise || '--'}</span>
                            <span>{sunset || '--'}</span>
                        </div>
                    </div>
                </div>

                <div style={{ ...cardStyle, padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Pressure</span>
                    <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>{pressure === null ? '--' : `${pressure}`} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>mbar</span></span>
                    <CircularGauge size={72} strokeWidth={7} progress={pressure === null ? 0.5 : Math.max(0, Math.min(1, (pressure - 970) / 80))} progressColor="#38BDF8" centerIcon={<GaugeIcon size={18} color="#38BDF8" />} />
                </div>
            </div>

            {aqi !== null && (
                <div style={{ ...cardStyle, padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Wind size={18} color={aqiLabel(aqi)?.color || 'var(--accent)'} />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>Air Quality Index</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: aqiLabel(aqi)?.color || 'var(--text-primary)' }}>{aqi} · {aqiLabel(aqi)?.text}</span>
                </div>
            )}

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                Live weather data via Open-Meteo. Air quality via Open-Meteo Air Quality API.
            </p>
        </div>
    );
};

export default WeatherPage;
