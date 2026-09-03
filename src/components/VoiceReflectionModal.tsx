import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  X, 
  Check, 
  RotateCcw, 
  Volume2, 
  Loader2, 
  FileText,
  Radio,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUserToken } from '../lib/firebase';

interface VoiceReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTranscription: (text: string, title?: string) => void;
  currentMood?: string;
  currentIntention?: string;
}

export const VoiceReflectionModal: React.FC<VoiceReflectionModalProps> = ({
  isOpen,
  onClose,
  onApplyTranscription,
  currentMood = 'thoughtful',
  currentIntention = 'free_expression'
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishedResult, setPolishedResult] = useState<{ title?: string; text: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isOpen) {
      stopListening();
      setTranscript('');
      setInterimTranscript('');
      setDuration(0);
      setPolishedResult(null);
      setErrorMsg(null);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Speech recognition is not natively supported in this browser. You can type or use Chrome / Edge / Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let currentFinal = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentFinal += text + ' ';
          } else {
            currentInterim += text;
          }
        }

        if (currentFinal) {
          setTranscript(prev => (prev ? `${prev} ${currentFinal.trim()}` : currentFinal.trim()));
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access was denied. Please allow microphone permissions in your browser address bar.');
        } else if (event.error !== 'no-speech') {
          setErrorMsg(`Voice input notice: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;

      // Auto-start listening on open
      startListening();
    } catch (err: any) {
      setErrorMsg('Could not initialize speech recognition.');
    }

    return () => {
      stopListening();
    };
  }, [isOpen]);

  // Duration Timer
  useEffect(() => {
    if (isListening) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isListening]);

  const startListening = () => {
    setErrorMsg(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        // Recognition might already be running
        setIsListening(true);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleReset = () => {
    stopListening();
    setTranscript('');
    setInterimTranscript('');
    setDuration(0);
    setPolishedResult(null);
    setErrorMsg(null);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  // Polish with Gemini API
  const handlePolishWithGemini = async () => {
    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (!fullText) return;

    stopListening();
    setIsPolishing(true);
    setErrorMsg(null);

    try {
      const token = await getCurrentUserToken();
      const res = await fetch('/api/gemini/voice-reflection', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          speechText: fullText,
          action: 'polish',
          mood: currentMood,
          intention: currentIntention
        })
      });

      if (!res.ok) {
        throw new Error('Could not polish voice reflection');
      }

      const data = await res.json();
      setPolishedResult({
        title: data.suggestedTitle,
        text: data.polishedReflection
      });
    } catch (err: any) {
      setErrorMsg('Gemini polish was unavailable. You can still insert your raw spoken text directly.');
    } finally {
      setIsPolishing(false);
    }
  };

  const handleApplyDirect = () => {
    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (fullText) {
      onApplyTranscription(fullText);
      onClose();
    }
  };

  const handleApplyPolished = () => {
    if (polishedResult) {
      onApplyTranscription(polishedResult.text, polishedResult.title);
      onClose();
    }
  };

  if (!isOpen) return null;

  const activeContent = (transcript + ' ' + interimTranscript).trim();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2 }}
          className={`relative w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
            isDark 
              ? 'bg-neutral-900 border-white/[0.1] text-neutral-100 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]' 
              : 'bg-white border-black/[0.08] text-neutral-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]'
          }`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border transition-colors ${
                isListening
                  ? 'bg-rose-500/20 text-rose-500 border-rose-500/40 animate-pulse'
                  : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
              }`}>
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg sm:text-xl font-medium">Voice Reflection Assistant</h3>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Speak freely — Reflecta transcribes your thoughts in real-time
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isDark 
                  ? 'hover:bg-neutral-800 border-white/[0.08] text-neutral-400 hover:text-white' 
                  : 'hover:bg-neutral-100 border-black/[0.06] text-neutral-500 hover:text-black'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            
            {/* Live Recording Pulsing Graphic & Timer */}
            <div className="flex flex-col items-center justify-center py-4 text-center">
              
              <div className="relative mb-3">
                {/* Visual Audio Wave Rings */}
                {isListening && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.1, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                      className="absolute -inset-3 rounded-full bg-rose-500/20 pointer-events-none"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0.05, 0.4] }}
                      transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut", delay: 0.3 }}
                      className="absolute -inset-6 rounded-full bg-amber-500/15 pointer-events-none"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={handleToggleListening}
                  className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                    isListening
                      ? 'bg-rose-500 text-white shadow-rose-500/40 hover:bg-rose-600 scale-105'
                      : 'bg-amber-500 text-neutral-950 shadow-amber-500/30 hover:bg-amber-400'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-8 h-8 animate-bounce" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 mt-1">
                {isListening ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-mono font-semibold text-rose-500 uppercase tracking-wider">
                      Listening... Speak Naturally ({formatTime(duration)})
                    </span>
                  </>
                ) : (
                  <span className={`text-xs font-mono tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {activeContent ? 'Voice paused • Tap mic to resume or apply below' : 'Tap microphone to begin speaking'}
                  </span>
                )}
              </div>

              {/* Animated Sound Wave Bars while listening */}
              {isListening && (
                <div className="flex items-center gap-1 mt-3 h-6">
                  {[40, 75, 55, 90, 65, 80, 45, 95, 60, 70, 50, 85].map((height, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: ['20%', `${height}%`, '20%'] }}
                      transition={{ repeat: Infinity, duration: 0.6 + (i % 4) * 0.15, ease: 'easeInOut' }}
                      className="w-1 bg-gradient-to-t from-amber-500 to-rose-500 rounded-full"
                    />
                  ))}
                </div>
              )}

            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Live Transcription Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-mono uppercase tracking-wider ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}>
                  Live Transcription:
                </span>
                {activeContent && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-[11px] font-mono text-neutral-400 hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className={`p-4 rounded-2xl border min-h-[120px] max-h-[220px] overflow-y-auto font-serif text-sm sm:text-base leading-relaxed select-text ${
                isDark 
                  ? 'bg-neutral-950/70 border-white/[0.08] text-neutral-200' 
                  : 'bg-stone-50 border-stone-200 text-neutral-800'
              }`}>
                {activeContent ? (
                  <>
                    <span>{transcript}</span>
                    {interimTranscript && (
                      <span className="opacity-50 italic"> {interimTranscript}</span>
                    )}
                  </>
                ) : (
                  <span className={`italic font-sans text-xs ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    Your spoken words will appear here in real-time as you speak...
                  </span>
                )}
              </div>
            </div>

            {/* AI Polished Preview */}
            {polishedResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border space-y-2 ${
                  isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50/80 border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-amber-500">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gemini Polished Reflection</span>
                  </span>
                  {polishedResult.title && (
                    <span className="text-[11px] font-serif font-medium px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300">
                      Title: {polishedResult.title}
                    </span>
                  )}
                </div>
                <p className="font-serif text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                  {polishedResult.text}
                </p>
              </motion.div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-black/[0.06] dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
            
            <button
              type="button"
              onClick={handlePolishWithGemini}
              disabled={!activeContent || isPolishing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-xs font-medium transition-all disabled:opacity-40 cursor-pointer shadow-sm"
            >
              {isPolishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini Polishing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>Polish with Gemini</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  isDark 
                    ? 'hover:bg-neutral-800 border-white/[0.08] text-neutral-300' 
                    : 'hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                }`}
              >
                Cancel
              </button>

              {polishedResult ? (
                <button
                  type="button"
                  onClick={handleApplyPolished}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-semibold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Insert Polished Reflection</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyDirect}
                  disabled={!activeContent}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-semibold text-xs shadow-md shadow-amber-500/20 disabled:opacity-40 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Insert Spoken Reflection</span>
                </button>
              )}
            </div>

          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
