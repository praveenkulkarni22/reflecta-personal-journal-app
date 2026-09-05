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
      subtext: 'Daily reflections',
      icon: BookOpen,
      badge: journalCount > 0 ? `${journalCount}` : undefined
    },
    {
      id: 'calendar' as NavTab,
      label: 'Memory Calendar',
      subtext: 'Dates & milestones',
      icon: CalendarIcon,
      badge: eventsCount > 0 ? `${eventsCount}` : undefined,
      isSpecial: true
    },
    {
      id: 'conversations' as NavTab,
      label: 'Reflect Dialogue',
      subtext: 'Socratic inquiry',
      icon: MessageSquare
    },
    {
      id: 'archive' as NavTab,
      label: 'Volume Archive',
      subtext: 'Historical vault',
      icon: Archive
    },
    {
      id: 'landscape' as NavTab,
      label: 'Inner Landscape',
      subtext: 'Mindspace themes',
      icon: Compass,
      onClick: onOpenLandscape
    },
    {
      id: 'flipbook' as any,
      label: 'Flipbook Reader',
      subtext: 'Contemplative view',
      icon: BookMarked,
      onClick: onOpenFlipbook
    }
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 flex flex-col border-r backdrop-blur-2xl ${
        isCollapsed ? 'w-[64px]' : 'w-60'
      } ${
        isDark
          ? 'bg-neutral-950/90 border-white/[0.08] shadow-[10px_0_30px_rgba(0,0,0,0.5)]'
          : 'bg-[#fdfbf7]/95 border-stone-200/80 shadow-[10px_0_30px_rgba(0,0,0,0.04)]'
      }`}
    >
      {/* Brand Header */}
      <div className={`p-3.5 flex items-center justify-between border-b ${
        isDark ? 'border-white/[0.08]' : 'border-stone-200/80'
      }`}>
        <div 
          onClick={() => setActiveTab('journal')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          {/* Monogram with #67C3DE Highlight */}
          <motion.div 
            whileHover={{ scale: 1.05, rotate: -2 }}
            whileTap={{ scale: 0.95 }}
            id="sidebar-logo"
            className={`relative flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isDark
                ? 'bg-[#67C3DE]/15 border border-[#67C3DE]/50 shadow-[0_0_12px_rgba(103,195,222,0.25)]'
                : 'bg-gradient-to-br from-[#67C3DE]/30 via-[#67C3DE]/15 to-white border border-[#67C3DE] shadow-[0_2px_8px_rgba(103,195,222,0.25)]'
            }`}
          >
            <span className={`font-serif text-lg font-bold tracking-wider ${
              isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
            }`}>
              R
            </span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse bg-[#67C3DE] shadow-[0_0_8px_#67C3DE]" />
          </motion.div>

          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col min-w-0"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-serif text-base font-bold tracking-tight whitespace-nowrap ${
                  isDark ? 'text-[#67C3DE]' : 'text-[#083847] group-hover:text-[#0c4a60]'
                }`}>
                  Reflecta
                </span>
                <span className={`px-1.5 py-0.5 text-[9px] font-mono tracking-wider uppercase rounded-full border whitespace-nowrap font-bold ${
                  isDark 
                    ? 'bg-[#67C3DE]/15 text-[#67C3DE] border-[#67C3DE]/40' 
                    : 'bg-[#67C3DE]/20 text-[#083847] border-[#67C3DE]/60'
                }`}>
                  Sanctuary
                </span>
              </div>
              {/* Responsive title in #67C3DE in dark mode and deep ocean tone in light mode */}
              <span className={`text-xs font-bold select-none tracking-normal leading-tight mt-0.5 ${
                isDark ? 'text-[#67C3DE]' : 'text-[#0c4a60]'
              }`}>
                Mindful Vault and Journey
              </span>
            </motion.div>
          )}
        </div>

        {/* Collapse / Expand Button */}
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title="Collapse Sidebar"
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isDark 
                ? 'border-white/[0.08] bg-neutral-900/40 text-[#67C3DE] hover:bg-[#67C3DE]/15' 
                : 'border-stone-200 bg-white text-[#0c4a60] hover:bg-[#67C3DE]/20 hover:text-[#083847] hover:border-[#67C3DE]/60 shadow-2xs'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Navigation Options List */}
      <nav className="flex-1 px-2.5 py-2.5 space-y-1.5 overflow-y-auto overflow-x-hidden">
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
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 text-left group cursor-pointer relative ${
                isActive
                  ? isDark
                    ? 'bg-[#67C3DE]/15 text-[#67C3DE] border border-[#67C3DE]/50 shadow-[0_0_14px_rgba(103,195,222,0.18)] font-bold'
                    : 'bg-[#67C3DE]/20 text-[#083847] border border-[#67C3DE]/70 shadow-[0_2px_10px_rgba(103,195,222,0.22)] font-bold'
                  : isDark
                    ? 'text-[#67C3DE]/70 hover:text-[#67C3DE] hover:bg-[#67C3DE]/10 hover:border-[#67C3DE]/25 border border-transparent font-medium'
                    : 'text-[#0c4a60]/80 hover:text-[#083847] hover:bg-[#67C3DE]/15 hover:border-[#67C3DE]/40 border border-transparent font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                isActive
                  ? isDark
                    ? 'bg-[#67C3DE]/25 text-[#67C3DE] border border-[#67C3DE]/40 shadow-xs'
                    : 'bg-[#67C3DE] text-[#083847] border border-[#67C3DE] shadow-xs'
                  : isDark
                    ? 'text-[#67C3DE]/80 group-hover:text-[#67C3DE]'
                    : 'text-[#0c4a60] group-hover:text-[#083847]'
              }`}>
                <Icon className="w-4 h-4" />
              </div>

              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`font-bold whitespace-nowrap ${
                      isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                    }`}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded-full shrink-0 whitespace-nowrap font-bold ${
                        isActive
                          ? isDark
                            ? 'bg-[#67C3DE] text-neutral-950 shadow-xs'
                            : 'bg-[#67C3DE] text-[#083847] shadow-xs'
                          : isDark
                            ? 'bg-[#67C3DE]/15 text-[#67C3DE] border border-[#67C3DE]/30'
                            : 'bg-[#67C3DE]/20 text-[#083847] border border-[#67C3DE]/50'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] leading-tight truncate mt-0.5 ${
                    isActive 
                      ? isDark ? 'text-[#67C3DE] font-semibold' : 'text-[#0c4a60] font-semibold'
                      : isDark ? 'text-[#67C3DE]/70 group-hover:text-[#67C3DE]/90' : 'text-[#0c4a60]/75 group-hover:text-[#083847]'
                  }`}>
                    {item.subtext}
                  </p>
                </div>
              )}

              {/* Active Indicator Bar on left using #67C3DE */}
              {isActive && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#67C3DE] shadow-[0_0_8px_#67C3DE]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Expand Toggle when collapsed */}
      {isCollapsed && (
        <div className={`p-2.5 border-t flex justify-center ${
          isDark ? 'border-white/[0.08]' : 'border-stone-200/80'
        }`}>
          <button
            onClick={() => setIsCollapsed(false)}
            title="Expand Sidebar"
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark 
                ? 'border-white/[0.08] bg-neutral-900/40 text-[#67C3DE] hover:bg-[#67C3DE]/15' 
                : 'border-stone-200 bg-white text-[#0c4a60] hover:bg-[#67C3DE]/20 hover:text-[#083847] hover:border-[#67C3DE]/60 shadow-2xs'
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Vault Status Footer */}
      {!isCollapsed && (
        <div className={`p-3 m-2.5 rounded-xl border shadow-xs ${
          isDark 
            ? 'bg-neutral-900/60 border-white/[0.08]' 
            : 'bg-[#67C3DE]/12 border-[#67C3DE]/40 shadow-2xs'
        }`}>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${
              isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
            }`} />
            <span className={`text-[11px] font-bold leading-snug ${
              isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
            }`}>
              Private Encrypted Vault
            </span>
          </div>
          <p className={`text-[10px] mt-1 leading-relaxed font-medium ${
            isDark ? 'text-[#67C3DE]/80' : 'text-[#0c4a60]'
          }`}>
            Reflections & calendar are securely bound to your Google account.
          </p>
        </div>
      )}
    </aside>
  );
};
