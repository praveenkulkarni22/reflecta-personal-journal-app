import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, X, ArrowRight } from 'lucide-react';
import { PromptSpark } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUserToken } from '../lib/firebase';

interface PromptSparkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSpark: (spark: PromptSpark) => void;
}

const DEFAULT_SPARKS: PromptSpark[] = [
  {
    category: 'Quiet Inventory',
    title: 'What Am I Holding?',
    prompt: 'If you could put down one invisible backpack of pressure or expectation right now, what is inside it?',
    subtext: 'Name the expectation, fear, or unvoiced demand with radical honesty.'
  },
  {
    category: 'Sensory Wonder',
    title: 'The Overlooked Moment',
    prompt: 'What was a quiet, unnoticed moment in your day that held a gentle, subtle beauty?',
    subtext: 'Describe the sensory details—a ray of light, a warm cup, a gentle sound.'
  },
  {
    category: 'Compassionate Mirror',
    title: 'The Advice to a Friend',
    prompt: 'If someone you loved deeply came to you with your current dilemma, what soothing words would you offer them?',
    subtext: 'Write in first person as if receiving that grace yourself.'
  },
  {
    category: 'Decision Horizon',
    title: 'The Hidden Intuition',
    prompt: 'Deep down, beneath the pros and cons and analytical noise, what does your gut already know?',
    subtext: 'Explore the truth that feels uncomfortable to say aloud.'
  }
];

export const PromptSparkModal: React.FC<PromptSparkModalProps> = ({
  isOpen,
  onClose,
  onSelectSpark
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [sparks, setSparks] = useState<PromptSpark[]>(DEFAULT_SPARKS);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleFetchNewSparks = async () => {
    setIsGenerating(true);
    try {
      const token = await getCurrentUserToken();
      const res = await fetch('/api/gemini/spark', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ intention: 'deep_reflection', mood: 'curious' })
      });
      const data = await res.json();
      if (data.sparks && data.sparks.length > 0) {
        setSparks(data.sparks);
      }
    } catch (e) {
      console.warn('Failed to fetch new sparks:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={`relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border p-6 sm:p-8 space-y-6 backdrop-blur-2xl transition-all ${
          isDark
            ? 'bg-neutral-900/90 border-white/[0.1] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)] text-neutral-100'
            : 'bg-white/95 border-black/[0.08] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)] text-neutral-900'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${
              isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'
            }`}>
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                Reflective Sparks
              </span>
              <h3 className={`font-serif text-2xl font-semibold ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                Thought Starters
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFetchNewSparks}
              disabled={isGenerating}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-white/[0.08]'
                  : 'bg-neutral-100 hover:bg-white text-neutral-700 border-black/[0.08]'
              }`}
              title="Generate Fresh AI Sparks"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin text-amber-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isDark ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prompt List with Bento Card Depth */}
        <div className="space-y-3">
          {sparks.map((spark, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -2 }}
              onClick={() => {
                onSelectSpark(spark);
                onClose();
              }}
              className={`group p-5 rounded-2xl border transition-all cursor-pointer space-y-2 backdrop-blur-xl ${
                isDark
                  ? 'bg-neutral-950/60 border-white/[0.08] hover:border-amber-500/40 hover:bg-neutral-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                  : 'bg-white/80 border-black/[0.06] hover:border-amber-500/40 hover:bg-amber-50/30 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  {spark.category}
                </span>
                <span className={`text-xs transition-all flex items-center gap-1 font-medium ${
                  isDark ? 'text-neutral-400 group-hover:text-amber-300' : 'text-neutral-500 group-hover:text-amber-700'
                }`}>
                  <span>Write this</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>

              <h4 className={`font-serif text-base font-medium transition-colors ${
                isDark ? 'text-neutral-100 group-hover:text-amber-200' : 'text-neutral-900 group-hover:text-amber-800'
              }`}>
                {spark.title}
              </h4>

              <p className={`text-sm font-light leading-relaxed ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                "{spark.prompt}"
              </p>

              <p className={`text-xs font-mono italic ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {spark.subtext}
              </p>
            </motion.div>
          ))}
        </div>

      </motion.div>

    </div>
  );
};
