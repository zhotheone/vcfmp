import { Search } from 'lucide-react';
import { usePlayer } from '../../hooks/usePlayer';
import { TrackList } from '../TrackList';
import { motion } from 'framer-motion';

export function SearchView() {
  const { tracks, searchQuery, setSearchQuery, theme } = usePlayer();

  const filtered = searchQuery ? tracks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.album.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  return (
    <div className="p-8">
      {searchQuery && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Search Results</h2>
          {filtered.length === 0 ? (
            <p className="text-zinc-400">No results found for "{searchQuery}"</p>
          ) : (
            <TrackList tracks={filtered} />
          )}
        </div>
      )}
      {!searchQuery && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
          className="mt-32 text-center"
        >
          <Search className="w-24 h-24 mx-auto mb-6 opacity-40" style={{ color: theme.accent1 }} />
          <h2 className="text-3xl font-bold tracking-tight mb-4" style={{ color: theme.fgMain }}>Search your local library</h2>
          <p className="text-lg font-medium" style={{ color: theme.highlightLow }}>Find your favorite tracks, artists, and albums.</p>
        </motion.div>
      )}
    </div>
  );
}
