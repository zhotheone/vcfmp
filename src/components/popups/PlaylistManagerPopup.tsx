import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, ListMusic, Check, Edit2, X, CheckCircle2 } from 'lucide-react';
import { usePlayer } from '../../hooks/usePlayer';
import { Track } from '../../types';

interface PlaylistManagerPopupProps {
    isOpen: boolean;
    onClose: () => void;
    track?: Track | null;
    position?: 'top-right' | 'bottom-right';
}

export function PlaylistManagerPopup({ isOpen, onClose, track, position = 'bottom-right' }: PlaylistManagerPopupProps) {
    const { playlists, createPlaylist, deletePlaylist, renamePlaylist, addTrackToPlaylist, removeTrackFromPlaylist, setSelectedAlbum, setCurrentView, theme } = usePlayer();
    const [name, setName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingId]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            createPlaylist(name.trim());
            setName('');
        }
    };

    const handleRenameSubmit = (id: string) => {
        if (editName.trim()) {
            renamePlaylist(id, editName.trim());
        }
        setEditingId(null);
    };

    const toggleTrackInPlaylist = (playlistId: string, hasTrack: boolean) => {
        if (!track) return;
        if (hasTrack) {
            removeTrackFromPlaylist(playlistId, track.id);
        } else {
            addTrackToPlaylist(playlistId, track.id);
        }
    };

    const handlePlaylistClick = (playlistId: string) => {
        if (!track && !editingId) {
            // Navigate to playlist if not in adding track mode
            setSelectedAlbum(playlistId);
            setCurrentView('playlist');
            onClose();
        }
    };

    const posClasses = position === 'bottom-right'
        ? 'bottom-full right-0 mb-6 origin-bottom-right'
        : 'top-full right-0 mt-4 origin-top-right';

    const animProps = position === 'bottom-right'
        ? { initial: { opacity: 0, scale: 0.95, y: -10 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: -10 } }
        : { initial: { opacity: 0, scale: 0.95, y: 10 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 10 } };


    return (
        <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <motion.div
                {...animProps}
                transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                className={`absolute ${posClasses} w-72 rounded-2xl shadow-xl z-50 overflow-hidden border border-white/5 flex flex-col`}
                style={{ backgroundColor: theme.highlightHigh, maxHeight: '60vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {track && (
                    <div className="px-4 py-3 border-b border-white/10 bg-black/10">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">Add to Playlist</span>
                        <span className="text-sm text-white font-medium truncate block">{track.title}</span>
                    </div>
                )}

                <div className="p-3 border-b border-white/5 shrink-0">
                    <form onSubmit={handleSubmit} className="relative">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="New Playlist..."
                            className="w-full bg-black/20 text-white placeholder-zinc-500 rounded-xl px-3 py-2 pr-10 focus:outline-none focus:ring-1 transition-all text-sm"
                            style={{ paddingInlineStart: '0.75rem', ringColor: theme.accent1 }}
                        />
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </form>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1">
                    {playlists.length === 0 ? (
                        <p className="px-4 py-8 text-xs text-zinc-500 text-center font-medium">No custom playlists.</p>
                    ) : (
                        playlists.map((playlist) => {
                            const hasTrack = track ? playlist.trackIds.includes(track.id) : false;
                            const isEditing = editingId === playlist.id;

                            return (
                                <div
                                    key={playlist.id}
                                    className={`group flex items-center justify-between px-2 py-1 transition-colors ${track || !editingId ? 'hover:bg-white/5 cursor-pointer' : ''}`}
                                    onClick={() => track ? toggleTrackInPlaylist(playlist.id, hasTrack) : handlePlaylistClick(playlist.id)}
                                >
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 w-full px-1 py-1" onClick={e => e.stopPropagation()}>
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRenameSubmit(playlist.id);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                                className="flex-1 bg-black/30 text-white text-sm rounded px-2 py-1 outline-none ring-1"
                                                style={{ ringColor: theme.accent1 }}
                                            />
                                            <button onClick={() => handleRenameSubmit(playlist.id)} className="p-1 text-green-400 hover:text-green-300 transition-colors"><CheckCircle2 className="w-4 h-4" /></button>
                                            <button onClick={() => setEditingId(null)} className="p-1 text-zinc-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3 overflow-hidden px-2 py-1.5 flex-1">
                                                <ListMusic className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                                                <span className="text-sm font-medium text-white truncate flex-1">{playlist.name}</span>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {track ? (
                                                    <div className="p-1.5 mr-1" onClick={e => e.stopPropagation()}>
                                                        {hasTrack ? <Check className="w-4 h-4" style={{ color: theme.accent1 }} /> : <Plus className="w-4 h-4 text-zinc-400" />}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditName(playlist.name); setEditingId(playlist.id); }}
                                                            className="p-1.5 text-zinc-400 hover:text-white transition-all rounded-md hover:bg-white/10"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); }}
                                                            className="p-1.5 text-zinc-400 hover:text-red-400 transition-all rounded-md hover:bg-white/10"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </motion.div>
        </>
    );
}
