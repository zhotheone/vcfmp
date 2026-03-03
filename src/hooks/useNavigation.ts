import { useState, useEffect } from 'react';
import { View, HistoryItem, Track } from '../types';

export interface UseNavigationReturn {
    currentView: View;
    selectedArtist: string | null;
    selectedAlbum: string | null;
    history: HistoryItem[];
    setCurrentView: (view: View) => void;
    setSelectedArtist: (artist: string | null) => void;
    setSelectedAlbum: (album: string | null) => void;
    navigateTo: (view: View, name: string, tracks: Track[]) => void;
    clearHistory: () => void;
    removeHistoryItem: (id: string) => void;
}

export const useNavigation = (): UseNavigationReturn => {
    const [currentView, setCurrentViewState] = useState<View>(() => {
        return (localStorage.getItem('player-view') as View) ?? 'library';
    });
    const [selectedArtist, setSelectedArtistState] = useState<string | null>(
        () => localStorage.getItem('player-artist'),
    );
    const [selectedAlbum, setSelectedAlbumState] = useState<string | null>(
        () => localStorage.getItem('player-album'),
    );
    const [history, setHistory] = useState<HistoryItem[]>(() => {
        try {
            const saved = localStorage.getItem('player-history');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Persist view
    useEffect(() => {
        localStorage.setItem('player-view', currentView);
    }, [currentView]);

    // Persist artist
    useEffect(() => {
        if (selectedArtist) localStorage.setItem('player-artist', selectedArtist);
        else localStorage.removeItem('player-artist');
    }, [selectedArtist]);

    // Persist album
    useEffect(() => {
        if (selectedAlbum) localStorage.setItem('player-album', selectedAlbum);
        else localStorage.removeItem('player-album');
    }, [selectedAlbum]);

    const setCurrentView = (view: View) => {
        setCurrentViewState(view);
        if (view === 'liked') {
            setSelectedArtistState(null);
            setSelectedAlbumState(null);
        }
    };

    const setSelectedArtist = (artist: string | null) => setSelectedArtistState(artist);
    const setSelectedAlbum = (album: string | null) => setSelectedAlbumState(album);

    const navigateTo = (view: View, name: string, tracks: Track[]) => {
        setCurrentViewState(view);
        if (view === 'artist') {
            setSelectedArtistState(name);
            setSelectedAlbumState(null);
        } else if (view === 'album') {
            setSelectedAlbumState(name);
            const albumTrack = tracks.find(t => t.album === name);
            if (albumTrack) setSelectedArtistState(albumTrack.artist);
        }

        const newItem: HistoryItem = {
            id: crypto.randomUUID(),
            type: view === 'artist' ? 'artist' : 'album',
            name,
        };
        const next = [newItem, ...history.filter(h => h.name !== name)].slice(0, 3);
        setHistory(next);
        localStorage.setItem('player-history', JSON.stringify(next));
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem('player-history');
    };

    const removeHistoryItem = (id: string) => {
        const next = history.filter(item => item.id !== id);
        setHistory(next);
        localStorage.setItem('player-history', JSON.stringify(next));
    };

    return {
        currentView,
        selectedArtist,
        selectedAlbum,
        history,
        setCurrentView,
        setSelectedArtist,
        setSelectedAlbum,
        navigateTo,
        clearHistory,
        removeHistoryItem,
    };
};