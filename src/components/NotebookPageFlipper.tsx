import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';
import { ambientSound } from '../lib/audioSynth';

interface NotebookPageFlipperProps {
  pageKey: string;
  children: React.ReactNode;
  className?: string;
}

export const NotebookPageFlipper: React.FC<NotebookPageFlipperProps> = ({
  pageKey,
  children,
  className = ''
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Play a soft paper rustle sound whenever a page is flipped
  const handlePageFlip = () => {
    try {
      ambientSound.playPageFlipSound();
    } catch {
      // Audio autoplay policy fallback
    }
  };

  return (
    /* PERMANENT SPIRAL NOTEBOOK DESK FRAME (Stationary - Never Moves or Flips) */
    <div 
      className={`relative rounded-3xl transition-all duration-300 border flex-1 flex flex-col min-h-0 w-full ${
        isDark
          ? 'bg-neutral-950/95 border-white/[0.08] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85),2px_2px_0_1px_rgba(255,255,255,0.04)]'
          : 'bg-stone-200/95 border-stone-300/80 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1),3px_3px_0_rgba(0,0,0,0.04)]'
      } p-2 sm:p-3 ${className}`}
    >
      {/* Notebook Inner Container: Spine on Left + Flipping Pages on Right */}
      <div className="relative flex rounded-2xl overflow-hidden border border-black/[0.04] dark:border-white/[0.04] flex-1 min-h-0 w-full">
        
        {/* PERMANENT SPIRAL BINDING SPINE - 100% INTACT & FIXED (Never moves, never flips) */}
        <div 
          id="spiral-binding-spine"
          className={`relative w-14 sm:w-16 shrink-0 flex flex-col justify-evenly py-5 z-30 select-none ${
            isDark 
              ? 'bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-800 border-r border-neutral-700/60 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.5)]' 
              : 'bg-gradient-to-r from-stone-300 via-stone-200 to-stone-100 border-r border-stone-300 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.1)]'
          }`}
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="relative w-full h-4 sm:h-5 flex items-center">
              {/* 100% Visible Spiral Wire Loop with Specular Sheen & 3D Shadow (Inset from outer edge) */}
              <div 
                className={`h-2.5 sm:h-3 w-8 sm:w-10 ml-1.5 sm:ml-2 rounded-full transform -rotate-6 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${
                  isDark
                    ? 'bg-gradient-to-r from-zinc-500 via-neutral-100 to-zinc-600 border-t border-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]'
                    : 'bg-gradient-to-r from-stone-400 via-white to-stone-500 border-t border-white/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]'
                }`}
              />
              
              {/* Punched hole at the paper seam */}
              <div className={`absolute right-2 sm:right-2.5 w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-[2px] shadow-inner ${
                isDark 
                  ? 'bg-black border border-white/[0.08]' 
                  : 'bg-stone-800/90 border border-black/30'
              }`} />
            </div>
          ))}
        </div>

        {/* FLIPPING PAGE STAGE - ANCHORED AT SPIRAL SPINE ON LEFT */}
        <div 
          className="relative flex-1 flex flex-col min-h-0 w-full overflow-hidden"
          style={{
            perspective: '2500px',
            transformStyle: 'preserve-3d'
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pageKey}
              onAnimationStart={handlePageFlip}
              // Entering page: Resting flat on the desk, gently settling into view
              initial={{
                opacity: 0.82,
                scale: 0.992,
                filter: 'brightness(0.95)'
              }}
              animate={{
                opacity: 1,
                scale: 1,
                rotateY: 0,
                rotateZ: 0,
                skewY: 0,
                filter: 'brightness(1)',
                transition: {
                  duration: 0.72,
                  ease: [0.25, 1, 0.5, 1]
                }
              }}
              exit={{
                // Physical page turn: Starts lifting from right side/bottom-right corner,
                // and rotates gracefully around the left spiral binding seam (0% 50%) towards the left!
                transformOrigin: '0% 50%',
                rotateY: -96,
                rotateZ: 3.5,
                skewY: -2.5,
                opacity: [1, 0.95, 0],
                filter: isDark 
                  ? 'brightness(0.78) drop-shadow(-35px 20px 40px rgba(0,0,0,0.85))'
                  : 'brightness(0.86) drop-shadow(-35px 20px 35px rgba(0,0,0,0.35))',
                transition: {
                  duration: 0.78,
                  ease: [0.38, 0, 0.22, 1]
                }
              }}
              className="relative w-full h-full min-h-0 flex-1 flex flex-col"
              style={{
                transformOrigin: '0% 50%',
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity, filter'
              }}
            >
              {children}

              {/* Realistic Bottom-Right Corner Dog-Ear / Paper Fold Indicator */}
              <div 
                className="absolute bottom-1 right-1 w-8 h-8 pointer-events-none z-30 overflow-hidden select-none"
                title="Notebook Page Corner"
              >
                <div 
                  className={`absolute bottom-0 right-0 w-6 h-6 transform rotate-45 translate-x-3 translate-y-3 border transition-all ${
                    isDark 
                      ? 'bg-neutral-800/80 border-white/[0.12] shadow-[-2px_-2px_6px_rgba(0,0,0,0.7)]' 
                      : 'bg-stone-300/80 border-stone-400/60 shadow-[-2px_-2px_4px_rgba(0,0,0,0.15)]'
                  }`}
                />
              </div>

              {/* Dynamic lighting sheen sweeping across the page leaf during turn */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: [0, 0.4, 0.65, 0] }}
                transition={{ duration: 0.78 }}
                className="absolute inset-0 pointer-events-none z-25"
                style={{
                  background: isDark
                    ? 'linear-gradient(to left, rgba(255,255,255,0.06), rgba(0,0,0,0.5))'
                    : 'linear-gradient(to left, rgba(255,255,255,0.3), rgba(0,0,0,0.2))'
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};
