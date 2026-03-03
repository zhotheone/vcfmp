export type View = 'search' | 'library' | 'album' | 'artist' | 'liked' | 'playlist';

export interface HistoryItem {
  id: string;
  type: 'artist' | 'album';
  name: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  features?: string[];
  album: string;
  duration: number;
  trackNumber?: number;
  discNumber?: number;
  year?: number;
  coverUrl?: string;
  path: string;
  playCount?: number;
  lastPlayed?: number;
}

export interface TrackMetadataUpdate {
  title?: string;
  artist?: string;
  album?: string;
}

export interface Theme {
  bgMain: string;
  bgSecondary: string;
  bgOverlay: string;
  fgMain: string;
  fgSecondary: string;
  fgMuted: string;
  highlightLow: string;
  highlightMed: string;
  highlightHigh: string;
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
}
export type ThemeType = 'monochrome' | 'rose-pine' | 'rose-pine-dawn';
