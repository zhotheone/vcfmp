import { Music, Search, Mic2, Disc } from 'lucide-react';
import { usePlayer } from '../hooks/usePlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';
import { AlbumView } from './views/AlbumView';
import { ArtistView } from './views/ArtistView';
import { LikedSongsView } from './views/LikedSongsView';
import { PlaylistView } from './views/PlaylistView';

export function MainContent() {
  const { tracks, isScanning, scanProgress, hasSavedHandle, restoreLibrary, selectDirectory, currentView, setCurrentView, accentColor, selectedAlbum, selectedArtist, currentTrack, searchQuery, setSearchQuery, history, navigateTo, theme } = usePlayer();

  const renderContent = () => {
    if (isScanning) {
      return (
        <motion.div
          key="scanning"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
          className="flex-1 flex flex-col items-center justify-center p-8"
        >
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: accentColor, borderTopColor: 'transparent' }}></div>
          <h2 className="text-xl font-semibold text-white mb-2">Scanning local files...</h2>
          <p className="text-zinc-400">{scanProgress.current} / {scanProgress.total} files processed</p>
        </motion.div>
      );
    }

    if (tracks.length === 0) {
      return (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
          className="flex-1 flex flex-col items-center justify-center p-8"
        >
          <div className="text-center text-zinc-400 max-w-md">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Music className="w-10 h-10 text-zinc-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">No music found</h2>
            <p className="mb-8 text-lg">Select a local folder containing FLAC, MP3, or M4A files to start listening.</p>
            {hasSavedHandle ? (
              <button
                onClick={restoreLibrary}
                className="text-black font-bold py-3 px-8 rounded-full transition-transform hover:scale-105 w-full mb-4"
                style={{ backgroundColor: theme.accent1, color: theme.bgMain }}
              >
                Restore Previous Library
              </button>
            ) : null}
            <button
              onClick={selectDirectory}
              className="bg-white hover:bg-zinc-200 text-black font-bold py-3 px-8 rounded-full transition-transform hover:scale-105 w-full"
            >
              Select Music Folder
            </button>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={currentView + (selectedAlbum || '') + (selectedArtist || '')}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
        className="flex-1 overflow-y-auto"
      >
        {currentView === 'search' && <SearchView />}
        {currentView === 'library' && <LibraryView />}
        {currentView === 'album' && <AlbumView />}
        {currentView === 'artist' && <ArtistView />}
        {currentView === 'liked' && <LikedSongsView />}
        {currentView === 'playlist' && <PlaylistView />}
      </motion.div>
    );
  };

  return (
    <div
      className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative md:rounded-[2.5rem] transition-colors duration-700 ease-out"
      style={{ backgroundColor: theme.highlightLow }}
    >
      <div
        className="h-14 flex items-center px-6 gap-4 sticky top-0 z-10 overflow-x-auto whitespace-nowrap scrollbar-hide transition-colors duration-700 m-2 mt-2 rounded-[2rem] flex-shrink-0 shadow-sm"
        style={{ backgroundColor: theme.highlightMed }}
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
          onClick={() => setCurrentView('library')}
          className="px-5 py-2 text-sm rounded-full font-bold transition-colors flex-shrink-0 shadow-sm"
          style={currentView === 'library' ? { backgroundColor: theme.accent1, color: theme.bgMain } : { backgroundColor: theme.highlightHigh, color: theme.fgMain }}
        >
          Library
        </motion.button>
        <div className="relative flex-shrink-0">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (currentView !== 'search') setCurrentView('search');
            }}
            className="text-white pl-10 pr-5 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-white/20 w-64 transition-colors duration-700 shadow-inner block"
            style={{ backgroundColor: theme.highlightHigh }}
            onClick={() => setCurrentView('search')}
          />
        </div>
        {history.map((item) => {
          const isActive = currentView === item.type &&
            (item.type === 'artist' ? selectedArtist === item.name : selectedAlbum === item.name);
          const Icon = item.type === 'artist' ? Mic2 : Disc;

          return (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.2 }}
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log("Navigating to", item.type, item.name);
                navigateTo(item.type, item.name);
              }}
              className="px-4 py-2 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-2 flex-shrink-0 max-w-[180px] cursor-pointer pointer-events-auto shadow-sm"
              style={isActive ? { backgroundColor: theme.accent1, color: theme.bgMain } : { backgroundColor: theme.highlightHigh, color: theme.fgMain }}
            >
              <Icon className="w-4 h-4 pointer-events-none" />
              <span className="truncate pointer-events-none">{item.name}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </div>
    </div>
  );
}
