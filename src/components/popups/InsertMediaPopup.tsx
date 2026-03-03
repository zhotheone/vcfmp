import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, AlertCircle } from 'lucide-react';
import { usePlayer } from '../../hooks/usePlayer';

export function InsertMediaPopup() {
    const { isDriveMissing, selectDirectory, theme } = usePlayer();

    if (!isDriveMissing) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] p-8 rounded-[2.5rem] shadow-2xl z-[70] flex flex-col items-center justify-center text-center"
                style={{ backgroundColor: theme.highlightMed }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex flex-col items-center justify-center mb-6 relative">
                    <HardDrive className="w-10 h-10 text-red-500" />
                    <AlertCircle className="w-6 h-6 text-red-500 absolute -bottom-2 -right-2 bg-[#27272a] rounded-full border-2 border-[#27272a]" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-4">Media Missing</h2>
                <p className="text-base text-zinc-300 mb-8 px-4 leading-relaxed">
                    We can't find the audio files for your library. Is your USB drive disconnected?
                </p>

                <button
                    onClick={selectDirectory}
                    className="w-full py-4 rounded-full font-bold text-lg shadow-lg hover:scale-105 active:scale-95 transition-all text-black"
                    style={{ backgroundColor: theme.accent1 }}
                >
                    Reconnect Folder
                </button>
            </motion.div>
        </AnimatePresence>
    );
}
