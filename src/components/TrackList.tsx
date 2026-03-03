import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Clock, Music, ListPlus } from 'lucide-react';
import { Track } from '../types';
import { usePlayer } from '../hooks/usePlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { PlaylistManagerPopup } from './popups/PlaylistManagerPopup';
import { formatTrackDuration, getAlbumCoverKey } from '../utils/player';

export function TrackList({ tracks }: { tracks: Track[] }) {
  const { currentTrack, playContext, isPlaying, togglePlayPause, accentColor, navigateTo, theme, albumCovers } = usePlayer();
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null);
  const activeTrackRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the currently playing track when it changes
  useEffect(() => {
    if (activeTrackRef.current) {
      const el = activeTrackRef.current;
      const rect = el.getBoundingClientRect();
      const isVisible = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );

      // Only scroll if the element isn't fully visible on the screen
      if (!isVisible) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTrack?.id]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="hidden md:grid grid-cols-[40px_1fr_1fr_60px_100px] gap-4 px-4 py-2 text-sm text-zinc-400 border-b border-zinc-800 mb-4">
        <div className="text-center">#</div>
        <div>Title</div>
        <div>Album</div>
        <div className="flex justify-end"><Clock className="w-4 h-4" /></div>
        <div className="text-right">Year</div>
      </div>

      <div className="space-y-1">
        {tracks.map((track, index) => {
          const isCurrent = currentTrack?.id === track.id;
          const coverKey = getAlbumCoverKey(track.artist, track.album);
          const coverSrc = albumCovers[coverKey] || track.coverUrl;

          return (
            <motion.div
              layout
              transition={{
                type: 'tween',
                ease: [0.4, 0, 0.2, 1],
                duration: 0.3,
                layout: { type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 },
              }}
              key={track.id}
              ref={isCurrent ? activeTrackRef : null}
              onClick={() => {
                if (isCurrent) {
                  togglePlayPause();
                } else {
                  playContext(tracks, index);
                }
              }}
              whileHover={{ backgroundColor: theme.highlightMed }}
              whileTap={{ scale: 0.98 }}
              className="group grid grid-cols-[40px_1fr_60px] md:grid-cols-[40px_1fr_1fr_60px_100px] gap-2 md:gap-4 px-2 md:px-4 py-3 rounded-2xl cursor-pointer items-center transition-colors duration-700"
              style={isCurrent ? { backgroundColor: theme.highlightMed } : {}}
            >
              {/* Track number / play indicator */}
              <div className="text-center text-zinc-400 w-6 h-6 flex items-center justify-center relative">
                {isCurrent && isPlaying ? (
                  <>
                    <div className="flex gap-[2px] h-3 items-end justify-center w-full group-hover:hidden">
                      <div className="w-1 h-full animate-pulse" style={{ backgroundColor: accentColor }} />
                      <div className="w-1 h-2/3 animate-pulse delay-75" style={{ backgroundColor: accentColor }} />
                      <div className="w-1 h-4/5 animate-pulse delay-150" style={{ backgroundColor: accentColor }} />
                    </div>
                    <Pause className="w-4 h-4 hidden group-hover:block fill-current text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </>
                ) : (
                  <>
                    <span className="group-hover:hidden" style={{ color: isCurrent ? theme.accent1 : '' }}>
                      {track.trackNumber || index + 1}
                    </span>
                    <Play className="w-4 h-4 hidden group-hover:block fill-current text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </>
                )}
              </div>

              {/* Title + artist */}
              <div className="flex items-center truncate pr-4">
                <div className="w-10 h-10 bg-zinc-800 rounded mr-3 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt="Cover"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <Music className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
                <div className="flex flex-col truncate">
                  <span
                    className="truncate font-medium"
                    style={{ color: isCurrent ? theme.accent1 : 'white' }}
                  >
                    {track.title}
                  </span>
                  <div className="text-sm text-zinc-400 truncate group-hover:text-white transition-colors w-max pointer-events-auto">
                    <span
                      className="hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateTo('artist', track.artist);
                      }}
                    >
                      {track.artist}
                    </span>
                    {track.features?.map((feature, i) => (
                      <React.Fragment key={feature}>
                        {/* First feature gets "feat.", subsequent get ", " */}
                        <span className="cursor-default">
                          {i === 0 ? ' feat. ' : ', '}
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
              </div>

              {/* Album (Hidden on mobile) */}
              <div className="hidden md:flex text-sm text-zinc-400 truncate pr-4 transition-colors items-center">
                <span
                  className="group-hover:text-white hover:underline cursor-pointer pointer-events-auto truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateTo('album', track.album);
                  }}
                >
                  {track.album}
                </span>
              </div>

              {/* Duration + playlist button */}
              <div className="text-sm text-zinc-400 flex items-center justify-end gap-2">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaylistTrack(track);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 hover:text-white rounded-xl transition-all"
                    title="Add to playlist"
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                  </button>
                  <AnimatePresence>
                    {playlistTrack?.id === track.id && (
                      <PlaylistManagerPopup
                        isOpen={true}
                        onClose={() => setPlaylistTrack(null)}
                        track={track}
                        position="top-right"
                      />
                    )}
                  </AnimatePresence>
                </div>
                <span>{(!track.duration || isNaN(track.duration)) ? '--:--' : formatTrackDuration(track.duration)}</span>
              </div>

              {/* Year (Hidden on mobile) */}
              <div className="hidden md:block text-sm text-zinc-400 text-right">
                {track.year || ''}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}