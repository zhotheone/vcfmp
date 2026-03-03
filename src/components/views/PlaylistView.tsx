import { Play, Pause, Music, Shuffle, ListMusic, LayoutGrid, List } from 'lucide-react';
import { usePlayer } from '../../hooks/usePlayer';
import { TrackList } from '../TrackList';
import { PlaylistGallery } from './PlaylistGallery';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
    getPlayButtonState,
    handlePlayButtonClick,
    formatTotalDuration,
} from '../../utils/player';

export function PlaylistView() {
    const { tracks, selectedAlbum, playContext, isPlaying, currentTrack, togglePlayPause, setShuffle, shuffle, theme, playlists } = usePlayer();
    const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');

    const playlist = playlists.find(p => p.id === selectedAlbum);

    if (!playlist) {
        return (
            <div className="p-4 md:p-8 max-w-7xl mx-auto flex items-center justify-center h-64">
                <p className="text-zinc-400">Playlist not found.</p>
            </div>
        );
    }

    // Get track objects from trackIds
    const playlistTracks = useMemo(() => playlist.trackIds
        .map(id => tracks.find(t => t.id === id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined), [playlist.trackIds, tracks]);

    const totalDuration = useMemo(() => playlistTracks.reduce((acc, t) => acc + (t.duration || 0), 0), [playlistTracks]);

    const playButtonState = useMemo(
        () => getPlayButtonState(playlistTracks.map(t => t.id), currentTrack?.id, isPlaying),
        [playlistTracks, currentTrack?.id, isPlaying]
    );

    // Get a cover URL from the first track that has one
    const coverUrl = useMemo(() => {
        return playlistTracks.find(t => t.coverUrl)?.coverUrl;
    }, [playlistTracks]);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 md:gap-12 mb-6 md:mb-12">
                <div className="flex-1 flex flex-col gap-4 pt-4">
                    <span className="text-sm font-bold uppercase tracking-wider text-white">
                        Playlist
                    </span>
                    <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                        {playlist.name}
                    </h1>

                    <div className="flex items-center gap-2 text-white/70 text-sm font-medium">
                        <ListMusic className="w-4 h-4" />
                        <span>{playlistTracks.length} {playlistTracks.length === 1 ? 'song' : 'songs'}</span>
                        <span>•</span>
                        <span>{formatTotalDuration(totalDuration)}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
                            onClick={() => handlePlayButtonClick(playButtonState, playlistTracks, { togglePlayPause, playContext })}
                            disabled={playlistTracks.length === 0}
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
                                if (!isPlaying && playlistTracks.length > 0) playContext(playlistTracks, 0);
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
                    onClick={() => { if (playlistTracks.length > 0) playContext(playlistTracks, 0); }}
                >
                    {coverUrl ? (
                        <img
                            src={coverUrl}
                            alt={playlist.name}
                            className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                    ) : (
                        <ListMusic className="w-24 h-24 text-zinc-500 group-hover:opacity-40 transition-opacity" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-24 h-24 text-white fill-current" />
                    </div>
                </div>
            </div>

            <div className="mt-8 flex flex-col gap-6">
                {/* View Toggle */}
                {playlistTracks.length > 0 && (
                    <div className="flex justify-end">
                        <div className="flex bg-white/5 rounded-full p-1" style={{ backgroundColor: theme.highlightLow }}>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-full transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
                                style={viewMode === 'list' ? { backgroundColor: theme.highlightMed, color: theme.accent1 } : {}}
                            >
                                <List className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('gallery')}
                                className={`p-2 rounded-full transition-colors ${viewMode === 'gallery' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
                                style={viewMode === 'gallery' ? { backgroundColor: theme.highlightMed, color: theme.accent1 } : {}}
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {playlistTracks.length > 0 ? (
                    viewMode === 'list'
                        ? <TrackList tracks={playlistTracks} />
                        : <PlaylistGallery tracks={playlistTracks} onPlayContext={(startIndex) => playContext(playlistTracks, startIndex)} />
                ) : (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500">
                            <Music className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">It's a bit empty here...</h3>
                        <p className="text-zinc-400">Add some tracks to your playlist using the + button on the player bar!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
