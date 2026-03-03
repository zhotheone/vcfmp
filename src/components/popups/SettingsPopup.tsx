import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Upload, Settings, Trash2 } from 'lucide-react';
import { usePlayer } from '../../hooks/usePlayer';
import { del } from 'idb-keyval';

interface SettingsPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsPopup({ isOpen, onClose }: SettingsPopupProps) {
    const { playlists, importPlaylists, theme, themeType, setTheme } = usePlayer();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [storageSize, setStorageSize] = useState<string>('Calculating...');

    useEffect(() => {
        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(({ usage }) => {
                if (usage !== undefined) {
                    setStorageSize((usage / (1024 * 1024)).toFixed(2) + ' MB');
                } else {
                    setStorageSize('Unknown');
                }
            }).catch(() => setStorageSize('Error'));
        } else {
            setStorageSize('Not supported');
        }
    }, []);

    if (!isOpen) return null;

    const exportPlaylists = () => {
        const dataStr = JSON.stringify(playlists, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `vcfmp-playlists-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                if (Array.isArray(imported)) {
                    importPlaylists(imported);
                    alert('Playlists imported successfully!');
                    onClose();
                } else {
                    alert('Invalid playlist file format.');
                }
            } catch (error) {
                alert('Error parsing playlist file.');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handlePurgeCache = async () => {
        if (window.confirm('Are you sure you want to completely purge the IndexedDB cache? The page will reload.')) {
            try {
                await del('metadata-cache');
                await del('ui-tracks-cache');
                window.location.reload();
            } catch (err) {
                console.error("Failed to clear IDB:", err);
                alert("Failed to purge cache. See console.");
            }
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] rounded-[2.5rem] shadow-2xl z-[70] overflow-hidden flex flex-col"
                style={{ backgroundColor: theme.highlightMed }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Settings className="w-6 h-6" style={{ color: theme.accent1 }} />
                        <h2 className="text-xl font-bold text-white tracking-tight">Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <section>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Appearance</h3>
                        <div className="flex gap-4">
                            {(['monochrome', 'rose-pine', 'rose-pine-dawn'] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTheme(t)}
                                    className={`w-10 h-10 rounded-full border-2 transition-all duration-200 hover:scale-110 relative ${theme === t ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                    style={{
                                        backgroundColor: t === 'monochrome' ? '#27272a' : t === 'rose-pine' ? '#191724' : '#faf4ed'
                                    }}
                                    title={t.replace('-', ' ')}
                                >
                                    {theme === t && (
                                        <div
                                            className="absolute inset-1 rounded-full border border-white/20"
                                            style={{ backgroundColor: t === 'rose-pine-dawn' ? '#d7827e' : t === 'rose-pine' ? '#ebbcba' : '#fafafa' }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    </section>
                    <section>
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Data Management</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={exportPlaylists}
                                className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl hover:bg-white/5 transition-all group border border-white/5"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Download className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                                </div>
                                <span className="text-sm font-semibold text-white">Export<br />Playlists</span>
                            </button>

                            <button
                                onClick={handleImportClick}
                                className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl hover:bg-white/5 transition-all group border border-white/5"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                                </div>
                                <span className="text-sm font-semibold text-white">Import<br />Playlists</span>
                            </button>

                            <button
                                onClick={handlePurgeCache}
                                className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl hover:bg-red-500/10 transition-all group border border-red-500/5 hover:border-red-500/20"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-zinc-800 group-hover:bg-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Trash2 className="w-5 h-5 text-zinc-400 group-hover:text-red-400" />
                                </div>
                                <span className="text-sm font-semibold text-red-400">Purge<br />Cache</span>
                            </button>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".json"
                            className="hidden"
                        />
                        <div className="mt-4 text-xs text-center text-zinc-500 font-medium">
                            IndexedDB Usage: {storageSize}
                        </div>
                    </section>

                    <p className="text-xs text-zinc-500 text-center">
                        VCFMP v1.3.0 • Build {(window as any).__COMMIT_HASH__ || 'dev'}
                    </p>
                </div>
            </motion.div>
        </>
    );
}
