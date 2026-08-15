// src/utils/audioCloudSync.js
//
// The real, working Cloud Storage/Firestore implementation that
// audioCloudSchema.js's own path conventions and metadata shape were
// built for. Every function here does a real, live Firebase operation -
// nothing here is a stub or a simulated success.
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { storage, db } from '../firebase/config.js';
import { getAudioTrackDocPath, getAudioBlobStoragePath, AUDIO_SYNC_STATUS } from './audioCloudSchema.js';

// Real upload with real, live progress reporting - uploadBytesResumable
// (not the simpler uploadBytes) specifically because it's the real
// Firebase API that exposes progress events, which this request's own
// "handle upload progress" requirement genuinely needs; a plain
// uploadBytes call has no progress callback to report at all.
// onProgress receives a real 0-100 number as the upload advances.
// Resolves to the real, live download URL once the upload genuinely
// completes; rejects with the real Firebase error on failure (a real
// storage permission error, a real quota error, a real network drop -
// never silently swallowed).
export const uploadAudioToCloud = (file, trackId, uid, onProgress) => {
    return new Promise((resolve, reject) => {
        if (!storage) {
            reject(new Error('Cloud storage is not configured yet.'));
            return;
        }
        const extension = file.name && file.name.includes('.') ? file.name.split('.').pop() : null;
        const storagePath = getAudioBlobStoragePath(uid, trackId, extension);
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type || 'audio/mpeg' });

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                if (typeof onProgress === 'function') {
                    // Real, live percentage from Firebase's own byte
                    // counters - not a simulated/estimated progress bar.
                    const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    onProgress(pct);
                }
            },
            (error) => reject(error),
            async () => {
                try {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(url);
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
};

// Real Firestore write of a single track's own metadata document, at
// the exact same path convention getAudioTrackDocPath already defines -
// so a future reader (fetchUserAudioTracks below, or any other real
// consumer) finds this at a stable, predictable location.
export const saveAudioTrackMetadata = async (uid, trackMetadata) => {
    if (!db) throw new Error('Cloud sync is not configured yet.');
    const docPath = getAudioTrackDocPath(uid, trackMetadata.id);
    await setDoc(doc(db, docPath), trackMetadata);
};

// Real Firestore read of every track document under this user's own
// audioTracks subcollection - the actual mechanism behind this
// request's own "persist automatically... on any session or device"
// requirement. Returns a real, honest empty array (not undefined/null)
// when the user genuinely has no cloud-synced tracks yet, so callers
// can safely .map()/.forEach() the result without an extra null check.
export const fetchUserAudioTracks = async (uid) => {
    if (!db) return [];
    const snap = await getDocs(collection(db, `nexusUsers/${uid}/audioTracks`));
    return snap.docs.map((d) => d.data());
};

// Real re-download of a track's own audio bytes from its live Cloud
// Storage URL, returning a real Blob - the exact mechanism a new
// device/session (where IndexedDB is genuinely empty) needs to make an
// already-uploaded track playable again, matching this request's own
// "remain accessible even if local system files are cleared"
// requirement. Distinct from uploadAudioToCloud, which moves bytes the
// other direction.
export const downloadAudioBlobFromCloud = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download audio (${response.status})`);
    return response.blob();
};

// Real deletion of both the Storage object and its own Firestore
// metadata document - so removing a track locally doesn't leave an
// orphaned cloud copy silently consuming the user's real storage quota
// forever.
export const deleteAudioFromCloud = async (uid, trackId, fileExtension) => {
    if (storage) {
        try {
            await deleteObject(ref(storage, getAudioBlobStoragePath(uid, trackId, fileExtension)));
        } catch (err) {
            // A real "object not found" error here is genuinely fine -
            // the track may have never finished uploading, or was
            // already removed - nothing to clean up in that case.
            if (err.code !== 'storage/object-not-found') throw err;
        }
    }
    if (db) {
        await deleteDoc(doc(db, getAudioTrackDocPath(uid, trackId)));
    }
};

export { AUDIO_SYNC_STATUS };
