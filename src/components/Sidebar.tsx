import React, { useState } from 'react';
import { FolderOpen, Heart, Plus, ListMusic, Settings, Library } from 'lucide-react';
import { usePlayer } from '../hooks/usePlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { PlaylistManagerPopup } from './popups/PlaylistManagerPopup';
import { SettingsPopup } from './popups/SettingsPopup';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = '' }: SidebarProps) {
  const { selectDirectory, isScanning, scanProgress, hasSavedHandle, currentView, setCurrentView, theme, playlists, setSelectedAlbum, selectedAlbum } = usePlayer();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className={`flex shrink-0 ${className}`}>
      {/* Desktop Sidebar */}
      <div
        className="hidden md:flex w-72 h-full flex-col p-4 rounded-3xl transition-colors duration-700 ease-out flex-shrink-0"
        style={{ backgroundColor: theme.bgOverlay }}
      >
        <div className="flex items-center gap-2 mb-8 px-4 mt-4">
          <span className="text-2xl font-bold tracking-tight transition-colors duration-200 ease-in-out" style={{ color: theme.accent1 }}>VCFMP</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          <div className="space-y-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              onClick={selectDirectory}
              className="flex items-center gap-4 font-semibold hover:bg-white/5 transition-colors w-full px-4 py-3 rounded-full"
            >
              <FolderOpen className="w-5 h-5 text-zinc-400" />
              Open Folder
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-4 font-semibold hover:bg-white/5 transition-colors w-full px-4 py-3 rounded-full"
            >
              <Settings className="w-5 h-5 text-zinc-400" />
              Settings
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              onClick={() => setCurrentView('liked')}
              className="flex items-center gap-4 font-semibold transition-colors w-full px-4 py-3 rounded-full"
              style={currentView === 'liked' ? { backgroundColor: theme.highlightLow, color: theme.fgSecondary } : { color: 'white' }}
            >
              <Heart className="w-5 h-5" fill={currentView === 'liked' ? 'currentColor' : 'none'} />
              Liked Songs
            </motion.button>
          </div>

          <AnimatePresence>
            {isSettingsOpen && (
              <SettingsPopup
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
              />
            )}
          </AnimatePresence>

          <div className="pt-4 mt-4 border-t border-white/10">
            <div className="flex items-center justify-between px-4 mb-2 relative">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Playlists</span>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
              >
                <Plus className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {isCreateModalOpen && (
                  <PlaylistManagerPopup
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    position="top-right"
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-1">
              {playlists.map(playlist => (
                <motion.button
                  key={playlist.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
                  onClick={() => {
                    setSelectedAlbum(playlist.id); // Reusing selectedAlbum for playlist ID view routing
                    setCurrentView('playlist');
                  }}
                  className="flex items-center gap-4 font-semibold transition-colors w-full px-4 py-3 rounded-full truncate"
                  style={currentView === 'playlist' && selectedAlbum === playlist.id ? { backgroundColor: theme.highlightLow, color: theme.fgSecondary } : { color: 'white' }}
                >
                  <ListMusic className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate">{playlist.name}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {isScanning ? (
            <div className="text-sm text-zinc-400 px-4 mt-8">
              Scanning... {scanProgress.current}/{scanProgress.total}
            </div>
          ) : hasSavedHandle ? (
            <div className="text-sm text-zinc-400 px-4 mt-8">
              Library loaded
            </div>
          ) : null}

        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div
        className="md:hidden flex w-full h-16 items-center justify-around px-2 flex-shrink-0 border-t border-white/5 relative z-50 bg-opacity-90 backdrop-blur-md"
        style={{ backgroundColor: theme.bgOverlay }}
      >
        <button onClick={selectDirectory} className="p-3 text-zinc-400 hover:text-white transition-colors flex flex-col items-center">
          <FolderOpen className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Open</span>
        </button>
        <button
          onClick={() => setCurrentView('library')}
          className={`p-3 transition-colors flex flex-col items-center ${currentView === 'library' ? '' : 'text-zinc-400 hover:text-white'}`}
          style={currentView === 'library' ? { color: theme.accent1 } : {}}
        >
          <Library className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Library</span>
        </button>
        <button
          onClick={() => setCurrentView('liked')}
          className={`p-3 transition-colors flex flex-col items-center ${currentView === 'liked' ? '' : 'text-zinc-400 hover:text-white'}`}
          style={currentView === 'liked' ? { color: theme.accent1 } : {}}
        >
          <Heart className="w-5 h-5 mb-1" fill={currentView === 'liked' ? 'currentColor' : 'none'} />
          <span className="text-[10px]">Liked</span>
        </button>
        <button onClick={() => setIsCreateModalOpen(true)} className="p-3 text-zinc-400 hover:text-white transition-colors flex flex-col items-center relative">
          <Plus className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Playlist</span>
        </button>
        <button onClick={() => setIsSettingsOpen(true)} className="p-3 text-zinc-400 hover:text-white transition-colors flex flex-col items-center relative">
          <Settings className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Settings</span>
        </button>
      </div>
    </div>
  );
}
