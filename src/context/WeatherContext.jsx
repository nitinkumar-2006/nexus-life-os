// src/context/WeatherContext.jsx
//
// A single, shared source of real, live local weather. Both the numeric
// temperature shown on the Home page (GreetingCard) and the sky/rain/cloud
// visuals in DynamicBackground read from the exact same fetch, so they can
// never show mismatched conditions - e.g. a temperature from one city while
// the sky depicts a completely different location's weather.
import React, { createContext, useContext, useEffect, useState } from 'react';

// Used only if BOTH the browser's Geolocation API and the IP-based
// fallback below fail - the last-resort tier, not the primary behavior.
const DEFAULT_LAT = 21.2514;
const DEFAULT_LON = 81.35;
const POLL_MS = 10 * 60 * 1000; // weather doesn't change fast - refresh every 10 minutes

// Tier 1: the browser's Geolocation API (GPS/Wi-Fi-based - the most
// accurate when it works). Resolves to null (never rejects) on any
// failure - denied permission, unsupported, a timeout, or a provider-level
// failure such as macOS's kCLErrorLocationUnknown - so the caller can fall
// through to the next tier below rather than the app breaking or showing
// stale data. Note: browsers can independently log provider-level location
// errors to the console themselves (outside the page's own JS, and not
// something a web page can suppress) - what this function guarantees is
// that the APP never throws, rejects, or shows an error because of it.
const resolveCoordinatesViaGps = () =>
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
const classifyWeatherCode = (code) => {
    if (code === null || code === undefined) return 'clear';
    if (code === 0 || code === 1) return 'clear';
    if ([2, 3, 45, 48].includes(code)) return 'cloudy';
    if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'cloudy'; // snow - folded into overcast look
    if ([95, 96, 99].includes(code)) return 'thunderstorm';
    return 'clear';
};

const WeatherContext = createContext({
    temperature: null,
    weatherCode: null,
    weatherState: 'clear',
});

export const WeatherProvider = ({ children }) => {
    const [temperature, setTemperature] = useState(null);
    const [weatherCode, setWeatherCode] = useState(null);

    useEffect(() => {
        let cancelled = false;
        // Resolved once per session and reused for every subsequent poll -
        // a device's physical location essentially never changes meaningfully
        // between 10-minute weather refreshes, so there's no reason to
        // re-invoke the browser's geolocation API (and the OS-level location
        // service underneath it) repeatedly for the life of the session.
        let cachedCoords = null;

        const fetchWeather = async () => {
            try {
                if (!cachedCoords) {
                    cachedCoords = await resolveCoordinates();
                }
                if (cancelled) return;
                const { lat, lon } = cachedCoords;
                const res = await fetch(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
                );
                const data = await res.json();
                if (cancelled || !data || !data.current) return;
                if (typeof data.current.temperature_2m === 'number') {
                    setTemperature(Math.round(data.current.temperature_2m));
                }
                if (typeof data.current.weather_code === 'number') {
                    setWeatherCode(data.current.weather_code);
                }
            } catch (e) {
                // A network hiccup should never break the greeting or the sky -
                // just keep whatever we last had (or the initial defaults).
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
        <WeatherContext.Provider value={{ temperature, weatherCode, weatherState }}>
            {children}
        </WeatherContext.Provider>
    );
};

export const useWeather = () => useContext(WeatherContext);
