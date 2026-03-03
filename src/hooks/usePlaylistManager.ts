import { useState, useEffect } from 'react';
import { get, set } from 'idb-keyval';
import { Playlist, View } from '../types';

export interface UsePlaylistManagerReturn {
    playlists: Playlist[];
    createPlaylist: (name: string) => Promise<void>;
    renamePlaylist: (id: string, newName: string) => Promise<void>;
    deletePlaylist: (id: string, currentView: View, selectedAlbum: string | null, onViewReset: () => void) => Promise<void>;
    addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
    removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
    importPlaylists: (imported: Playlist[]) => Promise<void>;
}

export const usePlaylistManager = (): UsePlaylistManagerReturn => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);

    useEffect(() => {
        get('playlists').then((saved: unknown) => {
            if (Array.isArray(saved)) setPlaylists(saved);
        }).catch(e => console.error('Failed to load playlists', e));
    }, []);

    const persist = async (next: Playlist[]) => {
        setPlaylists(next);
        await set('playlists', next);
    };

    const createPlaylist = async (name: string) => {
        const newPlaylist: Playlist = {
            id: crypto.randomUUID(),
            name,
            trackIds: [],
            createdAt: Date.now(),
        };
        await persist([...playlists, newPlaylist]);
    };

    const renamePlaylist = async (id: string, newName: string) => {
        await persist(playlists.map(p => (p.id === id ? { ...p, name: newName } : p)));
    };

    const deletePlaylist = async (
        id: string,
        currentView: View,
        selectedAlbum: string | null,
        onViewReset: () => void,
    ) => {
        await persist(playlists.filter(p => p.id !== id));
        if (currentView === 'playlist' && selectedAlbum === id) {
            onViewReset();
        }
    };

    const addTrackToPlaylist = async (playlistId: string, trackId: string) => {
        await persist(
            playlists.map(p =>
                p.id === playlistId && !p.trackIds.includes(trackId)
                    ? { ...p, trackIds: [...p.trackIds, trackId] }
                    : p,
            ),
        );
    };

    const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
        await persist(
            playlists.map(p =>
                p.id === playlistId
                    ? { ...p, trackIds: p.trackIds.filter(id => id !== trackId) }
                    : p,
            ),
        );
    };

    const importPlaylists = async (imported: Playlist[]) => {
        const valid = imported.filter(p => p.id && p.name && Array.isArray(p.trackIds));
        if (valid.length === 0) return;

        const merged = [...playlists];
        valid.forEach(imp => {
            const idx = merged.findIndex(p => p.id === imp.id);
            if (idx > -1) merged[idx] = imp;
            else merged.push(imp);
        });

        await persist(merged);
    };

    return {
        playlists,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        importPlaylists,
    };
};