import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Volume1, Sparkles, Sliders, Waves, Bird, Music2 } from 'lucide-react';
import { ambientSound } from '../lib/audioSynth';
import { useTheme } from '../context/ThemeContext';

interface SanctuaryAmbienceControlProps {
  variant?: 'compact' | 'expanded' | 'floating';
  className?: string;
}

export const SanctuaryAmbienceControl: React.FC<SanctuaryAmbienceControlProps> = ({
  variant = 'compact',
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isPlaying, setIsPlaying] = useState<boolean>(ambientSound.getActive());
  const [volume, setVolume] = useState<number>(ambientSound.getVolume());
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = ambientSound.subscribe((playing, vol) => {
      setIsPlaying(playing);
      setVolume(vol);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const toggleSound = () => {
    if (isPlaying) {
      ambientSound.stopSanctuaryAmbience();
    } else {
      const safeVol = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.30;
      ambientSound.playSanctuaryAmbience(safeVol || 0.30);
      ambientSound.playGlockenspielChime();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    const val = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.30;
    setVolume(val);
    if (!isPlaying && val > 0) {
      ambientSound.playSanctuaryAmbience(val);
    } else {
      ambientSound.setVolume(val);
    }
  };

  const setPreset = (val: number) => {
    const safeVal = Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.30;
    setVolume(safeVal);
    if (!isPlaying) {
      ambientSound.playSanctuaryAmbience(safeVal);
      ambientSound.playGlockenspielChime();
    } else {
      ambientSound.setVolume(safeVal);
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      {/* Main Toggle Button - Strictly Icon-Only */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={toggleSound}
        title={isPlaying ? 'Mute Sanctuary Soundscapes (Birds, Waves & Glockenspiel)' : 'Play Vibrant Sanctuary Ambience (Birds, Waves & Glockenspiel)'}
        aria-label={isPlaying ? 'Mute Sanctuary Ambience' : 'Play Sanctuary Ambience'}
        className={`p-2.5 rounded-full border transition-all duration-300 cursor-pointer relative ${
          isPlaying
            ? isDark
              ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-[0_0_18px_rgba(20,184,166,0.3),inset_0_1px_0_rgba(255,255,255,0.18)]'
              : 'bg-teal-100 text-teal-800 border-teal-300 shadow-[0_0_14px_rgba(13,148,136,0.25)]'
            : isDark
              ? 'bg-neutral-900/80 text-neutral-400 border-white/[0.08] hover:text-teal-200 hover:border-teal-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.4)] hover:bg-neutral-800'
              : 'bg-white/90 text-neutral-600 border-black/[0.08] hover:text-teal-900 hover:border-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_4px_12px_rgba(0,0,0,0.05)] hover:bg-neutral-50'
        }`}
      >
        {isPlaying ? (
          volume > 0.4 ? (
            <Volume2 className="w-4 h-4 text-teal-400 animate-pulse" />
          ) : (
            <Volume1 className="w-4 h-4 text-teal-400" />
          )
        ) : (
          <VolumeX className="w-4 h-4 opacity-70" />
        )}

        {/* Subtle pulsing indicator ring when active */}
        {isPlaying && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-teal-400 rounded-full animate-ping opacity-75" />
        )}
      </motion.button>

      {/* Volume & Soundscapes Tuning Button - Icon-Only */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        title="Adjust Soundscape Volume & Instruments"
        aria-label="Soundscape settings"
        className={`p-2.5 rounded-full border transition-all duration-300 cursor-pointer ${
          isOpen
            ? isDark
              ? 'bg-teal-500/30 text-teal-200 border-teal-500/50 shadow-[0_0_12px_rgba(20,184,166,0.2)]'
              : 'bg-teal-200 text-teal-950 border-teal-400 font-semibold'
            : isDark
              ? 'bg-neutral-900/80 text-neutral-400 border-white/[0.08] hover:text-neutral-200 hover:bg-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
              : 'bg-white/90 text-neutral-600 border-black/[0.08] hover:text-neutral-900 hover:bg-neutral-50 shadow-[inset_0_1px_0_rgba(255,255,255,1)]'
        }`}
      >
        <Sliders className="w-4 h-4" />
      </motion.button>

      {/* Popover Volume Slider & Soundscapes Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`absolute right-0 top-full mt-2 w-72 p-4 rounded-2xl border shadow-2xl backdrop-blur-2xl z-50 ${
                isDark
                  ? 'bg-neutral-900/95 border-white/[0.12] text-neutral-200 shadow-black/80'
                  : 'bg-white/95 border-neutral-200 text-neutral-800 shadow-teal-950/10'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-teal-500/15 text-teal-400">
                    <Music2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold tracking-wide block">
                      Sanctuary Soundscape
                    </span>
                    <span className="text-[10px] opacity-60 block">
                      Birds • Ocean Waves • Glockenspiel
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono text-teal-500 font-semibold">
                  {Math.round(volume * 100)}%
                </span>
              </div>

              {/* Soundscape Features Badges */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-[10px]">
                  <Bird className="w-3 h-3 text-teal-400 shrink-0" />
                  <span className="truncate">Birds</span>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-[10px]">
                  <Waves className="w-3 h-3 text-sky-400 shrink-0" />
                  <span className="truncate">Waves</span>
                </div>
                <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-[10px]">
                  <Sparkles className="w-3 h-3 text-teal-400 shrink-0" />
                  <span className="truncate">Chimes</span>
                </div>
              </div>

              {/* Volume Slider Control */}
              <div className="space-y-1.5 mb-3.5">
                <div className="flex items-center justify-between text-[11px] opacity-70">
                  <span>Master Volume</span>
                  <span>{isPlaying ? 'Active' : 'Paused'}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-700 accent-teal-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                <button
                  onClick={() => setPreset(0.12)}
                  className={`py-1 px-2 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                    Math.abs(volume - 0.12) < 0.05
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-semibold'
                      : 'bg-neutral-500/10 hover:bg-neutral-500/20 border-transparent'
                  }`}
                >
                  Gentle
                </button>
                <button
                  onClick={() => setPreset(0.3)}
                  className={`py-1 px-2 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                    Math.abs(volume - 0.3) < 0.05
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-semibold'
                      : 'bg-neutral-500/10 hover:bg-neutral-500/20 border-transparent'
                  }`}
                >
                  Peaceful
                </button>
                <button
                  onClick={() => setPreset(0.65)}
                  className={`py-1 px-2 rounded-lg text-[10px] font-medium border transition-all cursor-pointer ${
                    Math.abs(volume - 0.65) < 0.05
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 font-semibold'
                      : 'bg-neutral-500/10 hover:bg-neutral-500/20 border-transparent'
                  }`}
                >
                  Deep
                </button>
              </div>

              {/* Test Glockenspiel Instrument Button */}
              <button
                onClick={() => {
                  ambientSound.playGlockenspielChime();
                }}
                className={`w-full py-2 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors border cursor-pointer ${
                  isDark
                    ? 'bg-neutral-800/80 hover:bg-neutral-700/80 text-teal-200 border-white/[0.08]'
                    : 'bg-teal-50 hover:bg-teal-100/80 text-teal-900 border-teal-200/80 font-medium'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                <span>Strike Glockenspiel Bar</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
