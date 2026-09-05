import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Pause, 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Image as ImageIcon, 
  MapPin, 
  Heart, 
  CalendarDays,
  Milestone,
  History,
  Quote, 
  TrendingUp, 
  ArrowRight,
  Maximize2,
  Smile,
  ShieldCheck,
  Award,
  Layers,
  Camera,
  Sun
} from 'lucide-react';
import { JournalEntry, ReflectionMood } from '../types';
import { useTheme } from '../context/ThemeContext';

export type MemoryCategory = 'weekly' | 'monthly' | 'quarterly' | 'on_this_day';

interface MemoryCategoryConfig {
  id: MemoryCategory;
  title: string;
  subtitle: string;
  badge: string;
  gradientRing: string;
  bgGradient: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const MEMORY_CATEGORIES: MemoryCategoryConfig[] = [
  {
    id: 'weekly',
    title: 'Weekly Echo',
    subtitle: 'Past 1 Week Highlights',
    badge: 'Past 1 Week',
    gradientRing: 'from-emerald-400 via-teal-500 to-cyan-500',
    bgGradient: 'from-teal-500/20 via-emerald-500/10 to-transparent',
    icon: CalendarDays
  },
  {
    id: 'monthly',
    title: 'Monthly Recap',
    subtitle: 'Past 1 Month Overview',
    badge: 'Past 1 Month',
    gradientRing: 'from-indigo-400 via-purple-500 to-pink-500',
    bgGradient: 'from-indigo-500/20 via-purple-500/10 to-transparent',
    icon: BookOpen
  },
  {
    id: 'quarterly',
    title: 'Quarterly Season',
    subtitle: 'Past 1 Quarter Milestone',
    badge: 'Past 1 Quarter',
    gradientRing: 'from-amber-400 via-orange-500 to-rose-500',
    bgGradient: 'from-amber-500/20 via-rose-500/10 to-transparent',
    icon: Milestone
  },
  {
    id: 'on_this_day',
    title: 'On This Day',
    subtitle: '1 Year Ago Flashback',
    badge: '1 & 2 Years Ago',
    gradientRing: 'from-yellow-400 via-amber-500 to-teal-400',
    bgGradient: 'from-yellow-500/20 via-amber-500/10 to-transparent',
    icon: History
  }
];

interface MemoryStoriesViewerProps {
  isOpen: boolean;
  onClose: () => void;
  category: MemoryCategory;
  onSelectCategory: (cat: MemoryCategory) => void;
  entries: JournalEntry[];
  onOpenEntry: (entry: JournalEntry) => void;
}

// 4 distinct content story slides
const SLIDES = [
  { id: 'reflections', label: 'Key Reflections', icon: BookOpen },
  { id: 'photos', label: 'Photo Keepsakes', icon: ImageIcon },
  { id: 'locations', label: 'Places Visited', icon: MapPin },
  { id: 'quotient', label: 'Emotional Quotient', icon: Heart }
];

const SLIDE_DURATION_MS = 6500; // 6.5s per slide

export const MemoryStoriesViewer: React.FC<MemoryStoriesViewerProps> = ({
  isOpen,
  onClose,
  category,
  onSelectCategory,
  entries,
  onOpenEntry
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pausedProgressRef = useRef<number>(0);

  // Filter entries based on the category
  const filteredData = useMemo(() => {
    const now = new Date();
    const nowTime = now.getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const parseEntryDate = (e: JournalEntry): Date => {
      if (e.entryDate) {
        const [y, m, d] = e.entryDate.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      return new Date(e.createdAt || now);
    };

    let matchedEntries: JournalEntry[] = [];
    let periodLabel = '';
    let isHistoricFallback = false;

    if (category === 'weekly') {
      // Full past 1 week (past 7 days up to current date)
      const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0).getTime();
      matchedEntries = entries.filter(e => {
        const t = parseEntryDate(e).getTime();
        return t >= oneWeekAgo && t <= endOfToday;
      });
      periodLabel = 'Past 1 Week';
    } else if (category === 'monthly') {
      // Full past 1 month (past 30/31 days up to current date)
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0).getTime();
      matchedEntries = entries.filter(e => {
        const t = parseEntryDate(e).getTime();
        return t >= oneMonthAgo && t <= endOfToday;
      });
      periodLabel = 'Past 1 Month';
    } else if (category === 'quarterly') {
      // Full past 1 quarter (past 3 months up to current date)
      const oneQuarterAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0).getTime();
      matchedEntries = entries.filter(e => {
        const t = parseEntryDate(e).getTime();
        return t >= oneQuarterAgo && t <= endOfToday;
      });
      periodLabel = 'Past 1 Quarter';
    } else if (category === 'on_this_day') {
      const currentMonth = now.getMonth();
      const currentDay = now.getDate();
      const currentYear = now.getFullYear();

      // Look for entries on same day (±3 days window) in any previous year
      matchedEntries = entries.filter(e => {
        const d = parseEntryDate(e);
        const diffYears = currentYear - d.getFullYear();
        if (diffYears >= 1) {
          const m = d.getMonth();
          const day = d.getDate();
          return m === currentMonth && Math.abs(day - currentDay) <= 3;
        }
        return false;
      });

      if (matchedEntries.length === 0) {
        // Also check if there are any entries older than 6 months or earliest entries
        const sixMonthsAgo = nowTime - 180 * 24 * 60 * 60 * 1000;
        const olderEntries = entries.filter(e => parseEntryDate(e).getTime() < sixMonthsAgo);
        if (olderEntries.length > 0) {
          matchedEntries = olderEntries;
          periodLabel = 'Historical Flashbacks';
        } else {
          // If all entries are recent, use earliest chronological entries as baseline
          matchedEntries = [...entries].sort((a, b) => parseEntryDate(a).getTime() - parseEntryDate(b).getTime()).slice(0, 5);
          periodLabel = 'Earliest Foundations & Baseline';
          isHistoricFallback = true;
        }
      } else {
        periodLabel = 'Same Day in Previous Years';
      }
    }

    // Fallback if category has 0 entries (so user always gets a rich interactive experience)
    if (matchedEntries.length === 0 && entries.length > 0) {
      matchedEntries = entries.slice(0, 6);
      isHistoricFallback = true;
    }

    // Extract Photos
    const photos: { photoUrl: string; caption?: string; date: string; entryTitle: string; entry: JournalEntry }[] = [];
    matchedEntries.forEach(e => {
      const dStr = e.entryDate || e.createdAt?.slice(0, 10) || 'Recent';
      if (e.photos && e.photos.length > 0) {
        e.photos.forEach(p => {
          photos.push({
            photoUrl: p.url,
            caption: p.caption || p.name || e.title,
            date: dStr,
            entryTitle: e.title,
            entry: e
          });
        });
      }
    });

    // Extract Locations
    const locations: { name: string; address?: string; date: string; entryTitle: string; entry: JournalEntry }[] = [];
    matchedEntries.forEach(e => {
      const dStr = e.entryDate || e.createdAt?.slice(0, 10) || 'Recent';
      if (e.location && e.location.name) {
        locations.push({
          name: e.location.name,
          address: e.location.address,
          date: dStr,
          entryTitle: e.title,
          entry: e
        });
      }
    });

    // Compute Emotional Quotient (EQ)
    const moodCounts: Record<string, number> = {};
    let totalWords = 0;

    matchedEntries.forEach(e => {
      const m = e.mood || 'thoughtful';
      moodCounts[m] = (moodCounts[m] || 0) + 1;
      totalWords += e.wordCount || e.content.split(/\s+/).filter(Boolean).length;
    });

    const totalCount = Math.max(matchedEntries.length, 1);
    const sortedMoods = Object.entries(moodCounts)
      .map(([mood, count]) => ({
        mood: mood as ReflectionMood,
        count,
        pct: Math.round((count / totalCount) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    const dominantMood = sortedMoods[0]?.mood || 'thoughtful';

    // Calculate EQ balance index (0-100)
    const peacefulCount = (moodCounts['peaceful'] || 0) + (moodCounts['calm'] || 0) + (moodCounts['grateful'] || 0);
    const reflectiveCount = (moodCounts['thoughtful'] || 0) + (moodCounts['curious'] || 0) + (moodCounts['energized'] || 0);
    const eqScore = Math.min(98, Math.max(68, Math.round(75 + (peacefulCount / totalCount) * 15 + Math.min(totalWords / 200, 8))));

    // Curate top poignant reflections & quotes
    const highlightedReflections = matchedEntries
      .slice(0, 4)
      .map(entry => {
        // Extract a key quote or punchy sentence
        const sentences = entry.content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
        const quoteSnippet = sentences[0] || entry.content.slice(0, 130) + '...';
        return {
          entry,
          quote: quoteSnippet,
          date: entry.entryDate || entry.createdAt?.slice(0, 10) || ''
        };
      });

    return {
      entries: matchedEntries,
      periodLabel,
      isHistoricFallback,
      photos,
      locations,
      sortedMoods,
      dominantMood,
      eqScore,
      totalWords,
      highlightedReflections
    };
  }, [entries, category]);

  // Handle slide timer auto-advance
  useEffect(() => {
    if (!isOpen) return;

    if (isPaused) {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now() - pausedProgressRef.current * SLIDE_DURATION_MS;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const curProgress = Math.min(1, elapsed / SLIDE_DURATION_MS);
      setProgress(curProgress);

      if (curProgress >= 1) {
        // Advance to next slide or loop
        pausedProgressRef.current = 0;
        setProgress(0);
        setActiveSlideIndex(prev => {
          if (prev < SLIDES.length - 1) {
            return prev + 1;
          } else {
            // Loop or keep at end
            return 0;
          }
        });
        startTimeRef.current = Date.now();
      }

      timerRef.current = requestAnimationFrame(tick);
    };

    timerRef.current = requestAnimationFrame(tick);

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isOpen, isPaused, activeSlideIndex, category]);

  // Reset progress on slide change or category change
  const handleJumpToSlide = (idx: number) => {
    pausedProgressRef.current = 0;
    setProgress(0);
    setActiveSlideIndex(idx);
    startTimeRef.current = Date.now();
  };

  const handleNextSlide = () => {
    if (activeSlideIndex < SLIDES.length - 1) {
      handleJumpToSlide(activeSlideIndex + 1);
    } else {
      // Advance to next category if available
      const currentCatIdx = MEMORY_CATEGORIES.findIndex(c => c.id === category);
      const nextCat = MEMORY_CATEGORIES[(currentCatIdx + 1) % MEMORY_CATEGORIES.length];
      onSelectCategory(nextCat.id);
      handleJumpToSlide(0);
    }
  };

  const handlePrevSlide = () => {
    if (activeSlideIndex > 0) {
      handleJumpToSlide(activeSlideIndex - 1);
    } else {
      // Go to previous category
      const currentCatIdx = MEMORY_CATEGORIES.findIndex(c => c.id === category);
      const prevCat = MEMORY_CATEGORIES[(currentCatIdx - 1 + MEMORY_CATEGORIES.length) % MEMORY_CATEGORIES.length];
      onSelectCategory(prevCat.id);
      handleJumpToSlide(SLIDES.length - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNextSlide();
      if (e.key === 'ArrowLeft') handlePrevSlide();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeSlideIndex, category, isPaused]);

  const currentCategoryConfig = MEMORY_CATEGORIES.find(c => c.id === category) || MEMORY_CATEGORIES[0];
  const CategoryIcon = currentCategoryConfig.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-lg overflow-hidden select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          
          {/* STORY DESK CONTAINER */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 24 }}
            transition={{ 
              duration: 0.55, 
              ease: [0.16, 1, 0.3, 1] 
            }}
            className={`relative w-full max-w-3xl h-[88vh] max-h-[780px] rounded-3xl overflow-hidden border flex flex-col shadow-2xl ${
              isDark
                ? 'bg-[#141417] text-neutral-100 border-white/[0.12] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)]'
                : 'bg-[#faf8f5] text-neutral-900 border-stone-300 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)]'
            }`}
          >
          
          {/* Top Subtle Ambient Atmospheric Glow */}
          <div className={`absolute top-0 inset-x-0 h-48 pointer-events-none bg-gradient-to-b ${currentCategoryConfig.bgGradient} opacity-60`} />

          {/* TOP STORY HEADER & PROGRESS BARS */}
          <div className="relative z-30 pt-3.5 px-4 sm:px-6 pb-2.5 flex flex-col gap-2.5 shrink-0 bg-gradient-to-b from-black/40 to-transparent">
            
            {/* Segmented Story Progress Bars */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {SLIDES.map((slide, idx) => {
                let barFill = 0;
                if (idx < activeSlideIndex) barFill = 1;
                else if (idx === activeSlideIndex) barFill = progress;

                return (
                  <button
                    key={slide.id}
                    onClick={() => handleJumpToSlide(idx)}
                    className="group relative h-1.5 rounded-full overflow-hidden bg-white/20 hover:bg-white/35 transition-colors cursor-pointer"
                    title={`Jump to ${slide.label}`}
                  >
                    <div 
                      className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-75"
                      style={{ width: `${barFill * 100}%` }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Story Navigation Strip: Category Pill, Slide Tag & Control Buttons */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              
              {/* Category Switcher Tabs (Clickable to switch memory timeframes on the fly!) */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {MEMORY_CATEGORIES.map((cat) => {
                  const isCur = cat.id === category;
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onSelectCategory(cat.id);
                        handleJumpToSlide(0);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                        isCur
                          ? 'bg-white text-neutral-950 font-semibold shadow-xs scale-105'
                          : 'bg-black/30 hover:bg-black/50 text-white/80 hover:text-white border border-white/10'
                      }`}
                    >
                      <CatIcon className="w-3 h-3 shrink-0" />
                      <span>{cat.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Player Controls (Pause/Play & Close) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsPaused(prev => !prev)}
                  className="p-1.5 rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title={isPaused ? "Resume Memory Play" : "Pause Memory Play"}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title="Close Memories (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

          </div>

          {/* MAIN STORY CONTENT CAROUSEL (Interactive Slide Stage) */}
          <div className="relative z-20 flex-1 min-h-0 flex flex-col overflow-hidden px-4 sm:px-7 pb-4">
            
            {/* Sub-header Indicator */}
            <div className="flex items-center justify-between py-1.5 mb-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider ${
                  isDark ? 'bg-white/10 text-neutral-200' : 'bg-black/5 text-neutral-700'
                }`}>
                  Slide {activeSlideIndex + 1} of {SLIDES.length}: {SLIDES[activeSlideIndex].label}
                </span>
                <span className="text-[11px] opacity-60 font-mono">
                  • {filteredData.periodLabel}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono opacity-70">
                  {filteredData.entries.length} reflections • {filteredData.totalWords} words
                </span>
              </div>
            </div>

            {/* Slide Content with Timed Transition Animations */}
            <div className="relative flex-1 min-h-0 flex flex-col overflow-y-auto pr-1">
              <AnimatePresence mode="wait">
                
                {/* SLIDE 0: IMPORTANT REFLECTIONS & KEY EXCERPTS */}
                {activeSlideIndex === 0 && (
                  <motion.div
                    key={`slide-reflections-${category}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 flex flex-col justify-between space-y-4 py-2"
                  >
                    <div>
                      {/* Hero Narrative Highlight */}
                      <div className={`p-4 sm:p-5 rounded-2xl border relative overflow-hidden mb-4 ${
                        isDark 
                          ? 'bg-neutral-900/80 border-white/[0.1] shadow-inner' 
                          : 'bg-white border-stone-200 shadow-xs'
                      }`}>
                        <Quote className="absolute top-2 right-3 w-10 h-10 opacity-10 pointer-events-none" />
                        <span className={`text-[10px] font-mono font-semibold uppercase tracking-widest block mb-1.5 ${
                          isDark ? 'text-teal-400' : 'text-teal-700'
                        }`}>
                          Resonant Memory Excerpt
                        </span>
                        
                        {filteredData.highlightedReflections.length > 0 ? (
                          <>
                            <p className="font-serif text-base sm:text-lg italic leading-relaxed mb-3">
                              "{filteredData.highlightedReflections[0].quote}"
                            </p>
                            <div className="flex items-center justify-between text-xs opacity-75 pt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                              <span className="font-medium">
                                From: {filteredData.highlightedReflections[0].entry.title}
                              </span>
                              <span className="font-mono text-[11px]">
                                {filteredData.highlightedReflections[0].date}
                              </span>
                            </div>
                          </>
                        ) : (
                          <p className="font-serif text-sm italic">
                            Your thoughts and experiences during this period continue to shape your journey.
                          </p>
                        )}
                      </div>

                      {/* Stack of Key Reflection Cards */}
                      <div className="space-y-2.5">
                        <span className="text-[11px] font-mono uppercase tracking-wider font-semibold opacity-70 block">
                          Curated Reflections from this Period
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {filteredData.entries.slice(0, 4).map((entry) => (
                            <motion.div
                              key={entry.id}
                              whileHover={{ y: -2 }}
                              onClick={() => {
                                onClose();
                                onOpenEntry(entry);
                              }}
                              className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                isDark
                                  ? 'bg-neutral-900/60 hover:bg-neutral-900 border-white/[0.08] hover:border-teal-500/40'
                                  : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-teal-600/40 shadow-2xs'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                                    isDark ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' : 'bg-teal-50 text-teal-800 border-teal-200'
                                  }`}>
                                    {entry.mood || 'thoughtful'}
                                  </span>
                                  <span className="text-[10px] font-mono opacity-60">
                                    {entry.entryDate || entry.createdAt?.slice(0, 10)}
                                  </span>
                                </div>
                                <h4 className="font-serif text-sm font-semibold truncate mb-1">
                                  {entry.title}
                                </h4>
                                <p className="text-xs opacity-75 line-clamp-2 leading-relaxed">
                                  {entry.content}
                                </p>
                              </div>

                              <div className="flex items-center justify-end gap-1 mt-2 text-[11px] font-medium text-teal-600 dark:text-teal-400">
                                <span>Read Reflection</span>
                                <ArrowRight className="w-3 h-3" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* SLIDE 1: PHOTO KEEPSAKES & VISUAL MOMENTS */}
                {activeSlideIndex === 1 && (
                  <motion.div
                    key={`slide-photos-${category}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 flex flex-col justify-between space-y-4 py-2"
                  >
                    {filteredData.photos.length > 0 ? (
                      <div className="space-y-3 flex-1 flex flex-col min-h-0">
                        {/* Featured Hero Photo */}
                        <div className="relative flex-1 min-h-[220px] max-h-[340px] rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-lg group">
                          <img
                            src={filteredData.photos[activePhotoIndex]?.photoUrl || filteredData.photos[0].photoUrl}
                            alt={filteredData.photos[activePhotoIndex]?.caption || "Memory Snapshot"}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                          />
                          
                          {/* Photo Caption Overlay */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 text-white flex items-end justify-between gap-2">
                            <div>
                              <p className="font-serif text-sm sm:text-base font-medium drop-shadow-md">
                                {filteredData.photos[activePhotoIndex]?.caption}
                              </p>
                              <span className="text-[10px] font-mono opacity-80">
                                {filteredData.photos[activePhotoIndex]?.date} • Attached to "{filteredData.photos[activePhotoIndex]?.entryTitle}"
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                onClose();
                                onOpenEntry(filteredData.photos[activePhotoIndex].entry);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/35 backdrop-blur-sm text-xs text-white font-medium transition-colors cursor-pointer"
                            >
                              View Entry
                            </button>
                          </div>
                        </div>

                        {/* Thumbnail Strip */}
                        {filteredData.photos.length > 1 && (
                          <div className="flex items-center gap-2 overflow-x-auto py-1">
                            {filteredData.photos.map((p, pIdx) => (
                              <button
                                key={pIdx}
                                onClick={() => setActivePhotoIndex(pIdx)}
                                className={`relative w-16 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                                  activePhotoIndex === pIdx 
                                    ? 'border-white scale-105 shadow-md' 
                                    : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={p.photoUrl}
                                  alt={p.caption || ''}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Atmospheric Visual Vignettes & Thought Keepsakes */
                      <div className="flex-1 flex flex-col justify-center space-y-4 py-4">
                        <div className={`p-6 rounded-2xl border text-center relative overflow-hidden ${
                          isDark 
                            ? 'bg-gradient-to-br from-neutral-900 via-neutral-900 to-teal-950/30 border-white/[0.08]' 
                            : 'bg-gradient-to-br from-white via-stone-50 to-teal-50/50 border-stone-200 shadow-xs'
                        }`}>
                          <Camera className="w-10 h-10 mx-auto mb-2.5 opacity-40 text-teal-500" />
                          <h4 className="font-serif text-lg font-medium mb-1">
                            Atmospheric Mindspace Moments
                          </h4>
                          <p className="text-xs max-w-md mx-auto opacity-75 mb-4 leading-relaxed">
                            No external photos were attached during this period, but your reflections painted rich mental imagery of quiet presence and intentional pauses.
                          </p>

                          <div className="grid grid-cols-3 gap-2.5 max-w-lg mx-auto">
                            <div className={`p-3 rounded-xl border text-center ${
                              isDark ? 'bg-black/40 border-white/5' : 'bg-white border-stone-200'
                            }`}>
                              <Sun className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                              <span className="text-[11px] font-serif block font-medium">Quiet Sun</span>
                              <span className="text-[9px] opacity-60 font-mono">Morning Light</span>
                            </div>

                            <div className={`p-3 rounded-xl border text-center ${
                              isDark ? 'bg-black/40 border-white/5' : 'bg-white border-stone-200'
                            }`}>
                              <BookOpen className="w-4 h-4 mx-auto mb-1 text-teal-400" />
                              <span className="text-[11px] font-serif block font-medium">Ink & Page</span>
                              <span className="text-[9px] opacity-60 font-mono">Contemplation</span>
                            </div>

                            <div className={`p-3 rounded-xl border text-center ${
                              isDark ? 'bg-black/40 border-white/5' : 'bg-white border-stone-200'
                            }`}>
                              <Heart className="w-4 h-4 mx-auto mb-1 text-rose-400" />
                              <span className="text-[11px] font-serif block font-medium">Gratitude</span>
                              <span className="text-[9px] opacity-60 font-mono">Evening Calm</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* SLIDE 2: PLACES & SANCTUARIES VISITED */}
                {activeSlideIndex === 2 && (
                  <motion.div
                    key={`slide-locations-${category}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 flex flex-col justify-between space-y-4 py-2"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono uppercase tracking-wider font-semibold opacity-70">
                          Geographical Footprints & Sanctuaries
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isDark ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' : 'bg-teal-50 text-teal-800 border-teal-200'
                        }`}>
                          {filteredData.locations.length > 0 ? `${filteredData.locations.length} Places Tagged` : 'Mindspace Exploration'}
                        </span>
                      </div>

                      {filteredData.locations.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {filteredData.locations.map((loc, lIdx) => (
                            <motion.div
                              key={lIdx}
                              whileHover={{ y: -2 }}
                              onClick={() => {
                                onClose();
                                onOpenEntry(loc.entry);
                              }}
                              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                isDark
                                  ? 'bg-neutral-900/70 hover:bg-neutral-900 border-white/[0.08]'
                                  : 'bg-white hover:bg-stone-50 border-stone-200 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                  isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-700 border border-teal-200'
                                }`}>
                                  <MapPin className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-serif text-sm font-semibold truncate">
                                    {loc.name}
                                  </h4>
                                  {loc.address && (
                                    <p className="text-[11px] opacity-70 truncate mb-1">
                                      {loc.address}
                                    </p>
                                  )}
                                  <span className="text-[10px] font-mono opacity-60">
                                    {loc.date} • {loc.entryTitle}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className={`p-5 sm:p-6 rounded-2xl border text-center space-y-3 ${
                          isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
                        }`}>
                          <MapPin className="w-8 h-8 mx-auto text-teal-500 opacity-60" />
                          <h4 className="font-serif text-base font-medium">
                            Personal Sanctuaries & Quiet Spaces
                          </h4>
                          <p className="text-xs opacity-75 max-w-md mx-auto leading-relaxed">
                            During this timeframe, reflections took place across your personal home sanctuaries, writing nooks, and daily contemplative walks.
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                              isDark ? 'bg-black/40 border-white/10 text-neutral-300' : 'bg-stone-100 border-stone-200 text-stone-700'
                            }`}>
                              🏡 Home Sanctuary
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                              isDark ? 'bg-black/40 border-white/10 text-neutral-300' : 'bg-stone-100 border-stone-200 text-stone-700'
                            }`}>
                              ☕ Contemplative Writing Desk
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                              isDark ? 'bg-black/40 border-white/10 text-neutral-300' : 'bg-stone-100 border-stone-200 text-stone-700'
                            }`}>
                              🌿 Nature Walks & Open Air
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* SLIDE 3: EMOTIONAL QUOTIENT (EQ) & MOOD TAPESTRY */}
                {activeSlideIndex === 3 && (
                  <motion.div
                    key={`slide-quotient-${category}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="flex-1 flex flex-col justify-between space-y-4 py-2"
                  >
                    <div>
                      {/* EQ Index Banner */}
                      <div className={`p-4 sm:p-5 rounded-2xl border mb-3 flex items-center justify-between gap-4 ${
                        isDark 
                          ? 'bg-gradient-to-r from-neutral-900 via-neutral-900 to-teal-950/40 border-white/[0.1]' 
                          : 'bg-gradient-to-r from-white via-teal-50/30 to-emerald-50/50 border-teal-200/80 shadow-xs'
                      }`}>
                        <div>
                          <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider block mb-1 ${
                            isDark ? 'text-teal-400' : 'text-teal-800'
                          }`}>
                            Emotional Balance Index
                          </span>
                          <h3 className="font-serif text-xl sm:text-2xl font-medium tracking-tight">
                            {filteredData.eqScore}% EQ Resonance
                          </h3>
                          <p className="text-xs opacity-75 mt-0.5">
                            Synthesized across {filteredData.entries.length} reflections & mindful moments
                          </p>
                        </div>

                        <div className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center shrink-0 shadow-xs ${
                          isDark ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' : 'bg-teal-100 text-teal-900 border-teal-300'
                        }`}>
                          <Smile className="w-6 h-6 mb-0.5" />
                          <span className="text-[9px] font-mono uppercase font-bold">Centered</span>
                        </div>
                      </div>

                      {/* Dominant Mood Spectrum */}
                      <div className="space-y-2.5">
                        <span className="text-[11px] font-mono uppercase tracking-wider font-semibold opacity-70 block">
                          Emotional State Distribution
                        </span>

                        <div className="space-y-2">
                          {filteredData.sortedMoods.map((m, mIdx) => (
                            <div key={mIdx} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="capitalize font-medium flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                                  {m.mood}
                                </span>
                                <span className="font-mono text-[11px] opacity-75">
                                  {m.count} {m.count === 1 ? 'entry' : 'entries'} ({m.pct}%)
                                </span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden bg-black/10 dark:bg-white/10">
                                <div
                                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                                  style={{ width: `${m.pct}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Trajectory Narrative */}
                      <div className={`mt-4 p-3.5 rounded-xl border text-xs leading-relaxed italic ${
                        isDark ? 'bg-black/30 border-white/5 opacity-85' : 'bg-stone-100/80 border-stone-200 text-stone-800'
                      }`}>
                        "A reflective season marked by intentional pauses, steady self-compassion, and consistent mindful writing."
                      </div>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* BOTTOM NAV ARROWS & SLIDE CONTROLS */}
            <div className="relative z-30 pt-3 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <button
                onClick={handlePrevSlide}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-white/10'
                    : 'bg-white hover:bg-stone-100 text-neutral-800 border-stone-300 shadow-2xs'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-1.5">
                {SLIDES.map((s, sIdx) => {
                  const SIcon = s.icon;
                  const isCur = sIdx === activeSlideIndex;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleJumpToSlide(sIdx)}
                      className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        isCur
                          ? isDark ? 'bg-white text-black font-semibold' : 'bg-black text-white font-semibold'
                          : isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-600 hover:text-black'
                      }`}
                      title={s.label}
                    >
                      <SIcon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleNextSlide}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-xs transition-all cursor-pointer`}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </motion.div>

      </motion.div>
      )}
    </AnimatePresence>
  );
};
