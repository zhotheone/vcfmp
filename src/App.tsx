import { useEffect } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { usePlayer } from './hooks/usePlayer';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { Player } from './components/Player';
import { InsertMediaPopup } from './components/popups/InsertMediaPopup';
import { getAlbumCoverKey } from './utils/player';

function AppContent() {
  const { currentTrack, isPlaying, theme, albumCovers } = usePlayer();

  useEffect(() => {
    let intervalId: number;

    if (currentTrack) {
      const fullTitle = `${isPlaying ? '▶' : '⏸'} ${currentTrack.title} - ${currentTrack.artist} `;
      let scrollIndex = 0;

      document.title = fullTitle;

      intervalId = window.setInterval(() => {
        scrollIndex = (scrollIndex + 1) % fullTitle.length;
        document.title = fullTitle.substring(scrollIndex) + fullTitle.substring(0, scrollIndex);
      }, 300);
    } else {
      document.title = 'VCFMP';
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentTrack?.title, currentTrack?.artist, isPlaying]);

  useEffect(() => {
    if (currentTrack) {
      const albumKey = getAlbumCoverKey(currentTrack.artist, currentTrack.album);
      const coverUrl = albumCovers[albumKey] || currentTrack.coverUrl;

      if (coverUrl) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        if (link.href !== coverUrl) {
          link.href = coverUrl;
        }
      }
    }
  }, [currentTrack?.artist, currentTrack?.album, currentTrack?.coverUrl, albumCovers]);

  return (
    <div
      className="flex flex-col h-[100dvh] text-white overflow-hidden font-sans transition-colors duration-700 ease-out"
      style={{ backgroundColor: theme.bgMain }}
    >
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 p-0 md:p-2 gap-0 md:gap-2">
        <Sidebar className="order-2 md:order-1" />
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative z-0 order-1 md:order-2">
          <MainContent />
        </div>
      </div>
      <Player />
      <InsertMediaPopup />
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}
