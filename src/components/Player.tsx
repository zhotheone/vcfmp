import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, Music, Heart, ListPlus } from 'lucide-react';
import { usePlayer } from '../hooks/usePlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { PlaylistManagerPopup } from './popups/PlaylistManagerPopup';

export function Player() {
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    progress,
    duration,
    seek,
    volume,
    setVolume,
    nextTrack,
    prevTrack,
    accentColor,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    setSelectedAlbum,
    setCurrentView,
    likedSongs,
    toggleLike,
    theme,
    toggleMute,
    navigateTo
  } = usePlayer();

  const [showVolume, setShowVolume] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  return (
    <div className="px-0 md:px-4 pb-0 md:pb-4 bg-transparent w-full z-40 relative">
      <motion.div
        transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
        className="h-[64px] md:h-[88px] flex items-center px-4 md:px-6 gap-4 md:gap-6 shadow-top md:shadow-2xl transition-all duration-700 ease-out"
        style={{
          backgroundColor: theme.highlightMed,
          borderTopLeftRadius: window.innerWidth < 768 ? '1rem' : '2.5rem',
          borderTopRightRadius: window.innerWidth < 768 ? '1rem' : '2.5rem',
          borderBottomLeftRadius: window.innerWidth < 768 ? '0' : '2.5rem',
          borderBottomRightRadius: window.innerWidth < 768 ? '0' : '2.5rem',
          opacity: isPlaying ? 1 : (window.innerWidth < 768 ? 1 : 0.6),
          scale: isPlaying ? 1 : (window.innerWidth < 768 ? 1 : 0.98)
        }}
      >
        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
            onClick={togglePlayPause}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-colors duration-200"
            style={{ backgroundColor: theme.accent1, color: theme.bgMain }}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
            onClick={prevTrack}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
            onClick={nextTrack}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
            onClick={() => setShuffle(!shuffle)}
            className={`transition-colors duration-200 ease-in-out ${shuffle ? '' : 'text-zinc-400 hover:text-white'}`}
            style={shuffle ? { color: theme.accent1 } : {}}
          >
            <Shuffle className="w-5 h-5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
            onClick={() => {
              if (repeat === 'off') setRepeat('all');
              else if (repeat === 'all') setRepeat('one');
              else setRepeat('off');
            }}
            className={`transition-colors duration-200 ease-in-out ${repeat !== 'off' ? '' : 'text-zinc-400 hover:text-white'}`}
            style={repeat !== 'off' ? { color: theme.accent1 } : {}}
          >
            {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
          </motion.button>
        </div>

        <div className="hidden md:flex flex-row items-center flex-1 gap-3 text-xs text-zinc-400 min-w-[200px]">
          <span className="w-10 text-right">{formatTime(progress)}</span>
          <div className="flex-1 group relative flex items-center h-4">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={progress}
              onChange={handleSeek}
              className="absolute w-full h-full top-0 left-0 opacity-0 cursor-pointer z-10"
            />
            <div className="w-full h-1 bg-zinc-600 rounded-full overflow-hidden block">
              <div
                className="h-full rounded-full transition-colors duration-200 ease-in-out"
                style={{
                  width: `${duration ? (progress / duration) * 100 : 0}%`,
                  backgroundColor: accentColor
                }}
              ></div>
            </div>
          </div>
          <span className="w-10">{formatTime(duration)}</span>
        </div>

        {/* Mobile top mini-progress bar */}
        <div className="md:hidden absolute top-0 left-0 w-full h-0.5 bg-zinc-800 pointer-events-none">
          <div
            className="h-full transition-colors duration-200 ease-linear"
            style={{
              width: `${duration ? (progress / duration) * 100 : 0}%`,
              backgroundColor: accentColor
            }}
          ></div>
        </div>

        <div
          className="relative hidden md:flex items-center h-full flex-shrink-0"
          onMouseEnter={() => setShowVolume(true)}
          onMouseLeave={() => setShowVolume(false)}
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
            className="text-zinc-400 hover:text-white transition-colors h-full flex items-center px-2"
            onClick={toggleMute}
          >
            {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </motion.button>

          {showVolume && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-10 h-32 rounded-2xl shadow-xl flex items-center justify-center pb-2 z-50 transition-colors duration-200"
              style={{ backgroundColor: theme.highlightMed }}
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolume}
                className="absolute w-24 h-4 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 opacity-0 cursor-pointer z-10"
              />
              <div className="absolute w-2 h-24 bg-zinc-600 rounded-full bottom-4 pointer-events-none overflow-hidden">
                <div
                  className="absolute bottom-0 w-full rounded-full transition-colors duration-200 ease-in-out"
                  style={{ height: `${volume * 100}%`, backgroundColor: accentColor }}
                />
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex flex-1 items-center gap-3 min-w-0 md:max-w-[400px] flex-shrink-1 md:flex-shrink-0 md:border-l border-white/5 md:pl-6 md:ml-2">
          {currentTrack ? (
            <>
              <div className="w-12 h-12 bg-zinc-800 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center shadow-md">
                {currentTrack.coverUrl ? (
                  <img src={currentTrack.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <div className="flex flex-col truncate pr-2 flex-1">
                <span
                  className="text-white text-sm hover:underline cursor-pointer truncate font-medium"
                  onClick={() => {
                    setSelectedAlbum(currentTrack.album);
                    setCurrentView('album');
                  }}
                >
                  {currentTrack.title}
                </span>
                <div className="text-zinc-400 text-xs truncate">
                  <span
                    className="hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateTo('artist', currentTrack.artist);
                    }}
                  >
                    {currentTrack.artist}
                  </span>
                  {currentTrack.features && currentTrack.features.map((feature, i) => (
                    <React.Fragment key={i}>
                      <span className="cursor-default whitespace-pre text-zinc-500">
                        {i === 0 && currentTrack.features!.length > 1 ? ', ' : i === 0 ? ' feat. ' : ', '}
                      </span>
                      <span
                        className="hover:underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateTo('artist', feature);
                        }}
                      >
                        {feature}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full opacity-50">
              <div className="w-12 h-12 bg-zinc-800 rounded flex items-center justify-center">
                <Music className="w-5 h-5 text-zinc-500" />
              </div>
              <div className="flex flex-col flex-1 gap-2">
                <div className="w-full h-3 bg-zinc-800 rounded"></div>
                <div className="w-2/3 h-2 bg-zinc-800 rounded"></div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Like/List Icons */}
        <div className="hidden md:flex items-center gap-4 flex-shrink-0 text-zinc-400">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
            className="hover:text-white transition-colors flex items-center justify-center"
            disabled={!currentTrack}
            onClick={() => currentTrack && toggleLike(currentTrack.id)}
          >
            <Heart
              className={`w-5 h-5`}
              fill={currentTrack && likedSongs.includes(currentTrack.id) ? 'currentColor' : 'none'}
              style={currentTrack && likedSongs.includes(currentTrack.id) ? { color: theme.accent1 } : {}}
            />
          </motion.button>

          <div className="relative flex items-center justify-center">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              onClick={() => setIsPlaylistModalOpen(true)}
              className="hover:text-white transition-colors flex items-center justify-center"
              disabled={!currentTrack}
            >
              <ListPlus className="w-5 h-5" />
            </motion.button>
            <AnimatePresence>
              {isPlaylistModalOpen && (
                <PlaylistManagerPopup
                  isOpen={isPlaylistModalOpen}
                  onClose={() => setIsPlaylistModalOpen(false)}
                  track={currentTrack}
                  position="bottom-right"
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-3 flex-shrink-0 ml-auto">
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200"
            style={{ backgroundColor: theme.highlightHigh, color: theme.accent1 }}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-1" />
            )}
          </button>
          <button
            onClick={nextTrack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-300 transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

      </motion.div>

    </div>
  );
}
