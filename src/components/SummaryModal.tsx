import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  Layers, 
  Check, 
  Copy, 
  HelpCircle, 
  ArrowRight, 
  Lightbulb
} from 'lucide-react';
import { ConversationSummary } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SummaryModalProps {
  summary: ConversationSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveToVault?: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  summary,
  isOpen,
  onClose
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [copied, setCopied] = useState(false);

  if (!isOpen || !summary) return null;

  const handleCopyFormatted = () => {
    const text = `
# Reflection Summary: ${summary.title}

## Main Themes
${summary.mainThemes.map(t => `- ${t}`).join('\n')}

## Important Thoughts
${summary.importantThoughts.map(t => `> "${t}"`).join('\n\n')}

## Key Insights
${summary.keyInsights.map(i => `* ${i}`).join('\n')}

## Lingering Reflective Questions
${summary.reflectiveQuestions.map(q => `? ${q}`).join('\n')}

## Suggested Next Steps
${summary.suggestedNextSteps.map(s => `→ ${s}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6 sm:p-8 space-y-6 backdrop-blur-2xl transition-all ${
            isDark
              ? 'bg-neutral-900/90 border-white/[0.1] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)] text-neutral-100'
              : 'bg-white/95 border-black/[0.08] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,1)] text-neutral-900'
          }`}
        >
          {/* Header */}
          <div className={`flex items-start justify-between gap-4 pb-4 border-b ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl border ${
                isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}>
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className={`text-[11px] font-mono uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  Distilled Reflection Summary
                </span>
                <h3 className={`font-serif text-2xl font-semibold ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  {summary.title}
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isDark ? 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Themes Pills */}
          <div>
            <h4 className={`text-xs font-mono uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
              isDark ? 'text-neutral-400' : 'text-neutral-500'
            }`}>
              <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span>Core Themes</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {summary.mainThemes.map((theme, i) => (
                <span
                  key={i}
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    isDark
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>

          {/* Key Insights Bento */}
          <div className={`p-5 rounded-2xl border space-y-3 ${
            isDark
              ? 'bg-neutral-950/60 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
              : 'bg-amber-50/40 border-amber-200/50 shadow-2xs'
          }`}>
            <h4 className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 ${
              isDark ? 'text-amber-400' : 'text-amber-700'
            }`}>
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Key Breakthroughs & Insights</span>
            </h4>
            <ul className={`space-y-2 text-sm ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}>
              {summary.keyInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className={`font-bold mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Important Thoughts */}
          <div className="space-y-2">
            <h4 className={`text-xs font-mono uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Significant Thoughts Expressed
            </h4>
            <div className="space-y-2">
              {summary.importantThoughts.map((thought, idx) => (
                <blockquote
                  key={idx}
                  className={`p-3 rounded-xl border-l-2 border-emerald-500 text-xs italic ${
                    isDark ? 'bg-neutral-800/50 text-neutral-300' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  "{thought}"
                </blockquote>
              ))}
            </div>
          </div>

          {/* Lingering Questions */}
          <div className={`p-5 rounded-2xl border space-y-2.5 ${
            isDark
              ? 'bg-purple-950/20 border-purple-500/20 text-purple-200/90'
              : 'bg-purple-50 border-purple-200 text-purple-900'
          }`}>
            <h4 className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 ${
              isDark ? 'text-purple-400' : 'text-purple-700'
            }`}>
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Questions to Carry Forward</span>
            </h4>
            <ul className="space-y-2 text-xs font-serif italic">
              {summary.reflectiveQuestions.map((q, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className={`font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>?</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested Next Steps */}
          <div className="space-y-2">
            <h4 className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 ${
              isDark ? 'text-cyan-400' : 'text-cyan-700'
            }`}>
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Mindful Micro-Steps</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {summary.suggestedNextSteps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    isDark
                      ? 'bg-neutral-950/40 border-white/[0.06] text-neutral-300'
                      : 'bg-neutral-50 border-black/[0.06] text-neutral-800'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDark ? 'bg-cyan-400' : 'bg-cyan-600'}`} />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleCopyFormatted}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                isDark
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08]'
                  : 'bg-white hover:bg-neutral-50 text-neutral-800 border-black/[0.08] shadow-2xs'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Markdown</span>
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 text-xs font-semibold shadow-[0_4px_14px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all cursor-pointer"
            >
              Done
            </motion.button>
          </div>

        </motion.div>

      </div>
    </AnimatePresence>
  );
};
