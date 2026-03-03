import React, { useState, useMemo, useCallback } from 'react';
import { Play, Pause, ChevronDown, ChevronRight, Mic2, Disc, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '../../hooks/usePlayer';
import { TrackList } from '../TrackList';
import { Track, Theme } from '../../types';
import { getAlbumCoverKey } from '../../utils/player';

// --- Types ---
type GroupByMode = 'artist' | 'genre' | 'year';

interface AlbumGroup {
  name: string;
  tracks: Track[];
  isSingle: boolean;
  coverUrl?: string;
  year: number;
  artist: string;
}

interface LibraryGroup {
  name: string;
  tracks: Track[];
  albums: AlbumGroup[];
  coverUrl?: string;
}

// --- Hooks ---
/**
 * Custom hook to toggle items in a Set.
 */
function useExpandedState<T>() {
  const [expanded, setExpanded] = useState<Set<T>>(new Set());

  const toggle = useCallback((item: T) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  }, []);

  return { expanded, toggle };
}

/**
 * Custom hook to encapsulate the complex logic of grouping tracks.
 */
function useLibraryGroups(
  tracks: Track[],
  albumCovers: Record<string, string>,
  groupBy: GroupByMode
): LibraryGroup[] {
  return useMemo(() => {
    const grouped = new Map<string, Track[]>();
    const displayNames = new Map<string, string>();

    const getGroupKeyAndDisplay = (track: Track): { key: string; display: string } => {
      switch (groupBy) {
        case 'artist': {
          const display = track.artist || 'Unknown Artist';
          return { key: display.toLowerCase(), display };
        }
        case 'genre': {
          const genreVal = (track as any).genre;
          const genreStr = Array.isArray(genreVal) ? genreVal[0] : genreVal;
          const display = genreStr ? (genreStr as string).split(/[,/]/)[0].trim() : 'Unknown Genre';
          return { key: display.toLowerCase(), display };
        }
        case 'year': {
          const display = track.year ? track.year.toString() : 'Unknown Year';
          return { key: display, display };
        }
      }
    };

    // Grouping into main categories (Artist, Genre, Year)
    for (const track of tracks) {
      const { key, display } = getGroupKeyAndDisplay(track);

      if (!grouped.has(key)) {
        grouped.set(key, []);
        displayNames.set(key, display);
      } else if (groupBy === 'artist' || groupBy === 'genre') {
        const currentDisplay = displayNames.get(key)!;
        const currentUpperCount = currentDisplay.replace(/[^A-Z]/g, '').length;
        const newUpperCount = display.replace(/[^A-Z]/g, '').length;
        if (newUpperCount > currentUpperCount) {
          displayNames.set(key, display);
        }
      }
      grouped.get(key)!.push(track);
    }

    // Transforming groups and creating sorted subgroups (Albums)
    return Array.from(grouped.entries())
      .map(([key, groupTracks]): LibraryGroup => {
        const name = displayNames.get(key)!;
        const albumGrouped = new Map<string, Track[]>();

        for (const track of groupTracks) {
          const albumKey = track.album || 'Unknown Album';
          if (!albumGrouped.has(albumKey)) {
            albumGrouped.set(albumKey, []);
          }
          albumGrouped.get(albumKey)!.push(track);
        }

        const albums: AlbumGroup[] = Array.from(albumGrouped.entries())
          .map(([albumName, albumTracks]) => {
            const sortedTracks = [...albumTracks].sort((a, b) => {
              const aNum = a.trackNumber ?? 0;
              const bNum = b.trackNumber ?? 0;
              if (aNum !== bNum) return aNum - bNum;
              return a.title.localeCompare(b.title);
            });

            const firstTrack = sortedTracks[0];
            const isSingle = sortedTracks.length === 1 && firstTrack.album === firstTrack.title && (!firstTrack.trackNumber || firstTrack.trackNumber === 1);
            const computedCoverKey = getAlbumCoverKey(firstTrack.artist, firstTrack.album);
            const coverUrl = albumCovers[computedCoverKey] || sortedTracks.find((t) => t.coverUrl)?.coverUrl;

            return {
              name: albumName,
              tracks: sortedTracks,
              isSingle,
              coverUrl,
              year: firstTrack?.year || 0,
              artist: firstTrack?.artist || 'Unknown Artist',
            };
          })
          .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return a.name.localeCompare(b.name);
          });

        return {
          name,
          tracks: groupTracks,
          albums,
          coverUrl: albums.find((a) => a.coverUrl)?.coverUrl,
        };
      })
      .sort((a, b) => {
        if (groupBy === 'year') {
          if (a.name === 'Unknown Year') return 1;
          if (b.name === 'Unknown Year') return -1;
          return b.name.localeCompare(a.name);
        }
        return a.name.localeCompare(b.name);
      });
  }, [tracks, albumCovers, groupBy]);
}

// --- Subcomponents ---

interface LibraryHeaderProps {
  trackCount: number;
  groupBy: GroupByMode;
  onGroupByChange: (mode: GroupByMode) => void;
  isPlaying: boolean;
  hasTracks: boolean;
  theme: Theme;
  coverUrl?: string | null;
  onPlayClick: () => void;
  onHeroPlayClick: () => void;
}

const LibraryHeader = React.memo(({
  trackCount,
  groupBy,
  onGroupByChange,
  isPlaying,
  hasTracks,
  theme,
  coverUrl,
  onPlayClick,
  onHeroPlayClick
}: LibraryHeaderProps) => (
  <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-12 mb-6 md:mb-8">
    <div className="flex-1 flex flex-col gap-4 pt-4">
      <span className="text-sm font-bold uppercase tracking-wider text-white">Your Collection</span>
      <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
        Library
      </h1>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-white/70 text-sm font-medium">
        <span>{trackCount} tracks</span>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as GroupByMode)}
            className="bg-black/20 text-white rounded-lg px-3 py-1.5 outline-none focus:bg-black/40 transition-colors cursor-pointer appearance-none border border-white/10"
            style={{ color: theme.fgMain }}
          >
            <option value="artist">Group by Artist</option>
            <option value="genre">Group by Genre</option>
            <option value="year">Group by Year</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
          onClick={onPlayClick}
          disabled={!hasTracks}
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-colors duration-700 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: theme.accent1, color: theme.bgMain }}
          aria-label={isPlaying ? "Pause Library" : "Play Library"}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 fill-current" />
          ) : (
            <Play className="w-8 h-8 fill-current ml-1" />
          )}
        </motion.button>
      </div>
    </div>

    <div
      className="w-48 h-48 self-center md:self-auto md:w-72 md:h-72 flex-shrink-0 rounded-[2.5rem] shadow-xl flex items-center justify-center overflow-hidden transition-colors duration-700 relative group cursor-pointer"
      style={{ backgroundColor: theme.highlightMed }}
      onClick={onHeroPlayClick}
      title="Play Library"
    >
      {coverUrl ? (
        <img src={coverUrl} alt="Library Collection" className="w-full h-full object-cover group-hover:opacity-40 transition-opacity" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <Mic2 className="w-24 h-24 text-zinc-500 group-hover:opacity-40 transition-opacity" />
      )}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Play className="w-24 h-24 text-white fill-current" />
      </div>
    </div>
  </div>
));
LibraryHeader.displayName = 'LibraryHeader';

// --- Smart Playlists ---
interface SmartPlaylistProps {
  title: string;
  tracks: Track[];
  theme: Theme;
  onPlayContext: (tracks: Track[], startIndex: number) => void;
  albumCovers: Record<string, string>;
}

const SmartPlaylist = React.memo(({ title, tracks, theme, onPlayContext, albumCovers }: SmartPlaylistProps) => {
  if (tracks.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-xl md:text-2xl font-bold mb-4 text-white">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
        {tracks.slice(0, 15).map((track, i) => (
          <motion.div
            key={`${title}-${track.id}`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 w-32 md:w-40 snap-start cursor-pointer group"
            onClick={() => onPlayContext(tracks, i)}
          >
            <div className="w-full aspect-square rounded-xl md:rounded-2xl overflow-hidden mb-3 shadow-lg relative bg-black/20">
              {track.coverUrl || albumCovers[getAlbumCoverKey(track.artist, track.album)] ? (
                <img src={track.coverUrl || albumCovers[getAlbumCoverKey(track.artist, track.album)]} alt={track.title} className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Disc className="w-10 h-10 text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-10 h-10 text-white fill-current" />
              </div>
            </div>
            <p className="text-sm font-semibold truncate text-white">{track.title}</p>
            <p className="text-xs truncate opacity-70" style={{ color: theme.fgMain }}>{track.artist}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
});
SmartPlaylist.displayName = 'SmartPlaylist';

interface AlbumCardProps {
  album: AlbumGroup;
  isExpanded: boolean;
  groupBy: GroupByMode;
  theme: Theme;
  onToggle: () => void;
  onPlayContext: (tracks: Track[]) => void;
  onNavigate: (type: 'album', name: string) => void;
}

const AlbumCard = React.memo(({
  album,
  isExpanded,
  groupBy,
  theme,
  onToggle,
  onPlayContext,
  onNavigate
}: AlbumCardProps) => {
  const handlePlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayContext(album.tracks);
  }, [album.tracks, onPlayContext]);

  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate('album', album.name);
  }, [album.name, onNavigate]);

  return (
    <motion.div
      className="rounded-[2rem] overflow-hidden transition-colors duration-700"
      style={{ backgroundColor: theme.highlightMed }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-center justify-between hover:bg-white/5 transition-colors focus:outline-none focus:bg-white/5"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 bg-zinc-800 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm relative group/album cursor-pointer"
            onClick={handlePlayClick}
          >
            {album.coverUrl ? (
              <img src={album.coverUrl} alt={album.name} className="w-full h-full object-cover group-hover/album:opacity-40 transition-opacity" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <Disc className="w-6 h-6 text-zinc-500 group-hover/album:opacity-40 transition-opacity" />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/album:opacity-100 transition-opacity">
              <Play className="w-6 h-6 text-white fill-current" />
            </div>
          </div>
          <div>
            <h4
              className="text-white font-bold text-lg hover:underline cursor-pointer"
              onClick={handleTitleClick}
            >
              {album.name}
            </h4>
            <p className="text-xs font-medium opacity-70" style={{ color: theme.fgMain }}>
              {album.year ? `${album.year} • ` : ''}
              {album.artist && groupBy !== 'artist' ? `${album.artist} • ` : ''}
              {album.isSingle ? 'Single' : 'Album'} • {album.tracks.length} {album.tracks.length === 1 ? 'song' : 'songs'}
            </p>
          </div>
        </div>
        <div style={{ color: theme.highlightLow }}>
          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
            className="p-4 pt-0"
          >
            <TrackList tracks={album.tracks} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
AlbumCard.displayName = 'AlbumCard';

interface GroupCardProps {
  group: LibraryGroup;
  isExpanded: boolean;
  groupBy: GroupByMode;
  expandedAlbums: Set<string>;
  theme: Theme;
  onToggle: () => void;
  onToggleAlbum: (albumKey: string) => void;
  onPlayContext: (tracks: Track[]) => void;
  onNavigate: (type: 'artist' | 'album', name: string) => void;
}

const GroupCard = React.memo(({
  group,
  isExpanded,
  groupBy,
  expandedAlbums,
  theme,
  onToggle,
  onToggleAlbum,
  onPlayContext,
  onNavigate
}: GroupCardProps) => {
  const handlePlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayContext(group.tracks);
  }, [group.tracks, onPlayContext]);

  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    if (groupBy === 'artist') {
      e.stopPropagation();
      onNavigate('artist', group.name);
    }
  }, [groupBy, group.name, onNavigate]);

  return (
    <motion.div
      className="rounded-[2.5rem] overflow-hidden shadow-sm transition-colors duration-700"
      style={{ backgroundColor: theme.bgOverlay }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-6 flex items-center justify-between hover:bg-white/5 transition-colors focus:outline-none focus:bg-white/5"
      >
        <div className="flex items-center gap-6">
          <div
            className="w-16 h-16 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center shadow-md relative group/cover cursor-pointer"
            onClick={handlePlayClick}
          >
            {group.coverUrl ? (
              <img src={group.coverUrl} alt={group.name} className="w-full h-full object-cover group-hover/cover:opacity-40 transition-opacity" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <Mic2 className="w-8 h-8 text-zinc-500 group-hover/cover:opacity-40 transition-opacity" />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
              <Play className="w-8 h-8 text-white fill-current" />
            </div>
          </div>
          <div>
            <h3
              className={`text-white font-bold text-xl tracking-tight transition-colors ${groupBy === 'artist' ? 'hover:underline cursor-pointer' : ''}`}
              onClick={handleTitleClick}
            >
              {group.name}
            </h3>
            <p className="text-sm font-medium opacity-70" style={{ color: theme.fgMain }}>
              {group.tracks.length} {group.tracks.length === 1 ? 'song' : 'songs'}
            </p>
          </div>
        </div>
        <div style={{ color: theme.highlightLow }}>
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
            className="p-6 pt-0 space-y-4"
          >
            {group.albums.map((album) => {
              const albumKey = `${group.name}-${album.name}`;
              return (
                <AlbumCard
                  key={albumKey}
                  album={album}
                  isExpanded={expandedAlbums.has(albumKey) || group.albums.length === 1}
                  groupBy={groupBy}
                  theme={theme}
                  onToggle={() => onToggleAlbum(albumKey)}
                  onPlayContext={onPlayContext}
                  onNavigate={onNavigate as any}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
GroupCard.displayName = 'GroupCard';

// --- Main View Component ---
export function LibraryView() {
  const {
    tracks,
    playTrack,
    playContext,
    isPlaying,
    currentTrack,
    togglePlayPause,
    navigateTo,
    theme,
    albumCovers
  } = usePlayer();

  const [groupBy, setGroupBy] = useState<GroupByMode>('artist');
  const groups = useLibraryGroups(tracks, albumCovers, groupBy);

  const { expanded: expandedGroups, toggle: toggleGroup } = useExpandedState<string>();
  const { expanded: expandedAlbums, toggle: toggleAlbum } = useExpandedState<string>();

  const handleMainPlayToggle = useCallback(() => {
    if (isPlaying || currentTrack) {
      togglePlayPause();
    } else if (tracks.length > 0) {
      playTrack(tracks[0]);
    }
  }, [isPlaying, currentTrack, tracks, togglePlayPause, playTrack]);

  const handleHeroPlay = useCallback(() => {
    if (tracks.length > 0) {
      playTrack(tracks[0]);
    }
  }, [tracks, playTrack]);

  const handlePlayContext = useCallback((contextTracks: Track[]) => {
    playContext(contextTracks, 0);
  }, [playContext]);

  const topCoverUrl = useMemo(() => {
    return groups.find(g => g.coverUrl)?.coverUrl || null;
  }, [groups]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <LibraryHeader
        trackCount={tracks.length}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        isPlaying={isPlaying}
        hasTracks={tracks.length > 0}
        theme={theme}
        coverUrl={topCoverUrl}
        onPlayClick={handleMainPlayToggle}
        onHeroPlayClick={handleHeroPlay}
      />

      {/* Smart Playlists Section */}
      <div className="mt-6 md:mt-10">
        <SmartPlaylist
          title="Recently Played"
          tracks={useMemo(() => [...tracks].filter(t => t.lastPlayed).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)), [tracks])}
          theme={theme}
          onPlayContext={handlePlayContext}
          albumCovers={albumCovers}
        />
        <SmartPlaylist
          title="Most Played"
          tracks={useMemo(() => [...tracks].filter(t => t.playCount).sort((a, b) => (b.playCount || 0) - (a.playCount || 0)), [tracks])}
          theme={theme}
          onPlayContext={handlePlayContext}
          albumCovers={albumCovers}
        />
        <SmartPlaylist
          title="90s Kids"
          tracks={useMemo(() => [...tracks].filter(t => t.year && t.year >= 1990 && t.year < 2000).sort(() => Math.random() - 0.5), [tracks])}
          theme={theme}
          onPlayContext={handlePlayContext}
          albumCovers={albumCovers}
        />
      </div>

      <div className="mt-8">
        <div className="space-y-4">
          {groups.map((group) => (
            <GroupCard
              key={group.name}
              group={group}
              isExpanded={expandedGroups.has(group.name)}
              groupBy={groupBy}
              expandedAlbums={expandedAlbums}
              theme={theme}
              onToggle={() => toggleGroup(group.name)}
              onToggleAlbum={toggleAlbum}
              onPlayContext={handlePlayContext}
              onNavigate={navigateTo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
