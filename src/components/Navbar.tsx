import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  LogIn, 
  LogOut, 
  Shield, 
  Sun, 
  Moon,
  PanelLeft,
  PanelLeftClose
} from 'lucide-react';
import { UserProfile } from '../types';
import { useTheme } from '../context/ThemeContext';
import { SanctuaryAmbienceControl } from './SanctuaryAmbienceControl';

interface NavbarProps {
  user: UserProfile | null;
  activeTab: 'journal' | 'conversations' | 'archive' | 'calendar' | 'landscape';
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenSparks: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  onSignIn,
  onSignOut,
  onOpenSparks,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
  const { theme, toggleTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isDark = theme === 'dark';

  const tabLabels: Record<string, string> = {
    journal: 'Daily Reflection & Prose',
    conversations: 'Reflect Dialogue (AI)',
    calendar: 'Memory Calendar',
    archive: 'Volume Archive',
    landscape: 'Inner Landscape'
  };

  return (
    <header className={`sticky top-0 z-30 w-full px-4 sm:px-6 py-3 backdrop-blur-2xl transition-all duration-300 border-b ${
      isDark 
        ? 'bg-neutral-950/80 border-white/[0.08] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]' 
        : 'bg-white/80 border-black/[0.06] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)]'
    }`}>
      <div className="w-full flex items-center justify-between gap-4">
        
        {/* Left: Sidebar Toggle & Active Workspace View Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? "Expand Side Navigation" : "Collapse Side Navigation"}
            className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
              isDark
                ? 'bg-neutral-900/90 border-white/[0.08] text-neutral-300 hover:text-white hover:bg-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'bg-neutral-100 border-black/[0.06] text-neutral-700 hover:text-black hover:bg-white shadow-sm'
            }`}
          >
            {isSidebarCollapsed ? (
              <PanelLeft className="w-4 h-4 text-amber-500" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-amber-500" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono tracking-wider uppercase ${
              isDark ? 'text-amber-400/90' : 'text-amber-700'
            }`}>
              Sanctuary
            </span>
            <span className="text-neutral-400 text-xs">/</span>
            <span className={`text-xs font-medium ${
              isDark ? 'text-neutral-200' : 'text-neutral-800'
            }`}>
              {tabLabels[activeTab] || 'Workspace'}
            </span>
          </div>
        </div>

        {/* Right: Only Sparks, Sanctuary music, soundscape, user profile, and matching Reflecta icon & text */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Daily Spark Inspiration Button */}
          {user && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onOpenSparks}
              title="Daily Contemplative Sparks"
              id="topbar-sparks-btn"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                isDark
                  ? 'bg-neutral-900 border-white/[0.08] hover:border-amber-500/40 text-amber-300 hover:text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'bg-amber-50 border-amber-200 hover:border-amber-300 text-amber-800 hover:bg-amber-100/70 shadow-sm'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
              <span className="hidden sm:inline">Sparks</span>
            </motion.button>
          )}

          {/* Sanctuary Ambience Music & Soundscape Volume Slider */}
          <SanctuaryAmbienceControl />

          {/* Light / Dark Mode Toggle */}
          <motion.button
            whileTap={{ scale: 0.9, rotate: 15 }}
            onClick={toggleTheme}
            title={isDark ? "Switch to Radiant Light Sanctuary" : "Switch to Obsidian Dark Sanctuary"}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer ${
              isDark
                ? 'bg-neutral-900/80 text-amber-300 border-white/[0.08] hover:bg-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'bg-neutral-100 text-amber-600 border-neutral-200 hover:bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.button>

          {/* Reflecta Monogram Icon and Text Matching Landing Page on Top Right */}
          <div 
            id="top-right-reflecta-brand"
            className="flex items-center gap-2 select-none pl-2 border-l border-neutral-200/40 dark:border-neutral-800/60"
          >
            <motion.div 
              whileHover={{ scale: 1.06, rotate: -2 }}
              whileTap={{ scale: 0.95 }}
              title="Reflecta Sanctuary"
              className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                isDark
                  ? 'bg-gradient-to-br from-amber-500/20 via-neutral-900 to-neutral-950 border border-amber-500/30 shadow-[0_4px_16px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'bg-gradient-to-br from-amber-50 via-white to-amber-100/60 border border-amber-500/30 shadow-[0_4px_14px_rgba(217,119,6,0.15),inset_0_1px_0_rgba(255,255,255,1)]'
              }`}
            >
              <span className={`font-serif text-base font-bold tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                R
              </span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse shadow-md shadow-amber-400/50" />
            </motion.div>
            
            <div className="hidden md:flex flex-col">
              <span className={`font-serif text-xs font-medium tracking-tight leading-tight ${
                isDark ? 'text-neutral-100' : 'text-neutral-900'
              }`}>
                Reflecta
              </span>
              <span className={`text-[8px] font-mono uppercase tracking-wider leading-none ${
                isDark ? 'text-amber-400/80' : 'text-amber-700'
              }`}>
                Sanctuary
              </span>
            </div>
          </div>

          {/* User Sign In / Profile Details */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center gap-2 p-1 pl-2.5 pr-1.5 rounded-full border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-neutral-900 border-white/[0.08] hover:border-neutral-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-sm'
                }`}
              >
                <span className={`text-xs font-medium max-w-[90px] truncate ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {user.displayName || 'Reflector'}
                </span>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full ring-1 ring-amber-500/30 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-semibold">
                    {(user.displayName || 'U')[0].toUpperCase()}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-0 mt-2 w-60 p-2.5 rounded-2xl border shadow-2xl backdrop-blur-2xl z-50 ${
                      isDark
                        ? 'bg-neutral-900/95 border-white/[0.1] shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)]'
                        : 'bg-white/95 border-black/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)]'
                    }`}
                  >
                    <div className={`px-3 py-2 border-b mb-1.5 ${isDark ? 'border-neutral-800' : 'border-neutral-100'}`}>
                      <p className={`text-xs font-semibold truncate ${isDark ? 'text-neutral-200' : 'text-neutral-900'}`}>
                        {user.displayName || 'Reflector'}
                      </p>
                      <p className={`text-[11px] font-mono truncate ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        {user.email}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-500 font-medium">
                        <Shield className="w-3 h-3" />
                        <span>Private Google Vault Active</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onSignOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors font-medium cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSignIn}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-md transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In with Google</span>
            </motion.button>
          )}

        </div>
      </div>
    </header>
  );
};
