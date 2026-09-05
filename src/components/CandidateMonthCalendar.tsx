import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface CandidateMonthCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
  isOpen: boolean;
  existingEntryDates?: Set<string>;
}

export const CandidateMonthCalendar: React.FC<CandidateMonthCalendarProps> = ({
  selectedDate,
  onSelectDate,
  onClose,
  isOpen,
  existingEntryDates = new Set()
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse selected date or today
  const initialDate = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
  const validInitialDate = isNaN(initialDate.getTime()) ? new Date() : initialDate;

  const [viewYear, setViewYear] = useState<number>(validInitialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(validInitialDate.getMonth()); // 0-indexed

  // Keep view year & month synced when selectedDate changes and opened
  useEffect(() => {
    if (selectedDate) {
      const d = new Date(`${selectedDate}T00:00:00`);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [selectedDate, isOpen]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Delay slightly to prevent the toggle button click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onSelectDate(todayStr);
    onClose();
  };

  // Build calendar matrix
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0-6
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const todayStr = new Date().toISOString().slice(0, 10);

  const days: { dayNumber: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Previous month spill
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = viewMonth === 0 ? 12 : viewMonth;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dayNumber: d, dateStr, isCurrentMonth: true });
  }

  // Next month spill (total cells = 35 or 42)
  const remainingCells = 42 - days.length;
  for (let d = 1; d <= remainingCells && days.length < 42; d++) {
    const m = viewMonth === 11 ? 1 : viewMonth + 2;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, scale: 0.95, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -6 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={`absolute top-full left-0 mt-2 z-50 w-72 sm:w-80 rounded-2xl p-4 shadow-2xl border backdrop-blur-2xl ${
          isDark
            ? 'bg-neutral-900/95 border-neutral-700/80 text-neutral-100 shadow-black/60'
            : 'bg-white/95 border-stone-200 text-neutral-900 shadow-stone-400/30'
        }`}
      >
        {/* Header: Candidate Month Navigator */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className={`w-4 h-4 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
            <span className="text-sm font-serif font-bold tracking-tight">
              {monthNames[viewMonth]} {viewYear}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleToday}
              className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100' : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100' : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close calendar"
              className={`p-1 rounded-lg transition-colors cursor-pointer ml-1 ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-100' : 'hover:bg-stone-100 text-stone-500 hover:text-stone-900'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Row */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {daysOfWeek.map((day, idx) => (
            <div
              key={idx}
              className={`text-[11px] font-semibold tracking-wider py-1 ${
                isDark ? 'text-neutral-500' : 'text-stone-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Candidate Days Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((item, idx) => {
            const isSelected = item.dateStr === selectedDate;
            const isToday = item.dateStr === todayStr;
            const hasExistingEntry = existingEntryDates.has(item.dateStr);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectDate(item.dateStr);
                  onClose();
                }}
                className={`relative flex flex-col items-center justify-center h-8 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  !item.isCurrentMonth
                    ? isDark ? 'text-neutral-600 opacity-40 hover:opacity-80' : 'text-stone-300 opacity-50 hover:opacity-80'
                    : isSelected
                    ? isDark
                      ? 'bg-teal-600 text-white font-bold shadow-sm shadow-teal-500/30'
                      : 'bg-teal-600 text-white font-bold shadow-sm shadow-teal-700/20'
                    : isDark
                    ? 'text-neutral-200 hover:bg-neutral-800 hover:text-white'
                    : 'text-stone-800 hover:bg-stone-100'
                } ${isToday && !isSelected ? (isDark ? 'border border-teal-500/50 text-teal-300 font-semibold' : 'border border-teal-600/50 text-teal-700 font-semibold') : ''}`}
              >
                <span>{item.dayNumber}</span>
                {/* Vault Reflection indicator dot */}
                {hasExistingEntry && (
                  <span
                    title="Reflection in vault"
                    className={`absolute bottom-1 w-1 h-1 rounded-full ${
                      isSelected ? 'bg-white' : isDark ? 'bg-teal-400' : 'bg-teal-600'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom indicator legend */}
        <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] ${
          isDark ? 'border-neutral-800 text-neutral-400' : 'border-stone-100 text-stone-500'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-teal-400' : 'bg-teal-600'}`} />
            <span>Reflection in vault</span>
          </div>
          <span className="font-mono text-[10px]">{selectedDate || todayStr}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
