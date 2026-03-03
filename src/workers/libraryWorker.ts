import * as mm from 'music-metadata';
import { Buffer } from 'buffer';
import { get, set } from 'idb-keyval';
import { getAlbumCoverKey, parseArtists, getMetadataCacheKey } from '../utils/player';

// Polyfill Buffer and process for music-metadata compatibility in worker
(self as any).Buffer = Buffer;
(self as any).process = { env: {} };

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
    fileHandle?: any;
}

export interface WorkerMessageResponse {
    type: 'NEXT_TRACK_PRELOADED';
    payload: {
        track: WorkerTrack;
        file: File;
    };
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
    | { type: 'PLAY_CONTEXT'; tracks: UITrack[], startIndex: number }
    | { type: 'NEXT_TRACK' }
    | { type: 'PREV_TRACK' }
    | { type: 'SET_SHUFFLE'; shuffle: boolean }
    | { type: 'SET_REPEAT'; repeat: 'off' | 'all' | 'one' }
    | { type: 'CLEAR_QUEUE' }
    | { type: 'FILE_NOT_FOUND' }
    | { type: 'PRELOAD_NEXT_TRACK' }
    | { type: 'RESTORE_CACHE'; tracks: WorkerTrack[] };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let workerTracks: WorkerTrack[] = [];
let queue: WorkerTrack[] = [];
let shuffledQueue: WorkerTrack[] = [];
let currentTrackId: string | null = null;
let shuffle = false;
let repeat: 'off' | 'all' | 'one' = 'off';

// Stores { buffer, mimeType } so MIME is never lost on a cache hit
const albumCovers = new Map<string, { buffer: ArrayBuffer; mimeType: string }>();

const getActiveQueue = () => (shuffle ? shuffledQueue : queue);

// ---------------------------------------------------------------------------
// Message serialization — processes one message at a time to prevent
// concurrent SCAN + PLAY_TRACK calls from corrupting shared state
// ---------------------------------------------------------------------------

let processing = false;
const messageQueue: WorkerMessage[] = [];

const drainQueue = async () => {
    processing = true;
    while (messageQueue.length > 0) {
        await handleMessage(messageQueue.shift()!);
    }
    processing = false;
};

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    messageQueue.push(e.data);
    if (!processing) drainQueue();
};

// ---------------------------------------------------------------------------
// Helpers
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

const getNextTrack = (): WorkerTrack | null => {
    if (!currentTrackId) return null;
    const q = getActiveQueue();
    if (q.length === 0) return null;

    const idx = q.findIndex(t => t.id === currentTrackId);
    if (idx === -1) return null;

    if (idx === q.length - 1) {
        return repeat === 'all' ? q[0] : null;
    }
    return q[idx + 1];
};

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
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const verifyFileAccess = async (track: WorkerTrack): Promise<boolean> => {
    try {
        if (track.fileHandle) {
            const testFile = await track.fileHandle.getFile();
            track.file = testFile;
        } else {
            await track.file.slice(0, 1).arrayBuffer();
        }
        return true;
    } catch (e) {
        console.error('Track file is no longer accessible on disk:', track.path, e);
        return false;
    }
};

const loadAndBroadcastTrack = async (track: WorkerTrack | undefined) => {
    if (!track) return;
    currentTrackId = track.id;

    // track.artist is already the primary artist (set during metadata parsing)
    const albumKey = getAlbumCoverKey(track.artist, track.album);

    let coverBuffer: ArrayBuffer | undefined;
    let mimeType: string | undefined;

    // Verify file is still accessible
    const isValid = await verifyFileAccess(track);
    if (!isValid) {
        postMessage({ type: 'FILE_NOT_FOUND' });
        return;
    }

    if (albumCovers.has(albumKey)) {
        const cached = albumCovers.get(albumKey)!;
        coverBuffer = cached.buffer;
        mimeType = cached.mimeType; // Use stored MIME — never assume image/jpeg
    } else {
        try {
            const metadata = await mm.parseBlob(track.file, { skipCovers: false });
            if (metadata.common.picture?.length) {
                const picture = metadata.common.picture[0];
                coverBuffer = picture.data.buffer.slice(
                    picture.data.byteOffset,
                    picture.data.byteOffset + picture.data.byteLength
                ) as ArrayBuffer;
                mimeType = picture.format;
                albumCovers.set(albumKey, { buffer: coverBuffer, mimeType });
            }
        } catch (e) {
            console.error('Worker failed to extract cover for', track.path, e);
        }
    }

    emitState();

    postMessage({
        type: 'TRACK_LOADED',
        payload: {
            track: toUITrack(track),
            file: track.file,
            coverBuffer,
            mimeType,
        },
    });
};

const shuffleArray = <T>(arr: T[]): T[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const buildShuffledQueue = (baseQueue: WorkerTrack[], pinnedId: string | null): WorkerTrack[] => {
    if (!pinnedId) return shuffleArray(baseQueue);
    const pinned = baseQueue.find(t => t.id === pinnedId);
    const rest = shuffleArray(baseQueue.filter(t => t.id !== pinnedId));
    return pinned ? [pinned, ...rest] : rest;
};

// ---------------------------------------------------------------------------
// Directory scanning
// ---------------------------------------------------------------------------

const scanDirectoryRecursive = async (
    dirHandle: FileSystemDirectoryHandle,
    path = ''
): Promise<{ file: File; handle?: FileSystemFileHandle }[]> => {
    const files: { file: File; handle?: FileSystemFileHandle }[] = [];
    for await (const entry of (dirHandle as any).values()) {
        if (entry.kind === 'file') {
            const name = entry.name.toLowerCase();
            if (
                name.endsWith('.flac') ||
                name.endsWith('.mp3') ||
                name.endsWith('.m4a') ||
                name.endsWith('.wav') ||
                name.endsWith('.ogg')
            ) {
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
// File processing
// ---------------------------------------------------------------------------

const processFiles = async (files: { file: File; handle?: FileSystemFileHandle }[]) => {
    postMessage({ type: 'SCAN_PROGRESS', payload: { current: 0, total: files.length } });

    albumCovers.clear();
    const parsedTracks: WorkerTrack[] = [];

    let metadataCache: Record<string, any> = {};
    try {
        const stored = await get('metadata-cache');
        if (stored) metadataCache = stored;
    } catch (e) {
        console.warn('Failed to load metadata cache', e);
    }

    const chunkSize = 10;
    let cacheUpdated = false;

    for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);

        const chunkTracks = await Promise.all(chunk.map(async ({ file, handle }) => {
            const path = (file as any).webkitRelativePath || (file as any).fullPath || file.name;
            const cacheKey = getMetadataCacheKey(path, file.lastModified);

            // --- Cache hit ---
            if (metadataCache[cacheKey]) {
                const c = metadataCache[cacheKey];
                return {
                    id: path, file, path, fileHandle: handle,
                    title: c.title,
                    artist: c.artist,
                    features: c.features,
                    album: c.album,
                    duration: c.duration,
                    trackNumber: c.trackNumber,
                    discNumber: c.discNumber,
                    year: c.year,
                } as WorkerTrack;
            }

            // --- Defaults ---
            let title = file.name.replace(/\.[^/.]+$/, '');
            let artist = 'Unknown Artist';
            let features: string[] | undefined;
            let album = 'Unknown Album';
            let duration = 0;
            let trackNumber: number | undefined;
            let discNumber: number | undefined;
            let year: number | undefined;

            try {
                const metadata = await mm.parseBlob(file, { duration: true, skipCovers: true });

                if (metadata.common.title) title = metadata.common.title;

                // Year — prefer original release year over remaster date
                if (metadata.common.originalyear) {
                    year = metadata.common.originalyear;
                } else if (metadata.common.year) {
                    year = metadata.common.year;
                } else if (metadata.common.releasedate) {
                    const y = parseInt(metadata.common.releasedate.substring(0, 4), 10);
                    if (!isNaN(y)) year = y;
                }

                // Artists — use music-metadata's pre-split `artists` array when available
                const rawArtists: string[] =
                    metadata.common.artists?.length
                        ? metadata.common.artists
                        : metadata.common.artist
                            ? [metadata.common.artist]
                            : metadata.common.albumartist
                                ? [metadata.common.albumartist]
                                : [];

                if (rawArtists.length) {
                    const parsed = parseArtists(rawArtists);
                    artist = parsed.primary;
                    if (parsed.features.length > 0) features = parsed.features;
                }

                if (metadata.common.album) album = metadata.common.album;
                if (metadata.format.duration) duration = metadata.format.duration;

                if (metadata.common.track?.no != null) trackNumber = metadata.common.track.no;

                // Disc: prefer path-based detection (more reliable than tags)
                const pathMatch = path.match(/(?:^|\/)(?:CD|Disc)\s*(\d+)/i);
                if (pathMatch) {
                    discNumber = parseInt(pathMatch[1], 10);
                } else if (metadata.common.disk?.no != null) {
                    discNumber = metadata.common.disk.no;
                }

                metadataCache[cacheKey] = { title, artist, features, album, duration, trackNumber, discNumber, year };
                cacheUpdated = true;

            } catch (e) {
                console.error('Metadata parsing failed for', file.name, e);

                // Stale cache fallback — find any entry for this path regardless of lastModified
                const fallbackKey = Object.keys(metadataCache).find(k => k.startsWith(path + '\0'));
                if (fallbackKey) {
                    const fb = metadataCache[fallbackKey];
                    return {
                        id: path, file, path, fileHandle: handle,
                        title: fb.title, artist: fb.artist, features: fb.features,
                        album: fb.album, duration: fb.duration, trackNumber: fb.trackNumber,
                        discNumber: fb.discNumber, year: fb.year,
                    } as WorkerTrack;
                }

                // Last resort: derive artist/album from folder structure
                const parts = path.split('/');
                if (parts.length >= 3) {
                    artist = parts[parts.length - 3];
                    album = parts[parts.length - 2];
                }
            }

            return { id: path, file, title, artist, features, album, duration, trackNumber, discNumber, year, path, fileHandle: handle } as WorkerTrack;
        }));

        parsedTracks.push(...chunkTracks);
        postMessage({ type: 'SCAN_PROGRESS', payload: { current: Math.min(i + chunkSize, files.length), total: files.length } });
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (cacheUpdated) {
        try {
            await set('metadata-cache', metadataCache);
        } catch (e) {
            console.warn('Failed to persist metadata cache', e);
        }
    }

    parsedTracks.sort((a, b) => {
        const yearDiff = (b.year || 0) - (a.year || 0);
        if (yearDiff !== 0) return yearDiff;

        const albumComp = a.album.localeCompare(b.album);
        if (albumComp !== 0) return albumComp;

        const discDiff = (a.discNumber || 1) - (b.discNumber || 1);
        if (discDiff !== 0) return discDiff;

        return (a.trackNumber || 0) - (b.trackNumber || 0);
    });

    workerTracks = parsedTracks;
    postMessage({ type: 'SCAN_COMPLETE', payload: { tracks: workerTracks.map(toUITrack) } });

    // Background: extract covers for all unique albums
    extractAllAlbumCovers(parsedTracks);
};

// ---------------------------------------------------------------------------
// Background cover extraction
// ---------------------------------------------------------------------------

const extractAllAlbumCovers = async (tracks: WorkerTrack[]) => {
    // One representative track per album key — artist is already primary here
    const uniqueAlbums = new Map<string, WorkerTrack>();
    for (const track of tracks) {
        const key = getAlbumCoverKey(track.artist, track.album);
        if (!uniqueAlbums.has(key)) uniqueAlbums.set(key, track);
    }

    for (const [albumKey, track] of uniqueAlbums.entries()) {
        if (albumCovers.has(albumKey)) continue;

        try {
            const metadata = await mm.parseBlob(track.file, { skipCovers: false });
            if (metadata.common.picture?.length) {
                const picture = metadata.common.picture[0];
                const buffer = picture.data.buffer.slice(
                    picture.data.byteOffset,
                    picture.data.byteOffset + picture.data.byteLength
                ) as ArrayBuffer;
                const mimeType = picture.format;

                albumCovers.set(albumKey, { buffer, mimeType });

                // Not transferred — buffer stays valid in worker cache
                (self as any).postMessage({
                    type: 'ALBUM_COVER',
                    payload: { albumKey, coverBuffer: buffer, mimeType },
                });
            }
        } catch {
            // Silently skip albums with no cover
        }

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
                const files = await scanDirectoryRecursive(msg.dirHandle);
                await processFiles(files);
            } catch (e) {
                console.error("Worker failed to scan directory:", e);
                postMessage({ type: 'FILE_NOT_FOUND' });
            }
            break;
        }

        case 'SCAN_FILES': {
            await processFiles(msg.files.map(file => ({ file })));
            break;
        }

        case 'RESTORE_CACHE': {
            // Re-hydrate workerTracks from the UI cache so playback works without scanning
            workerTracks = msg.tracks;
            break;
        }

        case 'PLAY_TRACK': {
            const track = workerTracks.find(t => t.id === msg.id);
            if (!track) {
                postMessage({ type: 'FILE_NOT_FOUND' });
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

            if (queue.length === 0 || msg.startIndex < 0 || msg.startIndex >= queue.length) return;

            if (shuffle) {
                shuffledQueue = buildShuffledQueue(queue, queue[msg.startIndex].id);
            }
            await loadAndBroadcastTrack(queue[msg.startIndex]);
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
            const nextTrack = getNextTrack();
            if (nextTrack) {
                verifyFileAccess(nextTrack).then(isValid => {
                    if (isValid) {
                        postMessage({
                            type: 'NEXT_TRACK_PRELOADED',
                            payload: { track: nextTrack, file: nextTrack.file }
                        });
                    }
                });
            }
            break;
        }
    }
};