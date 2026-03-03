import React, { createContext, useCallback, useState, ReactNode } from 'react';
import { View, HistoryItem, Playlist, Theme, Track, ThemeType } from '../types';

import { useTheme } from '../hooks/useTheme';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useLibraryWorker } from '../hooks/useLibraryWorker';
import { useMediaSession } from '../hooks/useMediaSession';
import { useLikedSongs } from '../hooks/useLikedSongs';
import { usePlaylistManager } from '../hooks/usePlaylistManager';
import { useNavigation } from '../hooks/useNavigation';

// ---------------------------------------------------------------------------
// Public context shape — unchanged from original so all consumers still compile
// ---------------------------------------------------------------------------
export interface PlayerContextType {
  // Library
  tracks: Track[];
  currentTrack: Track | null;
  queue: Track[];
  shuffledQueue: Track[];
  albumCovers: Record<string, string>;
  scanProgress: { current: number; total: number };
  isScanning: boolean;
  hasSavedHandle: boolean;
  isDriveMissing: boolean;
  // Playback
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  // Navigation
  currentView: View;
  selectedArtist: string | null;
  selectedAlbum: string | null;
  history: HistoryItem[];
  searchQuery: string;
  // Social
  likedSongs: string[];
  playlists: Playlist[];
  // Theme
  theme: Theme;
  themeType: ThemeType;
  accentColor: string;
  // Actions — playback
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
  // Actions — library
  rehydrate: (opts: import('../hooks/useLibraryWorker').RehydrateOptions) => void;
  selectDirectory: () => void;
  restoreLibrary: () => void;
  updateTrack: (trackId: string, metadata: { title?: string; artist?: string; album?: string }) => void;
  // Actions — navigation
  setCurrentView: (view: View) => void;
  setSelectedArtist: (artist: string | null) => void;
  setSelectedAlbum: (album: string | null) => void;
  navigateTo: (view: View, name: string) => void;
  clearHistory: () => void;
  removeHistoryItem: (id: string) => void;
  setSearchQuery: (query: string) => void;
  // Actions — social
  toggleLike: (trackId: string) => void;
  // Actions — playlists
  createPlaylist: (name: string) => void;
  renamePlaylist: (id: string, newName: string) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  importPlaylists: (imported: Playlist[]) => void;
  // Actions — theme
  setTheme: (theme: ThemeType) => void;
}

export const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider — composes hooks, wires cross-hook dependencies
// ---------------------------------------------------------------------------
export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const themeHook = useTheme();
  const audioEngine = useAudioEngine();
  const library = useLibraryWorker(audioEngine);
  const liked = useLikedSongs();
  const playlists = usePlaylistManager();
  const nav = useNavigation();

  // Wire Media Session — stable callbacks via useCallback to avoid re-registration
  const onPlay = useCallback(
    () => audioEngine.togglePlayPause(library.currentTrack),
    [audioEngine, library.currentTrack],
  );
  const onPause = useCallback(
    () => audioEngine.togglePlayPause(library.currentTrack),
    [audioEngine, library.currentTrack],
  );

  useMediaSession({
    currentTrack: library.currentTrack,
    isPlaying: audioEngine.isPlaying,
    duration: audioEngine.duration,
    onPlay,
    onPause,
    onNext: library.nextTrack,
    onPrev: () => library.prevTrack(
      audioEngine.audioRef.current?.currentTime ?? 0,
      () => { if (audioEngine.audioRef.current) audioEngine.audioRef.current.currentTime = 0; },
    ),
    onSeek: audioEngine.seek,
  });

  // Cross-hook wiring: deletePlaylist needs to know current navigation state
  const deletePlaylist = (id: string) =>
    playlists.deletePlaylist(id, nav.currentView, nav.selectedAlbum, () =>
      nav.setCurrentView('library'),
    );

  // navigateTo needs the track list to resolve album → artist
  const navigateTo = (view: View, name: string) => nav.navigateTo(view, name, library.tracks);

  return (
    <PlayerContext.Provider
      value={{
        // Library
        tracks: library.tracks,
        currentTrack: library.currentTrack,
        queue: library.queue,
        shuffledQueue: [], // populated by worker STATE_UPDATE via queue if needed
        albumCovers: library.albumCovers,
        scanProgress: library.scanProgress,
        isScanning: library.isScanning,
        hasSavedHandle: library.hasSavedHandle,
        isDriveMissing: library.isDriveMissing,
        // Playback
        isPlaying: audioEngine.isPlaying,
        progress: audioEngine.progress,
        duration: audioEngine.duration,
        volume: audioEngine.volume,
        shuffle: library.shuffle,
        repeat: library.repeat,
        // Navigation
        currentView: nav.currentView,
        selectedArtist: nav.selectedArtist,
        selectedAlbum: nav.selectedAlbum,
        history: nav.history,
        searchQuery,
        // Social
        likedSongs: liked.likedSongs,
        playlists: playlists.playlists,
        // Theme
        theme: themeHook.theme,
        themeType: themeHook.themeType,
        accentColor: themeHook.accentColor,
        // Actions — playback
        togglePlayPause: () => audioEngine.togglePlayPause(library.currentTrack),
        playTrack: library.playTrack,
        playContext: library.playContext,
        nextTrack: library.nextTrack,
        prevTrack: () => library.prevTrack(
          audioEngine.audioRef.current?.currentTime ?? 0,
          () => { if (audioEngine.audioRef.current) audioEngine.audioRef.current.currentTime = 0; },
        ),
        seek: audioEngine.seek,
        setVolume: audioEngine.setVolume,
        setShuffle: library.setShuffle,
        setRepeat: library.setRepeat,
        toggleMute: audioEngine.toggleMute,
        // Actions — library
        rehydrate: library.rehydrate,
        selectDirectory: library.selectDirectory,
        restoreLibrary: library.restoreLibrary,
        updateTrack: library.updateTrack,
        // Actions — navigation
        setCurrentView: nav.setCurrentView,
        setSelectedArtist: nav.setSelectedArtist,
        setSelectedAlbum: nav.setSelectedAlbum,
        navigateTo,
        clearHistory: nav.clearHistory,
        removeHistoryItem: nav.removeHistoryItem,
        setSearchQuery,
        // Actions — social
        toggleLike: liked.toggleLike,
        // Actions — playlists
        createPlaylist: playlists.createPlaylist,
        renamePlaylist: playlists.renamePlaylist,
        deletePlaylist,
        addTrackToPlaylist: playlists.addTrackToPlaylist,
        removeTrackFromPlaylist: playlists.removeTrackFromPlaylist,
        importPlaylists: playlists.importPlaylists,
        // Actions — theme
        setTheme: themeHook.setTheme,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};