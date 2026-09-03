import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  MessageSquare, 
  Archive, 
  Calendar as CalendarIcon, 
  Compass, 
  BookMarked, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  PlusCircle,
  Clock,
  Feather
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type NavTab = 'journal' | 'conversations' | 'archive' | 'calendar' | 'landscape';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  onOpenLandscape: () => void;
  onOpenFlipbook: () => void;
  onNewReflection: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  journalCount: number;
  eventsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenLandscape,
  onOpenFlipbook,
  onNewReflection,
  isCollapsed,
  setIsCollapsed,
  journalCount,
  eventsCount
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const navItems = [
    {
      id: 'journal' as NavTab,
      label: 'Journal',
      subtext: 'Daily reflections & prose',
      icon: BookOpen,
      badge: journalCount > 0 ? `${journalCount}` : undefined
    },
    {
      id: 'calendar' as NavTab,
      label: 'Memory Calendar',
      subtext: 'Dates, events & milestones',
      icon: CalendarIcon,
      badge: eventsCount > 0 ? `${eventsCount}` : undefined,
      isSpecial: true
    },
    {
      id: 'conversations' as NavTab,
      label: 'Reflect Dialogue',
      subtext: 'Gemini Socratic inquiry',
      icon: MessageSquare
    },
    {
      id: 'archive' as NavTab,
      label: 'Volume Archive',
      subtext: 'Historical vault records',
      icon: Archive
    },
    {
      id: 'landscape' as NavTab,
      label: 'Inner Landscape',
      subtext: 'Longitudinal mindspace themes',
      icon: Compass,
      onClick: onOpenLandscape
    },
    {
      id: 'flipbook' as any,
      label: 'Flipbook Reader',
      subtext: 'Contemplative book view',
      icon: BookMarked,
      onClick: onOpenFlipbook
    }
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 flex flex-col border-r backdrop-blur-2xl ${
        isCollapsed ? 'w-[72px]' : 'w-72'
      } ${
        isDark
          ? 'bg-neutral-950/90 border-white/[0.08] shadow-[10px_0_30px_rgba(0,0,0,0.5)]'
          : 'bg-white/90 border-black/[0.06] shadow-[10px_0_30px_rgba(0,0,0,0.03)]'
      }`}
    >
      {/* Brand Header */}
      <div className={`p-4 flex items-center justify-between border-b ${
        isDark ? 'border-neutral-900/80' : 'border-neutral-100'
      }`}>
        <div 
          onClick={() => setActiveTab('journal')}
          className="flex items-center gap-3 cursor-pointer group select-none overflow-hidden"
        >
          {/* Exact Amber Monogram matching Landing Page */}
          <motion.div 
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            id="sidebar-logo"
            className={`relative flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isDark
                ? 'bg-gradient-to-br from-amber-500/20 via-neutral-900 to-neutral-950 border border-amber-500/30 shadow-[0_4px_16px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'bg-gradient-to-br from-amber-50 via-white to-amber-100/60 border border-amber-500/30 shadow-[0_4px_14px_rgba(217,119,6,0.15),inset_0_1px_0_rgba(255,255,255,1)]'
            }`}
          >
            <span className={`font-serif text-xl font-bold tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              R
            </span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse shadow-md shadow-amber-400/50" />
          </motion.div>

          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col truncate"
            >
              <div className="flex items-center gap-2">
                <span className={`font-serif text-lg font-medium tracking-tight ${
                  isDark ? 'text-neutral-100 group-hover:text-amber-300' : 'text-neutral-900 group-hover:text-amber-600'
                }`}>
                  Reflecta
                </span>
                <span className={`px-1.5 py-0.5 text-[9px] font-mono tracking-wider uppercase rounded-full border ${
                  isDark
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  Sanctuary
                </span>
              </div>
              <span className={`text-[11px] font-serif italic truncate ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}>
                Mindful Vault & Journey
              </span>
            </motion.div>
          )}
        </div>

        {/* Collapse / Expand Button */}
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title="Collapse Sidebar"
            className={`p-1.5 rounded-lg border transition-colors ${
              isDark 
                ? 'bg-neutral-900 border-white/[0.08] text-neutral-400 hover:text-white hover:bg-neutral-800' 
                : 'bg-neutral-100 border-black/[0.06] text-neutral-500 hover:text-black hover:bg-neutral-200'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Options List */}
      <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                } else {
                  setActiveTab(item.id);
                }
              }}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 text-left group cursor-pointer relative ${
                isActive
                  ? isDark
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_2px_12px_rgba(245,158,11,0.15)]'
                    : 'bg-amber-50 text-amber-900 border border-amber-300 shadow-[0_2px_8px_rgba(217,119,6,0.1)]'
                  : isDark
                  ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/80 border border-transparent'
                  : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 border border-transparent'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors flex-shrink-0 ${
                isActive
                  ? isDark ? 'text-amber-400' : 'text-amber-700'
                  : isDark ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-neutral-500 group-hover:text-neutral-800'
              }`}>
                <Icon className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">{item.label}</span>
                    {item.badge && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded-full ${
                        isActive
                          ? isDark ? 'bg-amber-500/30 text-amber-200' : 'bg-amber-200 text-amber-900'
                          : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200 text-neutral-600'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] truncate ${
                    isActive 
                      ? isDark ? 'text-amber-400/80' : 'text-amber-800/80' 
                      : isDark ? 'text-neutral-500' : 'text-neutral-400'
                  }`}>
                    {item.subtext}
                  </p>
                </div>
              )}

              {/* Active Indicator Bar on left */}
              {isActive && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-amber-500"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Expand Toggle when collapsed */}
      {isCollapsed && (
        <div className="p-3 border-t flex justify-center">
          <button
            onClick={() => setIsCollapsed(false)}
            title="Expand Sidebar"
            className={`p-2 rounded-lg border transition-colors ${
              isDark 
                ? 'bg-neutral-900 border-white/[0.08] text-neutral-400 hover:text-white hover:bg-neutral-800' 
                : 'bg-neutral-100 border-black/[0.06] text-neutral-500 hover:text-black hover:bg-neutral-200'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bottom Vault Status Footer */}
      {!isCollapsed && (
        <div className={`p-3.5 m-3 rounded-2xl border ${
          isDark 
            ? 'bg-neutral-900/60 border-white/[0.06]' 
            : 'bg-neutral-50 border-black/[0.05]'
        }`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-[11px] font-medium truncate">Private Encrypted Vault</span>
          </div>
          <p className={`text-[10px] mt-1 leading-relaxed ${
            isDark ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
            Your thoughts and calendar reminders are bound to your secure Google UID.
          </p>
        </div>
      )}
    </aside>
  );
};
