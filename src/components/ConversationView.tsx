import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Sparkles, 
  User, 
  Copy, 
  Check, 
  RotateCcw, 
  Brain, 
  Lightbulb, 
  Layers, 
  Feather, 
  ArrowLeft,
  Quote,
  Shield,
  HelpCircle
} from 'lucide-react';
import { ConversationMessage, ConversationSummary } from '../types';
import { useTheme } from '../context/ThemeContext';

interface ConversationViewProps {
  messages: ConversationMessage[];
  onSendMessage: (msg: string, mode: string) => Promise<void>;
  onSummarize: () => void;
  onBackToJournal: () => void;
  isGenerating: boolean;
  modelUsed?: string;
  conversationTitle?: string;
  error?: string | null;
  onRetryLast?: () => void;
}

const CONVERSATION_MODES = [
  { id: 'reflect', label: 'Empathetic Sanctuary', icon: Feather, color: 'text-emerald-500' },
  { id: 'socratic', label: 'Socratic Inquiry', icon: Brain, color: 'text-purple-500' },
  { id: 'brainstorm', label: 'Creative Divergence', icon: Lightbulb, color: 'text-amber-500' },
  { id: 'unpack', label: 'Unpack Friction', icon: HelpCircle, color: 'text-cyan-500' },
];

const SUGGESTED_FOLLOWUPS = [
  "Can you help me explore why this triggered me?",
  "What is another perspective I might be missing?",
  "How can I set a healthy boundary here?",
  "What question should I be asking myself right now?",
  "Help me break this down into one small step."
];

export const ConversationView: React.FC<ConversationViewProps> = ({
  messages,
  onSendMessage,
  onSummarize,
  onBackToJournal,
  isGenerating,
  modelUsed,
  conversationTitle,
  error,
  onRetryLast
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [inputText, setInputText] = useState('');
  const [activeMode, setActiveMode] = useState('reflect');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isGenerating) return;
    const text = inputText;
    setInputText('');
    await onSendMessage(text, activeMode);
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (isGenerating) return;
    await onSendMessage(prompt, activeMode);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-140px)] min-h-[550px]"
    >
      
      {/* Top Header Strip with Layered Depth */}
      <div className={`p-4 rounded-2xl border transition-all duration-300 backdrop-blur-2xl flex flex-wrap items-center justify-between gap-3 mb-3.5 ${
        isDark
          ? 'bg-neutral-900/80 border-white/[0.09] shadow-[0_12px_30px_-8px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)]'
          : 'bg-white/85 border-black/[0.06] shadow-[0_12px_30px_-8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
      }`}>
        
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onBackToJournal}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-white/[0.08]'
                : 'bg-neutral-100 hover:bg-white text-neutral-700 border-black/[0.08]'
            }`}
            title="Back to Journal Canvas"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
          <div>
            <h2 className={`font-serif text-lg font-medium truncate max-w-xs sm:max-w-md ${
              isDark ? 'text-neutral-100' : 'text-neutral-900'
            }`}>
              {conversationTitle || 'Reflection Dialogue'}
            </h2>
            <div className={`flex items-center gap-2 text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              <span className={`flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                <Shield className="w-3 h-3" />
                <span>Isolated Multi-Turn Vault</span>
              </span>
              {modelUsed && (
                <span>
                  • Engine: <strong className="font-semibold">{modelUsed}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onSummarize}
            disabled={messages.length < 2 || isGenerating}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-40 cursor-pointer ${
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'bg-white hover:bg-neutral-50 text-neutral-800 border-black/[0.08] shadow-sm'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span>Distill Summary</span>
          </motion.button>
        </div>

      </div>

      {/* Mode Selector Strip */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
        <span className={`text-[10px] font-mono uppercase tracking-wider shrink-0 mr-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
          Companion Lens:
        </span>
        {CONVERSATION_MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? isDark
                    ? 'bg-neutral-100 text-neutral-950 font-semibold shadow-sm'
                    : 'bg-neutral-900 text-neutral-50 font-semibold shadow-sm'
                  : isDark
                    ? 'bg-neutral-900/70 text-neutral-400 border border-white/[0.06] hover:text-neutral-200'
                    : 'bg-white text-neutral-600 border border-black/[0.06] hover:text-neutral-900 shadow-2xs'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? (isDark ? 'text-neutral-950' : 'text-white') : mode.color}`} />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Message Stream Area */}
      <div className={`flex-1 overflow-y-auto pr-2 space-y-4 rounded-3xl p-4 sm:p-6 border transition-all duration-300 backdrop-blur-2xl ${
        isDark
          ? 'bg-neutral-900/60 border-white/[0.08] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]'
          : 'bg-white/70 border-black/[0.06] shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]'
      }`}>
        
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}>
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className={`font-serif text-xl mb-1 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                Your reflection space is open
              </h3>
              <p className={`text-xs max-w-sm mx-auto ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Share a thought, a feeling, or ask Reflecta to unpack what is present with you right now.
              </p>
            </div>

            {/* Quick Starter Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-md pt-2">
              {SUGGESTED_FOLLOWUPS.slice(0, 3).map((prompt, idx) => (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  key={idx}
                  onClick={() => handleQuickPrompt(prompt)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all text-left cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900 border-white/[0.08] hover:border-emerald-500/40 text-neutral-300 hover:text-emerald-300 shadow-2xs'
                      : 'bg-white border-black/[0.08] hover:border-emerald-500/40 text-neutral-700 hover:text-emerald-700 shadow-2xs'
                  }`}
                >
                  "{prompt}"
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              key={msg.id}
              className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isDark
                    ? 'bg-gradient-to-br from-emerald-500/20 to-neutral-900 border-emerald-500/30 text-emerald-400 shadow-[0_2px_8px_rgba(16,185,129,0.2)]'
                    : 'bg-gradient-to-br from-emerald-100 to-white border-emerald-300 text-emerald-700 shadow-sm'
                }`}>
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div
                className={`relative max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 sm:p-5 shadow-lg group border transition-all ${
                  isUser
                    ? isDark
                      ? 'bg-gradient-to-br from-neutral-800 to-neutral-800/90 text-neutral-100 border-white/[0.1] rounded-tr-none shadow-[0_4px_14px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]'
                      : 'bg-gradient-to-br from-neutral-900 to-neutral-800 text-white border-neutral-800 rounded-tr-none shadow-[0_4px_14px_rgba(0,0,0,0.15)]'
                    : isDark
                      ? 'bg-neutral-900/85 text-neutral-200 border-white/[0.08] rounded-tl-none shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'bg-white/90 text-neutral-800 border-black/[0.06] rounded-tl-none shadow-[0_4px_14px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]'
                }`}
              >
                {/* Role / Lens Marker */}
                <div className={`flex items-center justify-between gap-4 mb-1.5 text-[11px] font-mono ${
                  isUser ? (isDark ? 'text-neutral-400' : 'text-neutral-300') : (isDark ? 'text-neutral-400' : 'text-neutral-500')
                }`}>
                  <span className="font-semibold">{isUser ? 'You' : 'Reflecta'}</span>
                  
                  {!isUser && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-neutral-800/50 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="markdown-body text-sm leading-[1.75]">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>

              {isUser && (
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isDark
                    ? 'bg-neutral-800 border-white/[0.1] text-neutral-300 shadow-sm'
                    : 'bg-neutral-200 border-neutral-300 text-neutral-700 shadow-sm'
                }`}>
                  <User className="w-4 h-4" />
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Loading Pulsing State */}
        {isGenerating && (
          <div className="flex gap-3 items-start justify-start">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 animate-pulse border ${
              isDark ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-100 border-emerald-300 text-emerald-700'
            }`}>
              <Sparkles className="w-4 h-4 animate-spin-slow" />
            </div>
            <div className={`p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-3 border ${
              isDark ? 'bg-neutral-900/90 border-emerald-500/30 text-neutral-200' : 'bg-white border-emerald-300 text-neutral-800 shadow-sm'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Reflecting with deep presence...</span>
            </div>
          </div>
        )}

        {/* Error State with Retry */}
        {error && (
          <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            isDark
              ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <span>{error}</span>
            {onRetryLast && (
              <button
                onClick={onRetryLast}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Followup Question Chips */}
      {messages.length > 0 && !isGenerating && (
        <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none">
          <span className={`text-[10px] font-mono shrink-0 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Suggestions:
          </span>
          {SUGGESTED_FOLLOWUPS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickPrompt(prompt)}
              className={`px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap transition-all cursor-pointer ${
                isDark
                  ? 'bg-neutral-900/80 border-white/[0.06] hover:border-emerald-500/30 text-neutral-400 hover:text-emerald-300'
                  : 'bg-white border-black/[0.06] hover:border-emerald-500/40 text-neutral-600 hover:text-emerald-700 shadow-2xs'
              }`}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Message Input Box with Apple-Grade Skeuomorphic Inset Depth */}
      <form onSubmit={handleSubmit} className="relative mt-1.5">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Speak your mind, ask a question, or explore further..."
          disabled={isGenerating}
          maxLength={4000}
          className={`w-full pl-5 pr-14 py-4 rounded-2xl text-sm outline-none transition-all ${
            isDark
              ? 'bg-neutral-900/90 border border-white/[0.09] focus:border-emerald-500/60 text-neutral-100 placeholder:text-neutral-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_10px_25px_-5px_rgba(0,0,0,0.7)]'
              : 'bg-white border border-black/[0.08] focus:border-emerald-500/60 text-neutral-900 placeholder:text-neutral-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_10px_25px_-5px_rgba(0,0,0,0.06)]'
          }`}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          type="submit"
          disabled={!inputText.trim() || isGenerating}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 shadow-[0_4px_12px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] disabled:opacity-30 transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </form>

    </motion.div>
  );
};
