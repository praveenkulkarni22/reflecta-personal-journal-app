import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  ArrowRight, 
  RotateCw, 
  Sun, 
  Moon, 
  Heart, 
  ShieldCheck, 
  Clock,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { InteractiveBackground } from './InteractiveBackground';
import { SanctuaryAmbienceControl } from './SanctuaryAmbienceControl';
import { ambientSound } from '../lib/audioSynth';

interface ThankYouPageProps {
  onReturnHome: () => void;
  onSignInAgain: () => void;
}

export const ThankYouPage: React.FC<ThankYouPageProps> = ({
  onReturnHome,
  onSignInAgain
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [secondsRemaining, setSecondsRemaining] = useState<number>(10);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Keep Sanctuary Soundscape alive and playing peacefully on the Thank You page
  useEffect(() => {
    ambientSound.autoStartPeacefulMode(0.30);
  }, []);

  // 10-second countdown timer
  useEffect(() => {
    if (isPaused) return;

    if (secondsRemaining <= 0) {
      onReturnHome();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining, isPaused, onReturnHome]);

  const progressPercent = ((10 - secondsRemaining) / 10) * 100;

  return (
    <div className={`relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden transition-colors duration-500 bg-transparent ${
      isDark 
        ? 'text-neutral-100 selection:bg-teal-500/20 selection:text-teal-200' 
        : 'text-neutral-900 selection:bg-teal-500/20 selection:text-teal-900'
    }`}>
      {/* Cool Autumn Atmosphere & Falling Orange Leaves Engine */}
      <InteractiveBackground />

      {/* Floating Top Header: Sanctuary Ambience Volume & Theme Switcher */}
      <div className="absolute top-6 right-6 z-30 flex items-center gap-2.5 sm:gap-3">
        {/* Sanctuary Ambience Controller */}
        <SanctuaryAmbienceControl />

        {/* Light / Dark Mode quick switcher */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={toggleTheme}
          title={isDark ? "Switch to Radiant Light Mode" : "Switch to Obsidian Dark Mode"}
          className={`p-2.5 rounded-full border transition-all duration-300 cursor-pointer ${
            isDark
              ? 'bg-neutral-900/80 text-teal-300 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.5)] hover:bg-neutral-800'
              : 'bg-white/90 text-teal-700 border-black/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_8px_20px_rgba(0,0,0,0.06)] hover:bg-neutral-50'
          }`}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </motion.button>
      </div>

      {/* Cool Autumn Atmospheric Glow Overlay */}
      {isDark ? (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_10%,rgba(56,189,248,0.07),transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_90%,rgba(20,184,166,0.1),transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,23,42,0.4),rgba(12,10,29,0.5),rgba(20,10,5,0.65))] pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_10%,rgba(14,165,233,0.05),transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_90%,rgba(20,184,166,0.08),transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(241,245,249,0.4),rgba(255,255,255,0.5),rgba(240,253,250,0.35))] pointer-events-none" />
        </>
      )}

      {/* Main Centered Farewell Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-xl mx-auto text-center flex flex-col items-center space-y-6"
      >
        {/* Monogram / Logo Mark with gentle breath animation */}
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          id="thank-you-logo"
          className={`relative w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-300 ${
            isDark
              ? 'bg-gradient-to-br from-teal-500/25 via-neutral-900 to-neutral-950 border border-teal-500/40 shadow-[0_12px_30px_rgba(20,184,166,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]'
              : 'bg-gradient-to-br from-teal-50 via-white to-teal-100/70 border border-teal-500/30 shadow-[0_12px_25px_rgba(13,148,136,0.18),inset_0_1px_0_rgba(255,255,255,1)]'
          }`}
        >
          <span className={`font-serif text-4xl font-bold tracking-wider ${
            isDark ? 'text-teal-300' : 'text-teal-700'
          }`}>
            R
          </span>
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-teal-400 rounded-full shadow-md shadow-teal-400/50 animate-ping opacity-75" />
        </motion.div>

        {/* Heading */}
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium tracking-wide border ${
              isDark
                ? 'bg-teal-500/10 border-teal-500/25 text-teal-300'
                : 'bg-teal-50 border-teal-300 text-teal-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
            <span>Reflections Safely Preserved</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            id="thank-you-title"
            className={`font-serif text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight ${
              isDark ? 'text-neutral-50' : 'text-neutral-900'
            }`}
          >
            Thank You for Visiting
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            id="thank-you-tagline"
            className={`font-serif text-xl sm:text-2xl italic ${
              isDark ? 'text-teal-200/90' : 'text-teal-800'
            }`}
          >
            May the clarity you found today remain with you.
          </motion.p>
        </div>

        {/* Beautiful Reflective Message Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          id="thank-you-card"
          className={`w-full p-6 sm:p-7 rounded-3xl backdrop-blur-2xl transition-all duration-300 space-y-4 border ${
            isDark
              ? 'bg-neutral-900/80 border-white/[0.12] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]'
              : 'bg-white/90 border-black/[0.08] shadow-[0_20px_45px_-10px_rgba(13,148,136,0.12),inset_0_1px_0_rgba(255,255,255,1)]'
          }`}
        >
          {/* Poetic Message */}
          <div className="space-y-3 text-sm sm:text-base font-light leading-relaxed">
            <p className={isDark ? 'text-neutral-200' : 'text-neutral-700'}>
              Your thoughts and conversations are safely encrypted in your private vault. Take a gentle breath, carry this tranquility into your world, and visit whenever you need a moment for yourself.
            </p>
          </div>

          {/* Countdown & Timer Bar */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isDark
              ? 'bg-neutral-950/60 border-white/[0.06]'
              : 'bg-neutral-50 border-neutral-200/80'
          }`}>
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-teal-500" />
                <span className={isDark ? 'text-neutral-300' : 'text-neutral-700'}>
                  Returning to Sanctuary Home in
                </span>
                <span className="font-mono font-bold text-teal-500 px-1.5 py-0.5 rounded bg-teal-500/10">
                  {secondsRemaining}s
                </span>
              </div>

              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  isPaused
                    ? 'bg-teal-500/20 text-teal-300'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {isPaused ? 'Resume Timer' : 'Pause'}
              </button>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.9, ease: 'linear' }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onReturnHome}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all border cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08]'
                  : 'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 border-neutral-200'
              }`}
            >
              <Compass className="w-4 h-4 text-teal-500" />
              <span>Return to Home Now</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSignInAgain}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold tracking-wide bg-gradient-to-r from-teal-600 via-teal-600 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 text-white shadow-md shadow-teal-500/20 transition-all cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>Sign In Again</span>
            </motion.button>
          </div>

          {/* Security & Ambience Note */}
          <div className={`flex items-center justify-center gap-1.5 text-[11px] font-light pt-1 ${
            isDark ? 'text-neutral-400' : 'text-neutral-500'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500 shrink-0" />
            <span>Vault locked • Sanctuary Soundscape active</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
