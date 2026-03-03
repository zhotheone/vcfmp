import { Play, Pause, Heart } from 'lucide-react';
import { usePlayer } from '../../hooks/usePlayer';
import { TrackList } from '../TrackList';
import { motion } from 'framer-motion';

export function LikedSongsView() {
    const { tracks, likedSongs, playContext, isPlaying, currentTrack, togglePlayPause, theme } = usePlayer();

    const likedTracks = tracks.filter(t => likedSongs.includes(t.id));

    return (
        <>
            <div
                className="h-64 p-8 flex flex-col justify-end relative group rounded-[2.5rem] mt-2 mx-2 transition-colors duration-700 ease-out shadow-sm"
                style={{ backgroundColor: theme.bgOverlay }}
            >
                <div className="flex items-end gap-6">
                    <div className="w-40 h-40 bg-zinc-800 shadow-2xl flex items-center justify-center rounded-xl overflow-hidden">
                        <Heart className="w-16 h-16 text-white" fill="white" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-white">Playlist</span>
                        <h1 className="text-5xl font-bold text-white tracking-tight">Liked Songs</h1>
                        <span className="text-white font-medium opacity-70">{likedTracks.length} {likedTracks.length === 1 ? 'song' : 'songs'}</span>
                    </div>
                </div>
            </div>
            <div className="p-8">
                <div className="mb-8">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
                        onClick={() => {
                            const isLikedPlaying = likedTracks.some(t => t.id === currentTrack?.id);
                            if (isLikedPlaying && isPlaying) {
                                togglePlayPause();
                            } else if (isLikedPlaying && !isPlaying) {
                                togglePlayPause();
                            } else if (likedTracks.length > 0) {
                                playContext(likedTracks, 0);
                            }
                        }}
                        disabled={likedTracks.length === 0}
                        className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-colors duration-700"
                        style={{ backgroundColor: theme.accent1, color: theme.bgMain }}
                    >
                        {likedTracks.some(t => t.id === currentTrack?.id) && isPlaying ? (
                            <Pause className="w-8 h-8 fill-current" />
                        ) : (
                            <Play className="w-8 h-8 fill-current ml-1" />
                        )}
                    </motion.button>
                </div>
                <div className="space-y-4">
                    <TrackList tracks={likedTracks} />
                </div>
            </div>
        </>
    );
}
