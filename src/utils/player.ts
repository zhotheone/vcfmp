/**
 * @file utils/player.ts
 * Shared utilities for the music player.
 *
 * USED BY:
 *   - worker.ts
 *   - AlbumView.tsx
 *   - ArtistView.tsx
 *   - (any future view that touches album covers or artists)
 */

/**
 * Canonical key used to store and look up album cover art.
 *
 * Normalises both parts to lowercase so that a worker key of
 * "Tyler, The Creator-IGOR" and a navigation key of "tyler, the creator-igor"
 * always resolve to the same entry.
 *
 * REPLACE every inline `${artist}-${album}` template literal with this.
 *
 * @used-in  worker.ts            → albumCovers.set / albumCovers.has
 * @used-in  AlbumView.tsx        → coverUrl lookup
 * @used-in  ArtistView.tsx       → coverUrl lookup (×2)
 */
export function getAlbumCoverKey(artist?: string | null, album?: string | null): string {
    const safeArtist = artist || 'Unknown Artist';
    const safeAlbum = album || 'Unknown Album';
    return `${safeArtist.toLowerCase()}\0${safeAlbum.toLowerCase()}`;
}

export interface ParsedArtists {
    /** Primary / first artist. */
    primary: string;
    /** Remaining featured artists, deduped. Empty array when none. */
    features: string[];
    /** All artists combined (primary + features). */
    all: string[];
}

/**
 * Splits on:
 *   - `;` always
 *   - `feat.` / `ft.` / `featuring` always
 *   - `,` ONLY when followed by a capital letter (new name boundary)
 *     e.g. "Kendrick Lamar, Mary J. Blige" → splits
 *          "Tyler, the Creator"             → does NOT split ("the" is lowercase)
 */
export function parseArtists(raw: string | string[]): ParsedArtists {
    const inputs = Array.isArray(raw) ? raw : [raw];

    const SEPARATOR_RE = /\s*;\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+featuring\s+|,\s+(?=\p{Lu}|\d)/u;

    const parts = inputs
        .flatMap(s => s.split(SEPARATOR_RE))
        .map(p => p.trim())
        .filter(p => p.length > 0 && !/^(?:feat\.?|ft\.?|featuring)$/i.test(p));

    const [primary = 'Unknown Artist', ...rest] = parts;
    const features = Array.from(new Set(rest));

    return { primary, features, all: [primary, ...features] };
}

/**
 * Returns the separator tokens present in an artist string so UI components
 * can render them as non-clickable spans between clickable artist names.
 *
 * Example output for "A feat. B & C":
 *   [
 *     { text: 'A',       isSeparator: false },
 *     { text: ' feat. ', isSeparator: true  },
 *     { text: 'B & C',   isSeparator: false },
 *   ]
 *
 * REPLACE the inline `.split(...)` + `.map(...)` render logic in
 * AlbumView.tsx with this function.
 *
 * @used-in  AlbumView.tsx   → artist link rendering
 */
export function splitArtistForDisplay(
    artist: string
): { text: string; isSeparator: boolean }[] {
    const SEPARATOR_RE = /(\s*;\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+featuring\s+)/i;
    return artist.split(SEPARATOR_RE).map(part => ({
        text: part,
        isSeparator: SEPARATOR_RE.test(part),
    }));
}

export interface PlayButtonState {
    /** Whether any track in `contextTracks` is the currently loaded track. */
    isContextActive: boolean;
    /** True when the context is active AND playback is running. */
    isContextPlaying: boolean;
}

/**
 * Derives the state needed to render a context play/pause button correctly.
 *
 * REPLACE the duplicated `albumTracks.some(t => t.id === currentTrack?.id)`
 * expressions in AlbumView.tsx and ArtistView.tsx with this helper.
 *
 * @used-in  AlbumView.tsx   → play button onClick + icon selection
 * @used-in  ArtistView.tsx  → play button onClick + icon selection
 */
export function getPlayButtonState(
    contextTrackIds: string[],
    currentTrackId: string | undefined | null,
    isPlaying: boolean
): PlayButtonState {
    const isContextActive = !!currentTrackId && contextTrackIds.includes(currentTrackId);
    return {
        isContextActive,
        isContextPlaying: isContextActive && isPlaying,
    };
}

/**
 * Canonical onClick handler logic for a context play button.
 *
 * REPLACE the three-branch if/else in both AlbumView.tsx and ArtistView.tsx
 * (the one with two identical `togglePlayPause()` branches) with a call to
 * this function.
 *
 * @used-in  AlbumView.tsx   → play button onClick
 * @used-in  ArtistView.tsx  → play button onClick
 */
export function handlePlayButtonClick(
    state: PlayButtonState,
    contextTracks: { id: string }[],
    callbacks: {
        togglePlayPause: () => void;
        playContext: (tracks: { id: string }[], index: number) => void;
    }
): void {
    if (state.isContextActive) {
        callbacks.togglePlayPause();
    } else if (contextTracks.length > 0) {
        callbacks.playContext(contextTracks, 0);
    }
}

/**
 * Formats a duration in seconds to a human-readable string.
 *
 * Examples:
 *   formatDuration(195)   → "3:15"
 *   formatDuration(3723)  → "1:02:03"
 *   formatTotalDuration(3723) → "1 hr 2 min"
 *
 * REPLACE the inline `formatDuration` function defined inside AlbumView.tsx
 * with these — and use `formatTrackDuration` anywhere individual track
 * lengths are displayed (e.g. TrackList rows).
 *
 * @used-in  AlbumView.tsx   → total album duration display
 * @used-in  TrackList.tsx   → (likely) individual track duration column
 */
export function formatTrackDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatTotalDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h} hr ${m} min`;
    return `${m} min`;
}

/**
 * Builds the IndexedDB cache key for a track's parsed metadata.
 *
 * Using `\0` as a delimiter prevents collisions where a path segment itself
 * contains a hyphen (e.g. "/music/2024-remaster/track.flac-1700000000000"
 * would collide with "/music/2024/remaster/track.flac-1700000000000" under
 * the old `${path}-${lastModified}` scheme).
 *
 * REPLACE the inline template literal in worker.ts:
 *   const cacheKey = `${path}-${file.lastModified}`;
 *
 * @used-in  worker.ts  → metadata cache read/write
 */
export function getMetadataCacheKey(path: string, lastModified: number): string {
    return `${path}\0${lastModified}`;
}

/**
 * Returns the most representative year for an album given its track list.
 * Uses the minimum non-zero year so re-releases don't push the date forward.
 *
 * REPLACE `a.tracks[0]?.year || 0` in ArtistView.tsx's album sort comparator
 * with this — the first track is not guaranteed to be the earliest when the
 * array is being constructed mid-sort.
 *
 * @used-in  ArtistView.tsx  → album sort comparator
 */
export function deriveAlbumYear(tracks: { year?: number }[]): number {
    const years = tracks.map(t => t.year ?? 0).filter(y => y > 0);
    return years.length > 0 ? Math.min(...years) : 0;
}