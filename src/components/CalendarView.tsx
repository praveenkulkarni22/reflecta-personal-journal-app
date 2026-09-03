import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  BookOpen, 
  Clock, 
  Tag, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Cake, 
  Heart, 
  GraduationCap, 
  Trophy, 
  UtensilsCrossed, 
  Stethoscope, 
  Plane, 
  Bell, 
  Sparkles,
  AlertCircle,
  X,
  Feather,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';
import { JournalEntry, CalendarEvent, CalendarEventCategory } from '../types';
import { useTheme } from '../context/ThemeContext';

interface CalendarViewProps {
  entries: JournalEntry[];
  events: CalendarEvent[];
  onAddEntryForDate: (dateStr: string) => void;
  onOpenEntry: (entry: JournalEntry) => void;
  onSaveEvent: (event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onToggleEventComplete: (eventId: string, isCompleted: boolean) => Promise<void>;
}

// Preset Quick-Access Templates
interface EventPreset {
  category: CalendarEventCategory;
  label: string;
  sublabel: string;
  icon: any;
  defaultTitle: string;
  defaultPriority: 'normal' | 'important' | 'celebration';
  color: string;
  bgLight: string;
  bgDark: string;
}

const EVENT_PRESETS: EventPreset[] = [
  {
    category: 'birthday',
    label: "Birthday",
    sublabel: "Celebrate someone special",
    icon: Cake,
    defaultTitle: "Someone's Birthday",
    defaultPriority: 'celebration',
    color: 'text-rose-500',
    bgLight: 'bg-rose-50 border-rose-200 text-rose-800',
    bgDark: 'bg-rose-500/15 border-rose-500/30 text-rose-300'
  },
  {
    category: 'anniversary',
    label: "Anniversary",
    sublabel: "Milestone or commemoration",
    icon: Heart,
    defaultTitle: "Anniversary Celebration",
    defaultPriority: 'celebration',
    color: 'text-amber-500',
    bgLight: 'bg-amber-50 border-amber-200 text-amber-800',
    bgDark: 'bg-amber-500/15 border-amber-500/30 text-amber-300'
  },
  {
    category: 'graduation',
    label: "Graduation Day",
    sublabel: "Academic milestone & honors",
    icon: GraduationCap,
    defaultTitle: "Graduation Ceremony",
    defaultPriority: 'important',
    color: 'text-purple-500',
    bgLight: 'bg-purple-50 border-purple-200 text-purple-800',
    bgDark: 'bg-purple-500/15 border-purple-500/30 text-purple-300'
  },
  {
    category: 'sports',
    label: "Sports Meet",
    sublabel: "Tournament, match or run",
    icon: Trophy,
    defaultTitle: "Sports Meet & Practice",
    defaultPriority: 'normal',
    color: 'text-orange-500',
    bgLight: 'bg-orange-50 border-orange-200 text-orange-800',
    bgDark: 'bg-orange-500/15 border-orange-500/30 text-orange-300'
  },
  {
    category: 'dining',
    label: "Lunch / Dinner",
    sublabel: "Meal planning & gatherings",
    icon: UtensilsCrossed,
    defaultTitle: "Dinner Gathering",
    defaultPriority: 'normal',
    color: 'text-emerald-500',
    bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    bgDark: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
  },
  {
    category: 'wellness',
    label: "Health & Doctor",
    sublabel: "Wellness & medical visit",
    icon: Stethoscope,
    defaultTitle: "Health Checkup",
    defaultPriority: 'important',
    color: 'text-teal-500',
    bgLight: 'bg-teal-50 border-teal-200 text-teal-800',
    bgDark: 'bg-teal-500/15 border-teal-500/30 text-teal-300'
  },
  {
    category: 'travel',
    label: "Travel / Trip",
    sublabel: "Journey & getaways",
    icon: Plane,
    defaultTitle: "Travel Departure",
    defaultPriority: 'normal',
    color: 'text-sky-500',
    bgLight: 'bg-sky-50 border-sky-200 text-sky-800',
    bgDark: 'bg-sky-500/15 border-sky-500/30 text-sky-300'
  },
  {
    category: 'reminder',
    label: "Custom Reminder",
    sublabel: "Contemplative to-do & note",
    icon: Bell,
    defaultTitle: "Important Reminder",
    defaultPriority: 'important',
    color: 'text-amber-500',
    bgLight: 'bg-amber-50 border-amber-200 text-amber-800',
    bgDark: 'bg-amber-500/15 border-amber-500/30 text-amber-300'
  }
];

function getCategoryIcon(cat: CalendarEventCategory) {
  const preset = EVENT_PRESETS.find(p => p.category === cat);
  return preset ? preset.icon : Bell;
}

function getCategoryStyles(cat: CalendarEventCategory, isDark: boolean) {
  const preset = EVENT_PRESETS.find(p => p.category === cat);
  if (!preset) {
    return isDark 
      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' 
      : 'bg-amber-50 border-amber-200 text-amber-800';
  }
  return isDark ? preset.bgDark : preset.bgLight;
}

function formatDateToKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  entries,
  events,
  onAddEntryForDate,
  onOpenEntry,
  onSaveEvent,
  onDeleteEvent,
  onToggleEventComplete
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Navigation state
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateToKey(today), [today]);

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // Modal / Form state for creating event
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CalendarEventCategory>('birthday');
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventPriority, setEventPriority] = useState<'normal' | 'important' | 'celebration'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter state for upcoming events
  const [eventFilter, setEventFilter] = useState<'all' | CalendarEventCategory>('all');

  // Map entries by date key (YYYY-MM-DD)
  const entriesByDate = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const entry of entries) {
      // Use entryDate if defined, or parse createdAt
      const dateKey = entry.entryDate || (entry.createdAt ? entry.createdAt.slice(0, 10) : '');
      if (dateKey) {
        const list = map.get(dateKey) || [];
        list.push(entry);
        map.set(dateKey, list);
      }
    }
    return map;
  }, [entries]);

  // Map events by date key (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (ev.date) {
        const list = map.get(ev.date) || [];
        list.push(ev);
        map.set(ev.date, list);
      }
    }
    return map;
  }, [events]);

  // Generate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      journalEntries: JournalEntry[];
      dayEvents: CalendarEvent[];
    }> = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dObj = new Date(prevYear, prevMonth, d);
      const key = formatDateToKey(dObj);
      days.push({
        dateStr: key,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: key === todayStr,
        journalEntries: entriesByDate.get(key) || [],
        dayEvents: eventsByDate.get(key) || []
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dObj = new Date(currentYear, currentMonth, d);
      const key = formatDateToKey(dObj);
      days.push({
        dateStr: key,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: key === todayStr,
        journalEntries: entriesByDate.get(key) || [],
        dayEvents: eventsByDate.get(key) || []
      });
    }

    // Next month filler days to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dObj = new Date(nextYear, nextMonth, d);
      const key = formatDateToKey(dObj);
      days.push({
        dateStr: key,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: key === todayStr,
        journalEntries: entriesByDate.get(key) || [],
        dayEvents: eventsByDate.get(key) || []
      });
    }

    return days;
  }, [currentYear, currentMonth, todayStr, entriesByDate, eventsByDate]);

  // Selected date's content
  const selectedEntries = useMemo(() => {
    return entriesByDate.get(selectedDateStr) || [];
  }, [entriesByDate, selectedDateStr]);

  const selectedEvents = useMemo(() => {
    return eventsByDate.get(selectedDateStr) || [];
  }, [eventsByDate, selectedDateStr]);

  // Formatted selected date label
  const formattedSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return selectedDateStr;
    }
  }, [selectedDateStr]);

  // Handlers for month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(todayStr);
  };

  // Open creation modal with a specific preset
  const handleOpenPreset = (preset: EventPreset) => {
    setSelectedCategory(preset.category);
    setEventTitle(preset.defaultTitle);
    setEventPriority(preset.defaultPriority);
    setEventTime('');
    setEventNotes('');
    setIsEventModalOpen(true);
  };

  // Submit new event
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await onSaveEvent({
        title: eventTitle.trim(),
        date: selectedDateStr,
        time: eventTime.trim() || undefined,
        category: selectedCategory,
        notes: eventNotes.trim() || undefined,
        priority: eventPriority,
        isCompleted: false
      });
      setIsEventModalOpen(false);
      setEventTitle('');
      setEventNotes('');
      setEventTime('');
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner: Sanctuary Calendar Title & Month Navigation */}
      <div className={`p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
        isDark
          ? 'bg-neutral-900/70 border-white/[0.08] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]'
          : 'bg-white/80 border-black/[0.06] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 text-[10px] font-mono tracking-wider uppercase rounded-full border ${
                isDark
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                Time Sanctuary
              </span>
              <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {entries.length} reflections recorded • {events.length} milestones planned
              </span>
            </div>
            <h1 className={`font-serif text-2xl sm:text-3xl font-medium tracking-tight mt-1 ${
              isDark ? 'text-neutral-50' : 'text-neutral-900'
            }`}>
              Memory Calendar
            </h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Navigate your journey by date, highlight written memories, and organize meaningful milestones.
            </p>
          </div>

          {/* Month & Year Controller */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleJumpToToday}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08]'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-black/[0.06]'
              }`}
            >
              Today
            </button>

            <div className={`flex items-center p-1 rounded-xl border ${
              isDark ? 'bg-neutral-950 border-white/[0.08]' : 'bg-neutral-100/80 border-black/[0.06]'
            }`}>
              <button
                onClick={handlePrevMonth}
                title="Previous Month"
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-white text-neutral-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 text-xs sm:text-sm font-serif font-medium tracking-wide min-w-[130px] text-center">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>

              <button
                onClick={handleNextMonth}
                title="Next Month"
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-white text-neutral-700'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Access Menu for Common Milestones & Events */}
        <div className="mt-5 pt-4 border-t border-dashed border-neutral-200/40 dark:border-neutral-800/60">
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-[11px] font-mono tracking-wider uppercase flex items-center gap-1.5 ${
              isDark ? 'text-amber-400/90' : 'text-amber-800'
            }`}>
              <Sparkles className="w-3 h-3 text-amber-500" />
              Easy Access Quick Presets — Click to add for selected date ({selectedDateStr}):
            </span>
            <span className="text-[10px] text-neutral-400">
              One-click milestone scheduler
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {EVENT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <motion.button
                  key={preset.category}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleOpenPreset(preset)}
                  className={`flex flex-col items-center text-center p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900/90 hover:bg-neutral-800 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'bg-white hover:bg-neutral-50 border-black/[0.06] shadow-sm'
                  }`}
                >
                  <div className={`p-2 rounded-xl mb-1.5 ${
                    isDark ? 'bg-neutral-800' : 'bg-neutral-100'
                  }`}>
                    <Icon className={`w-4 h-4 ${preset.color}`} />
                  </div>
                  <span className="text-xs font-medium leading-tight truncate w-full">
                    {preset.label}
                  </span>
                  <span className={`text-[9px] leading-tight truncate w-full mt-0.5 ${
                    isDark ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    {preset.sublabel}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Dual Pane: Calendar Grid on Left, Selected Date Workspace on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Pane: Interactive Month Calendar Grid */}
        <div className={`lg:col-span-8 p-5 sm:p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
          isDark
            ? 'bg-neutral-900/70 border-white/[0.08] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'bg-white/80 border-black/[0.06] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]'
        }`}>
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center mb-2">
            {WEEKDAY_NAMES.map((name) => (
              <div
                key={name}
                className={`py-1.5 text-xs font-mono font-medium uppercase tracking-wider ${
                  name === 'Sun' || name === 'Sat'
                    ? isDark ? 'text-amber-400/70' : 'text-amber-700'
                    : isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarDays.map((cell) => {
              const isSelected = cell.dateStr === selectedDateStr;
              const hasJournal = cell.journalEntries.length > 0;
              const hasEvents = cell.dayEvents.length > 0;

              return (
                <button
                  key={cell.dateStr}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`min-h-[80px] sm:min-h-[96px] p-2 rounded-2xl flex flex-col justify-between text-left transition-all duration-200 relative group cursor-pointer border ${
                    isSelected
                      ? isDark
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/50'
                        : 'bg-amber-50/90 border-amber-400 shadow-[0_0_16px_rgba(217,119,6,0.15)] ring-1 ring-amber-400'
                      : hasJournal
                      ? isDark
                        ? 'bg-neutral-900/90 hover:bg-neutral-800/90 border-amber-500/20'
                        : 'bg-amber-50/30 hover:bg-amber-50/70 border-amber-500/20'
                      : cell.isCurrentMonth
                      ? isDark
                        ? 'bg-neutral-900/50 hover:bg-neutral-800/60 border-white/[0.04]'
                        : 'bg-white/60 hover:bg-white border-black/[0.04]'
                      : isDark
                      ? 'bg-neutral-950/40 hover:bg-neutral-900/40 border-transparent opacity-40'
                      : 'bg-neutral-100/40 hover:bg-neutral-100/70 border-transparent opacity-40'
                  }`}
                >
                  {/* Top Bar: Day Number & Today indicator */}
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-mono font-medium rounded-full w-6 h-6 flex items-center justify-center ${
                      cell.isToday
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                        : isSelected
                        ? isDark ? 'text-amber-300 font-bold' : 'text-amber-900 font-bold'
                        : cell.isCurrentMonth
                        ? isDark ? 'text-neutral-200' : 'text-neutral-800'
                        : isDark ? 'text-neutral-600' : 'text-neutral-400'
                    }`}>
                      {cell.dayNumber}
                    </span>

                    {/* Journal Indicator Badge / Marker */}
                    {hasJournal && (
                      <span 
                        title={`${cell.journalEntries.length} reflection(s) written`}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono border ${
                          isDark
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        <BookOpen className="w-2.5 h-2.5 text-amber-500" />
                        <span>{cell.journalEntries.length}</span>
                      </span>
                    )}
                  </div>

                  {/* Bottom: Events / Reminders preview pills */}
                  <div className="w-full space-y-1 mt-1">
                    {cell.dayEvents.slice(0, 2).map((ev) => {
                      const Icon = getCategoryIcon(ev.category);
                      return (
                        <div
                          key={ev.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] truncate font-medium border ${getCategoryStyles(ev.category, isDark)} ${
                            ev.isCompleted ? 'line-through opacity-60' : ''
                          }`}
                        >
                          <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{ev.title}</span>
                        </div>
                      );
                    })}

                    {cell.dayEvents.length > 2 && (
                      <span className={`text-[9px] block font-mono pl-1 ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        +{cell.dayEvents.length - 2} more
                      </span>
                    )}
                  </div>

                  {/* Glowing Bottom Highlight for active Journal Days */}
                  {hasJournal && (
                    <div className="absolute bottom-1 left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend Strip */}
          <div className="mt-4 pt-3 border-t border-neutral-200/40 dark:border-neutral-800/60 flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/30 border border-amber-500" />
                <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Reflection Written</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/40 border border-rose-500" />
                <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Birthday / Milestone</span>
              </div>
            </div>

            <span className={`italic ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Click any date to view reflections or add entries & reminders.
            </span>
          </div>
        </div>

        {/* Right Pane: Selected Date Detail & Action Workspace */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Selected Date Card */}
          <div className={`p-5 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
            isDark
              ? 'bg-neutral-900/80 border-white/[0.08] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]'
              : 'bg-white/90 border-black/[0.06] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`text-[10px] font-mono tracking-wider uppercase block ${
                  isDark ? 'text-amber-400' : 'text-amber-700'
                }`}>
                  Selected Calendar Date
                </span>
                <h2 className={`font-serif text-lg sm:text-xl font-medium tracking-tight mt-0.5 ${
                  isDark ? 'text-neutral-50' : 'text-neutral-900'
                }`}>
                  {formattedSelectedDate}
                </h2>
              </div>

              {selectedDateStr === todayStr && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold ${
                  isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  Today
                </span>
              )}
            </div>

            {/* Main Action 1: Add Journal Entry for this Date */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAddEntryForDate(selectedDateStr)}
              id="calendar-add-journal-btn"
              className={`w-full mt-4 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-medium text-xs shadow-md transition-all cursor-pointer ${
                isDark
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 hover:from-amber-400 hover:to-amber-500 shadow-amber-500/20'
                  : 'bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-500 hover:to-amber-600 shadow-amber-600/20'
              }`}
            >
              <Feather className="w-3.5 h-3.5" />
              <span>Write Reflection for this Date</span>
            </motion.button>

            {/* Main Action 2: Add Milestone / Event */}
            <button
              onClick={() => {
                setSelectedCategory('birthday');
                setEventTitle('');
                setEventTime('');
                setEventNotes('');
                setIsEventModalOpen(true);
              }}
              className={`w-full mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-2xl font-medium text-xs border transition-all cursor-pointer ${
                isDark
                  ? 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 border-white/[0.08]'
                  : 'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 border-black/[0.06]'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-amber-500" />
              <span>Schedule Event or Reminder</span>
            </button>
          </div>

          {/* Reflections on this Date */}
          <div className={`p-5 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
            isDark
              ? 'bg-neutral-900/80 border-white/[0.08]'
              : 'bg-white/90 border-black/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${
                isDark ? 'text-neutral-200' : 'text-neutral-800'
              }`}>
                <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                Journal Entries ({selectedEntries.length})
              </span>
            </div>

            {selectedEntries.length === 0 ? (
              <div className={`p-4 rounded-2xl border text-center ${
                isDark ? 'bg-neutral-950/40 border-neutral-800/60' : 'bg-neutral-50 border-neutral-200/60'
              }`}>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  No reflection recorded for this date yet.
                </p>
                <button
                  onClick={() => onAddEntryForDate(selectedDateStr)}
                  className="mt-2 text-xs text-amber-500 hover:underline font-medium inline-flex items-center gap-1"
                >
                  Start writing now <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => onOpenEntry(entry)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer group ${
                      isDark
                        ? 'bg-neutral-950/60 hover:bg-neutral-800/60 border-white/[0.06]'
                        : 'bg-white hover:bg-neutral-50 border-black/[0.05] shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium truncate group-hover:text-amber-500 transition-colors">
                        {entry.title || 'Untitled Reflection'}
                      </h4>
                      {entry.mood && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-neutral-500/10 text-neutral-400">
                          {entry.mood}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] line-clamp-2 mt-1 ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}>
                      {entry.content}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-500/10 text-[10px] text-neutral-400 font-mono">
                      <span>{entry.wordCount} words</span>
                      <span className="text-amber-500 group-hover:underline">Open in Editor →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Events & Reminders on this Date */}
          <div className={`p-5 rounded-3xl border backdrop-blur-2xl transition-all duration-300 ${
            isDark
              ? 'bg-neutral-900/80 border-white/[0.08]'
              : 'bg-white/90 border-black/[0.06]'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${
                isDark ? 'text-neutral-200' : 'text-neutral-800'
              }`}>
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                Scheduled Milestones & Reminders ({selectedEvents.length})
              </span>
            </div>

            {selectedEvents.length === 0 ? (
              <div className={`p-4 rounded-2xl border text-center ${
                isDark ? 'bg-neutral-950/40 border-neutral-800/60' : 'bg-neutral-50 border-neutral-200/60'
              }`}>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  No events or reminders set for this date.
                </p>
                <button
                  onClick={() => setIsEventModalOpen(true)}
                  className="mt-2 text-xs text-amber-500 hover:underline font-medium inline-flex items-center gap-1"
                >
                  Add milestone / reminder <Plus className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedEvents.map((ev) => {
                  const Icon = getCategoryIcon(ev.category);
                  const isDone = !!ev.isCompleted;

                  return (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-2xl border transition-all flex items-start gap-2.5 ${
                        getCategoryStyles(ev.category, isDark)
                      } ${isDone ? 'opacity-50' : ''}`}
                    >
                      <button
                        onClick={() => onToggleEventComplete(ev.id, !isDone)}
                        title={isDone ? "Mark as Active" : "Mark as Completed"}
                        className="mt-0.5 flex-shrink-0 cursor-pointer text-neutral-400 hover:text-amber-500 transition-colors"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold truncate ${
                            isDone ? 'line-through' : ''
                          }`}>
                            {ev.title}
                          </span>
                          {ev.time && (
                            <span className="text-[10px] font-mono opacity-75 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {ev.time}
                            </span>
                          )}
                        </div>

                        {ev.notes && (
                          <p className="text-[11px] opacity-80 mt-0.5 line-clamp-2">
                            {ev.notes}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-black/5 dark:border-white/5 text-[9px] opacity-70 uppercase font-mono">
                          <span>{ev.category}</span>
                          <button
                            onClick={() => onDeleteEvent(ev.id)}
                            title="Delete Event"
                            className="text-rose-500 hover:text-rose-600 cursor-pointer p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* EVENT CREATION MODAL */}
      <AnimatePresence>
        {isEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl backdrop-blur-2xl relative ${
                isDark
                  ? 'bg-neutral-900 border-white/[0.1] text-neutral-100'
                  : 'bg-white border-black/[0.08] text-neutral-900'
              }`}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-neutral-500/10 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase rounded-full border ${
                  isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  Calendar Event & Reminder
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  {selectedDateStr}
                </span>
              </div>

              <h3 className="font-serif text-xl font-medium">
                Schedule Milestone
              </h3>

              <form onSubmit={handleCreateEventSubmit} className="space-y-4 mt-4">
                
                {/* Category Preset Selector */}
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
                    Select Event Category
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {EVENT_PRESETS.map((preset) => {
                      const Icon = preset.icon;
                      const isCatActive = selectedCategory === preset.category;
                      return (
                        <button
                          key={preset.category}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(preset.category);
                            if (!eventTitle || EVENT_PRESETS.some(p => p.defaultTitle === eventTitle)) {
                              setEventTitle(preset.defaultTitle);
                            }
                            setEventPriority(preset.defaultPriority);
                          }}
                          className={`flex items-center gap-1.5 p-2 rounded-xl border text-[11px] font-medium transition-all ${
                            isCatActive
                              ? isDark
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                                : 'bg-amber-100 border-amber-400 text-amber-900 shadow-sm'
                              : isDark
                              ? 'bg-neutral-800/60 border-neutral-700/60 text-neutral-400 hover:text-neutral-200'
                              : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${preset.color}`} />
                          <span className="truncate">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title Input */}
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                    Event Title / Milestone Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="e.g., Mom's Birthday, Team Lunch, Graduation..."
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none transition-all ${
                      isDark
                        ? 'bg-neutral-950 border-neutral-800 focus:border-amber-500 text-neutral-100'
                        : 'bg-neutral-50 border-neutral-200 focus:border-amber-500 text-neutral-900'
                    }`}
                  />
                </div>

                {/* Date & Time Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={selectedDateStr}
                      onChange={(e) => setSelectedDateStr(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                        isDark
                          ? 'bg-neutral-950 border-neutral-800 focus:border-amber-500 text-neutral-100'
                          : 'bg-neutral-50 border-neutral-200 focus:border-amber-500 text-neutral-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                      Time (Optional)
                    </label>
                    <input
                      type="text"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      placeholder="e.g., 7:30 PM"
                      className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none ${
                        isDark
                          ? 'bg-neutral-950 border-neutral-800 focus:border-amber-500 text-neutral-100'
                          : 'bg-neutral-50 border-neutral-200 focus:border-amber-500 text-neutral-900'
                      }`}
                    />
                  </div>
                </div>

                {/* Notes & Contemplations */}
                <div>
                  <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">
                    Notes & Reminders (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    placeholder="e.g., Buy flowers, reserve table at 6, bring portfolio..."
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none resize-none ${
                      isDark
                        ? 'bg-neutral-950 border-neutral-800 focus:border-amber-500 text-neutral-100'
                        : 'bg-neutral-50 border-neutral-200 focus:border-amber-500 text-neutral-900'
                    }`}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium ${
                      isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !eventTitle.trim()}
                    className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer ${
                      isDark
                        ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-amber-500/20'
                        : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                    } disabled:opacity-50`}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Milestone'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
