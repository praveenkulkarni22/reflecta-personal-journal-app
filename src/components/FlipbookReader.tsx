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
  onNewReflection?: () => void;
  onOpenSparks?: () => void;
}

const SAMPLE_ENTRIES: JournalEntry[] = [
  {
    id: 'sample-1',
    userId: 'sample_user',
    title: 'Dawn Over Still Waters',
    content: `The morning mist hangs low above the pond, quiet and motionless. There is a profound stillness in waking before the world demands anything of you.\n\nI sat on the wooden bench with hot tea in hand, watching the ripples spread as a single fallen leaf touched the surface. It struck me how often we mistake motion for progress. Today, my intention is simple: move with deliberation, breathe into pauses, and let thoughts settle like silt at the bottom of clear spring water.\n\nGratitude for the silence that holds everything together.`,
    mood: 'peaceful',
    intention: 'gratitude_focus',
    wordCount: 88,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    entryDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
  },
  {
    id: 'sample-2',
    userId: 'sample_user',
    title: 'The Architecture of Solitude',
    content: `Spent the afternoon untangling a knot of competing priorities. In quiet contemplation, the noise fades, leaving only what is truly essential.\n\nSolitude is not absence; it is presence. The presence of one's own center. When I close my eyes and listen to the ambient chime of the sanctuary, the urgent whispers lose their urgency, and the foundational truths re-emerge.\n\n"What is essential is invisible to the eye," St. Exupéry wrote. Tonight, that feels less like poetry and more like an operational compass.`,
    mood: 'thoughtful',
    intention: 'decision_clarity',
    wordCount: 84,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    entryDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  },
  {
    id: 'sample-3',
    userId: 'sample_user',
    title: 'Evening Dusk & Gratitude Cadence',
    content: `As twilight settles into deep indigo, shadows soften against the windowpane. I reflect on today's small triumphs: an honest conversation that required courage, twenty minutes of uninterrupted reading, and the crisp scent of cedar after rain.\n\nTomorrow brings new questions, but tonight I leave the journal open to this page of quiet contentment. Rest is not a reward to be earned; it is the rhythm of life itself.`,
    mood: 'calm',
    intention: 'creative_flow',
    wordCount: 74,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entryDate: new Date().toISOString().slice(0, 10),
  }
];

export const FlipbookReader: React.FC<FlipbookReaderProps> = ({
  entries,
  isOpen,
  onClose,
  onSelectEntry,
  onNewReflection,
  onOpenSparks
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [currentPage, setCurrentPage] = useState(0);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const [useSamples, setUseSamples] = useState(false);

  // Auto-enable sample view if user has 0 entries when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
      setUseSamples(entries.length === 0);
    }
  }, [isOpen, entries.length]);

  const activeEntries = entries.length > 0 ? entries : (useSamples ? SAMPLE_ENTRIES : []);
  const totalPages = activeEntries.length;
  const safeCurrentPage = totalPages > 0 ? Math.min(Math.max(0, currentPage), totalPages - 1) : 0;
  const currentEntry = activeEntries[safeCurrentPage];

  const nextPage = () => {
    if (safeCurrentPage < totalPages - 1) {
      setFlipDirection('next');
      ambientSound.playGentleChime();
      setCurrentPage(prev => Math.min(prev + 1, totalPages - 1));
    }
  };

  const prevPage = () => {
    if (safeCurrentPage > 0) {
      setFlipDirection('prev');
      ambientSound.playGentleChime();
      setCurrentPage(prev => Math.max(prev - 1, 0));
    }
  };

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
  }, [isOpen, safeCurrentPage, totalPages]);

  if (!isOpen) return null;

  const wordCount = currentEntry ? calculateWordCount(currentEntry.content || '') : 0;
  const readingTime = currentEntry ? calculateReadingTimeMinutes(currentEntry.content || '') : 0;
  const isViewingSample = entries.length === 0 || useSamples;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-950/85 backdrop-blur-2xl animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      
      <div className="relative w-full max-w-4xl flex flex-col items-center">
        
        {/* Top Control Strip */}
        <div className="w-full flex items-center justify-between mb-3 px-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <BookOpen className={`w-4 h-4 ${isDark ? 'text-[#67C3DE]' : 'text-[#083847]'}`} />
            <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
              Volume Flipbook • {totalPages > 0 ? (
                <>Leaf <strong className="font-semibold">{safeCurrentPage + 1}</strong> of {totalPages}</>
              ) : 'Empty Sanctuary'}
            </span>
            {isViewingSample && (
              <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[10px] font-mono border font-medium ${
                isDark 
                  ? 'bg-[#67C3DE]/15 text-[#67C3DE] border-[#67C3DE]/30' 
                  : 'bg-[#67C3DE]/20 text-[#083847] border-[#67C3DE]/50'
              }`}>
                Sample Preview Mode
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {entries.length > 0 && useSamples && (
              <button
                onClick={() => {
                  setUseSamples(false);
                  setCurrentPage(0);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  isDark
                    ? 'bg-neutral-900/90 text-neutral-300 hover:text-white border-white/[0.08]'
                    : 'bg-white text-neutral-700 hover:text-neutral-900 border-black/[0.08] shadow-xs'
                }`}
              >
                Back to My Entries
              </button>
            )}

            <button
              onClick={onClose}
              title="Close Flipbook Reader (Esc)"
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-neutral-900/90 text-neutral-400 hover:text-neutral-100 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border-black/[0.08] shadow-xs'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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

          {totalPages > 0 && currentEntry ? (
            <>
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
                        <span className={`flex items-center gap-1.5 ${isDark ? 'text-[#67C3DE]' : 'text-[#083847] font-semibold'}`}>
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
                            ? 'bg-[#67C3DE]/15 text-[#67C3DE] border-[#67C3DE]/30'
                            : 'bg-[#67C3DE]/20 text-[#083847] border-[#67C3DE]/50'
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
                    isDark ? 'text-neutral-200 selection:bg-[#67C3DE]/20' : 'text-neutral-800 selection:bg-[#67C3DE]/20'
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
                  disabled={safeCurrentPage === 0}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 cursor-pointer ${
                    isDark
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'bg-neutral-100 hover:bg-white text-neutral-800 border-black/[0.08] shadow-xs'
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
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Feather className="w-3.5 h-3.5" />
                  <span>{isViewingSample ? 'Use This Reflection as Spark' : 'Open in Sanctuary Editor'}</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={nextPage}
                  disabled={safeCurrentPage === totalPages - 1}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-all disabled:opacity-30 cursor-pointer ${
                    isDark
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'bg-neutral-100 hover:bg-white text-neutral-800 border-black/[0.08] shadow-xs'
                  }`}
                >
                  <span>Next Leaf</span>
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </>
          ) : (
            /* Serene Empty State Leaf */
            <div className="space-y-6 text-center py-12 px-4 z-10 my-auto">
              <div className={`w-16 h-16 mx-auto rounded-3xl border flex items-center justify-center shadow-lg ${
                isDark
                  ? 'bg-[#67C3DE]/15 border-[#67C3DE]/40 text-[#67C3DE] shadow-[0_0_15px_rgba(103,195,222,0.2)]'
                  : 'bg-[#67C3DE]/20 border-[#67C3DE]/60 text-[#083847] shadow-sm'
              }`}>
                <BookOpen className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className={`font-serif text-2xl sm:text-3xl font-medium ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  Your Sanctuary Flipbook Awaits
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  You have not penned any journal reflections yet. Write your first reflection to fill these tactile 3D pages, or explore with contemplative sample leaves.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {onNewReflection && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      onClose();
                      onNewReflection();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <Feather className="w-4 h-4" />
                    <span>Write First Reflection</span>
                  </motion.button>
                )}

                <button
                  onClick={() => {
                    setUseSamples(true);
                    setCurrentPage(0);
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.1]'
                      : 'bg-white hover:bg-neutral-50 text-neutral-800 border-black/[0.1] shadow-2xs'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-[#67C3DE]" />
                  <span>Preview Sample Leaves</span>
                </button>

                {onOpenSparks && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenSparks();
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-white/[0.08]'
                        : 'bg-stone-50 hover:bg-white text-stone-700 border-stone-300 shadow-2xs'
                    }`}
                  >
                    <span>Prompt Sparks</span>
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
