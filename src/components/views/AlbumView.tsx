import { Play, Pause, Disc, Shuffle, User } from 'lucide-react';
import { usePlayer } from '../../hooks/usePlayer';
import { TrackList } from '../TrackList';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import {
  getAlbumCoverKey,
  splitArtistForDisplay,
  getPlayButtonState,
  handlePlayButtonClick,
  formatTotalDuration,
} from '../../utils/player';

export function AlbumView() {
  const {
    tracks, selectedAlbum, playContext, isPlaying, currentTrack,
    togglePlayPause, setShuffle, shuffle, theme, albumCovers, navigateTo,
  } = usePlayer();

  const albumTracks = useMemo(() => tracks
    .filter(t => t.album === selectedAlbum)
    .sort((a, b) => {
      const discDiff = (a.discNumber || 1) - (b.discNumber || 1);
      if (discDiff !== 0) return discDiff;
      if (a.trackNumber !== undefined && b.trackNumber !== undefined) return a.trackNumber - b.trackNumber;
      return a.title.localeCompare(b.title);
    }),
    [tracks, selectedAlbum]
  );

  const artist = useMemo(
    () => albumTracks.length > 0 ? albumTracks[0].artist : 'Unknown Artist',
    [albumTracks]
  );

  const coverUrl = useMemo(
    () => albumCovers[getAlbumCoverKey(artist, selectedAlbum)] || albumTracks.find(t => t.coverUrl)?.coverUrl,
    [albumCovers, artist, selectedAlbum, albumTracks]
  );

  const isSingle = albumTracks.length === 1 && albumTracks[0].album === albumTracks[0].title;
  const totalDuration = useMemo(() => albumTracks.reduce((acc, t) => acc + t.duration, 0), [albumTracks]);

  const tracksByDisc = useMemo(() => albumTracks.reduce((acc, track) => {
    const disc = track.discNumber || 1;
    if (!acc[disc]) acc[disc] = [];
    acc[disc].push(track);
    return acc;
  }, {} as Record<number, typeof albumTracks>), [albumTracks]);

  const discs = Object.keys(tracksByDisc).map(Number).sort((a, b) => a - b);
  const isMultiDisc = discs.length > 1;

  const playButtonState = useMemo(
    () => getPlayButtonState(albumTracks.map(t => t.id), currentTrack?.id, isPlaying),
    [albumTracks, currentTrack?.id, isPlaying]
  );

  if (albumTracks.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto flex items-center justify-center h-64">
        <p className="text-zinc-400">No tracks found for this album.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-12 mb-6 md:mb-12">
        <div className="flex-1 flex flex-col gap-4 pt-4">
          <span className="text-sm font-bold uppercase tracking-wider text-white">
            {isSingle ? 'Single' : 'Album'}
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
            {selectedAlbum}
          </h1>

          <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
            <User className="w-4 h-4" />
            <div className="text-white truncate">
              {splitArtistForDisplay(artist).map(({ text, isSeparator }, i) =>
                isSeparator ? (
                  <span key={i} className="cursor-default">{text}</span>
                ) : (
                  <span
                    key={i}
                    className="hover:underline cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); navigateTo('artist', text.trim()); }}
                  >
                    {text}
                  </span>
                )
              )}
            </div>
            <span>•</span>
            <span>{albumTracks.length} {albumTracks.length === 1 ? 'song' : 'songs'}</span>
            <span>•</span>
            <span>{formatTotalDuration(totalDuration)}</span>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              onClick={() => handlePlayButtonClick(playButtonState, albumTracks, { togglePlayPause, playContext })}
              disabled={albumTracks.length === 0}
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-colors duration-700"
              style={{ backgroundColor: theme.accent1, color: theme.bgMain }}
            >
              {playButtonState.isContextPlaying
                ? <Pause className="w-8 h-8 fill-current" />
                : <Play className="w-8 h-8 fill-current ml-1" />
              }
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              onClick={() => {
                setShuffle(!shuffle);
                if (!isPlaying && albumTracks.length > 0) playContext(albumTracks, 0);
              }}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-700"
              style={{
                backgroundColor: theme.highlightMed,
                color: shuffle ? theme.accent1 : theme.fgMain,
                opacity: shuffle ? 1 : 0.5,
              }}
            >
              <Shuffle className="w-6 h-6" />
            </motion.button>
          </div>
        </div>

        <div
          className="w-48 h-48 self-center md:self-auto md:w-72 md:h-72 flex-shrink-0 rounded-[2.5rem] shadow-xl flex items-center justify-center overflow-hidden transition-colors duration-700 relative group cursor-pointer"
          style={{ backgroundColor: theme.highlightMed }}
          onClick={() => { if (albumTracks.length > 0) playContext(albumTracks, 0); }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={selectedAlbum || (isSingle ? 'Single' : 'Album')}
              className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <Disc className="w-24 h-24 text-zinc-500 group-hover:opacity-40 transition-opacity" />
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-24 h-24 text-white fill-current" />
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {discs.map(disc => (
          <div key={disc}>
            {isMultiDisc && (
              <div className="flex items-center gap-3 px-4 mb-4 text-white">
                <Disc className="w-5 h-5" style={{ color: theme.accent1 }} />
                <h3 className="text-lg font-bold">Disc {disc}</h3>
              </div>
            )}
            <TrackList tracks={tracksByDisc[disc]} />
          </div>
        ))}
      </div>
    </div>
  );
}