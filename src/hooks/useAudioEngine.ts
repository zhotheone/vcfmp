import { useState, useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { Track } from '../types';

export interface UseAudioEngineReturn {
    isPlaying: boolean;
    progress: number;
    duration: number;
    volume: number;
    preloadedTrackId: string | null;
    // Refs exposed so the worker hook can interact with audio directly
    audioRef: MutableRefObject<HTMLAudioElement | null>;
    audioRefNext: MutableRefObject<HTMLAudioElement | null>;
    objectUrlRef: MutableRefObject<string | null>;
    objectUrlRefNext: MutableRefObject<string | null>;
    // State setters needed by the worker message hub
    setIsPlaying: (v: boolean) => void;
    setProgress: (v: number) => void;
    setDuration: (v: number) => void;
    setPreloadedTrackId: (id: string | null) => void;
    // Public API
    togglePlayPause: (currentTrack: Track | null) => void;
    seek: (time: number) => void;
    setVolume: (v: number) => void;
    toggleMute: () => void;
}

export const useAudioEngine = (): UseAudioEngineReturn => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState<number>(() => {
        const saved = localStorage.getItem('player-volume');
        return saved ? parseFloat(saved) : 1;
    });
    const [preloadedTrackId, setPreloadedTrackId] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioRefNext = useRef<HTMLAudioElement | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const objectUrlRefNext = useRef<string | null>(null);
    const lastVolumeRef = useRef(volume > 0 ? volume : 1);

    // Use refs for values read inside rAF / event handlers to avoid stale closures
    const volumeRef = useRef(volume);
    const isPlayingRef = useRef(isPlaying);
    const durationRef = useRef(duration);
    const preloadedTrackIdRef = useRef(preloadedTrackId);
    const workerRef = useRef<Worker | null>(null); // injected by the worker hook via returned setter
    const repeatRef = useRef<'off' | 'all' | 'one'>('off');

    useEffect(() => { volumeRef.current = volume; }, [volume]);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { durationRef.current = duration; }, [duration]);
    useEffect(() => { preloadedTrackIdRef.current = preloadedTrackId; }, [preloadedTrackId]);

    // Expose a way for the worker hook to inject itself & repeat state
    (audioEngineInternals as any).setWorkerRef = (w: Worker | null) => { workerRef.current = w; };
    (audioEngineInternals as any).setRepeat = (r: 'off' | 'all' | 'one') => { repeatRef.current = r; };

    // Initialise Audio elements once
    useEffect(() => {
        audioRef.current = new Audio();
        audioRefNext.current = new Audio();

        return () => {
            audioRef.current?.pause();
            audioRefNext.current?.pause();
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            if (objectUrlRefNext.current) URL.revokeObjectURL(objectUrlRefNext.current);
        };
    }, []);

    // Sync volume to audio element whenever it changes
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
    }, [volume]);

    // rAF-based progress loop + crossfade + media session position
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        let rafId: number;

        const tick = () => {
            const current = audio.currentTime;
            const dur = durationRef.current;

            setProgress(current);
            localStorage.setItem('player-progress', current.toString());

            // Trigger preload 10 s before end
            if (dur > 0 && dur - current <= 10 && !preloadedTrackIdRef.current) {
                workerRef.current?.postMessage({ type: 'PRELOAD_NEXT_TRACK' });
            }

            // Crossfade: 3 s before end
            const nextAudio = audioRefNext.current;
            if (dur > 0 && dur - current <= 3 && nextAudio?.src) {
                const vol = volumeRef.current;
                const ratio = Math.max(0, Math.min(1, (dur - current) / 3));
                audio.volume = vol * ratio;

                if (nextAudio.paused) nextAudio.play().catch(console.error);
                nextAudio.volume = vol * (1 - ratio);
            }

            // Media Session position
            if ('mediaSession' in navigator && dur > 0 && !isNaN(current)) {
                try {
                    navigator.mediaSession.setPositionState({
                        duration: Math.max(0, dur),
                        playbackRate: audio.playbackRate,
                        position: Math.min(Math.max(0, current), dur),
                    });
                } catch { /* ignore rapid-change errors */ }
            }

            if (isPlayingRef.current) rafId = requestAnimationFrame(tick);
        };

        if (isPlaying) {
            rafId = requestAnimationFrame(tick);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        } else {
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        }

        const handleEnded = () => {
            if (repeatRef.current === 'one') {
                audio.currentTime = 0;
                audio.play();
            } else {
                workerRef.current?.postMessage({ type: 'NEXT_TRACK' });
            }
        };

        const handleLoadedMetadata = () => setDuration(audio.duration);

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);

        return () => {
            cancelAnimationFrame(rafId);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
    }, [isPlaying]); // Only re-bind when play state toggles — all other values go through refs

    const togglePlayPause = useCallback((currentTrack: Track | null) => {
        if (!currentTrack) return;
        if (isPlayingRef.current) {
            audioRef.current?.pause();
            setIsPlaying(false);
        } else {
            audioRef.current?.play().catch(console.error);
            setIsPlaying(true);
        }
    }, []);

    const seek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setProgress(time);
        }
    }, []);

    const setVolume = useCallback((v: number) => {
        setVolumeState(v);
        volumeRef.current = v;
        if (v > 0) lastVolumeRef.current = v;
        localStorage.setItem('player-volume', v.toString());
        if (audioRef.current) audioRef.current.volume = v;
    }, []);

    const toggleMute = useCallback(() => {
        setVolume(volumeRef.current > 0 ? 0 : lastVolumeRef.current);
    }, [setVolume]);

    return {
        isPlaying,
        progress,
        duration,
        volume,
        preloadedTrackId,
        audioRef,
        audioRefNext,
        objectUrlRef,
        objectUrlRefNext,
        setIsPlaying,
        setProgress,
        setDuration,
        setPreloadedTrackId,
        togglePlayPause,
        seek,
        setVolume,
        toggleMute,
    };
};

// Internal bridge object so the worker hook can inject the worker ref without
// circular imports. Not exported as part of the public API.
export const audioEngineInternals: {
    setWorkerRef?: (w: Worker | null) => void;
    setRepeat?: (r: 'off' | 'all' | 'one') => void;
} = {};