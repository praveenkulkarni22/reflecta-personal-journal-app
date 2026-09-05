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
  Check,
  Repeat,
  TrendingUp
} from 'lucide-react';
import { JournalEntry, CalendarEvent, CalendarEventCategory, EventRecurrence } from '../types';
import { useTheme } from '../context/ThemeContext';
import { EmotionalTrendsChart } from './EmotionalTrendsChart';

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
    color: 'text-rose-500',
    bgLight: 'bg-rose-50 border-rose-200 text-rose-800',
    bgDark: 'bg-rose-500/15 border-rose-500/30 text-rose-300'
  },
  {
    category: 'graduation',
    label: "Graduation",
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
    label: "Dining",
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
    label: "Wellness",
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
    label: "Travel",
    sublabel: "Journey & getaways",
    icon: Plane,
    defaultTitle: "Travel Departure",
    defaultPriority: 'normal',
    color: 'text-sky-500',
    bgLight: 'bg-sky-50 border-sky-200 text-sky-800',
    bgDark: 'bg-sky-500/15 border-sky-500/30 text-sky-300'
  },
  {
    category: 'custom',
    label: "Custom",
    sublabel: "Contemplative to-do & note",
    icon: Bell,
    defaultTitle: "Personal Milestone",
    defaultPriority: 'important',
    color: 'text-teal-600 dark:text-teal-400',
    bgLight: 'bg-teal-50 border-teal-200 text-teal-800',
    bgDark: 'bg-teal-500/15 border-teal-500/30 text-teal-300'
  }
];

export function isEventOnDate(ev: CalendarEvent, targetDateStr: string): boolean {
  if (!ev.date) return false;
  const recurrence = ev.recurrence || 'none';
  if (recurrence === 'none') {
    return ev.date === targetDateStr;
  }
  // Recurring events only trigger on or after their starting date
  if (targetDateStr < ev.date) {
    return false;
  }
  if (recurrence === 'daily') {
    return true;
  }
  const [evY, evM, evD] = ev.date.split('-').map(Number);
  const [tY, tM, tD] = targetDateStr.split('-').map(Number);
  const evDate = new Date(evY, evM - 1, evD);
  const targetDate = new Date(tY, tM - 1, tD);

  if (recurrence === 'weekly') {
    return evDate.getDay() === targetDate.getDay();
  }
  if (recurrence === 'monthly') {
    return evD === tD;
  }
  if (recurrence === 'yearly') {
    return evM === tM && evD === tD;
  }
  return ev.date === targetDateStr;
}

function getCategoryIcon(cat: CalendarEventCategory) {
  const preset = EVENT_PRESETS.find(p => p.category === cat);
  return preset ? preset.icon : Bell;
}

function getCategoryStyles(cat: CalendarEventCategory, isDark: boolean) {
  const preset = EVENT_PRESETS.find(p => p.category === cat);
  if (!preset) {
    return isDark 
      ? 'bg-teal-500/15 border-teal-500/30 text-teal-300' 
      : 'bg-teal-50 border-teal-200 text-teal-800';
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
  const [activeDetailTab, setActiveDetailTab] = useState<'reflections' | 'milestones'>('reflections');

  // Filter state for upcoming events
  const [eventFilter, setEventFilter] = useState<'all' | CalendarEventCategory>('all');
  const [eventRecurrence, setEventRecurrence] = useState<EventRecurrence>('none');
  const [isEmotionalTrendsOpen, setIsEmotionalTrendsOpen] = useState(false);

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
        dayEvents: events.filter(ev => isEventOnDate(ev, key))
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
        dayEvents: events.filter(ev => isEventOnDate(ev, key))
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
        dayEvents: events.filter(ev => isEventOnDate(ev, key))
      });
    }

    return days;
  }, [currentYear, currentMonth, todayStr, entriesByDate, events]);

  // Selected date's content
  const selectedEntries = useMemo(() => {
    return entriesByDate.get(selectedDateStr) || [];
  }, [entriesByDate, selectedDateStr]);

  const selectedEvents = useMemo(() => {
    return events.filter(ev => isEventOnDate(ev, selectedDateStr));
  }, [events, selectedDateStr]);

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
    setEventRecurrence(
      preset.category === 'birthday' || preset.category === 'anniversary'
        ? 'yearly'
        : 'none'
    );
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
        recurrence: eventRecurrence,
        isCompleted: false
      });
      setIsEventModalOpen(false);
      setEventTitle('');
      setEventNotes('');
      setEventTime('');
      setEventRecurrence('none');
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 w-full animate-in fade-in duration-300">
      
      {/* SPIRAL NOTEBOOK PAPER PAGE */}
      <div className={`relative flex-1 p-3.5 sm:p-5 sm:pl-8 sm:pr-6 transition-colors duration-200 flex flex-col min-h-0 w-full max-w-full overflow-hidden ${
        isDark 
          ? 'bg-[#18181b] text-neutral-100' 
          : 'bg-[#fdfbf7] text-neutral-900'
      }`}>
            
            {/* Perforated tear line on the left of the page */}
            <div className={`absolute top-0 bottom-0 left-0 w-px border-r-2 border-dashed ${
              isDark ? 'border-neutral-700/60' : 'border-stone-300/80'
            }`} />

            {/* Red / Coral Classic Notebook Margin Rule Line */}
            <div className={`absolute top-0 bottom-0 left-3 sm:left-5 w-px ${
              isDark ? 'bg-rose-500/20' : 'bg-rose-400/40'
            }`} />

            {/* Ruled lines texture */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
              style={{
                backgroundImage: isDark
                  ? 'repeating-linear-gradient(to bottom, transparent, transparent 29px, rgba(255,255,255,0.06) 29px, rgba(255,255,255,0.06) 30px)'
                  : 'repeating-linear-gradient(to bottom, transparent, transparent 29px, rgba(0,0,0,0.06) 29px, rgba(0,0,0,0.06) 30px)'
              }}
            />

            {/* NOTEBOOK TOP ROW: Title, Month Navigator & Header Actions (shrink-0) */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 mb-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              
              {/* Left: Sanctuary Badge & Title */}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[9px] font-mono tracking-wider uppercase rounded-full border ${
                  isDark
                    ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                    : 'bg-teal-50 text-teal-800 border-teal-200'
                }`}>
                  Time Sanctuary
                </span>
                <h1 className={`font-serif text-lg sm:text-xl font-medium tracking-tight ${
                  isDark ? 'text-neutral-50' : 'text-neutral-900'
                }`}>
                  Memory Calendar
                </h1>
                <span className={`hidden md:inline-flex text-[11px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  • {entries.length} reflections • {events.length} milestones
                </span>
              </div>

              {/* Middle: Month & Year Navigator */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-700'
                      : 'bg-white hover:bg-stone-100 text-neutral-700 border-stone-300 shadow-2xs'
                  }`}
                >
                  Today
                </button>

                <div className={`flex items-center p-0.5 rounded-lg border ${
                  isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-stone-300 shadow-2xs'
                }`}>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-stone-100 text-neutral-700'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="px-2 text-xs sm:text-sm font-serif font-medium tracking-wide min-w-[120px] text-center select-none">
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Next Month"
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-stone-100 text-neutral-700'
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right: Primary Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setIsEmotionalTrendsOpen(!isEmotionalTrendsOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap ${
                    isEmotionalTrendsOpen
                      ? isDark
                        ? 'bg-[#67C3DE]/20 text-[#67C3DE] border-[#67C3DE]/60'
                        : 'bg-[#67C3DE]/20 text-[#083847] border-[#67C3DE]/70'
                      : isDark
                        ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-700'
                        : 'bg-white hover:bg-stone-100 text-neutral-700 border-stone-300 shadow-2xs'
                  }`}
                  title="Toggle D3 Emotional Trends Line Chart"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#67C3DE]" />
                  <span className="hidden sm:inline">Emotional Trends (D3)</span>
                  <span className="sm:hidden">Trends (D3)</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => onAddEntryForDate(selectedDateStr)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <Feather className="w-3.5 h-3.5" />
                  <span>Write Reflection</span>
                </motion.button>
              </div>
            </div>

            {/* QUICK PRESETS STRIP (Compact horizontal strip - shrink-0) */}
            <div className="relative z-10 flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-black/[0.05] dark:border-white/[0.05] shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full pr-8 sm:pr-12">
                <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold whitespace-nowrap flex items-center gap-1 mr-0.5 shrink-0 ${
                  isDark ? 'text-teal-400' : 'text-teal-700'
                }`}>
                  <Sparkles className="w-3 h-3 text-teal-500 shrink-0" />
                  Quick Presets:
                </span>
                {EVENT_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.category}
                      type="button"
                      onClick={() => handleOpenPreset(preset)}
                      title={`Schedule ${preset.label} for ${selectedDateStr}`}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer whitespace-nowrap hover:scale-105 shadow-2xs shrink-0 ${
                        isDark
                          ? 'bg-neutral-900/80 hover:bg-neutral-800 border-white/[0.08] text-neutral-300'
                          : 'bg-white hover:bg-stone-50 border-stone-300 text-neutral-800'
                      }`}
                    >
                      <Icon className={`w-3 h-3 ${preset.color} shrink-0`} />
                      <span className="whitespace-nowrap">{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* EXPANDABLE D3 EMOTIONAL TRENDS DRAWER */}
            <AnimatePresence>
              {isEmotionalTrendsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative z-20 overflow-hidden shrink-0"
                >
                  <div className="relative p-1">
                    <button
                      onClick={() => setIsEmotionalTrendsOpen(false)}
                      className={`absolute top-4 right-4 z-30 p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border-white/[0.1]'
                          : 'bg-white hover:bg-stone-100 text-stone-600 hover:text-black border-stone-200 shadow-xs'
                      }`}
                      title="Close Emotional Trends"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <EmotionalTrendsChart
                      entries={entries}
                      onSelectEntry={onOpenEntry}
                      isCompact={true}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MAIN DUAL PANE WORKSPACE (flex-1 min-h-0: Calendar Grid on Left, Day Dossier on Right) */}
            <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
              
              {/* Left Pane: Interactive Month Calendar Grid */}
              <div className={`flex-1 min-h-0 flex flex-col rounded-2xl border p-2.5 sm:p-3 overflow-hidden transition-all ${
                isDark 
                  ? 'bg-neutral-900/60 border-white/[0.08] shadow-sm' 
                  : 'bg-stone-100/70 border-stone-300/70 shadow-2xs'
              }`}>
                
                {/* Weekday Names Header Row */}
                <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-mono uppercase tracking-wider py-1 shrink-0">
                  {WEEKDAY_NAMES.map((name) => (
                    <div
                      key={name}
                      className={`font-semibold ${
                        name === 'Sun' || name === 'Sat'
                          ? isDark ? 'text-teal-400' : 'text-teal-700'
                          : isDark ? 'text-neutral-400' : 'text-neutral-600'
                      }`}
                    >
                      {name}
                    </div>
                  ))}
                </div>

                {/* Days Grid: Exactly fits 100% of available height with no scroll */}
                <div 
                  className="grid grid-cols-7 gap-1 sm:gap-1.5 flex-1 min-h-0 h-full w-full"
                  style={{
                    gridTemplateRows: `repeat(${calendarDays.length / 7}, minmax(0, 1fr))`
                  }}
                >
                  {calendarDays.map((cell) => {
                    const isSelected = cell.dateStr === selectedDateStr;
                    const hasJournal = cell.journalEntries.length > 0;
                    const hasEvents = cell.dayEvents.length > 0;

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => setSelectedDateStr(cell.dateStr)}
                        className={`h-full min-h-0 p-1 sm:p-1.5 rounded-xl flex flex-col justify-between text-left transition-all duration-150 relative cursor-pointer border overflow-hidden ${
                          isSelected
                            ? isDark
                              ? 'bg-teal-500/20 border-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.3)] ring-1 ring-teal-500'
                              : 'bg-teal-100/90 border-teal-600 shadow-[0_0_12px_rgba(13,148,136,0.2)] ring-1 ring-teal-600'
                            : hasJournal
                            ? isDark
                              ? 'bg-neutral-900/90 hover:bg-neutral-800/90 border-teal-500/30'
                              : 'bg-teal-50/50 hover:bg-teal-100/60 border-teal-500/30'
                            : cell.isCurrentMonth
                            ? isDark
                              ? 'bg-neutral-900/40 hover:bg-neutral-800/50 border-white/[0.04]'
                              : 'bg-white/70 hover:bg-white border-stone-200/80 shadow-2xs'
                            : isDark
                            ? 'bg-neutral-950/20 opacity-30 border-transparent'
                            : 'bg-stone-200/30 opacity-35 border-transparent'
                        }`}
                      >
                        {/* Top: Day Number & Journal Marker */}
                        <div className="flex items-center justify-between w-full shrink-0">
                          <span className={`text-[10px] sm:text-xs font-mono font-medium rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center ${
                            cell.isToday
                              ? 'bg-teal-600 text-white font-bold shadow-xs'
                              : isSelected
                              ? isDark ? 'text-teal-300 font-bold' : 'text-teal-950 font-bold'
                              : cell.isCurrentMonth
                              ? isDark ? 'text-neutral-200' : 'text-neutral-800'
                              : isDark ? 'text-neutral-500' : 'text-neutral-400'
                          }`}>
                            {cell.dayNumber}
                          </span>

                          {/* Journal Indicator Badge */}
                          {hasJournal && (
                            <span 
                              title={`${cell.journalEntries.length} reflection(s) written`}
                              className={`flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-mono border shrink-0 ${
                                isDark
                                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                  : 'bg-teal-100 text-teal-900 border-teal-300'
                              }`}
                            >
                              <BookOpen className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
                              <span>{cell.journalEntries.length}</span>
                            </span>
                          )}
                        </div>

                        {/* Bottom: Milestone Pills or Dot Indicators */}
                        <div className="w-full space-y-0.5 mt-0.5 min-h-0 overflow-hidden">
                          {cell.dayEvents.slice(0, 1).map((ev) => {
                            const Icon = getCategoryIcon(ev.category);
                            return (
                              <div
                                key={ev.id}
                                className={`flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] truncate font-medium border ${getCategoryStyles(ev.category, isDark)} ${
                                  ev.isCompleted ? 'line-through opacity-60' : ''
                                }`}
                              >
                                <Icon className="w-2 h-2 shrink-0" />
                                <span className="truncate leading-tight">{ev.title}</span>
                              </div>
                            );
                          })}

                          {cell.dayEvents.length > 1 && (
                            <span className={`text-[8px] sm:text-[9px] block font-mono pl-0.5 leading-none truncate ${
                              isDark ? 'text-neutral-400' : 'text-neutral-500'
                            }`}>
                              +{cell.dayEvents.length - 1} more
                            </span>
                          )}
                        </div>

                        {/* Subtle Journal glow bottom line */}
                        {hasJournal && (
                          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-teal-500/50 to-transparent rounded-full mt-0.5 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Compact Legend Strip (shrink-0) */}
                <div className="pt-2 mt-auto border-t border-black/[0.05] dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-2 text-[10px] shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-teal-600 shadow-xs" />
                      <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Today</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-teal-500/30 border border-teal-500" />
                      <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Reflection Written</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500/40 border border-rose-500" />
                      <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>Milestone Event</span>
                    </div>
                  </div>

                  <span className={`hidden sm:inline italic text-[10px] ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Click any date to inspect reflections and milestones.
                  </span>
                </div>
              </div>

              {/* Right Pane: Selected Date Detail Dossier */}
              <div className={`w-full lg:w-80 xl:w-88 shrink-0 flex flex-col min-h-0 rounded-2xl border p-3 overflow-hidden transition-all ${
                isDark 
                  ? 'bg-neutral-900/70 border-white/[0.08] shadow-sm' 
                  : 'bg-stone-100/80 border-stone-300/70 shadow-2xs'
              }`}>
                
                {/* Header: Date Title & Today indicator */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                      <span className={`text-[10px] font-mono tracking-wider uppercase font-semibold ${
                        isDark ? 'text-teal-300' : 'text-teal-900'
                      }`}>
                        Selected Date
                      </span>
                    </div>
                    <h2 className={`font-serif text-sm sm:text-base font-semibold tracking-tight mt-0.5 break-words leading-tight ${
                      isDark ? 'text-neutral-100' : 'text-neutral-900'
                    }`}>
                      {formattedSelectedDate}
                    </h2>
                  </div>

                  {selectedDateStr === todayStr && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold shrink-0 ${
                      isDark ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40' : 'bg-teal-100 text-teal-900 border border-teal-300'
                    }`}>
                      Today
                    </span>
                  )}
                </div>

                {/* Quick Actions for Selected Date */}
                <div className="grid grid-cols-2 gap-1.5 my-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onAddEntryForDate(selectedDateStr)}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Feather className="w-3 h-3" />
                    <span>Write Reflection</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('birthday');
                      setEventTitle('');
                      setEventTime('');
                      setEventNotes('');
                      setIsEventModalOpen(true);
                    }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-medium border transition-all cursor-pointer whitespace-nowrap ${
                      isDark
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08]'
                        : 'bg-white hover:bg-stone-50 text-neutral-800 border-stone-300 shadow-2xs'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    <span>Add Milestone</span>
                  </button>
                </div>

                {/* Tab Switcher: Reflections vs Milestones */}
                <div className={`flex items-center gap-1 p-0.5 rounded-xl border mb-2 shrink-0 text-[11px] font-medium ${
                  isDark ? 'bg-neutral-950/60 border-white/[0.06]' : 'bg-stone-200/60 border-stone-300/60'
                }`}>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('reflections')}
                    className={`flex-1 py-1 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeDetailTab === 'reflections'
                        ? isDark 
                          ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40 shadow-xs font-semibold' 
                          : 'bg-white text-teal-900 border border-teal-300/80 shadow-2xs font-semibold'
                        : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Reflections ({selectedEntries.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('milestones')}
                    className={`flex-1 py-1 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      activeDetailTab === 'milestones'
                        ? isDark 
                          ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40 shadow-xs font-semibold' 
                          : 'bg-white text-teal-900 border border-teal-300/80 shadow-2xs font-semibold'
                        : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <Bell className="w-3 h-3" />
                    <span>Milestones ({selectedEvents.length})</span>
                  </button>
                </div>

                {/* Scrollable list inside the dossier card (only this inner container scrolls if entries exceed height) */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
                  {activeDetailTab === 'reflections' ? (
                    selectedEntries.length === 0 ? (
                      <div className={`p-4 rounded-xl border text-center my-auto ${
                        isDark ? 'bg-neutral-950/40 border-neutral-800/60' : 'bg-white border-stone-200'
                      }`}>
                        <BookOpen className={`w-6 h-6 mx-auto mb-1.5 opacity-40 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                        <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          No reflection recorded for this date yet.
                        </p>
                        <button
                          type="button"
                          onClick={() => onAddEntryForDate(selectedDateStr)}
                          className="mt-2 text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          Start writing reflection <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      selectedEntries.map((entry) => (
                        <div
                          key={entry.id}
                          onClick={() => onOpenEntry(entry)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                            isDark
                              ? 'bg-neutral-950/60 hover:bg-neutral-800/60 border-white/[0.06]'
                              : 'bg-white hover:bg-stone-50 border-stone-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="text-xs font-semibold break-words leading-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                              {entry.title || 'Untitled Reflection'}
                            </h4>
                            {entry.mood && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 shrink-0">
                                {entry.mood}
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] line-clamp-2 mt-1 ${
                            isDark ? 'text-neutral-400' : 'text-neutral-600'
                          }`}>
                            {entry.content}
                          </p>
                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/[0.05] dark:border-white/[0.05] text-[10px] text-neutral-400 font-mono">
                            <span>{entry.wordCount || entry.content.split(/\s+/).filter(Boolean).length} words</span>
                            <span className="text-teal-600 dark:text-teal-400 group-hover:underline font-medium">Open in Editor →</span>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    selectedEvents.length === 0 ? (
                      <div className={`p-4 rounded-xl border text-center my-auto ${
                        isDark ? 'bg-neutral-950/40 border-neutral-800/60' : 'bg-white border-stone-200'
                      }`}>
                        <Bell className={`w-6 h-6 mx-auto mb-1.5 opacity-40 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                        <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                          No milestones or reminders scheduled for this date.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsEventModalOpen(true)}
                          className="mt-2 text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          Add milestone or reminder <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      selectedEvents.map((ev) => {
                        const Icon = getCategoryIcon(ev.category);
                        const isDone = !!ev.isCompleted;

                        return (
                          <div
                            key={ev.id}
                            className={`p-2.5 rounded-xl border transition-all flex items-start gap-2 ${
                              getCategoryStyles(ev.category, isDark)
                            } ${isDone ? 'opacity-50' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={() => onToggleEventComplete(ev.id, !isDone)}
                              title={isDone ? "Mark as Active" : "Mark as Completed"}
                              className="mt-0.5 shrink-0 cursor-pointer text-neutral-400 hover:text-teal-500 transition-colors"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs font-semibold break-words leading-tight ${
                                  isDone ? 'line-through' : ''
                                }`}>
                                  {ev.title}
                                </span>
                                {ev.time && (
                                  <span className="text-[10px] font-mono opacity-80 flex items-center gap-0.5 shrink-0">
                                    <Clock className="w-2.5 h-2.5" />
                                    {ev.time}
                                  </span>
                                )}
                              </div>

                              {ev.notes && (
                                <p className="text-[11px] opacity-80 mt-0.5 break-words line-clamp-3">
                                  {ev.notes}
                                </p>
                              )}

                              <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-black/5 dark:border-white/5 text-[9px] opacity-80 uppercase font-mono">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{ev.category}</span>
                                  {ev.recurrence && ev.recurrence !== 'none' && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 font-semibold lowercase">
                                      <Repeat className="w-2.5 h-2.5" />
                                      {ev.recurrence}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onDeleteEvent(ev.id)}
                                  title="Delete Milestone"
                                  className="text-rose-500 hover:text-rose-600 cursor-pointer p-0.5 shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>

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
                  isDark ? 'bg-teal-500/10 text-teal-300 border-teal-500/20' : 'bg-teal-50 text-teal-800 border-teal-200'
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
                            if (preset.category === 'birthday' || preset.category === 'anniversary') {
                              setEventRecurrence('yearly');
                            }
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                            isCatActive
                              ? isDark
                                ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-sm ring-1 ring-teal-500/40'
                                : 'bg-teal-100 border-teal-500 text-teal-900 shadow-sm ring-1 ring-teal-400'
                              : isDark
                              ? 'bg-neutral-800/60 border-neutral-700/60 text-neutral-400 hover:text-neutral-200'
                              : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${preset.color}`} />
                          <span className="whitespace-nowrap font-medium">{preset.label}</span>
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
                        ? 'bg-neutral-950 border-neutral-800 focus:border-teal-500 text-neutral-100'
                        : 'bg-neutral-50 border-neutral-200 focus:border-teal-500 text-neutral-900'
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
                          ? 'bg-neutral-950 border-neutral-800 focus:border-teal-500 text-neutral-100'
                          : 'bg-neutral-50 border-neutral-200 focus:border-teal-500 text-neutral-900'
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
                          ? 'bg-neutral-950 border-neutral-800 focus:border-teal-500 text-neutral-100'
                          : 'bg-neutral-50 border-neutral-200 focus:border-teal-500 text-neutral-900'
                      }`}
                    />
                  </div>
                </div>

                {/* Repeat / Recurrence Options */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                      <Repeat className="w-3 h-3 text-teal-500 shrink-0" />
                      <span>Repeat Frequency</span>
                    </label>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                      {eventRecurrence === 'none' && 'One-time only'}
                      {eventRecurrence === 'daily' && 'Repeats every day'}
                      {eventRecurrence === 'weekly' && 'Repeats weekly on this day'}
                      {eventRecurrence === 'monthly' && 'Repeats monthly on this date'}
                      {eventRecurrence === 'yearly' && 'Repeats every year on this date'}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {(
                      [
                        { id: 'none', label: 'None' },
                        { id: 'daily', label: 'Daily' },
                        { id: 'weekly', label: 'Weekly' },
                        { id: 'monthly', label: 'Monthly' },
                        { id: 'yearly', label: 'Yearly' }
                      ] as const
                    ).map((opt) => {
                      const isSelected = eventRecurrence === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEventRecurrence(opt.id)}
                          className={`px-2 py-1.5 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer whitespace-nowrap ${
                            isSelected
                              ? isDark
                                ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-semibold shadow-2xs ring-1 ring-teal-500/50'
                                : 'bg-teal-100 border-teal-500 text-teal-900 font-semibold shadow-2xs ring-1 ring-teal-400'
                              : isDark
                              ? 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                              : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
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
                        ? 'bg-neutral-950 border-neutral-800 focus:border-teal-500 text-neutral-100'
                        : 'bg-neutral-50 border-neutral-200 focus:border-teal-500 text-neutral-900'
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
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white disabled:opacity-50"
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
