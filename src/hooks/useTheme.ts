import { useState } from 'react';
import { Theme, ThemeType } from '../types';

export const THEMES: Record<ThemeType, Theme> = {
    monochrome: {
        bgMain: '#09090b',
        bgSecondary: '#18181b',
        bgOverlay: '#27272a',
        fgMain: '#fafafa',
        fgSecondary: '#d4d4d8',
        fgMuted: '#a1a1aa',
        highlightLow: '#27272a',
        highlightMed: '#3f3f46',
        highlightHigh: '#52525b',
        accent1: '#fafafa',
        accent2: '#a1a1aa',
        accent3: '#71717a',
        accent4: '#52525b',
    },
    'rose-pine': {
        bgMain: '#191724',
        bgSecondary: '#1f1d2e',
        bgOverlay: '#21202e',
        fgMain: '#e0def4',
        fgSecondary: '#9ccfd8',
        fgMuted: '#c4a7e7',
        highlightLow: '#403d52',
        highlightMed: '#26233a',
        highlightHigh: '#403d52',
        accent1: '#ebbcba',
        accent2: '#31748f',
        accent3: '#9ccfd8',
        accent4: '#c4a7e7',
    },
    'rose-pine-dawn': {
        bgMain: '#faf4ed',
        bgSecondary: '#fffaf3',
        bgOverlay: '#f2e9e1',
        fgMain: '#575279',
        fgSecondary: '#907aa9',
        fgMuted: '#575279',
        highlightLow: '#dfdad5',
        highlightMed: '#e8e1d9',
        highlightHigh: '#dfdad5',
        accent1: '#d7827e',
        accent2: '#286983',
        accent3: '#56949f',
        accent4: '#907aa9',
    },
};

export interface UseThemeReturn {
    theme: Theme;
    themeType: ThemeType;
    accentColor: string;
    setTheme: (t: ThemeType) => void;
}

export const useTheme = (): UseThemeReturn => {
    const [themeType, setThemeState] = useState<ThemeType>(() => {
        return (localStorage.getItem('player-theme') as ThemeType) ?? 'rose-pine';
    });

    const theme = THEMES[themeType];

    const setTheme = (t: ThemeType) => {
        setThemeState(t);
        localStorage.setItem('player-theme', t);
    };

    return { theme, themeType, accentColor: theme.accent1, setTheme };
};