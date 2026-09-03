import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Save, 
  Check, 
  Brain, 
  Compass, 
  Clock, 
  Smile, 
  Zap, 
  Layers, 
  Lightbulb, 
  ArrowRight,
  Bookmark,
  FileText,
  Loader2,
  Image as ImageIcon,
  MapPin,
  Mic,
  MicOff,
  X,
  Plus,
  Trash2,
  Maximize2
} from 'lucide-react';
import { JournalEntry, ReflectionMood, ReflectionIntention, JournalLocation, JournalPhoto } from '../types';
import { calculateWordCount, calculateReadingTimeMinutes } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { LocationTaggerModal } from './LocationTaggerModal';
import { VoiceReflectionModal } from './VoiceReflectionModal';

interface JournalEditorProps {
  currentEntry: Partial<JournalEntry>;
  onSaveEntry: (entry: Partial<JournalEntry>) => Promise<void>;
  onStartReflection: (context: string, mode: 'reflect' | 'brainstorm' | 'socratic' | 'unpack') => void;
  onSummarize: (title: string, content: string) => void;
  onOpenSparks: () => void;
  isSaving: boolean;
}

const MOODS: { key: ReflectionMood; label: string; icon: string; group: 'serene' | 'contemplative' | 'friction' }[] = [
  // Serene & Uplifting
  { key: 'calm', label: 'Calm', icon: '🍃', group: 'serene' },
  { key: 'peaceful', label: 'Peaceful', icon: '🕊️', group: 'serene' },
  { key: 'grateful', label: 'Grateful', icon: '✨', group: 'serene' },
  { key: 'energized', label: 'Energized', icon: '⚡', group: 'serene' },
  
  // Contemplative & Inquiry
  { key: 'thoughtful', label: 'Thoughtful', icon: '💭', group: 'contemplative' },
  { key: 'curious', label: 'Curious', icon: '🔭', group: 'contemplative' },
  { key: 'searching', label: 'Searching', icon: '🧭', group: 'contemplative' },
  { key: 'vulnerable', label: 'Vulnerable', icon: '🪶', group: 'contemplative' },

  // Low / Negative / Friction Feelings
  { key: 'overwhelmed', label: 'Overwhelmed', icon: '🌊', group: 'friction' },
  { key: 'disappointed', label: 'Disappointed', icon: '🌧️', group: 'friction' },
  { key: 'sorrow', label: 'Sorrow', icon: '🥀', group: 'friction' },
  { key: 'disgusted', label: 'Disgusted', icon: '🌪️', group: 'friction' },
  { key: 'anxious', label: 'Anxious', icon: '⚡', group: 'friction' },
  { key: 'frustrated', label: 'Frustrated', icon: '🌋', group: 'friction' },
  { key: 'exhausted', label: 'Exhausted', icon: '🍂', group: 'friction' },
  { key: 'melancholy', label: 'Melancholy', icon: '🕯️', group: 'friction' },
];

const INTENTIONS: { key: ReflectionIntention; label: string; icon: string }[] = [
  { key: 'free_expression', label: 'Free Expression', icon: '✍️' },
  { key: 'unpack_friction', label: 'Unpack Friction', icon: '🔍' },
  { key: 'gratitude_focus', label: 'Gratitude Focus', icon: '🙏' },
  { key: 'brainstorm_ideas', label: 'Brainstorm Ideas', icon: '💡' },
  { key: 'decision_clarity', label: 'Decision Clarity', icon: '⚖️' },
  { key: 'creative_flow', label: 'Creative Flow', icon: '🎨' },
];

// Client-side image compression helper
async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(event.target?.result as string);
    };
    reader.onerror = (error) => reject(error);
  });
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  currentEntry,
  onSaveEntry,
  onStartReflection,
  onSummarize,
  onOpenSparks,
  isSaving
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [title, setTitle] = useState(currentEntry.title || '');
  const [content, setContent] = useState(currentEntry.content || '');
  const [mood, setMood] = useState<ReflectionMood>(currentEntry.mood || 'thoughtful');
  const [intention, setIntention] = useState<ReflectionIntention>(currentEntry.intention || 'free_expression');
  const [entryDate, setEntryDate] = useState<string>(currentEntry.entryDate || '');
  const [photos, setPhotos] = useState<JournalPhoto[]>(
    (currentEntry.photos as JournalPhoto[]) || []
  );
  const [location, setLocation] = useState<JournalLocation | undefined>(currentEntry.location);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [moodFilter, setMoodFilter] = useState<'all' | 'serene' | 'contemplative' | 'friction'>('all');

  // Modals
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<JournalPhoto | null>(null);

  // Quick inline speech recognition toggle
  const [isInlineListening, setIsInlineListening] = useState(false);
  const inlineRecognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(currentEntry.title || '');
    setContent(currentEntry.content || '');
    setEntryDate(currentEntry.entryDate || '');
    setPhotos((currentEntry.photos as JournalPhoto[]) || []);
    setLocation(currentEntry.location);
    if (currentEntry.mood) setMood(currentEntry.mood);
    if (currentEntry.intention) setIntention(currentEntry.intention);
  }, [currentEntry.id, currentEntry.entryDate, currentEntry.title]);

  const words = calculateWordCount(content);
  const readingTime = calculateReadingTimeMinutes(content);

  const handleManualSave = useCallback(async () => {
    if (isSaving) return;
    await onSaveEntry({
      id: currentEntry.id,
      title: title.trim() || 'Untitled Reflection',
      content: content.trim(),
      mood,
      intention,
      photos,
      location,
      entryDate: entryDate.trim() || undefined,
      wordCount: words
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  }, [currentEntry.id, title, content, mood, intention, photos, location, entryDate, words, onSaveEntry, isSaving]);

  // Keyboard shortcut: Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  // Photo Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: JournalPhoto[] = [];
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImageFile(file);
          newPhotos.push({
            id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            url: compressed,
            name: file.name
          });
        } catch (err) {
          console.error('Image upload compression error:', err);
        }
      }
    }

    if (newPhotos.length > 0) {
      setPhotos(prev => [...prev, ...newPhotos]);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Paste image handler (supports pasting screenshots directly!)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const compressed = await compressImageFile(file);
          setPhotos(prev => [
            ...prev,
            {
              id: `paste_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              url: compressed,
              name: 'Pasted Screenshot'
            }
          ]);
        }
      }
    }
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  // Inline Speech-to-Text Toggle
  const toggleInlineSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsVoiceModalOpen(true);
      return;
    }

    if (isInlineListening) {
      if (inlineRecognitionRef.current) {
        inlineRecognitionRef.current.stop();
      }
      setIsInlineListening(false);
    } else {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          let spoken = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            spoken += event.results[i][0].transcript + ' ';
          }
          if (spoken) {
            setContent(prev => (prev ? `${prev} ${spoken.trim()}` : spoken.trim()));
          }
        };

        rec.onerror = () => {
          setIsInlineListening(false);
        };
        rec.onend = () => {
          setIsInlineListening(false);
        };

        rec.start();
        inlineRecognitionRef.current = rec;
        setIsInlineListening(true);
      } catch {
        setIsVoiceModalOpen(true);
      }
    }
  };

  const handleLaunchReflection = (mode: 'reflect' | 'brainstorm' | 'socratic' | 'unpack') => {
    if (!content.trim()) {
      onStartReflection('I would like to explore what is on my mind today.', mode);
      return;
    }
    onStartReflection(content, mode);
  };

  const filteredMoods = moodFilter === 'all' 
    ? MOODS 
    : MOODS.filter(m => m.group === moodFilter);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto space-y-3 sm:space-y-3.5 pb-4"
    >
      
      {/* Hidden File Input for Inserting Photos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* 1. STREAMLINED EMOTIONAL ATTUNEMENT / MOOD FRAME */}
      {/* Compact low-profile header that fits cleanly within the single frame */}
      <div className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 backdrop-blur-xl ${
        isDark
          ? 'bg-neutral-900/80 border-white/[0.08] shadow-sm'
          : 'bg-white/90 border-black/[0.06] shadow-2xs'
      }`}>
        
        {/* Mood Header & Group Filter */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
          <div className="flex items-center gap-1.5">
            <Smile className="w-3.5 h-3.5 text-amber-500" />
            <span className={`text-[11px] font-mono uppercase tracking-wider ${
              isDark ? 'text-amber-400' : 'text-amber-700'
            }`}>
              Emotional Attunement
            </span>
          </div>

          {/* Quick Group Tabs */}
          <div className="flex items-center gap-1 text-[10px] font-mono">
            {(['all', 'serene', 'contemplative', 'friction'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setMoodFilter(tab)}
                className={`px-2 py-0.5 rounded-full capitalize transition-all cursor-pointer ${
                  moodFilter === tab
                    ? isDark 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold' 
                      : 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                    : isDark 
                      ? 'text-neutral-400 hover:text-neutral-200' 
                      : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {tab === 'friction' ? 'Low & Friction' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Compact Mood Pills Grid */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {filteredMoods.map(m => {
            const isSelected = mood === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMood(m.key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                  isSelected
                    ? isDark
                      ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)] font-semibold'
                      : 'bg-amber-100 text-amber-900 border border-amber-400 shadow-2xs font-semibold'
                    : isDark
                      ? 'bg-neutral-950/60 text-neutral-400 border border-white/[0.06] hover:text-neutral-200'
                      : 'bg-neutral-50 text-neutral-600 border border-neutral-200 hover:text-neutral-900'
                }`}
              >
                <span className="text-xs leading-none">{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Intention Strip */}
        <div className="mt-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.05] flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          <span className={`font-mono uppercase text-[9px] tracking-wider shrink-0 flex items-center gap-1 ${
            isDark ? 'text-neutral-400' : 'text-neutral-500'
          }`}>
            <Compass className={`w-3 h-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            <span>Intention:</span>
          </span>
          {INTENTIONS.map(it => (
            <button
              key={it.key}
              onClick={() => setIntention(it.key)}
              className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-all text-[11px] font-medium cursor-pointer ${
                intention === it.key
                  ? isDark
                    ? 'bg-neutral-100 text-neutral-950 font-semibold shadow-2xs'
                    : 'bg-neutral-900 text-neutral-50 font-semibold shadow-2xs'
                  : isDark
                    ? 'text-neutral-400 hover:text-neutral-200 bg-neutral-950/50 border border-white/[0.06]'
                    : 'text-neutral-600 hover:text-neutral-900 bg-neutral-100 border border-neutral-200'
              }`}
            >
              <span>{it.label}</span>
            </button>
          ))}
        </div>

      </div>

      {/* 2. MAIN SPIRAL NOTEBOOK WRITING SURFACE (Single-Frame Proportioned) */}
      <div 
        onPaste={handlePaste}
        className={`relative rounded-3xl transition-all duration-300 ${
          isDark
            ? 'bg-neutral-950/90 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.85),2px_2px_0_1px_rgba(255,255,255,0.04)]'
            : 'bg-stone-200/90 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1),3px_3px_0_rgba(0,0,0,0.04)]'
        } p-2 sm:p-2.5`}
      >
        
        {/* Notebook Cover Layer & Spiral Spine */}
        <div className="relative flex rounded-2xl overflow-hidden">
          
          {/* SPIRAL BINDING SPINE (Left Edge - Dynamically Scaling Double Wire-O Coils) */}
          <div className={`relative w-8 sm:w-11 shrink-0 flex flex-col justify-around py-4 z-20 select-none ${
            isDark 
              ? 'bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-800 border-r border-neutral-700/60 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.5)]' 
              : 'bg-gradient-to-r from-stone-300 via-stone-200 to-stone-100 border-r border-stone-300 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.1)]'
          }`}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="relative flex items-center justify-center my-0.5">
                {/* Punched hole */}
                <div className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-[2px] shadow-inner ${
                  isDark 
                    ? 'bg-black border border-white/[0.05]' 
                    : 'bg-stone-800/80 border border-black/30'
                }`} />
                
                {/* Metallic Spiral Wire Loop */}
                <div 
                  className={`absolute h-2 sm:h-2.5 w-5 sm:w-8 -left-1 sm:-left-1.5 rounded-full transform -rotate-6 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] ${
                    isDark
                      ? 'bg-gradient-to-r from-neutral-600 via-neutral-300 to-neutral-700 border-t border-white/40'
                      : 'bg-gradient-to-r from-stone-400 via-white to-stone-500 border-t border-white/80'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* SPIRAL NOTEBOOK PAPER PAGE */}
          <div className={`relative flex-1 p-4 sm:p-6 sm:pl-8 transition-colors duration-200 ${
            isDark 
              ? 'bg-[#18181b] text-neutral-100' 
              : 'bg-[#fdfbf7] text-neutral-900'
          }`}>
            
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

            {/* NOTEBOOK HEADER: Date, Stationery Tools (Photos, Location, Voice), Metrics & Primary Save to Vault */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 mb-3 pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              
              {/* Left Group: Reflection Date Picker & Stationery Tools */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Date Picker */}
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <input
                    type="date"
                    value={entryDate || new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className={`text-xs font-mono px-2 py-0.5 rounded-lg border outline-none cursor-pointer transition-colors ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-700 text-neutral-200 focus:border-amber-500' 
                        : 'bg-white border-stone-300 text-neutral-800 focus:border-amber-500'
                    }`}
                  />
                </div>

                {/* Divider */}
                <span className="text-neutral-400 opacity-40">|</span>

                {/* STATIONERY ACTIONS TOOLBAR: Insert Photo, Tag Location, Voice Assistance */}
                <div className="flex items-center gap-1.5">
                  
                  {/* 1. Insert Photos Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Insert photo(s) into this reflection or paste from clipboard"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      photos.length > 0
                        ? isDark
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                        : isDark
                          ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-white/[0.08]'
                          : 'bg-white hover:bg-stone-50 text-neutral-700 border-stone-300 shadow-2xs'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>Photo</span>
                    {photos.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-neutral-950 font-bold text-[10px] flex items-center justify-center ml-0.5">
                        {photos.length}
                      </span>
                    )}
                  </button>

                  {/* 2. Tag Location Button (Google Maps Platform) */}
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(true)}
                    title="Tag a mindful location with Google Maps Platform"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      location
                        ? isDark
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-blue-50 text-blue-900 border-blue-300'
                        : isDark
                          ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-white/[0.08]'
                          : 'bg-white hover:bg-stone-50 text-neutral-700 border-stone-300 shadow-2xs'
                    }`}
                  >
                    <MapPin className={`w-3.5 h-3.5 ${location ? 'text-blue-500' : 'text-amber-500'}`} />
                    <span>{location ? location.name.slice(0, 16) + (location.name.length > 16 ? '...' : '') : 'Location'}</span>
                  </button>

                  {/* 3. Voice Assistance Button */}
                  <button
                    type="button"
                    onClick={() => setIsVoiceModalOpen(true)}
                    title="Speak reflection with real-time transcription and Gemini polish"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 transition-all cursor-pointer shadow-2xs"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Speak</span>
                  </button>

                </div>

              </div>

              {/* Right Group: Real-time Word Metrics & Primary Save to Vault Button */}
              <div className="flex items-center gap-2.5">
                
                {/* Word count & reading time */}
                <div className={`text-[11px] font-mono flex items-center gap-1.5 ${
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                }`}>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-500" />
                    <span>{words}w</span>
                  </span>
                  <span>•</span>
                  <span>{readingTime}m</span>
                </div>

                {/* Primary Save Vault Button */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleManualSave}
                  disabled={isSaving}
                  title="Save reflection to encrypted vault (Cmd+S / Ctrl+S)"
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer shadow-2xs ${
                    saveStatus === 'saved'
                      ? isDark
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-400'
                      : isDark
                        ? 'bg-gradient-to-r from-amber-500/25 to-amber-600/25 hover:from-amber-500/35 hover:to-amber-600/35 text-amber-200 border-amber-500/40'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-amber-600'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold">Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Vault</span>
                      <span className="hidden sm:inline text-[9px] opacity-70">⌘S</span>
                    </>
                  )}
                </motion.button>
              </div>

            </div>

            {/* Tagged Location Pill Banner (if tagged) */}
            {location && (
              <div className="relative z-10 pl-2 sm:pl-3 mb-2">
                <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border ${
                  isDark 
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' 
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}>
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="font-medium">{location.name}</span>
                  {location.address && (
                    <span className="opacity-70 text-[11px] hidden sm:inline">• {location.address}</span>
                  )}
                  {location.lat && location.lng && (
                    <span className="font-mono text-[10px] opacity-60">
                      ({location.lat.toFixed(2)}°, {location.lng.toFixed(2)}°)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(true)}
                    className="hover:underline text-[10px] opacity-80 cursor-pointer ml-1"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation(undefined)}
                    className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                    title="Remove location tag"
                  >
                    <X className="w-3 h-3 opacity-70 hover:opacity-100" />
                  </button>
                </div>
              </div>
            )}

            {/* Photo Strip (Polaroid Thumbnail Previews) */}
            {photos.length > 0 && (
              <div className="relative z-10 pl-2 sm:pl-3 mb-2 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className={`relative group shrink-0 rounded-xl overflow-hidden border p-1 transition-all ${
                      isDark 
                        ? 'bg-neutral-900 border-white/[0.1] shadow-md' 
                        : 'bg-white border-stone-300 shadow-2xs'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name || 'Journal Photo'}
                      onClick={() => setPreviewPhoto(photo)}
                      className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    />
                    
                    {/* Delete Thumbnail Button */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-rose-600"
                      title="Remove Photo"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}

                {/* Add another photo quick button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-16 h-16 rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer shrink-0 ${
                    isDark
                      ? 'border-white/[0.15] text-neutral-400 hover:text-white hover:border-amber-500/50'
                      : 'border-stone-300 text-stone-500 hover:text-stone-900 hover:border-amber-500'
                  }`}
                  title="Add more photos"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[9px] font-mono">Add</span>
                </button>
              </div>
            )}

            {/* Notebook Title Input */}
            <div className="relative z-10 pl-2 sm:pl-3 mb-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title of this reflection..."
                maxLength={200}
                className={`w-full bg-transparent font-serif text-xl sm:text-2xl focus:outline-none border-b pb-1.5 transition-colors ${
                  isDark
                    ? 'text-neutral-100 placeholder:text-neutral-600 border-white/[0.08] focus:border-amber-500/50'
                    : 'text-neutral-900 placeholder:text-stone-400 border-stone-200 focus:border-amber-500'
                }`}
              />
            </div>

            {/* Notebook Textarea Writing Area with responsive height and inline dictation button */}
            <div className="relative z-10 pl-2 sm:pl-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write freely in your spiral notebook. Pour out thoughts, or tap Speak to dictate your voice notes..."
                rows={6}
                maxLength={50000}
                className={`w-full bg-transparent text-sm sm:text-base leading-[30px] focus:outline-none resize-none font-light selection:bg-amber-500/25 min-h-[140px] max-h-[220px] overflow-y-auto ${
                  isDark
                    ? 'text-neutral-200 placeholder:text-neutral-600'
                    : 'text-neutral-800 placeholder:text-stone-400'
                }`}
              />

              {/* Quick Inline Dictation Toggle in corner of notebook paper */}
              <div className="flex items-center justify-end gap-2 pt-1">
                {isInlineListening && (
                  <span className="text-[10px] font-mono text-rose-500 animate-pulse flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Listening to your voice...
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleInlineSpeech}
                  title={isInlineListening ? "Stop voice dictation" : "Quick inline microphone dictation"}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isInlineListening
                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                      : isDark
                        ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border-white/[0.08]'
                        : 'bg-white hover:bg-stone-100 text-neutral-600 hover:text-neutral-900 border-stone-300 shadow-2xs'
                  }`}
                >
                  {isInlineListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-amber-500" />}
                </button>
              </div>
            </div>

            {/* NOTEBOOK FOOTER: Compact Sparks Trigger & AI Action Buttons in Single Visible Row */}
            <div className={`relative z-10 pt-3 mt-2 border-t flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 ${
              isDark ? 'border-white/[0.08]' : 'border-stone-200'
            }`}>
              
              {/* 5. COMPACT CLICKABLE SPARK PROMPT CALLOUT */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={onOpenSparks}
                type="button"
                className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all text-left cursor-pointer shadow-2xs ${
                  isDark
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-200'
                    : 'bg-amber-50/90 hover:bg-amber-100/80 border-amber-200 text-amber-900'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 group-hover:bg-amber-500 text-amber-500 group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                  <Lightbulb className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <span>Need a spark? Contemplative Questions</span>
                  <ArrowRight className="w-3 h-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.button>

              {/* AI Thought Actions Deck */}
              <div className="flex flex-wrap items-center gap-1.5">
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleLaunchReflection('reflect')}
                  title="Reflect deeply with Gemini AI"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reflect with Gemini</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleLaunchReflection('socratic')}
                  title="Socratic Inquiry Mirror"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-white/[0.08]'
                      : 'bg-white hover:bg-stone-50 text-neutral-800 border-stone-300 shadow-2xs'
                  }`}
                >
                  <Brain className="w-3 h-3 text-purple-500" />
                  <span>Socratic</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleLaunchReflection('unpack')}
                  title="Unpack Emotional Friction"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-white/[0.08]'
                      : 'bg-white hover:bg-stone-50 text-neutral-800 border-stone-300 shadow-2xs'
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Unpack</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSummarize(title || 'Reflection', content)}
                  disabled={!content.trim()}
                  title="Distill Structured Summary"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-40 cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-white/[0.08]'
                      : 'bg-white hover:bg-stone-50 text-neutral-700 border-stone-300 shadow-2xs'
                  }`}
                >
                  <Layers className="w-3 h-3 text-cyan-500" />
                  <span>Distill</span>
                </motion.button>

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Google Maps Location Tagger Modal */}
      <LocationTaggerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSelectLocation={(loc) => setLocation(loc)}
        currentLocation={location}
      />

      {/* Voice Reflection Assistant Modal */}
      <VoiceReflectionModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onApplyTranscription={(transcriptionText, suggestedTitle) => {
          setContent(prev => (prev ? `${prev}\n\n${transcriptionText}` : transcriptionText));
          if (suggestedTitle && !title.trim()) {
            setTitle(suggestedTitle);
          }
        }}
        currentMood={mood}
        currentIntention={intention}
      />

      {/* Fullscreen Photo Zoom Modal */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/20">
            <img 
              src={previewPhoto.url} 
              alt={previewPhoto.name || 'Preview Photo'} 
              className="max-h-[80vh] w-auto object-contain"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </motion.div>
  );
};
