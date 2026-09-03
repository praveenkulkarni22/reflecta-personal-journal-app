import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Calendar, 
  Clock, 
  Smile, 
  Sparkles, 
  X,
  Feather,
  Bookmark,
  MapPin
} from 'lucide-react';
import { JournalEntry } from '../types';
import { formatFullDate, calculateReadingTimeMinutes, calculateWordCount } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { ambientSound } from '../lib/audioSynth';

interface FlipbookReaderProps {
  entries: JournalEntry[];
  isOpen: boolean;
  onClose: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
}

export const FlipbookReader: React.FC<FlipbookReaderProps> = ({
  entries,
  isOpen,
  onClose,
  onSelectEntry
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [currentPage, setCurrentPage] = useState(0);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevPage();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPage, entries.length]);

  if (!isOpen || entries.length === 0) return null;

  const currentEntry = entries[currentPage];
  const totalPages = entries.length;
  const wordCount = calculateWordCount(currentEntry.content || '');
  const readingTime = calculateReadingTimeMinutes(currentEntry.content || '');

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setFlipDirection('next');
      ambientSound.playGentleChime();
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setFlipDirection('prev');
      ambientSound.playGentleChime();
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-950/85 backdrop-blur-2xl animate-in fade-in duration-200">
      
      <div className="relative w-full max-w-4xl flex flex-col items-center">
        
        {/* Top Control Strip */}
        <div className="w-full flex items-center justify-between mb-3 px-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <BookOpen className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
              Volume Flipbook • Leaf <strong className="font-semibold">{currentPage + 1}</strong> of {totalPages}
            </span>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition-all ${
              isDark
                ? 'bg-neutral-900/90 text-neutral-400 hover:text-neutral-100 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'bg-white text-neutral-600 hover:text-neutral-900 border-black/[0.08] shadow-sm'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3D Tactile Book Leaf Container */}
        <div className={`flipbook-container relative w-full min-h-[520px] max-h-[78vh] rounded-3xl border transition-all duration-300 p-6 sm:p-12 flex flex-col justify-between overflow-hidden ${
          isDark
            ? 'bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border-white/[0.1] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.5)]'
            : 'bg-gradient-to-br from-[#fffefc] via-white to-[#fbf9f5] border-black/[0.08] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,1),inset_0_-2px_0_rgba(0,0,0,0.04)]'
        }`}>
          
          {/* Subtle 3D Book Spine Center Crease */}
          <div className="absolute top-0 bottom-0 left-1/2 w-16 -translate-x-1/2 flipbook-spine-shadow pointer-events-none opacity-60" />

          {/* Book Spine Stitching Effect */}
          <div className={`absolute top-0 bottom-0 left-1/2 w-[1px] -translate-x-1/2 pointer-events-none ${
            isDark ? 'bg-neutral-800' : 'bg-neutral-200'
          }`} />

          {/* Dynamic Turning Leaf Animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentEntry.id}
              initial={{ 
                opacity: 0, 
                rotateY: flipDirection === 'next' ? 22 : -22, 
                x: flipDirection === 'next' ? 30 : -30 
              }}
              animate={{ opacity: 1, rotateY: 0, x: 0 }}
              exit={{ 
                opacity: 0, 
                rotateY: flipDirection === 'next' ? -22 : 22, 
                x: flipDirection === 'next' ? -30 : 30 
              }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 overflow-y-auto pr-2 z-10"
            >
              {/* Header Info */}
              <div className={`flex flex-wrap items-center justify-between gap-3 pb-5 border-b ${
                isDark ? 'border-neutral-800/80' : 'border-neutral-200/80'
              }`}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className={`flex items-center gap-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatFullDate(currentEntry.createdAt)}</span>
                    </span>
                    <span className={isDark ? 'text-neutral-500' : 'text-neutral-400'}>•</span>
                    <span className={isDark ? 'text-neutral-400' : 'text-neutral-500'}>
                      {wordCount} words • {readingTime}m read
                    </span>
                  </div>

                  <h3 className={`font-serif text-2xl sm:text-4xl font-normal tracking-tight ${
                    isDark ? 'text-neutral-100' : 'text-neutral-900'
                  }`}>
                    {currentEntry.title || 'Untitled Reflection'}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {currentEntry.location && (
                    <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${
                      isDark
                        ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}>
                      <MapPin className="w-3 h-3 text-blue-400" />
                      <span>{currentEntry.location.name}</span>
                    </span>
                  )}
                  {currentEntry.mood && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${
                      isDark
                        ? 'bg-neutral-800/90 text-emerald-300 border-neutral-700/80'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {currentEntry.mood}
                    </span>
                  )}
                  {currentEntry.intention && (
                    <span className={`px-3 py-1 rounded-full text-xs font-mono capitalize border ${
                      isDark
                        ? 'bg-neutral-900 text-neutral-300 border-neutral-800'
                        : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                    }`}>
                      {currentEntry.intention.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Photos Gallery if present */}
              {currentEntry.photos && currentEntry.photos.length > 0 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {currentEntry.photos.map((photo) => (
                    <div 
                      key={photo.id}
                      className="p-1 rounded-2xl bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 shadow-sm shrink-0"
                    >
                      <img 
                        src={photo.url} 
                        alt={photo.name || 'Reflection Photo'} 
                        className="h-28 w-auto max-w-[200px] object-cover rounded-xl"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Journal Body Content with Typographic Rhythm */}
              <div className={`text-base sm:text-lg leading-[1.8] font-light font-serif whitespace-pre-wrap ${
                isDark ? 'text-neutral-200 selection:bg-emerald-500/20' : 'text-neutral-800 selection:bg-emerald-500/20'
              }`}>
                {currentEntry.content}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom Flipbook Navigation Bar */}
          <div className={`flex items-center justify-between pt-6 border-t mt-6 z-10 ${
            isDark ? 'border-neutral-800/80' : 'border-neutral-200/80'
          }`}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={prevPage}
              disabled={currentPage === 0}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'bg-neutral-100 hover:bg-white text-neutral-800 border-black/[0.08] shadow-sm'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Leaf</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onSelectEntry(currentEntry);
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 text-xs font-semibold shadow-[0_4px_14px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all cursor-pointer"
            >
              <Feather className="w-3.5 h-3.5" />
              <span>Open in Sanctuary Editor</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={nextPage}
              disabled={currentPage === totalPages - 1}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'bg-neutral-100 hover:bg-white text-neutral-800 border-black/[0.08] shadow-sm'
              }`}
            >
              <span>Next Leaf</span>
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>

        </div>

      </div>

    </div>
  );
};
