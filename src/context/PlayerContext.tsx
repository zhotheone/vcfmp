import React, { createContext, useState, useRef, useEffect, ReactNode } from 'react';
import { get, set } from 'idb-keyval';
import { View, HistoryItem, Playlist, Theme, Track, ThemeType } from '../types';
import { getAlbumCoverKey } from '../utils/player';

export interface PlayerContextType {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Track[];
  shuffledQueue: Track[];
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  currentView: View;
  selectedArtist: string | null;
  selectedAlbum: string | null;
  history: HistoryItem[];
  scanProgress: { current: number; total: number };
  isScanning: boolean;
  hasSavedHandle: boolean;
  isDriveMissing: boolean;
  searchQuery: string;
  theme: Theme;
  themeType: ThemeType;
  setTheme: (theme: ThemeType) => void;
  togglePlayPause: () => void;
  playTrack: (id: string) => void;
  playContext: (tracks: Track[], startIndex: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeat: (repeat: 'off' | 'all' | 'one') => void;
  toggleMute: () => void;
  selectDirectory: () => void;
  setCurrentView: (view: View) => void;
  setSelectedArtist: (artist: string | null) => void;
  setSelectedAlbum: (album: string | null) => void;
  clearHistory: () => void;
  removeHistoryItem: (id: string) => void;
  setSearchQuery: (query: string) => void;
  toggleLike: (trackId: string) => void;
  playlists: Playlist[];
  createPlaylist: (name: string) => void;
  renamePlaylist: (id: string, newName: string) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  importPlaylists: (imported: Playlist[]) => void;
  restoreLibrary: () => void;
  navigateTo: (view: View, name: string) => void;
  updateTrack: (trackId: string, metadata: { title?: string; artist?: string; album?: string }) => void;
  albumCovers: Record<string, string>;
  accentColor: string;
}

const THEMES: Record<ThemeType, Theme> = {
  'monochrome': {
    bgMain: '#09090b',
    bgSecondary: '#18181b', // Originally surfaceContainerLow 
    bgOverlay: '#27272a', // Originally surfaceContainer
    fgMain: '#fafafa',
    fgSecondary: '#d4d4d8',
    fgMuted: '#a1a1aa',
    highlightLow: '#27272a',
    highlightMed: '#3f3f46', // surfaceContainerHigh
    highlightHigh: '#52525b', // surfaceContainerHighest
    accent1: '#fafafa', // primary
    accent2: '#a1a1aa', // lightVibrant
    accent3: '#71717a', // muted
    accent4: '#52525b', // vibrant
  },
  'rose-pine': {
    bgMain: '#191724',
    bgSecondary: '#1f1d2e',
    bgOverlay: '#21202e',
    fgMain: '#e0def4',
    fgSecondary: '#9ccfd8',
    fgMuted: '#c4a7e7',
    highlightLow: '#403d52', // secondaryContainer
    highlightMed: '#26233a', // surfaceContainerHigh
    highlightHigh: '#403d52', // surfaceContainerHighest
    accent1: '#ebbcba', // primary
    accent2: '#31748f',
    accent3: '#9ccfd8',
    accent4: '#c4a7e7',
  },
  'rose-pine-dawn': {
    bgMain: '#faf4ed',
    bgSecondary: '#fffaf3',
    bgOverlay: '#f2e9e1',
    fgMain: '#575279',
    fgSecondary: '#907aa9',
    fgMuted: '#575279',
    highlightLow: '#dfdad5',
    highlightMed: '#e8e1d9',
    highlightHigh: '#dfdad5',
    accent1: '#d7827e', // primary
    accent2: '#286983',
    accent3: '#56949f',
    accent4: '#907aa9',
  }
};

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [shuffledQueue, setShuffledQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');

  const [currentView, setCurrentView] = useState<View>('library');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [isScanning, setIsScanning] = useState(false);
  const [hasSavedHandle, setHasSavedHandle] = useState(false);
  const [savedHandle, setSavedHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isDriveMissing, setIsDriveMissing] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [likedSongs, setLikedSongs] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const workerRef = useRef<Worker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [themeType, setThemeState] = useState<ThemeType>('rose-pine');
  const [hasRestoredTracks, setHasRestoredTracks] = useState(false);
  const [albumCovers, setAlbumCovers] = useState<Record<string, string>>({});
  const [lastVolume, setLastVolume] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRefNext = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const objectUrlRefNext = useRef<string | null>(null);
  const [preloadedTrackId, setPreloadedTrackId] = useState<string | null>(null);

  const theme = THEMES[themeType];

  useEffect(() => {
    audioRef.current = new Audio();
    audioRefNext.current = new Audio();

    // Load volume and persistence logic
    const savedVolume = localStorage.getItem('player-volume');
    if (savedVolume) setVolumeState(parseFloat(savedVolume));
    const savedShuffle = localStorage.getItem('player-shuffle');
    if (savedShuffle) setShuffle(savedShuffle === 'true');
    const savedRepeat = localStorage.getItem('player-repeat');
    if (savedRepeat) setRepeat(savedRepeat as 'off' | 'all' | 'one');
    const savedTheme = localStorage.getItem('player-theme');
    if (savedTheme) setThemeState(savedTheme as ThemeType);

    const savedHistory = localStorage.getItem('player-history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedView = localStorage.getItem('player-view');
    if (savedView) setCurrentView(savedView as View);
    const savedArtist = localStorage.getItem('player-artist');
    if (savedArtist) setSelectedArtist(savedArtist);
    const savedAlbum = localStorage.getItem('player-album');
    if (savedAlbum) setSelectedAlbum(savedAlbum);
  }, []);

  // Worker Initialization & Message Hub
  useEffect(() => {
    const worker = new Worker(new URL('../workers/libraryWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const msg = e.data;
      switch (msg.type) {
        case 'SCAN_PROGRESS':
          setScanProgress(msg.payload);
          break;
        case 'SCAN_COMPLETE': {
          const scannedTracks = msg.payload.tracks as Track[];
          get('ui-tracks-cache').then((cached: any) => {
            let finalTracks = scannedTracks;
            if (Array.isArray(cached)) {
              const cacheMap = new Map(cached.map((t: any) => [t.id, t]));
              finalTracks = scannedTracks.map(st => {
                const existing = cacheMap.get(st.id);
                if (existing) {
                  return {
                    ...st,
                    playCount: existing.playCount,
                    lastPlayed: existing.lastPlayed
                  };
                }
                return st;
              });
            }

            console.log(`[Library] Scan complete. Loaded ${finalTracks.length} tracks:`, finalTracks);
            setTracks(finalTracks);
            setIsScanning(false);
            setIsDriveMissing(false);

            setAlbumCovers(prev => {
              Object.values(prev).forEach(url => URL.revokeObjectURL(url as string));
              return {};
            });

            if (!hasRestoredTracks) {
              const savedTrackId = localStorage.getItem('player-current-track-id');
              const savedQueueIds = localStorage.getItem('player-queue-ids');

              if (savedTrackId) {
                const track = finalTracks.find(t => t.id === savedTrackId);
                if (track) {
                  if (savedQueueIds) {
                    try {
                      const ids = JSON.parse(savedQueueIds) as string[];
                      const restoredQueue = ids.map(id => finalTracks.find(t => t.id === id)).filter((t): t is Track => !!t);
                      if (restoredQueue.length > 0) {
                        const startIndex = restoredQueue.findIndex(t => t.id === savedTrackId);
                        worker.postMessage({ type: 'PLAY_CONTEXT', tracks: restoredQueue, startIndex: Math.max(0, startIndex) });
                      }
                    } catch (e) {
                      worker.postMessage({ type: 'PLAY_TRACK', id: savedTrackId });
                    }
                  } else {
                    worker.postMessage({ type: 'PLAY_TRACK', id: savedTrackId });
                  }
                  (window as any).__vcfmp_restoring = true;
                }
              }
              setHasRestoredTracks(true);
            }
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

          // Persist cover to IDB
          set(`cover-${albumKey}`, { coverBuffer, mimeType }).catch(e => console.warn('Failed to save cover', e));
          break;
        }
        case 'STATE_UPDATE':
          setQueue(msg.payload.queue);
          setShuffle(msg.payload.shuffle);
          setRepeat(msg.payload.repeat);
          break;
        case 'FILE_NOT_FOUND':
          setIsDriveMissing(true);
          setIsPlaying(false);
          if (audioRef.current) audioRef.current.pause();

          // If we fail to play a track, and we have a handle, initiate a rescan to try to fix it.
          get('music-dir-handle').then(handle => {
            if (handle && !isScanning) {
              setIsScanning(true);
              workerRef.current?.postMessage({ type: 'SCAN_DIRECTORY', dirHandle: handle as FileSystemDirectoryHandle });
            }
          }).catch(console.warn);

          break;
        case 'NEXT_TRACK_PRELOADED': {
          const { track, file } = msg.payload;

          if (objectUrlRefNext.current) {
            URL.revokeObjectURL(objectUrlRefNext.current);
          }

          const fileUrl = URL.createObjectURL(file);
          objectUrlRefNext.current = fileUrl;

          if (audioRefNext.current) {
            audioRefNext.current.src = fileUrl;
            audioRefNext.current.load();
            audioRefNext.current.volume = 0; // Prepare for fade
          }

          console.log(`[Gapless] Preloaded next track: ${track.title}`);
          setPreloadedTrackId(track.id);
          break;
        }
        case 'TRACK_LOADED':
          const { track: loadedTrack, file: loadedFile, coverBuffer: loadedCoverBuffer, mimeType: loadedMimeType } = msg.payload;

          // GARBAGE COLLECTION: Release previous song URLs instantly!
          // ONLY if we aren't swapping to our preloaded URL
          if (objectUrlRef.current && loadedTrack.id !== preloadedTrackId) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          if (currentTrack?.coverUrl) URL.revokeObjectURL(currentTrack.coverUrl);

          let coverUrl: string | undefined;
          if (loadedCoverBuffer) {
            const blob = new Blob([loadedCoverBuffer], { type: loadedMimeType });
            coverUrl = URL.createObjectURL(blob);
          }

          const fileUrl = URL.createObjectURL(loadedFile);

          setCurrentTrack({ ...loadedTrack, coverUrl }); // Track no longer holds File

          // SMART PLAYLIST LOGIC: Increment playCount and set lastPlayed
          get('ui-tracks-cache').then((cached: any) => {
            if (Array.isArray(cached)) {
              const idx = cached.findIndex(t => t.id === loadedTrack.id);
              if (idx !== -1) {
                cached[idx].playCount = (cached[idx].playCount || 0) + 1;
                cached[idx].lastPlayed = Date.now();
                set('ui-tracks-cache', cached).catch(console.error);

                // Update React state seamlessly
                setTracks(prev => {
                  const newTracks = [...prev];
                  const tIdx = newTracks.findIndex(t => t.id === loadedTrack.id);
                  if (tIdx !== -1) {
                    newTracks[tIdx] = { ...newTracks[tIdx], playCount: cached[idx].playCount, lastPlayed: cached[idx].lastPlayed };
                  }
                  return newTracks;
                });
              }
            }
          }).catch(console.error);

          const isRestoring = (window as any).__vcfmp_restoring;
          setIsPlaying(!isRestoring);

          if (audioRef.current && loadedTrack.id === preloadedTrackId && audioRefNext.current && objectUrlRefNext.current) {
            console.log(`[Gapless] Instant playback swap for: ${loadedTrack.title}`);

            // Release the freshly decoded track URL because we already have one pre-buffered
            URL.revokeObjectURL(fileUrl);

            // Promote Next -> Primary
            objectUrlRef.current = objectUrlRefNext.current;
            objectUrlRefNext.current = null;

            // Grab the exact elapsed time from the preloaded player
            const elapsedFadeTime = audioRefNext.current.currentTime;

            // Pause old audio and move source directly to the primary ref
            audioRef.current.pause();
            audioRef.current.src = audioRefNext.current.src;

            // Seek forward to account for the crossfade overlap that already occurred
            audioRef.current.currentTime = elapsedFadeTime;

            // Restore default volume
            audioRef.current.volume = volume;

            // Clear secondary context
            audioRefNext.current.src = '';
            setPreloadedTrackId(null);

            if (!isRestoring) {
              audioRef.current.play().catch(console.error);
            }
          } else {
            objectUrlRef.current = fileUrl;
            if (audioRef.current) {
              audioRef.current.src = fileUrl;
              audioRef.current.load();

              // Restore default volume
              audioRef.current.volume = volume;

              if (isRestoring) {
                const savedProgress = localStorage.getItem('player-progress');
                if (savedProgress) {
                  const time = parseFloat(savedProgress);
                  audioRef.current.currentTime = time;
                  setProgress(time);
                }
                (window as any).__vcfmp_restoring = false;
              } else {
                audioRef.current.play().catch(console.error);
              }
            }
          }

          localStorage.setItem('player-current-track-id', loadedTrack.id);
          break;
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

    return () => {
      worker.terminate();
      // Final cleanup of album cover URLs
      setAlbumCovers(prev => {
        Object.values(prev).forEach(url => URL.revokeObjectURL(url as string));
        return {};
      });
    };
  }, []);

  // Load saved directory handle on mount
  useEffect(() => {
    const loadSavedHandle = async () => {
      // 1. Load playlists and liked songs immediately
      try {
        const savedLikedSongs = await get('liked-songs');
        if (Array.isArray(savedLikedSongs)) {
          setLikedSongs(savedLikedSongs);
        }
      } catch (e) {
        console.error("Failed to load liked songs", e);
      }

      try {
        const savedPlaylists = await get('playlists');
        if (Array.isArray(savedPlaylists)) {
          setPlaylists(savedPlaylists);
        }
      } catch (e) {
        console.error("Failed to load playlists", e);
      }

      // 2. Load UI cache first so the UI is blocked for 0 seconds
      let hasCache = false;
      try {
        const cachedTracks = await get('ui-tracks-cache');
        if (Array.isArray(cachedTracks) && cachedTracks.length > 0) {
          console.log(`[Library] Loaded ${cachedTracks.length} tracks from UI cache immediately.`);
          workerRef.current?.postMessage({ type: 'RESTORE_CACHE', tracks: cachedTracks });
          setTracks(cachedTracks);
          hasCache = true;

          // Restore Album Covers from IDB
          const uniqueKeys = new Set<string>();
          cachedTracks.forEach((t: Track) => {
            const key = getAlbumCoverKey(t.artist, t.album);
            uniqueKeys.add(key);
          });

          const loadedCovers: Record<string, string> = {};
          for (const key of uniqueKeys) {
            try {
              const cachedCover: any = await get(`cover-${key}`);
              if (cachedCover && cachedCover.coverBuffer) {
                const blob = new Blob([cachedCover.coverBuffer], { type: cachedCover.mimeType });
                loadedCovers[key] = URL.createObjectURL(blob);
              }
            } catch (e) {
              console.warn(`Failed to restore cover for ${key}`, e);
            }
          }
          if (Object.keys(loadedCovers).length > 0) {
            setAlbumCovers(loadedCovers);
          }
        }
      } catch (e) {
        console.error("Failed to load cached tracks", e);
      }

      // 3. Try to access the physical drive
      try {
        const handle = await get('music-dir-handle');
        if (handle) {
          setHasSavedHandle(true);
          setSavedHandle(handle as FileSystemDirectoryHandle);

          let mediaExists = false;
          try {
            // Test if media is present by requesting the iterator
            const iterator = (handle as any).values();
            await iterator.next();
            mediaExists = true;
          } catch (e) {
            console.warn("Media appears to be missing:", e);
            mediaExists = false;
          }

          if (mediaExists) {
            // We just ensure we have permission, but we skip the initial exhaustive scan.
            // We'll rescan only when a cached file is missing.
            await (handle as any).queryPermission({ mode: 'read' });
          } else {
            setIsDriveMissing(true);
            setIsScanning(false);
          }
        }
      } catch (e) {
        console.error("Failed to load saved handle", e);
      }
    };

    loadSavedHandle();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let animationFrameId: number;

    const updateProgress = () => {
      setProgress(audio.currentTime);
      localStorage.setItem('player-progress', audio.currentTime.toString());

      // GAPLESS LOGIC: Trigger preload 10 seconds before end
      if (duration > 0 && duration - audio.currentTime <= 10 && !preloadedTrackId && isPlaying) {
        workerRef.current?.postMessage({ type: 'PRELOAD_NEXT_TRACK' });
      }

      // FADE LOGIC: 3 seconds before end, begin crossfade
      if (duration > 0 && duration - audio.currentTime <= 3 && audioRefNext.current?.src && isPlaying) {
        const fadeDuration = 3;
        const remaining = duration - audio.currentTime;
        const ratio = Math.max(0, Math.min(1, remaining / fadeDuration));

        // Primary audio fades OUT
        audio.volume = volume * ratio;

        // Next audio fades IN and begins playing
        const nextAudio = audioRefNext.current;
        if (nextAudio.paused) {
          nextAudio.play().catch(console.error);
        }
        nextAudio.volume = volume * (1 - ratio);
      }

      if (isPlaying) {
        animationFrameId = requestAnimationFrame(updateProgress);
      }

      // Update Media Session Position State
      if ('mediaSession' in navigator && duration > 0 && !isNaN(audio.currentTime)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, duration),
            playbackRate: audio.playbackRate,
            position: Math.min(Math.max(0, audio.currentTime), duration)
          });
        } catch (e) {
          // Ignore errors from invalid state during rapid changes
        }
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateProgress);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } else {
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }

    const handleEnded = () => {
      if (repeat === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        // If we crossfaded, audioRefNext is already playing - we just need the worker to advance the queue
        // so `TRACK_LOADED` comes back and performs the instant ref swap.
        workerRef.current?.postMessage({ type: 'NEXT_TRACK' });
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.volume = volume;

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [tracks, currentTrack, isPlaying, repeat, volume, duration]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const selectDirectory = async () => {
    try {
      // Try the modern File System Access API first
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker({
            mode: 'read'
          });
          await set('music-dir-handle', dirHandle);
          setHasSavedHandle(true);
          setSavedHandle(dirHandle);
          workerRef.current?.postMessage({ type: 'SCAN_DIRECTORY', dirHandle });
          setIsScanning(true);
          return;
        } catch (e: any) {
          // If it's a security error (like in cross-origin iframes), fall through to the input fallback
          if (e.name === 'SecurityError' || e.message.includes('Cross origin')) {
            console.warn("showDirectoryPicker blocked by cross-origin restriction, falling back to input element.");
          } else {
            throw e;
          }
        }
      }

      // Fallback for browsers that don't support showDirectoryPicker or when it's blocked by iframe restrictions
      const input = document.createElement('input');
      input.type = 'file';
      (input as any).webkitdirectory = true;
      (input as any).directory = true;
      input.multiple = true;

      input.onchange = async (e: any) => {
        const files = Array.from(e.target.files as FileList);
        if (files.length > 0) {
          setIsScanning(true);
          // Filter for music files
          const musicFiles = files.filter(file => {
            const name = file.name.toLowerCase();
            return name.endsWith('.flac') || name.endsWith('.mp3') || name.endsWith('.m4a') || name.endsWith('.wav') || name.endsWith('.ogg');
          });

          workerRef.current?.postMessage({ type: 'SCAN_FILES', files: musicFiles });
        }
      };

      input.click();
    } catch (e) {
      console.error("Directory selection cancelled or failed", e);
    }
  };

  const togglePlayPause = () => {
    if (!currentTrack) return;
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const playTrack = (id: string) => {
    workerRef.current?.postMessage({ type: 'PLAY_TRACK', id });
  };

  const playContext = (pTracks: Track[], startIndex: number) => {
    workerRef.current?.postMessage({ type: 'PLAY_CONTEXT', tracks: pTracks, startIndex });
  };

  const nextTrack = () => {
    workerRef.current?.postMessage({ type: 'NEXT_TRACK' });
  };

  const prevTrack = () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    workerRef.current?.postMessage({ type: 'PREV_TRACK' });
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  // Media Session Handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        if (!isPlaying && currentTrack) togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (isPlaying && currentTrack) togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && duration > 0) {
          seek(details.seekTime);
        }
      });
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      }
    };
  }, [currentTrack, isPlaying, prevTrack, nextTrack, togglePlayPause, seek, duration]);

  // Media Session Metadata
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      if (currentTrack.coverUrl) {
        // Many OS mediaplayers fail to load `blob:` protocol images in the MediaSession API.
        // We render it to an offscreen canvas and export a native data URI.
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 512, 512);
            const dataUrl = canvas.toDataURL('image/png');
            navigator.mediaSession.metadata = new MediaMetadata({
              title: currentTrack.title,
              artist: currentTrack.artist,
              album: currentTrack.album,
              artwork: [{ src: dataUrl, sizes: '512x512', type: 'image/png' }]
            });
          }
        };
        img.src = currentTrack.coverUrl;
      } else {
        // No cover, still update textual metadata
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artwork: []
        });
      }
    }
  }, [currentTrack]);

  const setVolume = (v: number) => {
    setVolumeState(v);
    if (v > 0) setLastVolume(v);
    localStorage.setItem('player-volume', v.toString());
  };

  const toggleMute = () => {
    if (volume > 0) {
      setVolume(0);
    } else {
      setVolume(lastVolume);
    }
  };

  const handleSetShuffle = (s: boolean) => {
    setShuffle(s);
    localStorage.setItem('player-shuffle', s.toString());
    workerRef.current?.postMessage({ type: 'SET_SHUFFLE', shuffle: s });
  };

  const handleSetRepeat = (r: 'off' | 'all' | 'one') => {
    setRepeat(r);
    localStorage.setItem('player-repeat', r);
    workerRef.current?.postMessage({ type: 'SET_REPEAT', repeat: r });
  };

  useEffect(() => {
    localStorage.setItem('player-view', currentView);
  }, [currentView]);

  useEffect(() => {
    if (selectedArtist) localStorage.setItem('player-artist', selectedArtist);
    else localStorage.removeItem('player-artist');
  }, [selectedArtist]);

  useEffect(() => {
    if (selectedAlbum) localStorage.setItem('player-album', selectedAlbum);
    else localStorage.removeItem('player-album');
  }, [selectedAlbum]);

  useEffect(() => {
    if (queue.length > 0) {
      localStorage.setItem('player-queue-ids', JSON.stringify(queue.map(t => t.id)));
    }
  }, [queue]);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('player-history');
  };

  const removeHistoryItem = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('player-history', JSON.stringify(newHistory));
  };

  const handleSetCurrentView = (view: View) => {
    setCurrentView(view);
    if (view === 'liked') {
      setSelectedArtist(null);
      setSelectedAlbum(null);
    }
  };

  const toggleLike = async (trackId: string) => {
    const newLikedSongs = likedSongs.includes(trackId)
      ? likedSongs.filter(id => id !== trackId)
      : [...likedSongs, trackId];

    setLikedSongs(newLikedSongs);
    try {
      await set('liked-songs', newLikedSongs);
    } catch (e) {
      console.error("Failed to save liked songs", e);
    }
  };

  const createPlaylist = async (name: string) => {
    const newPlaylist: Playlist = {
      id: crypto.randomUUID(),
      name,
      trackIds: [],
      createdAt: Date.now()
    };
    const newPlaylists = [...playlists, newPlaylist];
    setPlaylists(newPlaylists);
    await set('playlists', newPlaylists);
  };

  const renamePlaylist = async (id: string, newName: string) => {
    const newPlaylists = playlists.map(p =>
      p.id === id ? { ...p, name: newName } : p
    );
    setPlaylists(newPlaylists);
    await set('playlists', newPlaylists);
  };

  const deletePlaylist = async (id: string) => {
    const newPlaylists = playlists.filter(p => p.id !== id);
    setPlaylists(newPlaylists);
    if (currentView === 'playlist' && selectedAlbum === id) {
      setCurrentView('library');
    }
    await set('playlists', newPlaylists);
  };

  const addTrackToPlaylist = async (playlistId: string, trackId: string) => {
    const newPlaylists = playlists.map(p => {
      if (p.id === playlistId && !p.trackIds.includes(trackId)) {
        return { ...p, trackIds: [...p.trackIds, trackId] };
      }
      return p;
    });
    setPlaylists(newPlaylists);
    await set('playlists', newPlaylists);
  };

  const importPlaylists = async (imported: Playlist[]) => {
    // Basic validation: ensure they have required fields
    const valid = imported.filter(p => p.id && p.name && Array.isArray(p.trackIds));
    if (valid.length === 0) return;

    // Merge or replace? Let's merge by ID, keeping imported ones as newer if IDs match
    const merged = [...playlists];
    valid.forEach(imp => {
      const idx = merged.findIndex(p => p.id === imp.id);
      if (idx > -1) {
        merged[idx] = imp;
      } else {
        merged.push(imp);
      }
    });

    setPlaylists(merged);
    await set('playlists', merged);
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    const newPlaylists = playlists.map(p => {
      if (p.id === playlistId) {
        return { ...p, trackIds: p.trackIds.filter(id => id !== trackId) };
      }
      return p;
    });
    setPlaylists(newPlaylists);
    await set('playlists', newPlaylists);
  };

  const setTheme = (t: ThemeType) => {
    setThemeState(t);
    localStorage.setItem('player-theme', t);
  };

  const restoreLibrary = () => {
    if (savedHandle) {
      workerRef.current?.postMessage({ type: 'SCAN_DIRECTORY', dirHandle: savedHandle });
      setIsScanning(true);
    }
  };

  const navigateTo = (view: View, name: string) => {
    setCurrentView(view);
    if (view === 'artist') {
      setSelectedArtist(name);
      setSelectedAlbum(null);
    } else if (view === 'album') {
      setSelectedAlbum(name);
      // Find artist for this album if possible
      const albumTrack = tracks.find(t => t.album === name);
      if (albumTrack) setSelectedArtist(albumTrack.artist);
    }

    const newHistoryItem: HistoryItem = {
      id: crypto.randomUUID(),
      type: view === 'artist' ? 'artist' : 'album',
      name: name
    };
    const newHistory = [newHistoryItem, ...history.filter(h => h.name !== name)].slice(0, 3);
    setHistory(newHistory);
    localStorage.setItem('player-history', JSON.stringify(newHistory));
  };

  const updateTrack = (trackId: string, metadata: { title?: string; artist?: string; album?: string }) => {
    const newTracks = tracks.map(t =>
      t.id === trackId ? { ...t, ...metadata } : t
    );
    setTracks(newTracks);
    // In a real app, we'd persist this update to IndexedDB or the original file via File System Access API
  };

  const accentColor = theme.accent1;

  return (
    <PlayerContext.Provider
      value={{
        tracks,
        currentTrack,
        isPlaying,
        progress,
        duration,
        volume,
        queue,
        shuffledQueue,
        shuffle,
        repeat,
        currentView,
        selectedArtist,
        selectedAlbum,
        history,
        likedSongs,
        scanProgress,
        isScanning,
        hasSavedHandle,
        isDriveMissing,
        searchQuery,
        theme,
        themeType,
        setTheme,
        togglePlayPause,
        playTrack,
        playContext,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        setShuffle: handleSetShuffle,
        setRepeat: handleSetRepeat,
        selectDirectory,
        setCurrentView: handleSetCurrentView,
        setSelectedArtist,
        setSelectedAlbum,
        clearHistory,
        removeHistoryItem,
        setSearchQuery,
        toggleLike,
        playlists,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        importPlaylists,
        restoreLibrary,
        navigateTo,
        updateTrack,
        albumCovers,
        accentColor
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};
