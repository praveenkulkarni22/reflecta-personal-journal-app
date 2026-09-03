import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Compass, 
  Sparkles, 
  RefreshCw, 
  Layers, 
  Heart, 
  Activity, 
  Feather, 
  Quote, 
  Printer, 
  X,
  TrendingUp
} from 'lucide-react';
import { InnerLandscapeSynthesis, JournalEntry } from '../types';
import { useTheme } from '../context/ThemeContext';

interface InnerLandscapeModalProps {
  synthesis: InnerLandscapeSynthesis | null;
  entries: JournalEntry[];
  onSynthesize: () => Promise<void>;
  isSynthesizing: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export const InnerLandscapeModal: React.FC<InnerLandscapeModalProps> = ({
  synthesis,
  entries,
  onSynthesize,
  isSynthesizing,
  isOpen,
  onClose
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'pillars' | 'emotions' | 'growth'>('pillars');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
      
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={`relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border p-6 sm:p-10 space-y-8 backdrop-blur-2xl transition-all ${
          isDark
            ? 'bg-neutral-900/90 border-white/[0.1] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)] text-neutral-100'
            : 'bg-white/95 border-black/[0.08] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)] text-neutral-900'
        }`}
      >
        
        {/* Header */}
        <div className={`flex items-start justify-between gap-4 pb-6 border-b ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg ${
              isDark
                ? 'bg-gradient-to-br from-emerald-400/20 to-neutral-900 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
                : 'bg-gradient-to-br from-emerald-100 to-white border-emerald-300 text-emerald-700 shadow-sm'
            }`}>
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-mono uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  Original Enhancement
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  Longitudinal Synthesizer
                </span>
              </div>
              <h2 className={`font-serif text-2xl sm:text-3xl font-medium ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                Your Inner Landscape
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-white/[0.08]'
                  : 'bg-neutral-100 hover:bg-white text-neutral-700 border-black/[0.08]'
              }`}
              title="Print / Save Keepsake PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Keepsake</span>
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

        {/* Action Trigger Banner */}
        <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl ${
          isDark
            ? 'bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-neutral-950 border-emerald-500/20'
            : 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50/50 border-emerald-200'
        }`}>
          <div className="text-left">
            <p className={`text-xs font-semibold mb-1 flex items-center gap-1.5 ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
              <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span>Cross-Reflection Synthesis Engine</span>
            </p>
            <p className={`text-xs max-w-lg ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {entries.length > 0
                ? `Synthesizing patterns, themes, and emotional cadence across your ${entries.length} recorded journal entries.`
                : 'Write at least one reflection to synthesize your longitudinal inner landscape.'}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={onSynthesize}
            disabled={isSynthesizing || entries.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-semibold text-xs shadow-[0_4px_14px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] disabled:opacity-40 transition-all cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
            <span>{isSynthesizing ? 'Synthesizing...' : 'Synthesize Landscape'}</span>
          </motion.button>
        </div>

        {/* Synthesis Content */}
        {synthesis ? (
          <div className="space-y-8">
            
            {/* Personal Mantra Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border text-center relative overflow-hidden backdrop-blur-xl ${
              isDark
                ? 'bg-neutral-950/70 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'bg-emerald-50/50 border-emerald-200/60 shadow-2xs'
            }`}>
              <div className="absolute top-0 right-1/2 translate-x-1/2 w-64 h-24 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <span className={`text-[11px] font-mono uppercase tracking-widest block mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                Personalized Grounding Mantra
              </span>
              <blockquote className={`font-serif text-xl sm:text-2xl italic leading-relaxed max-w-2xl mx-auto ${
                isDark ? 'text-neutral-100' : 'text-neutral-900'
              }`}>
                "{synthesis.personalMantra}"
              </blockquote>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className={`flex items-center gap-2 border-b pb-3 ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
              <button
                onClick={() => setActiveTab('pillars')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'pillars'
                    ? isDark
                      ? 'bg-neutral-800 text-emerald-300 border border-white/[0.1]'
                      : 'bg-white text-emerald-700 border border-black/[0.08] shadow-2xs'
                    : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Core Life Pillars</span>
              </button>

              <button
                onClick={() => setActiveTab('emotions')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'emotions'
                    ? isDark
                      ? 'bg-neutral-800 text-emerald-300 border border-white/[0.1]'
                      : 'bg-white text-emerald-700 border border-black/[0.08] shadow-2xs'
                    : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Emotional Cadence</span>
              </button>

              <button
                onClick={() => setActiveTab('growth')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  activeTab === 'growth'
                    ? isDark
                      ? 'bg-neutral-800 text-emerald-300 border border-white/[0.1]'
                      : 'bg-white text-emerald-700 border border-black/[0.08] shadow-2xs'
                    : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Growth Vectors</span>
              </button>
            </div>

            {/* TAB 1: Core Pillars */}
            {activeTab === 'pillars' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {synthesis.corePillars.map((pillar, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ y: -2 }}
                    className={`p-5 rounded-2xl border transition-all space-y-3 backdrop-blur-xl ${
                      isDark
                        ? 'bg-neutral-950/50 border-white/[0.08] hover:border-emerald-500/30'
                        : 'bg-white border-black/[0.06] hover:border-emerald-500/30 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className={`font-serif text-lg font-semibold ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                        {pillar.theme}
                      </h4>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                        isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      }`}>
                        {pillar.frequency}% Resonance
                      </span>
                    </div>

                    <p className={`text-xs leading-relaxed font-light ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                      {pillar.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pillar.keywords.map((kw, kIdx) => (
                        <span
                          key={kIdx}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                            isDark
                              ? 'bg-neutral-900 text-neutral-400 border-white/[0.06]'
                              : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                          }`}
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* TAB 2: Emotional Cadence */}
            {activeTab === 'emotions' && (
              <div className="space-y-3">
                {synthesis.emotionalCadence.map((cad, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border flex items-start justify-between gap-4 backdrop-blur-xl ${
                      isDark
                        ? 'bg-neutral-950/50 border-white/[0.08]'
                        : 'bg-white border-black/[0.06] shadow-2xs'
                    }`}
                  >
                    <div className="space-y-1">
                      <h4 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                        <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`} />
                        <span>{cad.mood}</span>
                      </h4>
                      <p className={`text-xs font-light leading-relaxed ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                        {cad.narrative}
                      </p>
                    </div>
                    <span className={`text-xs font-mono shrink-0 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {cad.frequency}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: Growth Vectors */}
            {activeTab === 'growth' && (
              <div className={`p-6 rounded-2xl border space-y-4 backdrop-blur-xl ${
                isDark
                  ? 'bg-neutral-950/60 border-white/[0.08]'
                  : 'bg-white border-black/[0.06] shadow-2xs'
              }`}>
                <h4 className={`text-xs font-mono uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  Observed Emotional & Cognitive Evolution
                </h4>
                <div className="space-y-3">
                  {synthesis.growthVectors.map((vec, idx) => (
                    <div key={idx} className={`flex items-start gap-3 text-sm ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                        isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        ✓
                      </div>
                      <p className="leading-relaxed font-light">{vec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contemplative Inquiry for the Next Season */}
            <div className={`p-6 rounded-2xl border backdrop-blur-xl ${
              isDark
                ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
                : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}>
              <span className={`text-[11px] font-mono uppercase tracking-widest block mb-1 ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                Contemplative Inquiry for Your Next Season
              </span>
              <p className="font-serif text-lg italic">
                "{synthesis.contemplativeInquiry}"
              </p>
            </div>

          </div>
        ) : (
          <div className={`p-12 text-center space-y-3 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            <Compass className="w-10 h-10 mx-auto opacity-50 animate-pulse" />
            <h3 className={`font-serif text-xl ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
              No Landscape Synthesized Yet
            </h3>
            <p className="text-xs max-w-sm mx-auto">
              Click "Synthesize Landscape" above to reveal the overarching themes and emotional cadence from your entries.
            </p>
          </div>
        )}

      </motion.div>
      
    </div>
  );
};
