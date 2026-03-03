import { useEffect } from 'react';
import { get } from 'idb-keyval';
import { PlayerProvider } from './context/PlayerContext';
import { usePlayer } from './hooks/usePlayer';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { Player } from './components/Player';
import { InsertMediaPopup } from './components/popups/InsertMediaPopup';
import { getAlbumCoverKey } from './utils/player';
import { Track } from './types';

// ---------------------------------------------------------------------------
// Bootstrap — runs once, outside the render cycle
// Loads IDB cache, resolves the directory handle and its permission, then
// hands everything to the library hook via rehydrate().
// ---------------------------------------------------------------------------
async function bootstrapLibrary(): Promise<{
  cachedTracks: Track[];
  cachedCovers: Record<string, string>;
  dirHandle: FileSystemDirectoryHandle | null;
  hasSavedHandle: boolean;
  isDriveMissing: boolean;
}> {
  let cachedTracks: Track[] = [];
  let cachedCovers: Record<string, string> = {};
  let dirHandle: FileSystemDirectoryHandle | null = null;
  let hasSavedHandle = false;
  let isDriveMissing = false;

  // 1. Load track metadata cache — gives the UI an instant library on first render
  try {
    const stored = await get('ui-tracks-cache');
    if (Array.isArray(stored) && stored.length > 0) {
      cachedTracks = stored as Track[];

      // Load album covers from IDB in parallel
      const uniqueKeys = new Set(
        cachedTracks.map(t => getAlbumCoverKey(t.artist, t.album)),
      );
      const coverEntries = await Promise.all(
        [...uniqueKeys].map(async key => {
          try {
            const entry: any = await get(`cover-${key}`);
            if (entry?.coverBuffer) {
              const blob = new Blob([entry.coverBuffer], { type: entry.mimeType });
              return [key, URL.createObjectURL(blob)] as [string, string];
            }
          } catch { /* skip */ }
          return null;
        }),
      );
      cachedCovers = Object.fromEntries(coverEntries.filter(Boolean) as [string, string][]);
    }
  } catch (e) {
    console.error('Failed to load track cache', e);
  }

  // 2. Resolve directory handle + permission
  //    FileSystemFileHandle cannot be persisted — only the directory handle is stored.
  //    A background scan will rehydrate real File objects in the worker.
  try {
    const handle = await get('music-dir-handle') as FileSystemDirectoryHandle | undefined;
    if (handle) {
      hasSavedHandle = true;

      // Check if the media is still accessible before requesting permission
      let mediaAccessible = false;
      try {
        const iter = (handle as any).values();
        await iter.next();
        mediaAccessible = true;
      } catch {
        mediaAccessible = false;
      }

      if (mediaAccessible) {
        // queryPermission is non-destructive — it never shows a prompt.
        // Permission is either already granted from this session or it isn't.
        const permission = await (handle as any).queryPermission({ mode: 'read' });
        if (permission === 'granted') {
          dirHandle = handle;
        }
        // If permission is 'prompt' or 'denied', dirHandle stays null.
        // The worker will not scan, and FILE_NOT_FOUND will trigger a rescan
        // once the user interacts with the player.
      } else {
        isDriveMissing = true;
      }
    }
  } catch (e) {
    console.error('Failed to resolve directory handle', e);
  }

  return { cachedTracks, cachedCovers, dirHandle, hasSavedHandle, isDriveMissing };
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
function AppContent() {
  const { currentTrack, isPlaying, theme, albumCovers, rehydrate } = usePlayer();

  // Run bootstrap once on mount and hand results to the library hook
  useEffect(() => {
    bootstrapLibrary().then(rehydrate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrolling document title
  useEffect(() => {
    let intervalId: number;
    if (currentTrack) {
      const fullTitle = `${isPlaying ? '▶' : '⏸'} ${currentTrack.title} - ${currentTrack.artist} `;
      let scrollIndex = 0;
      document.title = fullTitle;
      intervalId = window.setInterval(() => {
        scrollIndex = (scrollIndex + 1) % fullTitle.length;
        document.title = fullTitle.substring(scrollIndex) + fullTitle.substring(0, scrollIndex);
      }, 300);
    } else {
      document.title = 'VCFMP';
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [currentTrack?.title, currentTrack?.artist, isPlaying]);

  // Album art favicon
  useEffect(() => {
    if (!currentTrack) return;
    const albumKey = getAlbumCoverKey(currentTrack.artist, currentTrack.album);
    const coverUrl = albumCovers[albumKey] || currentTrack.coverUrl;
    if (!coverUrl) return;

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (link.href !== coverUrl) link.href = coverUrl;
  }, [currentTrack?.artist, currentTrack?.album, currentTrack?.coverUrl, albumCovers]);

  return (
    <div
      className="flex flex-col h-[100dvh] text-white overflow-hidden font-sans transition-colors duration-700 ease-out"
      style={{ backgroundColor: theme.bgMain }}
    >
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 p-0 md:p-2 gap-0 md:gap-2">
        <Sidebar className="order-2 md:order-1" />
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative z-0 order-1 md:order-2">
          <MainContent />
        </div>
      </div>
      <Player />
      <InsertMediaPopup />
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}