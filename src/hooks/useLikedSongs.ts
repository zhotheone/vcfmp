import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';

export interface UseLikedSongsReturn {
    likedSongs: string[];
    toggleLike: (trackId: string) => Promise<void>;
}

export const useLikedSongs = (): UseLikedSongsReturn => {
    const [likedSongs, setLikedSongs] = useState<string[]>([]);

    useEffect(() => {
        get('liked-songs').then((saved: unknown) => {
            if (Array.isArray(saved)) setLikedSongs(saved);
        }).catch(e => console.error('Failed to load liked songs', e));
    }, []);

    const toggleLike = async (trackId: string) => {
        const next = likedSongs.includes(trackId)
            ? likedSongs.filter(id => id !== trackId)
            : [...likedSongs, trackId];

        setLikedSongs(next);
        try {
            await set('liked-songs', next);
        } catch (e) {
            console.error('Failed to save liked songs', e);
        }
    };

    return { likedSongs, toggleLike };
};