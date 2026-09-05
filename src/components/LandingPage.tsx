import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Lock, 
  ArrowRight, 
  Sun, 
  Moon, 
  ShieldAlert, 
  AlertCircle, 
  Info, 
  X, 
  RotateCw,
  ShieldCheck,
  Music,
  FastForward,
  Play
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { AuthNotice } from '../types';
import { InteractiveBackground } from './InteractiveBackground';
import { SanctuaryAmbienceControl } from './SanctuaryAmbienceControl';
import { ambientSound } from '../lib/audioSynth';

interface LandingPageProps {
  onSignIn: () => void;
  isLoading: boolean;
  authNotice?: AuthNotice | null;
  onClearNotice?: () => void;
}

interface StanzaLine {
  text: string;
  isAccent?: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onSignIn, 
  isLoading,
  authNotice,
  onClearNotice 
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Allow user to skip text transitions and view the landing page instantly
  const [skipTransition, setSkipTransition] = useState<boolean>(() => {
    try {
      return localStorage.getItem('reflecta_skip_transition') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSkipTransition = () => {
    const next = !skipTransition;
    setSkipTransition(next);
    try {
      localStorage.setItem('reflecta_skip_transition', next ? 'true' : 'false');
    } catch {}
  };

  // Automatically enable the Sanctuary Soundscape in peaceful mode by default on landing page load
  useEffect(() => {
    ambientSound.autoStartPeacefulMode(0.30);
  }, []);

  // Poem structure
  const stanza1: StanzaLine[] = [
    { text: "Life moves quickly, thoughts drift and flow," },
    { text: "Some bring us joy, some questions we know." },
    { text: "Some simply need a quiet place to be," },
    { text: "A moment of calm, where the mind can feel free." }
  ];

  const stanza2: StanzaLine[] = [
    { text: "Reflecta is your private space to pause and see,", isAccent: true },
    { text: "To express who you are and simply be." },
    { text: "Gather your thoughts, let them connect and grow,", isAccent: true },
    { text: "And make sense of the feelings you carry and know." }
  ];

  // Calculate cumulative word delays for slow, left-to-right word-by-word flow
  let totalWordCount = 0;
  const wordDelayStep = skipTransition ? 0 : 0.12; // Gentle, slow meditative flow or instant
  const baseStartDelay = skipTransition ? 0 : 0.35;

  const renderedStanza1 = stanza1.map((lineObj) => {
    const words = lineObj.text.split(' ');
    const lineWithDelays = words.map((w) => {
      const delay = skipTransition ? 0 : baseStartDelay + totalWordCount * wordDelayStep;
      totalWordCount += 1;
      return { word: w, delay };
    });
    return { ...lineObj, wordsWithDelays: lineWithDelays };
  });

  // Stanza 2 pause gap
  totalWordCount += 2;

  const renderedStanza2 = stanza2.map((lineObj) => {
    const words = lineObj.text.split(' ');
    const lineWithDelays = words.map((w) => {
      const delay = skipTransition ? 0 : baseStartDelay + totalWordCount * wordDelayStep;
      totalWordCount += 1;
      return { word: w, delay };
    });
    return { ...lineObj, wordsWithDelays: lineWithDelays };
  });

  const finalStatementDelay = skipTransition ? 0 : baseStartDelay + totalWordCount * wordDelayStep + 0.4;

  return (
    <div className={`relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden transition-colors duration-500 bg-transparent ${
      isDark 
        ? 'text-neutral-100 selection:bg-teal-500/20 selection:text-teal-200' 
        : 'text-neutral-900 selection:bg-teal-500/20 selection:text-teal-900'
    }`}>
      {/* Cool Autumn Atmosphere & Falling Orange Leaves Engine */}
      <InteractiveBackground />

      {/* Floating Top Header: Sanctuary Ambience Volume, Skip Transition & Theme Switcher */}
      <div className="absolute top-6 right-6 z-30 flex items-center gap-2 sm:gap-2.5">
        {/* Skip Intro / Play Intro Mode Switcher */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleToggleSkipTransition}
          title={skipTransition ? "Replay slow poetic transition" : "Skip all transitions and view app immediately"}
          id="skip-transition-btn"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-medium tracking-wide transition-all duration-300 cursor-pointer ${
            skipTransition
              ? isDark
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-[0_4px_15px_rgba(20,184,166,0.15)]'
                : 'bg-teal-100 text-teal-900 border-teal-300 shadow-[0_4px_12px_rgba(13,148,136,0.1)]'
              : isDark
              ? 'bg-neutral-900/80 text-neutral-300 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.5)] hover:bg-neutral-800 hover:text-teal-300'
              : 'bg-white/90 text-neutral-700 border-black/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_8px_20px_rgba(0,0,0,0.06)] hover:bg-neutral-50 hover:text-teal-800'
          }`}
        >
          {skipTransition ? (
            <>
              <RotateCw className="w-3.5 h-3.5 text-teal-500" />
              <span className="hidden sm:inline">Play Intro</span>
            </>
          ) : (
            <>
              <FastForward className="w-3.5 h-3.5 text-teal-500" />
              <span>Skip Intro</span>
            </>
          )}
        </motion.button>

        {/* Sanctuary Ambience Controller with Volume Slider */}
        <SanctuaryAmbienceControl />

        {/* Light / Dark Mode floating quick switcher */}
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

      {/* Main Centered Content */}
      <motion.div
        initial={skipTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: skipTransition ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-2xl mx-auto text-center flex flex-col items-center space-y-6"
      >
        {/* Monogram / Logo Mark */}
        <motion.div
          whileHover={{ scale: 1.05, rotate: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          id="landing-logo"
          className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            isDark
              ? 'bg-gradient-to-br from-teal-500/20 via-neutral-900 to-neutral-950 border border-teal-500/30 shadow-[0_8px_25px_rgba(20,184,166,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]'
              : 'bg-gradient-to-br from-teal-50 via-white to-teal-100/60 border border-teal-500/30 shadow-[0_8px_20px_rgba(13,148,136,0.15),inset_0_1px_0_rgba(255,255,255,1)]'
          }`}
        >
          <span className={`font-serif text-3xl sm:text-4xl font-bold tracking-wider ${
            isDark ? 'text-teal-300' : 'text-teal-700'
          }`}>
            R
          </span>
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-teal-400 rounded-full animate-pulse shadow-md shadow-teal-400/50" />
        </motion.div>

        {/* App Title */}
        <h1
          id="landing-title"
          className={`font-serif text-4xl sm:text-5xl md:text-6xl font-medium tracking-tight -mt-1 ${
            isDark ? 'text-neutral-50' : 'text-neutral-900'
          }`}
        >
          Reflecta
        </h1>

        {/* Italic Tagline */}
        <p
          id="landing-tagline"
          className={`font-serif text-2xl sm:text-3xl italic font-normal tracking-normal -mt-2 ${
            isDark ? 'text-teal-300/90 sm:text-teal-200/95' : 'text-teal-800 sm:text-teal-900'
          }`}
        >
          A place for every thought. A moment for yourself.
        </p>

        {/* Word-by-Word Left-to-Right Slow Flowing Poem */}
        <div className="w-full max-w-xl mx-auto space-y-5 text-center px-2 py-2">
          {/* Stanza 1 */}
          <div className="space-y-2 sm:space-y-2.5">
            {renderedStanza1.map((lineObj, lineIdx) => (
              <div
                key={`st1-line-${lineIdx}`}
                className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5"
              >
                {lineObj.wordsWithDelays.map((item, wordIdx) => (
                  <motion.span
                    key={`st1-w-${lineIdx}-${wordIdx}-${skipTransition ? 'instant' : 'flow'}`}
                    initial={skipTransition ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: -14, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    transition={{
                      duration: skipTransition ? 0 : 0.65,
                      delay: item.delay,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    className={`inline-block text-sm sm:text-base font-light tracking-wide ${
                      isDark ? 'text-neutral-200' : 'text-neutral-800'
                    }`}
                  >
                    {item.word}
                  </motion.span>
                ))}
              </div>
            ))}
          </div>

          {/* Stanza 2 */}
          <div className="space-y-2 sm:space-y-2.5 pt-1.5">
            {renderedStanza2.map((lineObj, lineIdx) => (
              <div
                key={`st2-line-${lineIdx}`}
                className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5"
              >
                {lineObj.wordsWithDelays.map((item, wordIdx) => (
                  <motion.span
                    key={`st2-w-${lineIdx}-${wordIdx}-${skipTransition ? 'instant' : 'flow'}`}
                    initial={skipTransition ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: -14, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    transition={{
                      duration: skipTransition ? 0 : 0.65,
                      delay: item.delay,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    className={`inline-block text-sm sm:text-base tracking-wide ${
                      lineObj.isAccent
                        ? isDark
                          ? 'text-teal-300 font-normal'
                          : 'text-teal-900 font-medium'
                        : isDark
                          ? 'text-neutral-200 font-light'
                          : 'text-neutral-800 font-light'
                    }`}
                  >
                    {item.word}
                  </motion.span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Core Statement Appearing after poem completes */}
        <motion.p
          initial={skipTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: skipTransition ? 0.1 : 0.7, delay: finalStatementDelay }}
          id="landing-statement"
          className={`text-base sm:text-lg font-medium tracking-wide pt-1 ${
            isDark ? 'text-teal-300' : 'text-teal-800 font-semibold'
          }`}
        >
          Write freely. Talk naturally. Reflect deeply.
        </motion.p>

        {/* Pill / Badge */}
        <motion.div
          initial={skipTransition ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: skipTransition ? 0.1 : 0.6, delay: skipTransition ? 0 : finalStatementDelay + 0.2 }}
          whileHover={{ scale: 1.05 }}
          id="landing-pill"
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all ${
            isDark
              ? 'bg-teal-500/10 border border-teal-500/25 text-teal-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_8px_rgba(20,184,166,0.1)]'
              : 'bg-teal-50 border border-teal-300 text-teal-800 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_6px_rgba(13,148,136,0.08)]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-500" />
          <span>Think. Reflect. Grow.</span>
        </motion.div>

        {/* Action Card with Apple-Grade Skeuomorphic Depth */}
        <motion.div
          initial={skipTransition ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: skipTransition ? 0.15 : 0.7, delay: skipTransition ? 0 : finalStatementDelay + 0.3 }}
          whileHover={{ y: -2 }}
          id="landing-auth-card"
          className={`w-full max-w-md mt-4 p-6 sm:p-7 rounded-3xl backdrop-blur-2xl transition-all duration-300 space-y-4 ${
            isDark
              ? 'bg-neutral-900/80 border border-white/[0.12] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.14)]'
              : 'bg-white/90 border border-black/[0.08] shadow-[0_25px_50px_-15px_rgba(13,148,136,0.12),inset_0_1px_0_rgba(255,255,255,1)]'
          }`}
        >
          {/* Primary CTA Button with Skeuomorphic Tactile Sheen */}
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.98, y: 1 }}
            id="landing-google-signin-btn"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full group relative flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 via-teal-600 to-emerald-700 hover:from-teal-500 hover:to-emerald-600 text-white font-semibold text-sm sm:text-base shadow-[0_10px_25px_-5px_rgba(13,148,136,0.4),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)] transition-all duration-200 cursor-pointer disabled:opacity-50"
          >
            {/* Google G Logo Badge */}
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-1 shadow-[0_1px_3px_rgba(0,0,0,0.15)] shrink-0">
              <svg className="w-full h-full" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>

            <span>{isLoading ? 'Connecting...' : 'Start Reflecting with Google'}</span>
            <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
          </motion.button>

          {/* Privacy Note with Lock Icon */}
          <div
            id="landing-privacy-note"
            className={`flex items-center justify-center gap-2 text-xs font-light ${
              isDark ? 'text-neutral-400' : 'text-neutral-500'
            }`}
          >
            <Lock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-teal-400/90' : 'text-teal-700'}`} />
            <span>Your personal sanctuary. Safe, confidential, and always just for you.</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Enterprise-Grade Floating Status Dock / Toast for Auth Feedback */}
      <AnimatePresence>
        {authNotice && (
          <motion.aside
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl"
          >
            <div
              className={`relative overflow-hidden rounded-2xl p-3.5 sm:p-4 border backdrop-blur-2xl transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.45)] ${
                authNotice.type === 'cancelled'
                  ? isDark
                    ? 'bg-neutral-900/90 border-teal-500/30 text-teal-100'
                    : 'bg-white/95 border-teal-500/40 text-teal-950 shadow-teal-950/10'
                  : authNotice.type === 'blocked'
                  ? isDark
                    ? 'bg-neutral-900/90 border-rose-500/30 text-rose-100'
                    : 'bg-white/95 border-rose-500/40 text-rose-950 shadow-rose-950/10'
                  : isDark
                  ? 'bg-neutral-900/90 border-neutral-700/60 text-neutral-200'
                  : 'bg-white/95 border-neutral-300 text-neutral-900 shadow-neutral-900/10'
              }`}
            >
              {/* Subtle top accent highlight line */}
              <div
                className={`absolute top-0 left-0 right-0 h-[2px] ${
                  authNotice.type === 'cancelled'
                    ? 'bg-gradient-to-r from-transparent via-teal-400 to-transparent'
                    : authNotice.type === 'blocked'
                    ? 'bg-gradient-to-r from-transparent via-rose-400 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-sky-400 to-transparent'
                }`}
              />

              <div className="flex items-center justify-between gap-3 sm:gap-4">
                {/* Left: Icon & Text Summary */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      authNotice.type === 'cancelled'
                        ? isDark ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-100 text-teal-700'
                        : authNotice.type === 'blocked'
                        ? isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700'
                        : isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {authNotice.type === 'cancelled' ? (
                      <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : authNotice.type === 'blocked' ? (
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs sm:text-sm tracking-tight leading-tight">
                        {authNotice.title}
                      </span>
                    </div>
                    <p
                      className={`text-xs sm:text-[13px] leading-relaxed mt-0.5 line-clamp-1 sm:line-clamp-2 ${
                        isDark ? 'text-neutral-300/85' : 'text-neutral-600'
                      }`}
                    >
                      {authNotice.type === 'cancelled'
                        ? 'Identity window closed. No credentials or session changes were committed.'
                        : authNotice.message}
                    </p>
                  </div>
                </div>

                {/* Right: Quick Enterprise Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={onSignIn}
                    disabled={isLoading}
                    title="Retry Google Sign-In"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm cursor-pointer ${
                      isDark
                        ? 'bg-teal-600 text-white hover:bg-teal-500'
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isLoading ? 'Connecting...' : 'Try Again'}</span>
                  </button>

                  {onClearNotice && (
                    <button
                      onClick={onClearNotice}
                      aria-label="Dismiss notification"
                      className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                        isDark
                          ? 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
                          : 'text-neutral-500 hover:text-neutral-900 hover:bg-black/5'
                      }`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
};
