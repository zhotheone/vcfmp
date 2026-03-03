import { useEffect } from 'react';
import { Track } from '../types';

interface UseMediaSessionProps {
    currentTrack: Track | null;
    isPlaying: boolean;
    duration: number;
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    onPrev: () => void;
    onSeek: (time: number) => void;
}

export const useMediaSession = ({
    currentTrack,
    isPlaying,
    duration,
    onPlay,
    onPause,
    onNext,
    onPrev,
    onSeek,
}: UseMediaSessionProps): void => {
    // Action handlers — re-register whenever callbacks change
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.setActionHandler('play', () => {
            if (!isPlaying && currentTrack) onPlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            if (isPlaying && currentTrack) onPause();
        });
        navigator.mediaSession.setActionHandler('previoustrack', onPrev);
        navigator.mediaSession.setActionHandler('nexttrack', onNext);
        navigator.mediaSession.setActionHandler('seekto', details => {
            if (details.seekTime != null && duration > 0) onSeek(details.seekTime);
        });

        return () => {
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('previoustrack', null);
            navigator.mediaSession.setActionHandler('nexttrack', null);
            navigator.mediaSession.setActionHandler('seekto', null);
        };
    }, [currentTrack, isPlaying, duration, onPlay, onPause, onNext, onPrev, onSeek]);

    // Metadata — only re-run when the track changes
    useEffect(() => {
        if (!('mediaSession' in navigator) || !currentTrack) return;

        const setMetadata = (artworkSrc?: string) => {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentTrack.title,
                artist: currentTrack.artist,
                album: currentTrack.album,
                artwork: artworkSrc ? [{ src: artworkSrc, sizes: '512x512', type: 'image/png' }] : [],
            });
        };

        if (currentTrack.coverUrl) {
            // Many OS media players reject blob: URIs; rasterise to a data URI first.
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 512, 512);
                    setMetadata(canvas.toDataURL('image/png'));
                }
            };
            img.onerror = () => setMetadata();
            img.src = currentTrack.coverUrl;
        } else {
            setMetadata();
        }
    }, [currentTrack]);
};