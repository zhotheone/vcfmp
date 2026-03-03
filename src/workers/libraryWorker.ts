import * as mm from 'music-metadata';
import { Buffer } from 'buffer';
import { get, set } from 'idb-keyval';
import { getAlbumCoverKey, parseArtists, getMetadataCacheKey } from '../utils/player';

// Polyfill Buffer and process for music-metadata in worker context
(self as any).Buffer = Buffer;
(self as any).process = { env: {} };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerTrack {
    id: string;
    file: File;
    title: string;
    artist: string;
    features?: string[];
    album: string;
    duration: number;
    trackNumber?: number;
    discNumber?: number;
    year?: number;
    path: string;
    fileHandle?: FileSystemFileHandle;
}

export interface UITrack {
    id: string;
    title: string;
    artist: string;
    features?: string[];
    album: string;
    duration: number;
    trackNumber?: number;
    discNumber?: number;
    year?: number;
    path: string;
}

export type WorkerMessage =
    | { type: 'SCAN_DIRECTORY'; dirHandle: FileSystemDirectoryHandle }
    | { type: 'SCAN_FILES'; files: File[] }
    | { type: 'PLAY_TRACK'; id: string }
    | { type: 'PLAY_CONTEXT'; tracks: UITrack[]; startIndex: number }
    | { type: 'NEXT_TRACK' }
    | { type: 'PREV_TRACK' }
    | { type: 'SET_SHUFFLE'; shuffle: boolean }
    | { type: 'SET_REPEAT'; repeat: 'off' | 'all' | 'one' }
    | { type: 'CLEAR_QUEUE' }
    | { type: 'PRELOAD_NEXT_TRACK' }
    | { type: 'RESTORE_CACHE'; tracks: UITrack[] }
    | { type: 'UPDATE_TRACK_METADATA'; id: string; metadata: { title?: string; artist?: string; album?: string } };

// ---------------------------------------------------------------------------
// Worker state
// ---------------------------------------------------------------------------

let workerTracks: WorkerTrack[] = [];
let queue: WorkerTrack[] = [];
let shuffledQueue: WorkerTrack[] = [];
let currentTrackId: string | null = null;
let shuffle = false;
let repeat: 'off' | 'all' | 'one' = 'off';

// Track ID to play once the next SCAN_COMPLETE arrives (deferred play)
let pendingPlayId: string | null = null;

// In-memory album cover store: albumKey → { buffer, mimeType }
const albumCoverCache = new Map<string, { buffer: ArrayBuffer; mimeType: string }>();

const getActiveQueue = () => (shuffle ? shuffledQueue : queue);

// ---------------------------------------------------------------------------
// Serial message processing — one message at a time to prevent race conditions
// ---------------------------------------------------------------------------

let processing = false;
const pendingMessages: WorkerMessage[] = [];

const drainQueue = async () => {
    processing = true;
    while (pendingMessages.length > 0) {
        await handleMessage(pendingMessages.shift()!);
    }
    processing = false;
};

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    pendingMessages.push(e.data);
    if (!processing) drainQueue();
};

// ---------------------------------------------------------------------------
// State broadcast
// ---------------------------------------------------------------------------

const emitState = () => {
    postMessage({
        type: 'STATE_UPDATE',
        payload: {
            queue: getActiveQueue().map(toUITrack),
            currentTrackId,
            shuffle,
            repeat,
        },
    });
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

const toUITrack = (wt: WorkerTrack): UITrack => ({
    id: wt.id,
    title: wt.title,
    artist: wt.artist,
    features: wt.features,
    album: wt.album,
    duration: wt.duration,
    trackNumber: wt.trackNumber,
    discNumber: wt.discNumber,
    year: wt.year,
    path: wt.path,
});

const getNextTrack = (): WorkerTrack | null => {
    if (!currentTrackId) return null;
    const q = getActiveQueue();
    const idx = q.findIndex(t => t.id === currentTrackId);
    if (idx === -1) return null;
    if (idx === q.length - 1) return repeat === 'all' ? q[0] : null;
    return q[idx + 1];
};

const shuffleArray = <T>(arr: T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const buildShuffledQueue = (base: WorkerTrack[], pinnedId: string | null): WorkerTrack[] => {
    if (!pinnedId) return shuffleArray(base);
    const pinned = base.find(t => t.id === pinnedId);
    const rest = shuffleArray(base.filter(t => t.id !== pinnedId));
    return pinned ? [pinned, ...rest] : rest;
};

// ---------------------------------------------------------------------------
// File access verification
// ---------------------------------------------------------------------------

const verifyFileAccess = async (track: WorkerTrack): Promise<boolean> => {
    try {
        if (track.fileHandle) {
            // Re-acquire the File object from the handle (handles cache-restored tracks)
            track.file = await track.fileHandle.getFile();
            return true;
        }

        if (!track.file) {
            // Cache-restored track with no handle — cannot access without a rescan
            console.warn('Track has no file or handle (cache-only):', track.path);
            return false;
        }

        await track.file.slice(0, 1).arrayBuffer();
        return true;
    } catch (e) {
        console.error('Track file inaccessible:', track.path, e);
        return false;
    }
};

// ---------------------------------------------------------------------------
// Track loading & broadcasting
// ---------------------------------------------------------------------------

const loadAndBroadcastTrack = async (track: WorkerTrack | undefined) => {
    if (!track) return;
    currentTrackId = track.id;

    const albumKey = getAlbumCoverKey(track.artist, track.album);
    let coverBuffer: ArrayBuffer | undefined;
    let mimeType: string | undefined;

    const isValid = await verifyFileAccess(track);
    if (!isValid) {
        postMessage({ type: 'FILE_NOT_FOUND' });
        return;
    }

    if (albumCoverCache.has(albumKey)) {
        const cached = albumCoverCache.get(albumKey)!;
        coverBuffer = cached.buffer;
        mimeType = cached.mimeType;
    } else {
        try {
            const meta = await mm.parseBlob(track.file, { skipCovers: false });
            if (meta.common.picture?.length) {
                const pic = meta.common.picture[0];
                coverBuffer = pic.data.buffer.slice(
                    pic.data.byteOffset,
                    pic.data.byteOffset + pic.data.byteLength,
                ) as ArrayBuffer;
                mimeType = pic.format;
                albumCoverCache.set(albumKey, { buffer: coverBuffer, mimeType });
            }
        } catch (e) {
            console.error('Failed to extract cover for', track.path, e);
        }
    }

    emitState();

    postMessage({
        type: 'TRACK_LOADED',
        payload: { track: toUITrack(track), file: track.file, coverBuffer, mimeType },
    });
};

// ---------------------------------------------------------------------------
// Directory scanning
// ---------------------------------------------------------------------------

const scanDirectoryRecursive = async (
    dirHandle: FileSystemDirectoryHandle,
    path = '',
): Promise<{ file: File; handle?: FileSystemFileHandle }[]> => {
    const files: { file: File; handle?: FileSystemFileHandle }[] = [];

    for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file') {
            if (/\.(flac|mp3|m4a|wav|ogg)$/i.test(entry.name)) {
                const file = await entry.getFile();
                (file as any).fullPath = `${path}/${entry.name}`;
                files.push({ file, handle: entry });
            }
        } else if (entry.kind === 'directory') {
            files.push(...await scanDirectoryRecursive(entry, `${path}/${entry.name}`));
        }
    }

    return files;
};

// ---------------------------------------------------------------------------
// Metadata parsing & caching
//
// Cache strategy: keyed by `path\0lastModified` — a stale entry for a moved
// or re-encoded file never masks fresh data.  Single-track updates patch only
// that key so the entire 10 k-entry cache is never rewritten for one change.
// ---------------------------------------------------------------------------

/**
 * Patch a single track's metadata in the IDB cache.
 * Called when the UI updates a track title/artist/album without rescanning.
 */
const patchMetadataCache = async (
    path: string,
    lastModified: number,
    patch: { title?: string; artist?: string; album?: string },
) => {
    try {
        const cache: Record<string, any> = (await get('metadata-cache')) ?? {};
        const key = getMetadataCacheKey(path, lastModified);
        if (cache[key]) {
            cache[key] = { ...cache[key], ...patch };
            await set('metadata-cache', cache);
        }
    } catch (e) {
        console.warn('Failed to patch metadata cache', e);
    }
};

const processFiles = async (files: { file: File; handle?: FileSystemFileHandle }[]) => {
    postMessage({ type: 'SCAN_PROGRESS', payload: { current: 0, total: files.length } });

    albumCoverCache.clear();

    // Load metadata cache once up front — O(1) lookup per track
    let metadataCache: Record<string, any> = {};
    try {
        const stored = await get('metadata-cache');
        if (stored) metadataCache = stored;
    } catch (e) {
        console.warn('Failed to load metadata cache', e);
    }

    const parsedTracks: WorkerTrack[] = [];
    let cacheUpdated = false;
    const CHUNK = 10;

    for (let i = 0; i < files.length; i += CHUNK) {
        const chunk = files.slice(i, i + CHUNK);

        const chunkTracks = await Promise.all(
            chunk.map(async ({ file, handle }) => {
                const path =
                    (file as any).webkitRelativePath ||
                    (file as any).fullPath ||
                    file.name;
                const cacheKey = getMetadataCacheKey(path, file.lastModified);

                // --- Cache hit: return immediately, no parsing ---
                if (metadataCache[cacheKey]) {
                    const c = metadataCache[cacheKey];
                    return {
                        id: path, file, path, fileHandle: handle,
                        title: c.title, artist: c.artist, features: c.features,
                        album: c.album, duration: c.duration,
                        trackNumber: c.trackNumber, discNumber: c.discNumber, year: c.year,
                    } as WorkerTrack;
                }

                // --- Cache miss: parse ---
                let title = file.name.replace(/\.[^/.]+$/, '');
                let artist = 'Unknown Artist';
                let features: string[] | undefined;
                let album = 'Unknown Album';
                let duration = 0;
                let trackNumber: number | undefined;
                let discNumber: number | undefined;
                let year: number | undefined;

                try {
                    const meta = await mm.parseBlob(file, { duration: true, skipCovers: true });

                    if (meta.common.title) title = meta.common.title;

                    // Prefer original release year over remaster date
                    if (meta.common.originalyear) year = meta.common.originalyear;
                    else if (meta.common.year) year = meta.common.year;
                    else if (meta.common.releasedate) {
                        const y = parseInt(meta.common.releasedate.substring(0, 4), 10);
                        if (!isNaN(y)) year = y;
                    }

                    const rawArtists: string[] =
                        meta.common.artists?.length
                            ? meta.common.artists
                            : meta.common.artist
                                ? [meta.common.artist]
                                : meta.common.albumartist
                                    ? [meta.common.albumartist]
                                    : [];

                    if (rawArtists.length) {
                        const parsed = parseArtists(rawArtists);
                        artist = parsed.primary;
                        if (parsed.features.length) features = parsed.features;
                    }

                    if (meta.common.album) album = meta.common.album;
                    if (meta.format.duration) duration = meta.format.duration;
                    if (meta.common.track?.no != null) trackNumber = meta.common.track.no;

                    // Prefer path-based disc detection over tags (more reliable)
                    const discMatch = path.match(/(?:^|\/)(?:CD|Disc)\s*(\d+)/i);
                    if (discMatch) discNumber = parseInt(discMatch[1], 10);
                    else if (meta.common.disk?.no != null) discNumber = meta.common.disk.no;

                    metadataCache[cacheKey] = {
                        title, artist, features, album, duration,
                        trackNumber, discNumber, year,
                    };
                    cacheUpdated = true;
                } catch (e) {
                    console.error('Metadata parse failed for', file.name, e);

                    // Stale-key fallback: find any cache entry for this path regardless of lastModified
                    const fallbackKey = Object.keys(metadataCache).find(k => k.startsWith(path + '\0'));
                    if (fallbackKey) {
                        const fb = metadataCache[fallbackKey];
                        return {
                            id: path, file, path, fileHandle: handle,
                            title: fb.title, artist: fb.artist, features: fb.features,
                            album: fb.album, duration: fb.duration,
                            trackNumber: fb.trackNumber, discNumber: fb.discNumber, year: fb.year,
                        } as WorkerTrack;
                    }

                    // Last resort: derive names from folder structure
                    const parts = path.split('/');
                    if (parts.length >= 3) {
                        artist = parts[parts.length - 3];
                        album = parts[parts.length - 2];
                    }
                }

                return {
                    id: path, file, title, artist, features,
                    album, duration, trackNumber, discNumber, year, path,
                    fileHandle: handle,
                } as WorkerTrack;
            }),
        );

        parsedTracks.push(...chunkTracks);
        postMessage({
            type: 'SCAN_PROGRESS',
            payload: { current: Math.min(i + CHUNK, files.length), total: files.length },
        });

        // Yield to allow other messages to be processed between chunks
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Persist only if new entries were added
    if (cacheUpdated) {
        try {
            await set('metadata-cache', metadataCache);
        } catch (e) {
            console.warn('Failed to persist metadata cache', e);
        }
    }

    // Sort: newest year → album → disc → track
    parsedTracks.sort((a, b) => {
        const yearDiff = (b.year ?? 0) - (a.year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        const albumComp = a.album.localeCompare(b.album);
        if (albumComp !== 0) return albumComp;
        const discDiff = (a.discNumber ?? 1) - (b.discNumber ?? 1);
        if (discDiff !== 0) return discDiff;
        return (a.trackNumber ?? 0) - (b.trackNumber ?? 0);
    });

    workerTracks = parsedTracks;
    postMessage({ type: 'SCAN_COMPLETE', payload: { tracks: workerTracks.map(toUITrack) } });

    // If a play was requested before file handles were available, honour it now.
    if (pendingPlayId) {
        const id = pendingPlayId;
        pendingPlayId = null;
        const track = workerTracks.find(t => t.id === id);
        if (track) {
            // Rebuild queue from full library if no context queue was set
            if (queue.length === 0) queue = [...workerTracks];
            // Re-resolve queue entries to hydrated WorkerTracks (old refs had null files)
            queue = queue.map(q => workerTracks.find(t => t.id === q.id) ?? q);
            if (shuffle) shuffledQueue = buildShuffledQueue(queue, id);
            await loadAndBroadcastTrack(track);
        }
    }

    // Background: extract covers for all albums after scan completes
    extractAllAlbumCovers(parsedTracks);
};

// ---------------------------------------------------------------------------
// Background cover extraction
// ---------------------------------------------------------------------------

const extractAllAlbumCovers = async (tracks: WorkerTrack[]) => {
    // One representative track per unique album key
    const uniqueAlbums = new Map<string, WorkerTrack>();
    for (const track of tracks) {
        const key = getAlbumCoverKey(track.artist, track.album);
        if (!uniqueAlbums.has(key)) uniqueAlbums.set(key, track);
    }

    for (const [albumKey, track] of uniqueAlbums.entries()) {
        if (albumCoverCache.has(albumKey)) continue;

        try {
            const meta = await mm.parseBlob(track.file, { skipCovers: false });
            if (meta.common.picture?.length) {
                const pic = meta.common.picture[0];
                const buffer = pic.data.buffer.slice(
                    pic.data.byteOffset,
                    pic.data.byteOffset + pic.data.byteLength,
                ) as ArrayBuffer;
                const mimeType = pic.format;

                albumCoverCache.set(albumKey, { buffer, mimeType });

                postMessage({
                    type: 'ALBUM_COVER',
                    payload: { albumKey, coverBuffer: buffer, mimeType },
                });
            }
        } catch { /* silently skip albums without artwork */ }

        // Throttle to avoid starving other messages
        await new Promise(resolve => setTimeout(resolve, 50));
    }
};

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

const handleMessage = async (msg: WorkerMessage) => {
    switch (msg.type) {

        case 'SCAN_DIRECTORY': {
            try {
                console.log('Worker: scanning directory', msg.dirHandle);
                const files = await scanDirectoryRecursive(msg.dirHandle);
                await processFiles(files);
            } catch (e) {
                console.error('Worker: directory scan failed', e);
                postMessage({ type: 'FILE_NOT_FOUND' });
            }
            break;
        }

        case 'SCAN_FILES': {
            await processFiles(msg.files.map(file => ({ file })));
            break;
        }

        case 'RESTORE_CACHE': {
            // Hydrate worker track list from the UI cache so metadata is available
            // immediately (e.g. for queue display). File objects are intentionally null
            // here — FileSystemFileHandle cannot be persisted across page loads, so
            // a background SCAN_DIRECTORY always follows to rehydrate real File refs.
            workerTracks = (msg.tracks as UITrack[]).map(ui => ({
                ...ui,
                file: null as unknown as File,
                fileHandle: undefined,
            }));
            break;
        }

        case 'PLAY_TRACK': {
            const track = workerTracks.find(t => t.id === msg.id);
            if (!track) {
                postMessage({ type: 'FILE_NOT_FOUND' });
                return;
            }

            // Cache-restored track: file handle not yet available, scan is running in background.
            // Defer the play until SCAN_COMPLETE rehydrates the real File objects.
            if (!track.file && !track.fileHandle) {
                pendingPlayId = msg.id;
                return;
            }

            if (queue.length === 0) queue = [...workerTracks];
            await loadAndBroadcastTrack(track);
            break;
        }

        case 'PLAY_CONTEXT': {
            queue = msg.tracks
                .map(ui => workerTracks.find(w => w.id === ui.id))
                .filter(Boolean) as WorkerTrack[];

            if (!queue.length || msg.startIndex < 0 || msg.startIndex >= queue.length) return;

            const startTrack = queue[msg.startIndex];

            // Cache-restored tracks have no File yet — defer until scan rehydrates them.
            if (!startTrack.file && !startTrack.fileHandle) {
                pendingPlayId = startTrack.id;
                return;
            }

            if (shuffle) shuffledQueue = buildShuffledQueue(queue, startTrack.id);
            await loadAndBroadcastTrack(startTrack);
            break;
        }

        case 'NEXT_TRACK': {
            if (!currentTrackId) return;
            const q = getActiveQueue();
            const idx = q.findIndex(t => t.id === currentTrackId);
            if (idx === -1) return;

            if (idx === q.length - 1) {
                repeat === 'all'
                    ? await loadAndBroadcastTrack(q[0])
                    : postMessage({ type: 'STOP_PLAYBACK' });
            } else {
                await loadAndBroadcastTrack(q[idx + 1]);
            }
            break;
        }

        case 'PREV_TRACK': {
            if (!currentTrackId) return;
            const q = getActiveQueue();
            const idx = q.findIndex(t => t.id === currentTrackId);
            if (idx === -1) return;

            if (idx === 0) {
                repeat === 'all'
                    ? await loadAndBroadcastTrack(q[q.length - 1])
                    : postMessage({ type: 'RESTART_PLAYBACK' });
            } else {
                await loadAndBroadcastTrack(q[idx - 1]);
            }
            break;
        }

        case 'SET_SHUFFLE': {
            shuffle = msg.shuffle;
            shuffledQueue = shuffle ? buildShuffledQueue(queue, currentTrackId) : [];
            emitState();
            break;
        }

        case 'SET_REPEAT': {
            repeat = msg.repeat;
            emitState();
            break;
        }

        case 'CLEAR_QUEUE': {
            queue = [];
            shuffledQueue = [];
            currentTrackId = null;
            emitState();
            break;
        }

        case 'PRELOAD_NEXT_TRACK': {
            const next = getNextTrack();
            if (!next) return;
            const isValid = await verifyFileAccess(next);
            if (isValid) {
                postMessage({
                    type: 'NEXT_TRACK_PRELOADED',
                    payload: { track: toUITrack(next), file: next.file },
                });
            }
            break;
        }

        case 'UPDATE_TRACK_METADATA': {
            // Patch the in-memory worker track — no rescan needed
            const track = workerTracks.find(t => t.id === msg.id);
            if (track) {
                Object.assign(track, msg.metadata);

                // Patch the persistent metadata cache entry for this track
                await patchMetadataCache(track.path, track.file?.lastModified ?? 0, msg.metadata);
            }
            break;
        }
    }
};