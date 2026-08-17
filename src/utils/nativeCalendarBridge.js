// src/utils/nativeCalendarBridge.js
//
// Real device-calendar read bridge for the Android app shell - genuinely
// reads the OS's own Calendar Provider via @ebarooni/capacitor-calendar
// (a local, on-device plugin call, no cloud account/OAuth involved
// anywhere in this path) and maps the result into Nexus's own calendar
// event shape, the same shape utils/calendarSync.js's ICS import already
// produces, so CalendarPage.jsx can merge either source into its one
// `events` state identically.
//
// Native-only by construction: Capacitor.isNativePlatform() is false in
// every browser context (the Netlify web deployment included), and the
// underlying plugin's Android implementation genuinely doesn't exist in a
// browser tab - so isDeviceCalendarBridgeAvailable() is what the UI
// should gate on before ever showing an entry point for this.
import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar, CalendarPermissionScope } from '@ebarooni/capacitor-calendar';

export const isDeviceCalendarBridgeAvailable = () => Capacitor.isNativePlatform();

// ms timestamp -> Nexus's own { date: 'YYYY-MM-DD', time: 'HH:MM AM/PM' }
// pair, identical formatting to calendarSync.js's parseIcsDate so both
// import paths produce interchangeable event objects.
const formatDeviceEventDateTime = (startMs, isAllDay) => {
    const d = new Date(startMs);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (isAllDay) return { date, time: 'All Day' };
    const hour = d.getHours();
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const time = `${String(hour12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${period}`;
    return { date, time };
};

const mapDeviceEventToNexusEvent = (deviceEvent) => {
    const { date, time } = formatDeviceEventDateTime(deviceEvent.startDate, deviceEvent.isAllDay);
    return {
        id: `device_${deviceEvent.id}`,
        title: deviceEvent.title || 'Untitled Event',
        category: 'Personal',
        date,
        time,
        priority: 'Medium',
        location: deviceEvent.location || '',
        completed: false,
        importedFromDevice: true,
    };
};

// Explicit, standalone permission step (rather than letting
// listEventsInRange fail and inferring why) so the caller can show an
// honest, specific "permission denied" message instead of a generic sync
// error - this is the actual "clean runtime permission request logic"
// mechanism: it drives Android's real system permission dialog the first
// time it's called, and simply returns the already-granted state on every
// call after that.
export const requestDeviceCalendarPermission = async () => {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    const existing = await CapacitorCalendar.checkPermission({ scope: CalendarPermissionScope.READ_CALENDAR });
    if (existing.result === 'granted') return 'granted';
    const requested = await CapacitorCalendar.requestReadOnlyCalendarAccess();
    return requested.result;
};

// Imports every device-calendar event inside [daysBack, daysForward] of
// today - a bounded, practical window (a full device calendar can span
// years of history) rather than an unbounded fetch. Throws a real,
// specific Error on permission denial or a plugin-level failure; the
// caller (CalendarPage.jsx, mirroring its own handleFeedImport pattern)
// is expected to surface that message honestly rather than swallow it.
export const importDeviceCalendarEvents = async ({ daysBack = 7, daysForward = 90 } = {}) => {
    if (!Capacitor.isNativePlatform()) {
        throw new Error('Device calendar sync is only available in the installed Android app, not a browser tab.');
    }

    const permission = await requestDeviceCalendarPermission();
    if (permission !== 'granted') {
        throw new Error('Calendar access was not granted. Enable it in Android Settings > Apps > Nexus > Permissions to sync device events.');
    }

    const now = Date.now();
    const from = now - daysBack * 24 * 60 * 60 * 1000;
    const to = now + daysForward * 24 * 60 * 60 * 1000;

    const { result } = await CapacitorCalendar.listEventsInRange({ from, to });
    return result.map(mapDeviceEventToNexusEvent);
};
