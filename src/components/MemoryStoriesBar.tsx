import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Image as ImageIcon,
  Heart,
  ChevronRight
} from 'lucide-react';
import { JournalEntry } from '../types';
import { useTheme } from '../context/ThemeContext';
import { MemoryCategory, MEMORY_CATEGORIES } from './MemoryStoriesViewer';

interface MemoryStoriesBarProps {
  entries: JournalEntry[];
  onOpenStory: (category: MemoryCategory) => void;
}

export const MemoryStoriesBar: React.FC<MemoryStoriesBarProps> = ({
  entries,
  onOpenStory
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Compute snapshot data for each circular badge (entry count, preview photo if any, dominant mood)
  const storiesSummary = useMemo(() => {
    const now = new Date();
    const nowTime = now.getTime();

    const parseEntryDate = (e: JournalEntry): Date => {
      if (e.entryDate) {
        const [y, m, d] = e.entryDate.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      return new Date(e.createdAt || now);
    };

    const getCategoryInfo = (cat: MemoryCategory) => {
      let filtered: JournalEntry[] = [];
      let timeLabel = '';
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

      if (cat === 'weekly') {
        // Full past 1 week (past 7 days up to current date)
        const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0).getTime();
        filtered = entries.filter(e => {
          const t = parseEntryDate(e).getTime();
          return t >= oneWeekAgo && t <= endOfToday;
        });
        timeLabel = 'Past 1 Week';
      } else if (cat === 'monthly') {
        // Full past 1 month (past 30/31 days up to current date)
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0, 0).getTime();
        filtered = entries.filter(e => {
          const t = parseEntryDate(e).getTime();
          return t >= oneMonthAgo && t <= endOfToday;
        });
        timeLabel = 'Past 1 Month';
      } else if (cat === 'quarterly') {
        // Full past 1 quarter (past 3 months up to current date)
        const oneQuarterAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0).getTime();
        filtered = entries.filter(e => {
          const t = parseEntryDate(e).getTime();
          return t >= oneQuarterAgo && t <= endOfToday;
        });
        timeLabel = 'Past 1 Quarter';
      } else if (cat === 'on_this_day') {
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        const currentYear = now.getFullYear();

        filtered = entries.filter(e => {
          const d = parseEntryDate(e);
          const diffYears = currentYear - d.getFullYear();
          if (diffYears >= 1) {
            const m = d.getMonth();
            const day = d.getDate();
            return m === currentMonth && Math.abs(day - currentDay) <= 3;
          }
          return false;
        });

        timeLabel = '1 Year Ago';
      }

      // Check if there is any photo in these entries
      let previewPhotoUrl: string | null = null;
      for (const e of filtered) {
        if (e.photos && e.photos.length > 0 && e.photos[0].url) {
          previewPhotoUrl = e.photos[0].url;
          break;
        }
      }

      // If no photo in filtered, pick from general entries for visual charm if needed
      return {
        count: filtered.length,
        timeLabel,
        previewPhotoUrl
      };
    };

    return {
      weekly: getCategoryInfo('weekly'),
      monthly: getCategoryInfo('monthly'),
      quarterly: getCategoryInfo('quarterly'),
      on_this_day: getCategoryInfo('on_this_day')
    };
  }, [entries]);

  return (
    <div className="relative z-10 w-full mb-2.5 pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
      
      {/* Section Header */}
      <div className="flex items-center justify-center gap-2 mb-2.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <span className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
            isDark ? 'text-teal-400' : 'text-teal-700'
          }`}>
            Memories & Glimpses
          </span>
          <span className="text-[10px] font-mono opacity-60 hidden sm:inline">
            • Tap circle to explore
          </span>
        </div>
      </div>

      {/* Circular Memory Story Badges Centered Reel */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 md:gap-8 py-1 px-1 w-full flex-wrap sm:flex-nowrap">
        {MEMORY_CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          const summary = storiesSummary[cat.id];
          const hasPhoto = Boolean(summary?.previewPhotoUrl);

          return (
            <motion.button
              key={cat.id}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onOpenStory(cat.id)}
              className="group flex flex-col items-center gap-1.5 shrink-0 text-center cursor-pointer outline-none"
              title={`View ${cat.title} (${cat.subtitle})`}
            >
              
              {/* Outer Gradient Story Ring Container */}
              <div className={`relative p-[2.5px] rounded-full bg-gradient-to-tr ${cat.gradientRing} transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(20,184,166,0.4)]`}>
                
                {/* Inner Ring Gap */}
                <div className={`p-0.5 rounded-full ${isDark ? 'bg-[#18181b]' : 'bg-[#fdfbf7]'}`}>
                  
                  {/* Circular Avatar / Thumbnail Canvas */}
                  <div className={`w-13 h-13 sm:w-15 sm:h-15 rounded-full overflow-hidden flex items-center justify-center relative shadow-inner ${
                    isDark ? 'bg-neutral-900' : 'bg-stone-200'
                  }`}>
                    {hasPhoto ? (
                      <img
                        src={summary.previewPhotoUrl!}
                        alt={cat.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${
                        cat.id === 'weekly' ? 'from-emerald-600/30 to-teal-800/40 text-emerald-400' :
                        cat.id === 'monthly' ? 'from-purple-600/30 to-indigo-800/40 text-purple-400' :
                        cat.id === 'quarterly' ? 'from-amber-600/30 to-rose-800/40 text-amber-400' :
                        'from-yellow-600/30 to-amber-800/40 text-yellow-400'
                      }`}>
                        <CatIcon className="w-6 h-6 drop-shadow-sm group-hover:scale-110 transition-transform duration-300" />
                      </div>
                    )}

                    {/* Sparkle badge on top corner */}
                    <div className="absolute bottom-0.5 right-0.5 p-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white">
                      <CatIcon className="w-2.5 h-2.5" />
                    </div>
                  </div>

                </div>

              </div>

              {/* Story Labels */}
              <div className="flex flex-col items-center max-w-[84px] sm:max-w-[96px]">
                <span className={`text-[11px] sm:text-xs font-serif font-semibold tracking-tight truncate w-full ${
                  isDark ? 'text-neutral-200 group-hover:text-white' : 'text-neutral-800 group-hover:text-neutral-950'
                }`}>
                  {cat.title}
                </span>
                <span className={`text-[9px] font-mono tracking-tight ${
                  isDark ? 'text-teal-400/90' : 'text-teal-700'
                }`}>
                  {summary?.timeLabel || cat.badge}
                </span>
              </div>

            </motion.button>
          );
        })}
      </div>

    </div>
  );
};
