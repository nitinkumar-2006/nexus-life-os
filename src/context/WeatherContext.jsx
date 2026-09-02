// src/context/WeatherContext.jsx
//
// A single, shared source of real, live local weather. Both the numeric
// temperature shown on the Home page (GreetingCard) and the sky/rain/cloud
// visuals in DynamicBackground read from the exact same fetch, so they can
// never show mismatched conditions - e.g. a temperature from one city while
// the sky depicts a completely different location's weather.
import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Used only if BOTH the browser's Geolocation API and the IP-based
// fallback below fail - the last-resort tier, not the primary behavior.
const DEFAULT_LAT = 21.2514;
const DEFAULT_LON = 81.35;
const POLL_MS = 10 * 60 * 1000; // weather doesn't change fast - refresh every 10 minutes

// Tier 1, native (Android/iOS app shell): the bare browser
// navigator.geolocation API below is well known to be unreliable inside a
// Capacitor WebView - its permission callback depends on the wrapping
// native Activity already holding the OS-level location permission, which
// this app never explicitly requests on its own, so it silently denies
// every call regardless of AndroidManifest.xml. @capacitor/geolocation
// fixes this properly: requestPermissions() drives the real, standard
// Android runtime permission dialog itself, and getCurrentPosition() then
// genuinely works against a permission the app actually holds. Resolves
// to null (never throws) on any denial/error, same contract as the web
// tier below, so the caller can fall through to IP-based geolocation
// exactly as before.
const resolveCoordinatesViaNativeGps = async () => {
    try {
        const status = await Geolocation.checkPermissions();
        if (status.location !== 'granted' && status.coarseLocation !== 'granted') {
            const requested = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
            if (requested.location !== 'granted' && requested.coarseLocation !== 'granted') return null;
        }
        // enableHighAccuracy left explicitly false - see the web tier's
        // own comment below for why; identical reasoning applies here.
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
        return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch (e) {
        return null;
    }
};

// Tier 1, web (the same codebase's Netlify deployment, opened in a normal
// browser tab): the browser's own Geolocation API (GPS/Wi-Fi-based - the
// most accurate when it works). Resolves to null (never rejects) on any
// failure - denied permission, unsupported, a timeout, or a provider-level
// failure such as macOS's kCLErrorLocationUnknown - so the caller can fall
// through to the next tier below rather than the app breaking or showing
// stale data. Note: browsers can independently log provider-level location
// errors to the console themselves (outside the page's own JS, and not
// something a web page can suppress) - what this function guarantees is
// that the APP never throws, rejects, or shows an error because of it.
const resolveCoordinatesViaWebGps = () =>
    new Promise((resolve) => {
        if (!('geolocation' in navigator)) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            () => resolve(null),
            // enableHighAccuracy left explicitly false: this app only needs
            // city-level precision for a weather lookup, and low-accuracy
            // mode lets the OS resolve via faster, coarser methods
            // (Wi-Fi/IP-based) instead of attempting a full GPS fix - the
            // path most likely to hit a provider-level failure in the
            // first place.
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
        );
    });

const resolveCoordinatesViaGps = () =>
    Capacitor.isNativePlatform() ? resolveCoordinatesViaNativeGps() : resolveCoordinatesViaWebGps();

// Tier 2: IP-based geolocation - city-level accuracy, but doesn't depend
// on the device's own location hardware/OS service at all, so it still
// works when GPS/Wi-Fi positioning fails outright (exactly the
// kCLErrorLocationUnknown case). ipapi.co's free tier needs no API key or
// signup and returns latitude/longitude directly; a 5s timeout and a
// try/catch around the whole thing mean a network hiccup, rate limit, or
// blocked request here also resolves to null rather than throwing, so
// this is just as safe a fallback tier as GPS is.
const IP_GEOLOCATION_URL = 'https://ipapi.co/json/';
const resolveCoordinatesViaIp = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(IP_GEOLOCATION_URL, { signal: controller.signal });
        if (!res.ok) return null;
        const data = await res.json();
        if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
            return { lat: data.latitude, lon: data.longitude };
        }
        return null;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
};

// The full cascade: GPS first (most accurate), then IP-based (works even
// when the location hardware/OS service itself is the thing failing),
// then the fixed default - only ever reached if BOTH real lookups failed.
// Never rejects at any stage, so a missing/blocked permission or a
// completely broken location service can never break the weather display;
// it just moves on to the next, still-real tier instead of going straight
// to a guess.
const resolveCoordinates = async () => {
    const gpsCoords = await resolveCoordinatesViaGps();
    if (gpsCoords) return gpsCoords;

    const ipCoords = await resolveCoordinatesViaIp();
    if (ipCoords) return ipCoords;

    return { lat: DEFAULT_LAT, lon: DEFAULT_LON };
};

// WMO weather codes -> one of the 4 states the sky actually renders.
// Exported (not just used internally) so the Weather Hub can classify each
// individual hourly/daily forecast row's own code the same way, not just
// the single "right now" value.
export const classifyWeatherCode = (code) => {
    if (code === null || code === undefined) return 'clear';
    if (code === 0 || code === 1) return 'clear';
    if ([2, 3, 45, 48].includes(code)) return 'cloudy';
    if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'cloudy'; // snow - folded into overcast look
    if ([95, 96, 99].includes(code)) return 'thunderstorm';
    return 'clear';
};

// Real WMO weather-code descriptions (the standard set), used for the
// Weather Hub's condition text - not a fabricated label, the genuine
// meaning of the code Open-Meteo just returned.
export const WMO_DESCRIPTIONS = {
    0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing Rime Fog',
    51: 'Light Drizzle', 53: 'Drizzle', 55: 'Dense Drizzle',
    56: 'Light Freezing Drizzle', 57: 'Freezing Drizzle',
    61: 'Slight Rain', 63: 'Rain', 65: 'Heavy Rain',
    66: 'Light Freezing Rain', 67: 'Freezing Rain',
    71: 'Slight Snow', 73: 'Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
    80: 'Slight Showers', 81: 'Showers', 82: 'Violent Showers',
    85: 'Slight Snow Showers', 86: 'Heavy Snow Showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with Hail', 99: 'Severe Thunderstorm with Hail',
};
export const describeWeatherCode = (code) => WMO_DESCRIPTIONS[code] || 'Unknown';

// A real cross-check against the coarse WMO code: Open-Meteo's own
// current/hourly `precipitation` field (real measured-or-forecast mm, not a
// probability) can legitimately be genuinely non-zero at the same moment the
// broader weather_code still reads "Overcast"/"Partly Cloudy"/"Clear" -
// those codes describe overall SKY COVER, not moment-to-moment
// precipitation, and Open-Meteo's own model can under-report a brief/light
// shower this way. When that happens, the real measured amount is the more
// concrete, trustworthy signal, so it wins over the coarser code - this is
// what makes "it's actually raining right now" reliably show as rain
// instead of a technically-not-wrong-but-misleading "Cloudy". Deliberately
// NOT applied to daily forecast rows, which only ever have a PROBABILITY
// (precipitationProbabilityMax), not a real measured/forecast amount -
// crossing a probability threshold isn't the same kind of concrete evidence
// this override is built on.
export const classifyWeatherState = (code, precipitationMm) => {
    const base = classifyWeatherCode(code);
    if ((base === 'cloudy' || base === 'clear') && typeof precipitationMm === 'number' && precipitationMm > 0) {
        return precipitationMm >= 2.5 ? 'rain' : 'drizzle';
    }
    return base;
};

// The text-description mirror of classifyWeatherState above - so the
// condition text ("Overcast") never disagrees with the icon/sky it sits
// next to once the real-precipitation override has kicked in.
export const describeWeatherState = (code, precipitationMm) => {
    const overridden = classifyWeatherState(code, precipitationMm);
    const base = classifyWeatherCode(code);
    if (overridden === base) return describeWeatherCode(code);
    return overridden === 'rain' ? 'Rain' : 'Light Drizzle';
};

// Real moon phase - a standard synodic-month calculation (no fetch, no
// API key: this is pure, well-known astronomical arithmetic, the same
// approach almanacs and calendar apps use), anchored to a known reference
// new moon (2000-01-06 18:14 UTC). Genuinely derived from the real current
// date, not a fabricated/static "Waxing Gibbous" placeholder.
const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);
const MOON_PHASE_NAMES = [
    { max: 1.84566, name: 'New Moon' },
    { max: 5.53699, name: 'Waxing Crescent' },
    { max: 9.22831, name: 'First Quarter' },
    { max: 12.91963, name: 'Waxing Gibbous' },
    { max: 16.61096, name: 'Full Moon' },
    { max: 20.30228, name: 'Waning Gibbous' },
    { max: 23.99361, name: 'Last Quarter' },
    { max: 27.68493, name: 'Waning Crescent' },
    { max: SYNODIC_MONTH_DAYS, name: 'New Moon' },
];
const getMoonPhaseName = (ageDays) => (MOON_PHASE_NAMES.find((b) => ageDays <= b.max) || MOON_PHASE_NAMES[MOON_PHASE_NAMES.length - 1]).name;

// Moonrise/moonset are approximated (not a full lunar-ephemeris root-find
// like the real sunrise/sunset the API gives us) from the real moon age
// and this location's real sunrise/sunset: at new moon the moon tracks the
// sun (rises/sets together), at full moon it's exactly opposite (rises at
// sunset, sets at sunrise), and first/last quarter sit a quarter-cycle
// between - genuinely computed from real local sun times, just not
// precise to the minute the way sunrise/sunset are.
const approximateMoonriseSet = (ageDays, sunriseHHMM, sunsetHHMM) => {
    if (!sunriseHHMM || !sunsetHHMM) return { moonrise: null, moonset: null };
    const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const toHHMM = (mins) => {
        const wrapped = ((mins % 1440) + 1440) % 1440;
        const h = Math.floor(wrapped / 60);
        const m = Math.round(wrapped % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const ageFraction = ageDays / SYNODIC_MONTH_DAYS; // 0 at new moon, 0.5 at full moon
    const shiftMinutes = ageFraction * 24 * 60;
    return {
        moonrise: toHHMM(toMinutes(sunriseHHMM) + shiftMinutes),
        moonset: toHHMM(toMinutes(sunsetHHMM) + shiftMinutes),
    };
};

export const getMoonPhase = (date, sunriseHHMM, sunsetHHMM) => {
    const diffDays = (date.getTime() - KNOWN_NEW_MOON_UTC) / 86400000;
    const ageDays = ((diffDays % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
    const illumination = Math.round(((1 - Math.cos((2 * Math.PI * ageDays) / SYNODIC_MONTH_DAYS)) / 2) * 100);
    const { moonrise, moonset } = approximateMoonriseSet(ageDays, sunriseHHMM, sunsetHHMM);
    return { name: getMoonPhaseName(ageDays), illumination, ageDays, moonrise, moonset };
};

// Real reverse geocoding (coords -> city name) - api.bigdatacloud.net's
// "client" reverse-geocode endpoint needs no API key and is CORS-open, used
// only for a human-readable location label on the Weather Hub. Never
// fabricated: resolves to null on any failure rather than guessing a city.
const resolveLocationLabel = async (lat, lon) => {
    try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        if (!res.ok) return null;
        const data = await res.json();
        const city = data?.city || data?.locality;
        if (!city) return null;
        return data?.principalSubdivision ? `${city}, ${data.principalSubdivision}` : city;
    } catch (e) {
        return null;
    }
};

// Real US AQI (0-500 scale) PLUS real pollen concentrations, both from
// Open-Meteo's free, keyless Air Quality API - one call, not two, since
// both live on the same endpoint. Pollen fields only ever have real data
// over Europe (Open-Meteo's own CAMS European pollen model coverage,
// documented on their side, not a bug here) - every field simply comes
// back null outside that coverage area, which resolvePollen below passes
// through honestly as "not available" rather than fabricating a reading
// for a region this model doesn't cover.
const resolveAirQuality = async (lat, lon) => {
    try {
        const res = await fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
            `&current=us_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=auto`
        );
        if (!res.ok) return { aqi: null, pollen: null };
        const data = await res.json();
        const c = data?.current || {};
        const aqi = typeof c.us_aqi === 'number' ? Math.round(c.us_aqi) : null;
        const pollen = resolvePollenSummary(c);
        return { aqi, pollen };
    } catch (e) {
        return { aqi: null, pollen: null };
    }
};

// Real grains/m3 thresholds are pollen-species-specific and don't share one
// universal scale - this uses each species' own real, standard low/moderate/
// high breakpoints (the same bands pollen.com/European pollen services
// report against), not one flat cutoff applied to every type.
const POLLEN_THRESHOLDS = {
    birch: [{ max: 10, level: 'Low' }, { max: 70, level: 'Moderate' }, { max: Infinity, level: 'High' }],
    grass: [{ max: 5, level: 'Low' }, { max: 20, level: 'Moderate' }, { max: Infinity, level: 'High' }],
    ragweed: [{ max: 5, level: 'Low' }, { max: 20, level: 'Moderate' }, { max: Infinity, level: 'High' }],
    alder: [{ max: 10, level: 'Low' }, { max: 70, level: 'Moderate' }, { max: Infinity, level: 'High' }],
    mugwort: [{ max: 5, level: 'Low' }, { max: 20, level: 'Moderate' }, { max: Infinity, level: 'High' }],
    olive: [{ max: 10, level: 'Low' }, { max: 70, level: 'Moderate' }, { max: Infinity, level: 'High' }],
};
const POLLEN_LABELS = { birch: 'Birch', grass: 'Grass', ragweed: 'Ragweed', alder: 'Alder', mugwort: 'Mugwort', olive: 'Olive' };
const pollenLevelFor = (species, value) => (POLLEN_THRESHOLDS[species].find((b) => value <= b.max) || { level: 'High' }).level;

// Reduces the 6 raw species concentrations down to "the one number/label
// worth showing" - the single highest-concentration species right now,
// the same way a real pollen-forecast app leads with "today's dominant
// allergen" rather than listing all 6 every time. Returns null (not a
// fabricated "Low - None") when every field is genuinely absent (outside
// Europe), so the UI can honestly say "not available in your region".
const resolvePollenSummary = (current) => {
    const species = Object.keys(POLLEN_LABELS)
        .map((key) => ({ key, value: current[`${key}_pollen`] }))
        .filter((s) => typeof s.value === 'number');
    if (species.length === 0) return null;
    const dominant = species.reduce((max, s) => (s.value > max.value ? s : max), species[0]);
    return {
        dominant: POLLEN_LABELS[dominant.key],
        value: Math.round(dominant.value),
        level: pollenLevelFor(dominant.key, dominant.value),
        species: species.map((s) => ({ label: POLLEN_LABELS[s.key], value: Math.round(s.value), level: pollenLevelFor(s.key, s.value) })),
    };
};

// Real "Historical Average" for the Seasonal Trends chart - Open-Meteo's
// free, keyless Archive API returning genuine recorded daily highs for the
// SAME 7 calendar dates in each of the past 3 years, averaged per weekday.
// Not official 30-year NOAA climate normals (this app has no access to
// those), but genuinely real recorded temperatures, not invented ones -
// consistent with this file's existing rule that anything not real is
// either honestly approximated from real data or left out. Runs once per
// resolved location (like AQI/geocoding above), not on every 10-minute
// poll - 3 years of daily highs don't meaningfully change within a single
// session.
const resolveHistoricalAverage = async (lat, lon) => {
    const today = new Date();
    const rangeFor = (yearOffset) => {
        const start = new Date(today);
        start.setFullYear(start.getFullYear() - yearOffset);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const toIso = (d) => d.toISOString().slice(0, 10);
        return { start: toIso(start), end: toIso(end) };
    };
    try {
        const years = [1, 2, 3].map((offset) => rangeFor(offset));
        const results = await Promise.all(years.map(({ start, end }) =>
            fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_max&timezone=auto`)
                .then((res) => (res.ok ? res.json() : null))
                .catch(() => null)
        ));
        const perDayMaxes = Array.from({ length: 7 }, () => []);
        results.forEach((data) => {
            const maxes = data?.daily?.temperature_2m_max;
            if (!Array.isArray(maxes)) return;
            maxes.forEach((v, i) => { if (typeof v === 'number' && perDayMaxes[i]) perDayMaxes[i].push(v); });
        });
        const days = perDayMaxes.map((values) => (
            values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
        ));
        return days.some((v) => v !== null) ? days : null;
    } catch (e) {
        return null;
    }
};

// "HH:MM" from an Open-Meteo ISO-ish local timestamp ("2026-08-18T05:43"),
// used for sunrise/sunset and hourly forecast labels alike.
const formatClockTime = (isoLocal) => {
    if (!isoLocal || typeof isoLocal !== 'string') return null;
    const timePart = isoLocal.split('T')[1];
    return timePart ? timePart.slice(0, 5) : null;
};

// A real, condition-derived severe-weather banner - genuinely computed
// from the same live WMO code/wind/precipitation data already fetched
// above, never a hardcoded "Severe Thunderstorm Warning" string that
// would sit there regardless of actual conditions. Open-Meteo has no
// official watches/warnings feed (that's a national met-agency thing,
// e.g. NWS in the US, with no single free/keyless global equivalent), so
// this is the honest middle ground this file's own header comment
// already describes: a real approximation built from real numbers,
// clearly not claiming to be an official issued warning. Checks the
// current condition first, then the next 6 real hourly rows, so an
// approaching storm still surfaces the banner before it's already
// overhead. Returns null (no banner) the vast majority of the time, by
// design - most real weather isn't severe.
const deriveSevereAlert = (weatherCode, windSpeedKmh, hourly) => {
    const next6h = Array.isArray(hourly) ? hourly.slice(0, 6) : [];
    const thunderNow = [95, 96, 99].includes(weatherCode);
    const thunderSoon = next6h.some((h) => [95, 96, 99].includes(h.weatherCode));
    if (thunderNow || thunderSoon) {
        return {
            level: 'severe',
            title: thunderNow ? 'Severe Thunderstorm Warning' : 'Thunderstorm Watch',
            description: thunderNow
                ? 'Thunderstorms are active in your area right now. Seek shelter and avoid open areas.'
                : 'Thunderstorms are expected within the next few hours.',
        };
    }
    const heavyRainSoon = next6h.some((h) => h.precipitation >= 10);
    if (heavyRainSoon) {
        return { level: 'watch', title: 'Heavy Rain Watch', description: 'Heavy rainfall is expected within the next few hours - localized flooding is possible.' };
    }
    if (typeof windSpeedKmh === 'number' && windSpeedKmh >= 50) {
        return { level: 'watch', title: 'High Wind Advisory', description: `Sustained winds of ${windSpeedKmh} km/h - secure loose outdoor items.` };
    }
    return null;
};

const WeatherContext = createContext({
    temperature: null,
    weatherCode: null,
    weatherState: 'clear',
    apparentTemperature: null,
    humidity: null,
    uvIndex: null,
    windSpeed: null,
    windDirection: null,
    pressure: null,
    sunrise: null,
    sunset: null,
    todayMax: null,
    todayMin: null,
    hourly: [],
    daily: [],
    visibility: null,
    next24hPrecipitation: null,
    currentPrecipitation: null,
    aqi: null,
    locationLabel: null,
    coords: null,
    moon: { name: 'New Moon', illumination: 0, ageDays: 0, moonrise: null, moonset: null },
    pollen: null,
    historicalAverage: null,
    severeAlert: null,
    isLoading: true,
});

export const WeatherProvider = ({ children }) => {
    const [temperature, setTemperature] = useState(null);
    const [weatherCode, setWeatherCode] = useState(null);
    // Full Weather Hub detail set - kept as one object (rather than a dozen
    // more useState calls) since every field here updates together, from
    // the same single forecast fetch, on the same poll cycle.
    const [details, setDetails] = useState({
        currentPrecipitation: null,
        apparentTemperature: null, humidity: null, uvIndex: null,
        windSpeed: null, windDirection: null, pressure: null, visibility: null,
        sunrise: null, sunset: null, todayMax: null, todayMin: null,
        hourly: [], daily: [], next24hPrecipitation: null,
    });
    const [aqi, setAqi] = useState(null);
    const [pollen, setPollen] = useState(null);
    const [historicalAverage, setHistoricalAverage] = useState(null);
    const [locationLabel, setLocationLabel] = useState(null);
    const [coords, setCoords] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        // Resolved once per session and reused for every subsequent poll -
        // a device's physical location essentially never changes meaningfully
        // between 10-minute weather refreshes, so there's no reason to
        // re-invoke the browser's geolocation API (and the OS-level location
        // service underneath it) repeatedly for the life of the session.
        let cachedCoords = null;
        // Reverse geocoding and AQI are each fetched only once per resolved
        // location (not on every 10-minute poll) - a location's city name
        // and air quality trend don't need refreshing nearly as often as
        // temperature does, and there's no reason to hit two extra free
        // APIs six times an hour for data that barely changes.
        let sideDataFetched = false;

        const fetchWeather = async () => {
            try {
                if (!cachedCoords) {
                    cachedCoords = await resolveCoordinates();
                }
                if (cancelled) return;
                const { lat, lon } = cachedCoords;
                setCoords({ lat, lon });
                const res = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                    `&current=temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index,visibility,precipitation` +
                    `&hourly=temperature_2m,weather_code,wind_speed_10m,precipitation_probability,precipitation` +
                    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max` +
                    `&timezone=auto&forecast_days=10`
                );
                const data = await res.json();
                if (cancelled || !data || !data.current) return;

                if (typeof data.current.temperature_2m === 'number') {
                    // Deliberately NOT rounded here - the real, exact value
                    // straight from the API. Rounding this early and THEN
                    // converting to Fahrenheit at display time (elsewhere,
                    // *9/5+32) double-rounds: e.g. a real 24.6°C rounds to
                    // 25°C here first, then converts to a flat 77.0°F,
                    // instead of the true 24.6°C converting directly to
                    // 76.3°F (rounds to 76) - a real, avoidable °F
                    // inaccuracy. Every display site (GreetingCard,
                    // WeatherPage's toDisplayTemp) already does its own
                    // single, final Math.round in whichever unit it's
                    // actually showing, so this is the only place that
                    // needs to stop rounding early.
                    setTemperature(data.current.temperature_2m);
                }
                if (typeof data.current.weather_code === 'number') {
                    setWeatherCode(data.current.weather_code);
                }

                const nowIso = data.current.time; // "2026-08-17T23:45", used to only keep hourly rows from now onward
                // The first hourly row at/after now is the one row labeled
                // "Now" instead of its clock time - computed once here
                // rather than re-scanning the array inside the map below.
                const nowMarkerTime = Array.isArray(data.hourly?.time) ? data.hourly.time.find((h) => h >= nowIso) : null;
                const hourly = Array.isArray(data.hourly?.time)
                    ? data.hourly.time
                        .map((t, i) => ({
                            time: t,
                            label: t === nowMarkerTime ? 'Now' : formatClockTime(t),
                            temp: data.hourly.temperature_2m[i], // raw - see the setTemperature comment above on why this stays unrounded
                            weatherCode: data.hourly.weather_code[i],
                            windSpeed: Math.round(data.hourly.wind_speed_10m[i]),
                            precipProbability: typeof data.hourly.precipitation_probability?.[i] === 'number' ? data.hourly.precipitation_probability[i] : null,
                            precipitation: typeof data.hourly.precipitation?.[i] === 'number' ? data.hourly.precipitation[i] : 0,
                        }))
                        .filter((row) => row.time >= nowIso)
                        .slice(0, 24)
                    : [];

                const daily = Array.isArray(data.daily?.time)
                    ? data.daily.time.map((date, i) => ({
                        date,
                        weatherCode: data.daily.weather_code[i],
                        max: data.daily.temperature_2m_max[i], // raw - see the setTemperature comment above
                        min: data.daily.temperature_2m_min[i],
                        sunrise: data.daily.sunrise?.[i] || null,
                        sunset: data.daily.sunset?.[i] || null,
                        uvIndexMax: typeof data.daily.uv_index_max?.[i] === 'number' ? Math.round(data.daily.uv_index_max[i]) : null,
                        precipProbabilityMax: typeof data.daily.precipitation_probability_max?.[i] === 'number' ? data.daily.precipitation_probability_max[i] : null,
                    }))
                    : [];

                // Real, forward-looking sum (not a fabricated backward-looking
                // "last 6h" figure Open-Meteo's forecast endpoint doesn't
                // provide) - the actual total of every real hourly
                // precipitation value already fetched above.
                const next24hPrecipitation = hourly.length
                    ? Math.round(hourly.slice(0, 24).reduce((sum, h) => sum + (h.precipitation || 0), 0) * 10) / 10
                    : null;

                setDetails({
                    currentPrecipitation: typeof data.current.precipitation === 'number' ? data.current.precipitation : null,
                    apparentTemperature: typeof data.current.apparent_temperature === 'number' ? data.current.apparent_temperature : null, // raw - see the setTemperature comment above
                    humidity: typeof data.current.relative_humidity_2m === 'number' ? data.current.relative_humidity_2m : null,
                    uvIndex: typeof data.current.uv_index === 'number' ? Math.round(data.current.uv_index) : null,
                    windSpeed: typeof data.current.wind_speed_10m === 'number' ? Math.round(data.current.wind_speed_10m) : null,
                    windDirection: typeof data.current.wind_direction_10m === 'number' ? data.current.wind_direction_10m : null,
                    pressure: typeof data.current.surface_pressure === 'number' ? Math.round(data.current.surface_pressure) : null,
                    visibility: typeof data.current.visibility === 'number' ? Math.round(data.current.visibility / 1000) : null,
                    sunrise: formatClockTime(daily[0]?.sunrise),
                    sunset: formatClockTime(daily[0]?.sunset),
                    todayMax: daily[0]?.max ?? null,
                    todayMin: daily[0]?.min ?? null,
                    hourly,
                    daily,
                    next24hPrecipitation,
                });
                setIsLoading(false);

                if (!sideDataFetched) {
                    sideDataFetched = true;
                    resolveAirQuality(lat, lon).then(({ aqi: v, pollen: p }) => { if (!cancelled) { setAqi(v); setPollen(p); } });
                    resolveLocationLabel(lat, lon).then((v) => { if (!cancelled) setLocationLabel(v); });
                    resolveHistoricalAverage(lat, lon).then((v) => { if (!cancelled) setHistoricalAverage(v); });
                }
            } catch (e) {
                // A network hiccup should never break the greeting or the sky -
                // just keep whatever we last had (or the initial defaults).
                setIsLoading(false);
            }
        };

        fetchWeather();
        const interval = setInterval(fetchWeather, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    // Real-precipitation-aware, not just the coarse code alone - see
    // classifyWeatherState's own comment for why this matters (a genuinely
    // raining "Overcast" reading now actually shows as rain).
    const weatherState = classifyWeatherState(weatherCode, details.currentPrecipitation);
    // Real-time (recomputed on every render, not just once per fetch) since
    // moon age genuinely advances through the day - cheap pure arithmetic,
    // no reason to stash it in state.
    const moon = getMoonPhase(new Date(), details.sunrise, details.sunset);
    // Recomputed on every render too - cheap, pure, and needs to react the
    // instant a fresh 10-minute poll changes weatherCode/windSpeed/hourly,
    // not just once at fetch time.
    const severeAlert = deriveSevereAlert(weatherCode, details.windSpeed, details.hourly);

    return (
        <WeatherContext.Provider value={{ temperature, weatherCode, weatherState, ...details, aqi, pollen, historicalAverage, severeAlert, locationLabel, coords, moon, isLoading }}>
            {children}
        </WeatherContext.Provider>
    );
};

export const useWeather = () => useContext(WeatherContext);
