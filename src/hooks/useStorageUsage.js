// src/hooks/useStorageUsage.js
//
// Real local storage usage, refreshed on demand - the exact same
// calculation SettingsPage.jsx's own calculateCache() already uses
// (bytes = (value.length + key.length) * 2 per key, since JS strings are
// UTF-16), extracted here so the System Diagnostics panel in header.jsx
// can show a real number instead of a second, drifting copy of this math.
import { useCallback, useState } from 'react';

const STORAGE_CAP_KB = 5120; // 5MB - same floor SettingsProfileHeader.jsx already assumes

export const useStorageUsage = () => {
    const [usedKB, setUsedKB] = useState(0);

    const refresh = useCallback(() => {
        let totalBytes = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalBytes += (localStorage[key].length + key.length) * 2;
            }
        }
        setUsedKB(totalBytes > 0 ? totalBytes / 1024 : 0);
    }, []);

    return { usedKB, capKB: STORAGE_CAP_KB, percent: Math.min(100, (usedKB / STORAGE_CAP_KB) * 100), refresh };
};
