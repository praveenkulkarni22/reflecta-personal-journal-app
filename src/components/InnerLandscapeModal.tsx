import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Compass, 
  Sparkles, 
  RefreshCw, 
  Layers, 
  Printer, 
  X,
  TrendingUp,
  Quote
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
  const [activeTab, setActiveTab] = useState<'pillars' | 'growth'>('pillars');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      
      {/* SPIRAL BOUND BOOK DESK CONTAINER */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={`relative w-full max-w-5xl h-[90vh] rounded-3xl transition-all duration-300 border flex flex-col min-h-0 ${
          isDark
            ? 'bg-neutral-950/95 border-white/[0.08] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),2px_2px_0_1px_rgba(255,255,255,0.04)]'
            : 'bg-stone-200/95 border-stone-300/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15),3px_3px_0_rgba(0,0,0,0.04)]'
        } p-2 sm:p-3`}
      >
        
        {/* Notebook Inner Container: Spine on Left + Notebook Page on Right */}
        <div className="relative flex rounded-2xl overflow-hidden border border-black/[0.04] dark:border-white/[0.04] flex-1 min-h-0 w-full">
          
          {/* SPIRAL BINDING SPINE */}
          <div 
            className={`relative w-12 sm:w-16 shrink-0 flex flex-col justify-evenly py-5 z-30 select-none ${
              isDark 
                ? 'bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-800 border-r border-neutral-700/60 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.5)]' 
                : 'bg-gradient-to-r from-stone-300 via-stone-200 to-stone-100 border-r border-stone-300 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.1)]'
            }`}
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="relative w-full h-4 sm:h-5 flex items-center">
                {/* Spiral Wire Loop with Specular Sheen & 3D Shadow */}
                <div 
                  className={`h-2.5 sm:h-3 w-7 sm:w-10 ml-1 sm:ml-2 rounded-full transform -rotate-6 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${
                    isDark
                      ? 'bg-gradient-to-r from-zinc-500 via-neutral-100 to-zinc-600 border-t border-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]'
                      : 'bg-gradient-to-r from-stone-400 via-white to-stone-500 border-t border-white/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]'
                  }`}
                />
                
                {/* Punched hole at the paper seam */}
                <div className={`absolute right-1.5 sm:right-2.5 w-2 sm:w-3 h-2 sm:h-3 rounded-[2px] shadow-inner ${
                  isDark 
                    ? 'bg-black border border-white/[0.08]' 
                    : 'bg-stone-800/90 border border-black/30'
                }`} />
              </div>
            ))}
          </div>

          {/* SPIRAL NOTEBOOK PAPER PAGE */}
          <div 
            className={`relative flex-1 p-3.5 sm:p-6 sm:pl-8 sm:pr-6 transition-colors duration-200 flex flex-col min-h-0 w-full max-w-full overflow-hidden ${
              isDark 
                ? 'bg-[#18181b] text-neutral-100' 
                : 'bg-[#fdfbf7] text-neutral-900'
            }`}
          >
            {/* Perforated tear line on the left of the page */}
            <div className={`absolute top-0 bottom-0 left-0 w-px border-r-2 border-dashed ${
              isDark ? 'border-neutral-700/60' : 'border-stone-300/80'
            }`} />

            {/* Red / Coral Classic Notebook Margin Rule Line */}
            <div className={`absolute top-0 bottom-0 left-3 sm:left-5 w-px ${
              isDark ? 'bg-rose-500/20' : 'bg-rose-400/40'
            }`} />

            {/* Ruled lines texture */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
              style={{
                backgroundImage: isDark
                  ? 'repeating-linear-gradient(to bottom, transparent, transparent 29px, rgba(255,255,255,0.06) 29px, rgba(255,255,255,0.06) 30px)'
                  : 'repeating-linear-gradient(to bottom, transparent, transparent 29px, rgba(0,0,0,0.06) 29px, rgba(0,0,0,0.06) 30px)'
              }}
            />

            {/* Scrollable Page Content */}
            <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-y-auto pr-1 sm:pr-2 space-y-5">
              
              {/* Header */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-xs shrink-0 ${
                    isDark
                      ? 'bg-neutral-900/90 border-[#67C3DE]/30 text-[#67C3DE]'
                      : 'bg-white border-[#67C3DE]/40 text-[#083847] shadow-xs'
                  }`}>
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                        isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                      }`}>
                        Longitudinal Mindspace
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                        isDark ? 'bg-[#67C3DE]/15 text-[#67C3DE] border-[#67C3DE]/30' : 'bg-[#67C3DE]/20 text-[#083847] border-[#67C3DE]/40'
                      }`}>
                        {entries.length} Reflections
                      </span>
                    </div>
                    <h2 className={`font-serif text-xl sm:text-2xl font-medium tracking-tight ${
                      isDark ? 'text-neutral-100' : 'text-neutral-900'
                    }`}>
                      Your Inner Landscape
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border-white/[0.08]'
                        : 'bg-white hover:bg-neutral-50 text-neutral-700 border-black/[0.08] shadow-2xs'
                    }`}
                    title="Print / Save Keepsake PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Keepsake</span>
                  </button>

                  <button
                    onClick={onClose}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      isDark ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-stone-200/60'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Action Trigger Banner */}
              <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isDark
                  ? 'bg-neutral-900/60 border-white/[0.08]'
                  : 'bg-white/80 border-stone-200/90 shadow-2xs'
              }`}>
                <div className="text-left space-y-0.5">
                  <p className={`text-xs font-semibold flex items-center gap-1.5 ${
                    isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                  }`}>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Synthesis Engine</span>
                  </p>
                  <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {entries.length > 0
                      ? `Distills recurring psychological themes, core life anchors, and growth vectors across your entries.`
                      : 'Record reflections in your journal to synthesize your longitudinal inner landscape.'}
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onSynthesize}
                  disabled={isSynthesizing || entries.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#67C3DE] to-[#38a3c4] hover:brightness-105 text-[#042029] font-semibold text-xs shadow-xs disabled:opacity-40 transition-all cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
                  <span>{isSynthesizing ? 'Synthesizing...' : 'Synthesize Landscape'}</span>
                </motion.button>
              </div>

              {/* Synthesis Content */}
              {synthesis ? (
                <div className="space-y-6 pb-6">
                  
                  {/* Personal Mantra Banner */}
                  <div className={`p-5 sm:p-7 rounded-2xl border text-center relative overflow-hidden ${
                    isDark
                      ? 'bg-neutral-900/80 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'bg-gradient-to-br from-white via-[#fcfbf9] to-[#f4f0e8] border-stone-300/80 shadow-xs'
                  }`}>
                    <div className="absolute top-2 left-3 opacity-15">
                      <Quote className="w-8 h-8" />
                    </div>
                    <span className={`text-[11px] font-mono uppercase tracking-widest block mb-2 font-semibold ${
                      isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                    }`}>
                      Personal Grounding Mantra
                    </span>
                    <blockquote className={`font-serif text-lg sm:text-2xl italic leading-relaxed max-w-2xl mx-auto ${
                      isDark ? 'text-neutral-100' : 'text-neutral-900'
                    }`}>
                      "{synthesis.personalMantra}"
                    </blockquote>
                  </div>

                  {/* Sub-Navigation Tabs */}
                  <div className={`flex items-center gap-2 border-b pb-2.5 ${isDark ? 'border-white/[0.08]' : 'border-stone-200'}`}>
                    <button
                      onClick={() => setActiveTab('pillars')}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        activeTab === 'pillars'
                          ? isDark
                            ? 'bg-neutral-800 text-[#67C3DE] border border-white/[0.1]'
                            : 'bg-white text-[#083847] border border-stone-300 shadow-2xs font-semibold'
                          : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Core Life Pillars</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('growth')}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        activeTab === 'growth'
                          ? isDark
                            ? 'bg-neutral-800 text-[#67C3DE] border border-white/[0.1]'
                            : 'bg-white text-[#083847] border border-stone-300 shadow-2xs font-semibold'
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
                          className={`p-5 rounded-2xl border transition-all space-y-3 ${
                            isDark
                              ? 'bg-neutral-900/70 border-white/[0.08] hover:border-[#67C3DE]/40'
                              : 'bg-white border-stone-200/90 hover:border-[#67C3DE]/60 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className={`font-serif text-base sm:text-lg font-semibold ${
                              isDark ? 'text-neutral-100' : 'text-neutral-900'
                            }`}>
                              {pillar.theme}
                            </h4>
                            <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                              isDark 
                                ? 'text-[#67C3DE] bg-[#67C3DE]/10 border-[#67C3DE]/30' 
                                : 'text-[#083847] bg-[#67C3DE]/20 border-[#67C3DE]/40 font-semibold'
                            }`}>
                              {pillar.frequency}% Resonance
                            </span>
                          </div>

                          <p className={`text-xs leading-relaxed font-light ${
                            isDark ? 'text-neutral-300' : 'text-neutral-700'
                          }`}>
                            {pillar.description}
                          </p>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {pillar.keywords.map((kw, kIdx) => (
                              <span
                                key={kIdx}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-mono border ${
                                  isDark
                                    ? 'bg-neutral-950 text-neutral-400 border-white/[0.06]'
                                    : 'bg-stone-100 text-stone-700 border-stone-200'
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

                  {/* TAB 2: Growth Vectors */}
                  {activeTab === 'growth' && (
                    <div className={`p-5 sm:p-6 rounded-2xl border space-y-4 ${
                      isDark
                        ? 'bg-neutral-900/70 border-white/[0.08]'
                        : 'bg-white border-stone-200/90 shadow-2xs'
                    }`}>
                      <h4 className={`text-xs font-mono uppercase tracking-wider font-semibold ${
                        isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                      }`}>
                        Observed Emotional & Cognitive Evolution
                      </h4>
                      <div className="space-y-3">
                        {synthesis.growthVectors.map((vec, idx) => (
                          <div key={idx} className={`flex items-start gap-3 text-sm ${
                            isDark ? 'text-neutral-200' : 'text-neutral-800'
                          }`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                              isDark ? 'bg-[#67C3DE]/20 text-[#67C3DE]' : 'bg-[#67C3DE]/30 text-[#083847]'
                            }`}>
                              ✓
                            </div>
                            <p className="leading-relaxed font-light text-xs sm:text-sm">{vec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contemplative Inquiry for the Next Season */}
                  <div className={`p-5 sm:p-6 rounded-2xl border ${
                    isDark
                      ? 'bg-neutral-900/60 border-white/[0.08] text-neutral-200'
                      : 'bg-white border-stone-200/90 text-neutral-900 shadow-2xs'
                  }`}>
                    <span className={`text-[11px] font-mono uppercase tracking-widest block mb-1 font-semibold ${
                      isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                    }`}>
                      Contemplative Inquiry for Your Next Season
                    </span>
                    <p className="font-serif text-base sm:text-lg italic">
                      "{synthesis.contemplativeInquiry}"
                    </p>
                  </div>

                </div>
              ) : (
                <div className={`p-12 text-center space-y-3 my-auto ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  <Compass className="w-10 h-10 mx-auto opacity-50 animate-pulse" />
                  <h3 className={`font-serif text-xl ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
                    No Landscape Synthesized Yet
                  </h3>
                  <p className="text-xs max-w-sm mx-auto">
                    Click "Synthesize Landscape" above to reveal the overarching core pillars and growth vectors distilled from your reflections.
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>

      </motion.div>
      
    </div>
  );
};
