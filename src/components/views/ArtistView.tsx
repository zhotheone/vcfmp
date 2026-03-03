import { useState, useMemo, useEffect } from 'react';
import { Play, Pause, Mic2, ChevronDown, ChevronRight, Disc, Search } from 'lucide-react';
import { usePlayer } from '../../hooks/usePlayer';
import { TrackList } from '../TrackList';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getAlbumCoverKey,
  getPlayButtonState,
  handlePlayButtonClick,
  deriveAlbumYear,
} from '../../utils/player';

export function ArtistView() {
  const {
    tracks, selectedArtist, playContext, isPlaying, currentTrack,
    togglePlayPause, navigateTo, theme, albumCovers, likedSongs,
  } = usePlayer();

  const [artistSearch, setArtistSearch] = useState('');
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  const [showAllSingles, setShowAllSingles] = useState(false);
  const [showAllAppearsIn, setShowAllAppearsIn] = useState(false);

  // Reset all local state when the artist changes
  useEffect(() => {
    setArtistSearch('');
    setExpandedAlbums(new Set());
    setShowAllSingles(false);
    setShowAllAppearsIn(false);
  }, [selectedArtist]);

  // All tracks belonging to this artist (as primary or feature)
  const artistTracks = useMemo(() => {
    if (!selectedArtist) return [];
    const target = selectedArtist.toLowerCase();
    return tracks.filter(t =>
      t.artist.toLowerCase() === target ||
      t.features?.some(f => f.toLowerCase() === target)
    );
  }, [tracks, selectedArtist]);

  // Search only filters within album track lists — structural sections are unaffected
  const filteredArtistTracks = useMemo(() => {
    if (!artistSearch.trim()) return artistTracks;
    const query = artistSearch.toLowerCase();
    return artistTracks.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.album.toLowerCase().includes(query)
    );
  }, [artistTracks, artistSearch]);

  // Cover uses unfiltered tracks so it doesn't disappear when searching
  const coverUrl = useMemo(() => {
    if (artistTracks.length === 0) return null;
    return albumCovers[getAlbumCoverKey(artistTracks[0].artist, artistTracks[0].album)]
      || artistTracks.find(t => t.coverUrl)?.coverUrl
      || null;
  }, [artistTracks, albumCovers]);

  // Structural sections — derived from unfiltered artistTracks
  const likedArtistTracks = useMemo(() => {
    return artistTracks
      .filter(t => likedSongs.includes(t.id))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [artistTracks, likedSongs]);

  const singleTracks = useMemo(() => {
    if (!selectedArtist) return [];
    const target = selectedArtist.toLowerCase();
    return artistTracks
      .filter(t => t.album === t.title && t.artist.toLowerCase() === target && (!t.trackNumber || t.trackNumber === 1))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [artistTracks, selectedArtist]);

  const appearsInTracks = useMemo(() => {
    if (!selectedArtist) return [];
    const target = selectedArtist.toLowerCase();
    return artistTracks
      .filter(t => t.artist.toLowerCase() !== target && t.features?.some(f => f.toLowerCase() === target))
      .sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [artistTracks, selectedArtist]);

  // Albums are grouped from filteredArtistTracks so search narrows track lists within albums
  const albums = useMemo(() => {
    const grouped = new Map<string, typeof tracks>();
    filteredArtistTracks.forEach(track => {
      if (!grouped.has(track.album)) grouped.set(track.album, []);
      grouped.get(track.album)!.push(track);
    });

    return Array.from(grouped.entries())
      .map(([name, albumTracks]) => {
        albumTracks.sort((a, b) => {
          if (a.trackNumber !== undefined && b.trackNumber !== undefined) return a.trackNumber - b.trackNumber;
          return a.title.localeCompare(b.title);
        });
        return {
          name,
          tracks: albumTracks,
          isSingle: albumTracks.length === 1 && albumTracks[0].album === albumTracks[0].title && (!albumTracks[0].trackNumber || albumTracks[0].trackNumber === 1),
          coverUrl: albumCovers[getAlbumCoverKey(selectedArtist || '', name)]
            || albumTracks.find(t => t.coverUrl)?.coverUrl,
          year: deriveAlbumYear(albumTracks),
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return a.name.localeCompare(b.name);
      });
  }, [filteredArtistTracks, selectedArtist, albumCovers]);

  const fullAlbums = useMemo(() => {
    if (!selectedArtist) return [];
    const target = selectedArtist.toLowerCase();
    return albums.filter(a => !a.isSingle && a.tracks.some(t => t.artist.toLowerCase() === target));
  }, [albums, selectedArtist]);

  // Computed once, used for both onClick and icon
  const playButtonState = useMemo(
    () => getPlayButtonState(artistTracks.map(t => t.id), currentTrack?.id, isPlaying),
    [artistTracks, currentTrack?.id, isPlaying]
  );

  const toggleAlbum = (albumName: string) => {
    setExpandedAlbums(prev => {
      const next = new Set(prev);
      next.has(albumName) ? next.delete(albumName) : next.add(albumName);
      return next;
    });
  };

  if (!selectedArtist) return null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-12 mb-6 md:mb-8">
        <div className="flex-1 flex flex-col gap-4 pt-4">
          <span className="text-sm font-bold uppercase tracking-wider text-white">Artist</span>
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
            {selectedArtist}
          </h1>

          <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
            <span>{artistTracks.length} {artistTracks.length === 1 ? 'song' : 'songs'}</span>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              onClick={() => handlePlayButtonClick(playButtonState, artistTracks, { togglePlayPause, playContext })}
              disabled={artistTracks.length === 0}
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-colors duration-700"
              style={{ backgroundColor: theme.accent1, color: theme.bgMain }}
            >
              {playButtonState.isContextPlaying
                ? <Pause className="w-8 h-8 fill-current" />
                : <Play className="w-8 h-8 fill-current ml-1" />
              }
            </motion.button>
          </div>
        </div>

        <div
          className="w-48 h-48 self-center md:self-auto md:w-72 md:h-72 flex-shrink-0 rounded-[2.5rem] shadow-xl flex items-center justify-center overflow-hidden transition-colors duration-700 relative group cursor-pointer"
          style={{ backgroundColor: theme.highlightMed }}
          onClick={() => { if (artistTracks.length > 0) playContext(artistTracks, 0); }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={selectedArtist}
              className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <Mic2 className="w-24 h-24 text-zinc-500 group-hover:opacity-40 transition-opacity" />
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-24 h-24 text-white fill-current" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-8 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50" style={{ color: theme.fgMain }} />
        <input
          type="text"
          placeholder={`Search in ${selectedArtist}...`}
          value={artistSearch}
          onChange={(e) => setArtistSearch(e.target.value)}
          className="w-full bg-black/20 text-white placeholder-white/50 rounded-full py-3 pl-12 pr-4 outline-none focus:bg-black/40 transition-colors"
          style={{ color: theme.fgMain }}
        />
      </div>

      <div className="mt-8">

        {/* Liked Songs — unaffected by search */}
        {likedArtistTracks.length > 0 && (
          <div className="mb-8 pl-2">
            <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Liked Songs</h2>
            <TrackList tracks={likedArtistTracks} />
          </div>
        )}

        {/* Singles + Appears In — unaffected by search */}
        {(singleTracks.length > 0 || appearsInTracks.length > 0) && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            {singleTracks.length > 0 && (
              <div className="pl-2">
                <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Singles</h2>
                <TrackList tracks={showAllSingles ? singleTracks : singleTracks.slice(0, 5)} />
                {singleTracks.length > 5 && (
                  <button
                    onClick={() => setShowAllSingles(v => !v)}
                    className="mt-4 px-6 py-2 rounded-full font-bold text-sm transition-colors"
                    style={{ backgroundColor: theme.highlightMed, color: theme.fgMain }}
                  >
                    {showAllSingles ? 'Show Less' : `Show All ${singleTracks.length} Singles`}
                  </button>
                )}
              </div>
            )}
            {appearsInTracks.length > 0 && (
              <div className="pl-2">
                <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Appears In</h2>
                <TrackList tracks={showAllAppearsIn ? appearsInTracks : appearsInTracks.slice(0, 5)} />
                {appearsInTracks.length > 5 && (
                  <button
                    onClick={() => setShowAllAppearsIn(v => !v)}
                    className="mt-4 px-6 py-2 rounded-full font-bold text-sm transition-colors"
                    style={{ backgroundColor: theme.highlightMed, color: theme.fgMain }}
                  >
                    {showAllAppearsIn ? 'Show Less' : `Show All ${appearsInTracks.length}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Full Albums — track lists filtered by search */}
        {fullAlbums.length > 0 && (
          <div className="mb-8 pl-2">
            <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Albums</h2>
            {fullAlbums.map((album) => {
              const isExpanded = expandedAlbums.has(album.name) || fullAlbums.length === 1;
              return (
                <motion.div
                  key={album.name}
                  className="rounded-[2rem] overflow-hidden shadow-sm transition-colors duration-700 mt-4 mx-2"
                  style={{ backgroundColor: theme.highlightMed }}
                >
                  <button
                    onClick={() => toggleAlbum(album.name)}
                    className="w-full text-left p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-6">
                      <div
                        className="w-16 h-16 bg-zinc-800 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center shadow-md relative group/album cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); playContext(album.tracks, 0); }}
                      >
                        {album.coverUrl ? (
                          <img
                            src={album.coverUrl}
                            alt={album.name}
                            className="w-full h-full object-cover group-hover/album:opacity-40 transition-opacity"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <Disc className="w-8 h-8 text-zinc-500 group-hover/album:opacity-40 transition-opacity" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/album:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 text-white fill-current" />
                        </div>
                      </div>
                      <div>
                        <h3
                          className="text-white font-bold text-xl hover:underline cursor-pointer tracking-tight"
                          onClick={(e) => { e.stopPropagation(); navigateTo('album', album.name); }}
                        >
                          {album.name}
                        </h3>
                        <p className="text-sm font-medium opacity-70" style={{ color: theme.fgMain }}>
                          {album.year ? `${album.year} • ` : ''}
                          {album.tracks.length} {album.tracks.length === 1 ? 'song' : 'songs'}
                        </p>
                      </div>
                    </div>
                    <div style={{ color: theme.fgMain }} className="opacity-70">
                      {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                        className="p-6 pt-0"
                      >
                        <TrackList tracks={album.tracks} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}