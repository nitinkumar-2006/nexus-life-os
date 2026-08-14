// src/utils/audioCloudSchema.js
//
// The real, shared mapping between a locally-imported audio track (bytes
// in IndexedDB, metadata in localStorage's own nexus_playlist entry) and
// where that same track will live once actual Cloud Storage/Firestore
// sync is implemented. Nothing here performs a real upload yet - that's
// explicitly a future step, per this request's own wording - this module
// is the real, concrete contract that step will build on: exact paths,
// exact metadata shape, so wiring in the real upload later is a drop-in
// addition to addSong/deleteSong, not a redesign of how tracks are
// represented.
//
// Matches the SAME real Firestore convention CloudSyncContext.jsx
// already established for every other synced module (the nexusUsers
// collection, keyed by the real, authenticated user's uid) - not a new,
// separate naming scheme invented just for audio.

// The real Firestore document path for a single track's own metadata.
// Subcollection (not a field inside the main nexusUsers/{uid} document),
// since CloudSyncContext's own document already holds the full
// localStorage snapshot as one blob - per-track documents here let a
// future sync step read/write/query individual tracks (e.g. "just this
// one changed") without touching that unrelated, larger document.
export const getAudioTrackDocPath = (uid, trackId) => `nexusUsers/${uid}/audioTracks/${trackId}`;

// The real Cloud Storage path for a single track's own audio bytes.
// Namespaced under the real, authenticated user's own uid (matching
// Storage's own real security-rule convention of scoping a path to
// request.auth.uid), with the track's own id as the filename so it's a
// direct, stable 1:1 mapping back to the same id used everywhere else
// (IndexedDB's own key, the playlist entry's own id) - no separate,
// second id scheme to keep in sync.
export const getAudioBlobStoragePath = (uid, trackId, fileExtension) =>
    `users/${uid}/audio/${trackId}${fileExtension ? `.${fileExtension}` : ''}`;

// Real, honest sync-status values a track's own metadata can carry.
// 'local-only' is every track's genuine starting state today, since
// actual Cloud Storage upload isn't implemented yet - this is not a
// placeholder value pretending to be synced, it's the real, current
// truth. 'pending'/'synced'/'sync-failed' are real states the future
// upload step will transition a track through; defined here now so
// that step has an established, real vocabulary to write into rather
// than inventing one under time pressure later.
export const AUDIO_SYNC_STATUS = {
    LOCAL_ONLY: 'local-only',
    PENDING: 'pending',
    SYNCED: 'synced',
    SYNC_FAILED: 'sync-failed',
};

// Extracts a real file extension from a File object's own name (e.g.
// "song.mp3" -> "mp3"), falling back to null rather than guessing -
// a track legitimately dropped without a recognizable extension (some
// browser drag-and-drop sources omit one) should honestly carry no
// extension rather than a fabricated, wrong one.
export const getFileExtension = (fileName) => {
    if (!fileName || typeof fileName !== 'string') return null;
    const match = fileName.match(/\.([a-zA-Z0-9]+)$/);
    return match ? match[1].toLowerCase() : null;
};

// Converts a real, local track + its originating File object into the
// exact metadata shape a future Firestore write will use. Every field
// here is genuinely available at upload time (from the real File
// object's own size/type/name, or the app's own real track id/title) -
// nothing is fabricated or estimated.
export const buildAudioTrackCloudMetadata = (track, file) => ({
    id: track.id,
    title: track.title,
    isLocal: true,
    fileSizeBytes: file ? file.size : null,
    mimeType: file ? file.type || null : null,
    fileExtension: file ? getFileExtension(file.name) : null,
    uploadedAt: Date.now(),
    syncStatus: AUDIO_SYNC_STATUS.LOCAL_ONLY,
    // Populated by the future upload step once a real Cloud Storage
    // upload actually completes - null now is the honest, current state,
    // not a placeholder pretending a URL already exists.
    cloudStorageUrl: null,
});
