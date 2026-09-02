// src/utils/customFontStorage.js
//
// IndexedDB, not localStorage - a real, uploaded font file (.ttf/.otf/
// .woff/.woff2) can genuinely run into the low single-digit megabytes,
// where base64-inflating it (~33% larger) into the same synchronous
// localStorage blob every other setting shares would be a real risk to
// that blob's own read/write cost on every single settings change, for
// every user, not just the one who uploaded a font. IndexedDB stores
// the raw ArrayBuffer directly and is the correct tool for exactly this
// kind of larger binary payload.
const DB_NAME = 'nexus_custom_fonts';
const STORE_NAME = 'fonts';
const DB_VERSION = 1;

const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

export const saveCustomFontBlob = async (id, arrayBuffer) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(arrayBuffer, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const getCustomFontBlob = async (id) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const deleteCustomFontBlob = async (id) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};
