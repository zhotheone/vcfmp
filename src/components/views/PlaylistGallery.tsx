import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Track } from '../../types';
import { usePlayer } from '../../hooks/usePlayer';
import { Play } from 'lucide-react';
import { getAlbumCoverKey } from '../../utils/player';

interface PlaylistGalleryProps {
    tracks: Track[];
    onPlayContext: (startIndex: number) => void;
}

export function PlaylistGallery({ tracks, onPlayContext }: PlaylistGalleryProps) {
    const { albumCovers, theme, currentTrack } = usePlayer();

    // Group tracks by album to get a unique set of covers
    const uniqueAlbums = useMemo(() => {
        const albums = new Map<string, { key: string; coverUrl: string | undefined; firstTrackIndex: number; title: string; artist: string }>();

        tracks.forEach((t, i) => {
            const key = getAlbumCoverKey(t.artist, t.album);
            if (!albums.has(key)) {
                albums.set(key, {
                    key,
                    coverUrl: albumCovers[key] || t.coverUrl,
                    firstTrackIndex: i,
                    title: t.album,
                    artist: t.artist
                });
            }
        });

        return Array.from(albums.values());
    }, [tracks, albumCovers]);

    const currentTrackKey = currentTrack ? getAlbumCoverKey(currentTrack.artist, currentTrack.album) : null;

    if (uniqueAlbums.length === 0) return null;

    return (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
            {uniqueAlbums.map((album, idx) => {
                // Ensure only vertical rectangles and squares
                const aspectClasses = [
                    'aspect-square', // 1:1 Square
                    'aspect-[3/4]',  // Vertical rectangle
                    'aspect-[2/3]'   // Taller vertical rectangle
                ];
                const pseudoRandom = ((album.title?.length || 0) + (album.artist?.length || 0)) % aspectClasses.length;
                const selectedAspect = aspectClasses[pseudoRandom];

                const isCurrentlyPlayingAlbum = currentTrackKey === album.key;

                return (
                    <motion.div
                        key={`${album.title}-${idx}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.4 }}
                        className={`relative group rounded-[2rem] overflow-hidden break-inside-avoid shadow-sm cursor-pointer ${selectedAspect} transition-all duration-300`}
                        style={{
                            backgroundColor: theme.highlightMed,
                            boxShadow: isCurrentlyPlayingAlbum ? `0 0 0 3px ${theme.bgMain}, 0 0 0 6px ${theme.accent1}` : undefined
                        }}
                        onClick={() => onPlayContext(album.firstTrackIndex)}
                    >
                        {album.coverUrl ? (
                            <img
                                src={album.coverUrl}
                                alt={album.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center group-hover:scale-105 transition-transform duration-700">
                                <span className="font-bold text-lg mb-1 line-clamp-2">{album.title}</span>
                                <span className="text-sm opacity-60 line-clamp-1">{album.artist}</span>
                            </div>
                        )}

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <motion.div
                                whileScale={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
                                style={{ backgroundColor: theme.accent1, color: theme.bgMain }}
                            >
                                <Play className="w-8 h-8 fill-current ml-1" />
                            </motion.div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}
