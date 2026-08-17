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

// Real US AQI (0-500 scale) from Open-Meteo's own free, keyless Air Quality
// API - a separate host/endpoint from the main forecast API above, so it's
// fetched independently and never blocks (or is blocked by) the core
// temperature/condition fetch that GreetingCard/DynamicBackground depend on.
const resolveAqi = async (lat, lon) => {
    try {
        const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`);
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data?.current?.us_aqi === 'number' ? Math.round(data.current.us_aqi) : null;
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
    aqi: null,
    locationLabel: null,
    isLoading: true,
});

export const WeatherProvider = ({ children }) => {
    const [temperature, setTemperature] = useState(null);
    const [weatherCode, setWeatherCode] = useState(null);
    // Full Weather Hub detail set - kept as one object (rather than a dozen
    // more useState calls) since every field here updates together, from
    // the same single forecast fetch, on the same poll cycle.
    const [details, setDetails] = useState({
        apparentTemperature: null, humidity: null, uvIndex: null,
        windSpeed: null, windDirection: null, pressure: null,
        sunrise: null, sunset: null, todayMax: null, todayMin: null,
        hourly: [], daily: [],
    });
    const [aqi, setAqi] = useState(null);
    const [locationLabel, setLocationLabel] = useState(null);
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
                const res = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                    `&current=temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,uv_index` +
                    `&hourly=temperature_2m,weather_code,wind_speed_10m` +
                    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max` +
                    `&timezone=auto&forecast_days=6`
                );
                const data = await res.json();
                if (cancelled || !data || !data.current) return;

                if (typeof data.current.temperature_2m === 'number') {
                    setTemperature(Math.round(data.current.temperature_2m));
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
                            temp: Math.round(data.hourly.temperature_2m[i]),
                            weatherCode: data.hourly.weather_code[i],
                            windSpeed: Math.round(data.hourly.wind_speed_10m[i]),
                        }))
                        .filter((row) => row.time >= nowIso)
                        .slice(0, 24)
                    : [];

                const daily = Array.isArray(data.daily?.time)
                    ? data.daily.time.map((date, i) => ({
                        date,
                        weatherCode: data.daily.weather_code[i],
                        max: Math.round(data.daily.temperature_2m_max[i]),
                        min: Math.round(data.daily.temperature_2m_min[i]),
                        sunrise: data.daily.sunrise?.[i] || null,
                        sunset: data.daily.sunset?.[i] || null,
                        uvIndexMax: typeof data.daily.uv_index_max?.[i] === 'number' ? Math.round(data.daily.uv_index_max[i]) : null,
                    }))
                    : [];

                setDetails({
                    apparentTemperature: typeof data.current.apparent_temperature === 'number' ? Math.round(data.current.apparent_temperature) : null,
                    humidity: typeof data.current.relative_humidity_2m === 'number' ? data.current.relative_humidity_2m : null,
                    uvIndex: typeof data.current.uv_index === 'number' ? Math.round(data.current.uv_index) : null,
                    windSpeed: typeof data.current.wind_speed_10m === 'number' ? Math.round(data.current.wind_speed_10m) : null,
                    windDirection: typeof data.current.wind_direction_10m === 'number' ? data.current.wind_direction_10m : null,
                    pressure: typeof data.current.surface_pressure === 'number' ? Math.round(data.current.surface_pressure) : null,
                    sunrise: formatClockTime(daily[0]?.sunrise),
                    sunset: formatClockTime(daily[0]?.sunset),
                    todayMax: daily[0]?.max ?? null,
                    todayMin: daily[0]?.min ?? null,
                    hourly,
                    daily,
                });
                setIsLoading(false);

                if (!sideDataFetched) {
                    sideDataFetched = true;
                    resolveAqi(lat, lon).then((v) => { if (!cancelled) setAqi(v); });
                    resolveLocationLabel(lat, lon).then((v) => { if (!cancelled) setLocationLabel(v); });
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

    const weatherState = classifyWeatherCode(weatherCode);

    return (
        <WeatherContext.Provider value={{ temperature, weatherCode, weatherState, ...details, aqi, locationLabel, isLoading }}>
            {children}
        </WeatherContext.Provider>
    );
};

export const useWeather = () => useContext(WeatherContext);
