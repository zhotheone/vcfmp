import { useState, useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { get, set } from 'idb-keyval';
import { Track } from '../types';
import { UseAudioEngineReturn, audioEngineInternals } from './useAudioEngine';

export interface RehydrateOptions {
    cachedTracks: Track[];
    cachedCovers: Record<string, string>;
    dirHandle: FileSystemDirectoryHandle | null;
    hasSavedHandle: boolean;
    isDriveMissing: boolean;
}

export interface UseLibraryWorkerReturn {
    tracks: Track[];
    currentTrack: Track | null;
    queue: Track[];
    shuffle: boolean;
    repeat: 'off' | 'all' | 'one';
    albumCovers: Record<string, string>;
    scanProgress: { current: number; total: number };
    isScanning: boolean;
    hasSavedHandle: boolean;
    isDriveMissing: boolean;
    workerRef: MutableRefObject<Worker | null>;
    /** Called once by App.tsx after it has loaded IDB cache and resolved the dir handle. */
    rehydrate: (opts: RehydrateOptions) => void;
    setTracks: (tracks: Track[]) => void;
    setShuffle: (s: boolean) => void;
    setRepeat: (r: 'off' | 'all' | 'one') => void;
    playTrack: (id: string) => void;
    playContext: (tracks: Track[], startIndex: number) => void;
    nextTrack: () => void;
    prevTrack: (audioCurrentTime: number, resetAudio: () => void) => void;
    selectDirectory: () => void;
    restoreLibrary: () => void;
    updateTrack: (trackId: string, metadata: { title?: string; artist?: string; album?: string }) => void;
}

export const useLibraryWorker = (audio: UseAudioEngineReturn): UseLibraryWorkerReturn => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [queue, setQueue] = useState<Track[]>([]);
    const [shuffle, setShuffleState] = useState(false);
    const [repeat, setRepeatState] = useState<'off' | 'all' | 'one'>('off');
    const [albumCovers, setAlbumCovers] = useState<Record<string, string>>({});
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
    const [isScanning, setIsScanning] = useState(false);
    const [hasSavedHandle, setHasSavedHandle] = useState(false);
    const [isDriveMissing, setIsDriveMissing] = useState(false);

    const workerRef = useRef<Worker | null>(null);
    const savedHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
    // True once the first SCAN_COMPLETE is processed — distinguishes the initial
    // session-restore scan from subsequent silent background rescans.
    const hasRestoredRef = useRef(false);
    // Replaces window.__vcfmp_restoring
    const isRestoringRef = useRef(false);

    const {
        audioRef, audioRefNext, objectUrlRef, objectUrlRefNext,
        setIsPlaying, setPreloadedTrackId, preloadedTrackId,
    } = audio;

    // Refs for values read inside the worker message handler — avoids stale closures
    const preloadedTrackIdRef = useRef(preloadedTrackId);
    useEffect(() => { preloadedTrackIdRef.current = preloadedTrackId; }, [preloadedTrackId]);
    const volumeRef = useRef(audio.volume);
    useEffect(() => { volumeRef.current = audio.volume; }, [audio.volume]);

    // ---------------------------------------------------------------------------
    // Worker lifecycle
    // ---------------------------------------------------------------------------
    useEffect(() => {
        const worker = new Worker(
            new URL('../workers/libraryWorker.ts', import.meta.url),
            { type: 'module' },
        );
        workerRef.current = worker;
        audioEngineInternals.setWorkerRef?.(worker);
        worker.onmessage = (e) => handleWorkerMessage(e.data);

        // Restore persisted shuffle / repeat into worker immediately
        const savedShuffle = localStorage.getItem('player-shuffle');
        if (savedShuffle) {
            const s = savedShuffle === 'true';
            setShuffleState(s);
            worker.postMessage({ type: 'SET_SHUFFLE', shuffle: s });
        }
        const savedRepeat = localStorage.getItem('player-repeat') as 'off' | 'all' | 'one' | null;
        if (savedRepeat) {
            setRepeatState(savedRepeat);
            audioEngineInternals.setRepeat?.(savedRepeat);
            worker.postMessage({ type: 'SET_REPEAT', repeat: savedRepeat });
        }

        return () => {
            worker.terminate();
            workerRef.current = null;
            audioEngineInternals.setWorkerRef?.(null);
            setAlbumCovers(prev => {
                Object.values(prev).forEach(url => URL.revokeObjectURL(url));
                return {};
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist queue IDs whenever the queue changes
    useEffect(() => {
        if (queue.length > 0) {
            localStorage.setItem('player-queue-ids', JSON.stringify(queue.map(t => t.id)));
        }
    }, [queue]);

    // ---------------------------------------------------------------------------
    // rehydrate — the single entry point called by App.tsx on mount
    // ---------------------------------------------------------------------------
    const rehydrate = useCallback((opts: RehydrateOptions) => {
        const { cachedTracks, cachedCovers, dirHandle, hasSavedHandle: hasSaved, isDriveMissing: driveMissing } = opts;

        setHasSavedHandle(hasSaved);
        setIsDriveMissing(driveMissing);

        if (cachedTracks.length > 0) {
            setTracks(cachedTracks);
            setAlbumCovers(cachedCovers);
            // Hydrate worker metadata so queue display works before the scan finishes
            workerRef.current?.postMessage({ type: 'RESTORE_CACHE', tracks: cachedTracks });
        }

        if (dirHandle) {
            savedHandleRef.current = dirHandle;
            // Silent background scan — rehydrates real File objects in the worker.
            // isScanning intentionally stays false: the UI already shows the cached library.
            workerRef.current?.postMessage({ type: 'SCAN_DIRECTORY', dirHandle });
        }
    }, []);

    // ---------------------------------------------------------------------------
    // Worker message handler
    // ---------------------------------------------------------------------------
    const handleWorkerMessage = (msg: any) => {
        switch (msg.type) {

            case 'SCAN_PROGRESS':
                setScanProgress(msg.payload);
                break;

            case 'SCAN_COMPLETE': {
                const scannedTracks = msg.payload.tracks as Track[];

                get('ui-tracks-cache').then((cached: unknown) => {
                    let finalTracks = scannedTracks;
                    if (Array.isArray(cached)) {
                        const cacheMap = new Map(cached.map((t: Track) => [t.id, t]));
                        finalTracks = scannedTracks.map(st => {
                            const existing = cacheMap.get(st.id);
                            return existing
                                ? { ...st, playCount: existing.playCount, lastPlayed: existing.lastPlayed }
                                : st;
                        });
                    }

                    setTracks(finalTracks);
                    setIsScanning(false);
                    setIsDriveMissing(false);

                    if (!hasRestoredRef.current) {
                        // First scan on startup — restore the previous session
                        hasRestoredRef.current = true;
                        restoreSessionAfterScan(finalTracks);
                    }
                    // Subsequent scans keep the current track and covers untouched.

                    if (finalTracks.length > 0) {
                        set('ui-tracks-cache', finalTracks).catch(console.warn);
                    }
                }).catch(err => {
                    console.error('Error merging track stats:', err);
                    setTracks(scannedTracks);
                    setIsScanning(false);
                    setIsDriveMissing(false);
                });
                break;
            }

            case 'ALBUM_COVER': {
                const { albumKey, coverBuffer, mimeType } = msg.payload;
                const blob = new Blob([coverBuffer], { type: mimeType });
                const url = URL.createObjectURL(blob);
                setAlbumCovers(prev => ({ ...prev, [albumKey]: url }));
                set(`cover-${albumKey}`, { coverBuffer, mimeType }).catch(e =>
                    console.warn('Failed to persist cover', e),
                );
                break;
            }

            case 'STATE_UPDATE':
                setQueue(msg.payload.queue);
                setShuffleState(msg.payload.shuffle);
                setRepeatState(msg.payload.repeat);
                audioEngineInternals.setRepeat?.(msg.payload.repeat);
                break;

            case 'FILE_NOT_FOUND': {
                setIsDriveMissing(true);
                setIsPlaying(false);
                audioRef.current?.pause();
                // Auto-rescan to recover stale file handles
                get('music-dir-handle').then((handle: unknown) => {
                    if (handle) {
                        setIsScanning(true);
                        workerRef.current?.postMessage({ type: 'SCAN_DIRECTORY', dirHandle: handle });
                    }
                }).catch(console.warn);
                break;
            }

            case 'NEXT_TRACK_PRELOADED': {
                const { track, file } = msg.payload;
                if (objectUrlRefNext.current) URL.revokeObjectURL(objectUrlRefNext.current);
                const fileUrl = URL.createObjectURL(file);
                objectUrlRefNext.current = fileUrl;
                if (audioRefNext.current) {
                    audioRefNext.current.src = fileUrl;
                    audioRefNext.current.load();
                    audioRefNext.current.volume = 0;
                }
                setPreloadedTrackId(track.id);
                break;
            }

            case 'TRACK_LOADED': {
                const { track: loadedTrack, file: loadedFile, coverBuffer, mimeType } = msg.payload;
                const vol = volumeRef.current;
                const preloadId = preloadedTrackIdRef.current;

                if (objectUrlRef.current && loadedTrack.id !== preloadId) {
                    URL.revokeObjectURL(objectUrlRef.current);
                }

                let coverUrl: string | undefined;
                if (coverBuffer) {
                    coverUrl = URL.createObjectURL(new Blob([coverBuffer], { type: mimeType }));
                }

                setCurrentTrack(prev => {
                    if (prev?.coverUrl) URL.revokeObjectURL(prev.coverUrl);
                    return { ...loadedTrack, coverUrl };
                });

                incrementPlayCount(loadedTrack.id);

                const isRestoring = isRestoringRef.current;
                setIsPlaying(!isRestoring);

                // Gapless swap — preloaded buffer already running in audioRefNext
                if (
                    audioRef.current &&
                    loadedTrack.id === preloadId &&
                    audioRefNext.current &&
                    objectUrlRefNext.current
                ) {
                    URL.revokeObjectURL(URL.createObjectURL(loadedFile));
                    const elapsed = audioRefNext.current.currentTime;
                    objectUrlRef.current = objectUrlRefNext.current;
                    objectUrlRefNext.current = null;
                    audioRef.current.pause();
                    audioRef.current.src = audioRefNext.current.src;
                    audioRef.current.currentTime = elapsed;
                    audioRef.current.volume = vol;
                    audioRefNext.current.src = '';
                    setPreloadedTrackId(null);
                    if (!isRestoring) audioRef.current.play().catch(console.error);
                } else {
                    const fileUrl = URL.createObjectURL(loadedFile);
                    objectUrlRef.current = fileUrl;
                    if (audioRef.current) {
                        audioRef.current.src = fileUrl;
                        audioRef.current.load();
                        audioRef.current.volume = vol;
                        if (isRestoring) {
                            const savedProgress = localStorage.getItem('player-progress');
                            if (savedProgress) {
                                const t = parseFloat(savedProgress);
                                audioRef.current.currentTime = t;
                                audio.setProgress(t);
                            }
                            isRestoringRef.current = false;
                        } else {
                            audioRef.current.play().catch(console.error);
                        }
                    }
                }

                localStorage.setItem('player-current-track-id', loadedTrack.id);
                break;
            }

            case 'STOP_PLAYBACK':
                setIsPlaying(false);
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                }
                break;

            case 'RESTART_PLAYBACK':
                if (audioRef.current) audioRef.current.currentTime = 0;
                break;
        }
    };

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    /** Patch play count for one track in IDB — never rewrites the full cache. */
    const incrementPlayCount = (trackId: string) => {
        get('ui-tracks-cache').then((cached: unknown) => {
            if (!Array.isArray(cached)) return;
            const idx = cached.findIndex((t: Track) => t.id === trackId);
            if (idx === -1) return;
            cached[idx] = { ...cached[idx], playCount: (cached[idx].playCount || 0) + 1, lastPlayed: Date.now() };
            set('ui-tracks-cache', cached).catch(console.error);
            setTracks(prev => {
                const next = [...prev];
                const tIdx = next.findIndex(t => t.id === trackId);
                if (tIdx !== -1) next[tIdx] = { ...next[tIdx], playCount: cached[idx].playCount, lastPlayed: cached[idx].lastPlayed };
                return next;
            });
        }).catch(console.error);
    };

    const restoreSessionAfterScan = (finalTracks: Track[]) => {
        const savedTrackId = localStorage.getItem('player-current-track-id');
        if (!savedTrackId || !finalTracks.find(t => t.id === savedTrackId)) return;

        const savedQueueIds = localStorage.getItem('player-queue-ids');
        if (savedQueueIds) {
            try {
                const ids = JSON.parse(savedQueueIds) as string[];
                const restoredQueue = ids
                    .map(id => finalTracks.find(t => t.id === id))
                    .filter((t): t is Track => !!t);
                if (restoredQueue.length > 0) {
                    const startIndex = Math.max(0, restoredQueue.findIndex(t => t.id === savedTrackId));
                    workerRef.current?.postMessage({ type: 'PLAY_CONTEXT', tracks: restoredQueue, startIndex });
                    isRestoringRef.current = true;
                    return;
                }
            } catch { /* fall through */ }
        }

        workerRef.current?.postMessage({ type: 'PLAY_TRACK', id: savedTrackId });
        isRestoringRef.current = true;
    };

    // ---------------------------------------------------------------------------
    // Shuffle / repeat
    // ---------------------------------------------------------------------------
    const setShuffle = (s: boolean) => {
        setShuffleState(s);
        localStorage.setItem('player-shuffle', s.toString());
        workerRef.current?.postMessage({ type: 'SET_SHUFFLE', shuffle: s });
    };

    const setRepeat = (r: 'off' | 'all' | 'one') => {
        setRepeatState(r);
        localStorage.setItem('player-repeat', r);
        audioEngineInternals.setRepeat?.(r);
        workerRef.current?.postMessage({ type: 'SET_REPEAT', repeat: r });
    };

    // ---------------------------------------------------------------------------
    // Playback commands
    // ---------------------------------------------------------------------------
    const playTrack = (id: string) => workerRef.current?.postMessage({ type: 'PLAY_TRACK', id });
    const playContext = (pTracks: Track[], startIndex: number) =>
        workerRef.current?.postMessage({ type: 'PLAY_CONTEXT', tracks: pTracks, startIndex });
    const nextTrack = () => workerRef.current?.postMessage({ type: 'NEXT_TRACK' });
    const prevTrack = (audioCurrentTime: number, resetAudio: () => void) => {
        if (audioCurrentTime > 3) { resetAudio(); return; }
        workerRef.current?.postMessage({ type: 'PREV_TRACK' });
    };

    // ---------------------------------------------------------------------------
    // Directory selection
    // ---------------------------------------------------------------------------
    const selectDirectory = async () => {
        try {
            if ('showDirectoryPicker' in window) {
                try {
                    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
                    await set('music-dir-handle', dirHandle);
                    savedHandleRef.current = dirHandle;
                    setHasSavedHandle(true);
                    setIsScanning(true);
                    workerRef.current?.postMessage({ type: 'SCAN_DIRECTORY', dirHandle });
                    return;
                } catch (e: any) {
                    if (e.name !== 'SecurityError' && !e.message?.includes('Cross origin')) throw e;
                    console.warn('showDirectoryPicker blocked, falling back to input element.');
                }
            }
            const input = document.createElement('input');
            input.type = 'file';
            (input as any).webkitdirectory = true;
            input.multiple = true;
            input.onchange = (e: any) => {
                const musicFiles: File[] = Array.from(e.target.files as FileList)
                    .filter((f: File) => /\.(flac|mp3|m4a|wav|ogg)$/i.test(f.name));
                if (musicFiles.length) {
                    setIsScanning(true);
                    workerRef.current?.postMessage({ type: 'SCAN_FILES', files: musicFiles });
                }
            };
            input.click();
        } catch (e) {
            console.error('Directory selection failed', e);
        }
    };

    const restoreLibrary = () => {
        if (savedHandleRef.current) {
            setIsScanning(true);
            workerRef.current?.postMessage({ type: 'SCAN_DIRECTORY', dirHandle: savedHandleRef.current });
        }
    };

    /** Patch one track's metadata in state and IDB — no rescan needed. */
    const updateTrack = (trackId: string, metadata: { title?: string; artist?: string; album?: string }) => {
        setTracks(prev => prev.map(t => (t.id === trackId ? { ...t, ...metadata } : t)));
        get('ui-tracks-cache').then((cached: unknown) => {
            if (!Array.isArray(cached)) return;
            const idx = cached.findIndex((t: Track) => t.id === trackId);
            if (idx === -1) return;
            cached[idx] = { ...cached[idx], ...metadata };
            set('ui-tracks-cache', cached).catch(console.error);
        }).catch(console.error);
    };

    return {
        tracks, currentTrack, queue, shuffle, repeat, albumCovers,
        scanProgress, isScanning, hasSavedHandle, isDriveMissing,
        workerRef, rehydrate, setTracks, setShuffle, setRepeat,
        playTrack, playContext, nextTrack, prevTrack,
        selectDirectory, restoreLibrary, updateTrack,
    };
};