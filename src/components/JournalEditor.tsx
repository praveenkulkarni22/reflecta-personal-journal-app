import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Maximize2,
  Leaf,
  Sun,
  Heart,
  Search,
  Feather,
  Waves,
  CloudRain,
  HeartCrack,
  CircleSlash,
  Activity,
  Flame,
  BatteryLow,
  CloudFog,
  PenTool,
  Scale,
  Palette,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Tag
} from 'lucide-react';
import { JournalEntry, ReflectionMood, ReflectionIntention, JournalLocation, JournalPhoto } from '../types';
import { calculateWordCount, calculateReadingTimeMinutes } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';
import { LocationTaggerModal } from './LocationTaggerModal';
import { VoiceReflectionModal } from './VoiceReflectionModal';
import { CandidateMonthCalendar } from './CandidateMonthCalendar';
import { getCurrentUserToken } from '../lib/firebase';

interface JournalEditorProps {
  currentEntry: Partial<JournalEntry>;
  onSaveEntry: (entry: Partial<JournalEntry>) => Promise<void>;
  onStartReflection: (context: string, mode: 'reflect' | 'brainstorm' | 'socratic' | 'unpack') => void;
  onSummarize: (title: string, content: string) => void;
  onOpenSparks: () => void;
  isSaving: boolean;
  existingEntries?: JournalEntry[];
  onSelectDateEntry?: (entry: JournalEntry) => void;
}

export type MoodCategory = 'peaceful' | 'reflective' | 'overload' | 'depleted';

export interface MoodOption {
  key: ReflectionMood;
  label: string;
  group: MoodCategory;
}

export interface IntentionOption {
  key: ReflectionIntention;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const STATE_OF_MIND_CATEGORIES: {
  key: MoodCategory;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'peaceful', label: 'Peaceful & Grounded', sublabel: 'Calm, peaceful, grateful', icon: Leaf },
  { key: 'reflective', label: 'Reflective & Inquiring', sublabel: 'Thoughtful, curious, searching', icon: Feather },
  { key: 'overload', label: 'Overload & Stress', sublabel: 'Overwhelmed, anxious, friction', icon: Activity },
  { key: 'depleted', label: 'Low Energy & Depleted', sublabel: 'Exhausted, tender, melancholy', icon: BatteryLow },
];

export const CATEGORY_DEFAULT_MOOD: Record<MoodCategory, ReflectionMood> = {
  peaceful: 'peaceful',
  reflective: 'thoughtful',
  overload: 'overwhelmed',
  depleted: 'exhausted',
};

const MOODS: MoodOption[] = [
  // Peaceful & Grounded (calm, centered, serene)
  { key: 'calm', label: 'Calm', group: 'peaceful' },
  { key: 'peaceful', label: 'Peaceful', group: 'peaceful' },
  { key: 'grateful', label: 'Grateful', group: 'peaceful' },
  
  // Reflective & Inquiring (exploratory, introspective, creative)
  { key: 'thoughtful', label: 'Thoughtful', group: 'reflective' },
  { key: 'curious', label: 'Curious', group: 'reflective' },
  { key: 'energized', label: 'Energized', group: 'reflective' },
  { key: 'searching', label: 'Searching', group: 'reflective' },
  { key: 'vulnerable', label: 'Vulnerable', group: 'reflective' },

  // Overload & Stress (Mental/sensory overload, high-arousal friction, cognitive saturation)
  { key: 'overwhelmed', label: 'Overwhelmed', group: 'overload' },
  { key: 'anxious', label: 'Anxious', group: 'overload' },
  { key: 'frustrated', label: 'Frustrated', group: 'overload' },

  // Low Energy & Tender (Depleted energy, fatigue, sadness, grief)
  { key: 'exhausted', label: 'Exhausted', group: 'depleted' },
  { key: 'melancholy', label: 'Melancholy', group: 'depleted' },
  { key: 'disappointed', label: 'Disappointed', group: 'depleted' },
  { key: 'sorrow', label: 'Sorrow', group: 'depleted' },
  { key: 'disgusted', label: 'Disgusted', group: 'depleted' },
];

const INTENTIONS: IntentionOption[] = [
  { key: 'free_expression', label: 'Free Expression', icon: PenTool },
  { key: 'unpack_friction', label: 'Unpack Friction', icon: Search },
  { key: 'gratitude_focus', label: 'Gratitude Focus', icon: Heart },
  { key: 'brainstorm_ideas', label: 'Brainstorm Ideas', icon: Lightbulb },
  { key: 'decision_clarity', label: 'Decision Clarity', icon: Scale },
  { key: 'creative_flow', label: 'Creative Flow', icon: Palette },
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
  isSaving,
  existingEntries = [],
  onSelectDateEntry
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const extractInitialEmotions = useCallback((entry: Partial<JournalEntry>): ReflectionMood[] => {
    const set = new Set<ReflectionMood>();
    if (entry.mood && MOODS.some(m => m.key === entry.mood)) {
      set.add(entry.mood);
    }
    if (Array.isArray(entry.tags)) {
      entry.tags.forEach(t => {
        const found = MOODS.find(m => m.key.toLowerCase() === t.toLowerCase() || m.label.toLowerCase() === t.toLowerCase());
        if (found) set.add(found.key);
      });
    }
    return Array.from(set);
  }, []);

  const [title, setTitle] = useState(currentEntry.title || '');
  const [content, setContent] = useState(currentEntry.content || '');
  // Selected emotions list: user can select any number of emotions within or across categories (Req 3)
  const [selectedEmotions, setSelectedEmotions] = useState<ReflectionMood[]>(() => extractInitialEmotions(currentEntry));
  const [mood, setMood] = useState<ReflectionMood | undefined>(currentEntry.mood || undefined);
  const [selectedCategory, setSelectedCategory] = useState<MoodCategory | null>(() => {
    if (currentEntry.mood) {
      const found = MOODS.find(m => m.key === currentEntry.mood);
      return found ? found.group : null;
    }
    return null;
  });
  const [tags, setTags] = useState<string[]>((currentEntry.tags as string[]) || []);
  const [intention, setIntention] = useState<ReflectionIntention>(currentEntry.intention || 'free_expression');
  const [entryDate, setEntryDate] = useState<string>(currentEntry.entryDate || '');
  const [photos, setPhotos] = useState<JournalPhoto[]>(
    (currentEntry.photos as JournalPhoto[]) || []
  );
  const [location, setLocation] = useState<JournalLocation | undefined>(currentEntry.location);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  // Calendar Popover state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Emotional analysis state
  const [isAnalyzingEmotions, setIsAnalyzingEmotions] = useState(false);
  const [eqInsight, setEqInsight] = useState<{
    emotionalQuotient?: string;
    tone?: string;
    mindfulObservation?: string;
  } | null>(null);
  const [emotionStatusMessage, setEmotionStatusMessage] = useState<string | null>(null);

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
    
    const initialEmotions = extractInitialEmotions(currentEntry);
    setSelectedEmotions(initialEmotions);
    if (initialEmotions.length > 0) {
      setMood(initialEmotions[0]);
      const found = MOODS.find(m => m.key === initialEmotions[0]);
      setSelectedCategory(found ? found.group : null);
    } else if (currentEntry.mood) {
      setMood(currentEntry.mood);
      const found = MOODS.find(m => m.key === currentEntry.mood);
      setSelectedCategory(found ? found.group : null);
    } else {
      setMood(undefined);
      setSelectedCategory(null);
    }

    if (currentEntry.intention) setIntention(currentEntry.intention);
    setTags((currentEntry.tags as string[]) || []);
    setEqInsight(null);
    setEmotionStatusMessage(null);
  }, [currentEntry.id, currentEntry.entryDate, currentEntry.title, extractInitialEmotions]);

  const words = calculateWordCount(content);
  const readingTime = calculateReadingTimeMinutes(content);

  // Date calculations
  const effectiveDate = entryDate || new Date().toISOString().slice(0, 10);

  const shiftDate = (days: number) => {
    try {
      const [y, m, d] = effectiveDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + days);
      const newY = dt.getFullYear();
      const newM = String(dt.getMonth() + 1).padStart(2, '0');
      const newD = String(dt.getDate()).padStart(2, '0');
      setEntryDate(`${newY}-${newM}-${newD}`);
    } catch {
      // fallback
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const existingEntryDatesSet = useMemo(() => {
    const set = new Set<string>();
    if (existingEntries) {
      existingEntries.forEach(e => {
        const d = e.entryDate || (e.createdAt ? e.createdAt.slice(0, 10) : '');
        if (d) set.add(d);
      });
    }
    return set;
  }, [existingEntries]);

  const existingEntryForSelectedDate = useMemo(() => {
    if (!existingEntries) return null;
    return existingEntries.find(e => {
      const d = e.entryDate || (e.createdAt ? e.createdAt.slice(0, 10) : '');
      return d === effectiveDate && e.id !== currentEntry.id;
    });
  }, [existingEntries, effectiveDate, currentEntry.id]);

  // AI Emotional Analysis Helper (Req 3 & 4)
  const analyzeEmotionsWithGemini = useCallback(async (titleText: string, contentText: string) => {
    setIsAnalyzingEmotions(true);
    setEmotionStatusMessage('Analyzing state of mind and emotional quotient...');
    try {
      const token = await getCurrentUserToken();
      const res = await fetch('/api/gemini/analyze-emotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: titleText,
          content: contentText
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data && data.primaryMood && data.category) {
        const emotionTag = data.primaryMood;
        const extraEmotionTags = (data.tags || []).filter((t: string) => 
          !STATE_OF_MIND_CATEGORIES.some(c => c.label.toLowerCase() === t.toLowerCase() || c.key.toLowerCase() === t.toLowerCase())
        );

        const newEmotions = Array.from(new Set([
          ...selectedEmotions,
          emotionTag,
          ...extraEmotionTags
        ])) as ReflectionMood[];

        setSelectedEmotions(newEmotions);
        setMood(data.primaryMood as ReflectionMood);
        setSelectedCategory(data.category as MoodCategory);

        // Req 3: All should be # hashtagged to the particular reflection
        const newTags = Array.from(new Set([
          ...tags.filter(t => !STATE_OF_MIND_CATEGORIES.some(c => c.label.toLowerCase() === t.toLowerCase() || c.key.toLowerCase() === t.toLowerCase())),
          ...newEmotions
        ]));
        setTags(newTags);

        if (data.eqAnalysis) {
          setEqInsight(data.eqAnalysis);
        }

        const moodLabel = MOODS.find(m => m.key === data.primaryMood)?.label || data.primaryMood;
        setEmotionStatusMessage(`State of Mind applied: "${moodLabel}" (${data.category})`);
        setTimeout(() => setEmotionStatusMessage(null), 4000);

        return {
          mood: data.primaryMood as ReflectionMood,
          tags: newTags,
          category: data.category as MoodCategory,
          eqAnalysis: data.eqAnalysis
        };
      }
    } catch (err) {
      console.warn('Gemini emotion analysis error:', err);
      setEmotionStatusMessage('Offline emotional insights applied.');
      setTimeout(() => setEmotionStatusMessage(null), 3000);
    } finally {
      setIsAnalyzingEmotions(false);
    }
    return null;
  }, [tags, selectedEmotions]);

  const handleManualSave = useCallback(async () => {
    if (isSaving) return;

    let finalMood = mood || (selectedEmotions.length > 0 ? selectedEmotions[0] : undefined);
    // Req 3: All selected emotions should be # hashtagged to the reflection
    let finalTags = Array.from(new Set([
      ...tags,
      ...selectedEmotions
    ])).filter(t => !STATE_OF_MIND_CATEGORIES.some(c => c.label.toLowerCase() === t.toLowerCase() || c.key.toLowerCase() === t.toLowerCase()));

    // If user did not choose any emotions, analyze via Gemini assistance and apply to reflection
    if (!finalMood && selectedEmotions.length === 0 && (content.trim().length > 0 || title.trim().length > 0)) {
      const analysisResult = await analyzeEmotionsWithGemini(title, content);
      if (analysisResult) {
        finalMood = analysisResult.mood;
        finalTags = analysisResult.tags;
      }
    }

    await onSaveEntry({
      id: currentEntry.id,
      title: title.trim() || 'Untitled Reflection',
      content: content.trim(),
      mood: finalMood,
      intention,
      photos,
      location,
      entryDate: entryDate.trim() || undefined,
      tags: finalTags,
      wordCount: words
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  }, [currentEntry.id, title, content, mood, selectedEmotions, intention, photos, location, entryDate, tags, words, onSaveEntry, isSaving, analyzeEmotionsWithGemini]);

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

  const handleCategoryClick = (catKey: MoodCategory) => {
    if (selectedCategory === catKey) {
      // Toggle off category filter so user can view and pick emotions across all categories
      setSelectedCategory(null);
    } else {
      // Filter to this category so user can view/select its emotions
      setSelectedCategory(catKey);
    }
  };

  const handleMoodSelect = (mKey: ReflectionMood) => {
    if (selectedEmotions.includes(mKey)) {
      // Unselect this emotion
      const updated = selectedEmotions.filter(k => k !== mKey);
      setSelectedEmotions(updated);
      setMood(updated.length > 0 ? updated[0] : undefined);
      // Remove from tags
      setTags(prev => prev.filter(t => t.toLowerCase() !== mKey.toLowerCase()));
    } else {
      // Multi-select: user can select any number of emotions within a category or across categories (Req 3)
      const updated = [...selectedEmotions, mKey];
      setSelectedEmotions(updated);
      setMood(mKey); // primary active mood
      const mDef = MOODS.find(m => m.key === mKey);
      if (mDef && !selectedCategory) {
        setSelectedCategory(mDef.group);
      }
      // Req 3: All should be # hashtagged to the particular reflection
      setTags(prev => {
        const cleaned = prev.filter(t => 
          !STATE_OF_MIND_CATEGORIES.some(c => c.label.toLowerCase() === t.toLowerCase() || c.key.toLowerCase() === t.toLowerCase())
        );
        if (!cleaned.some(t => t.toLowerCase() === mKey.toLowerCase())) {
          return [...cleaned, mKey];
        }
        return cleaned;
      });
    }
  };

  const categoryEmotions = useMemo(() => {
    if (!selectedCategory) return MOODS;
    return MOODS.filter(m => m.group === selectedCategory);
  }, [selectedCategory]);

  const selectedCategoryDef = STATE_OF_MIND_CATEGORIES.find(c => c.key === selectedCategory);
  const selectedIntentionDef = INTENTIONS.find(it => it.key === intention);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full flex-1 flex flex-col min-h-0"
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

      {/* SPIRAL NOTEBOOK PAPER PAGE */}
      <div 
        onPaste={handlePaste}
        className={`relative flex-1 p-3.5 sm:p-5 sm:pl-8 sm:pr-6 transition-colors duration-200 flex flex-col min-h-0 w-full max-w-full overflow-hidden ${
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

            {/* NOTEBOOK TOP ROW: Editable Date with Left/Right Arrows, Calendar Popover & Primary Save Button */}
            <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 mb-2.5 pb-2 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
              
              {/* Date Switcher: Left arrow, Editable date picker, Right arrow, Candidate Month Calendar popover */}
              <div className="relative flex items-center gap-1.5 sm:gap-2">
                {/* Left arrow: switch to previous day */}
                <button
                  type="button"
                  onClick={() => shiftDate(-1)}
                  title="Switch to previous day"
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800'
                      : 'bg-white border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-stone-100 shadow-2xs'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Editable Date Input with Clock Icon */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-2xs ${
                  isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-stone-300'
                }`}>
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    title="Click or edit date"
                    className={`text-xs sm:text-sm font-mono font-medium outline-none cursor-pointer bg-transparent ${
                      isDark ? 'text-neutral-100' : 'text-neutral-900'
                    }`}
                  />
                </div>

                {/* Right arrow: switch to next day */}
                <button
                  type="button"
                  onClick={() => shiftDate(1)}
                  title="Switch to next day"
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isDark
                      ? 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800'
                      : 'bg-white border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-stone-100 shadow-2xs'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Calendar Icon Button: Click pops up Candidate Month Calendar */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(prev => !prev)}
                    title="Open candidate month calendar to pick any date"
                    aria-label="Open candidate month calendar"
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      isCalendarOpen
                        ? isDark
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                          : 'bg-teal-100 text-teal-900 border-teal-400'
                        : isDark
                          ? 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800'
                          : 'bg-white border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-stone-100 shadow-2xs'
                    }`}
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>

                  {/* Popover Candidate Month Calendar */}
                  <CandidateMonthCalendar
                    isOpen={isCalendarOpen}
                    onClose={() => setIsCalendarOpen(false)}
                    selectedDate={effectiveDate}
                    onSelectDate={(newDate) => {
                      setEntryDate(newDate);
                      setIsCalendarOpen(false);
                    }}
                    existingEntryDates={existingEntryDatesSet}
                  />
                </div>

                {/* In vault indicator for selected date */}
                {existingEntryForSelectedDate && onSelectDateEntry && (
                  <button
                    type="button"
                    onClick={() => onSelectDateEntry(existingEntryForSelectedDate)}
                    title="Load this date's reflection from your vault"
                    className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-colors cursor-pointer ${
                      isDark 
                        ? 'bg-teal-950/40 border-teal-500/30 text-teal-300 hover:bg-teal-900/50' 
                        : 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100'
                    }`}
                  >
                    <Bookmark className="w-3 h-3 text-teal-500" />
                    <span className="truncate max-w-[130px]">In vault: {existingEntryForSelectedDate.title}</span>
                  </button>
                )}
              </div>

              {/* Primary Save Vault Button */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleManualSave}
                disabled={isSaving}
                title="Save reflection to encrypted vault (Cmd+S / Ctrl+S)"
                className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer shadow-2xs shrink-0 ${
                  saveStatus === 'saved'
                    ? isDark
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-400'
                    : isDark
                      ? 'bg-gradient-to-r from-teal-600/30 to-emerald-600/30 hover:from-teal-600/40 hover:to-emerald-600/40 text-teal-200 border-teal-500/40 shadow-2xs'
                      : 'bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white border-teal-800 shadow-sm'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold">Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Vault</span>
                    <span className="hidden sm:inline text-[10px] opacity-70">⌘S</span>
                  </>
                )}
              </motion.button>
            </div>

            {/* REFLECTION CONTEXT BLOCK: State of Mind, Intention, and Stationery Tools */}
            <div className="relative z-10 pl-2 sm:pl-3 mb-2.5 shrink-0">
              <div className={`p-2.5 sm:p-3 rounded-2xl border transition-all ${
                isDark 
                  ? 'bg-neutral-900/60 border-white/[0.08] shadow-sm' 
                  : 'bg-stone-100/80 border-stone-300/70 shadow-2xs'
              }`}>
                {/* 1. State of Mind Header: 4 Categories, None Selected by Default */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Smile className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <span className={`text-xs sm:text-[13px] font-mono uppercase tracking-wider font-semibold ${
                      isDark ? 'text-teal-300' : 'text-teal-900'
                    }`}>
                      State of Mind
                    </span>
                    {selectedCategoryDef && (
                      <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border ${
                        isDark 
                          ? 'bg-teal-500/15 border-teal-500/30 text-teal-300' 
                          : 'bg-teal-50 border-teal-200 text-teal-900 font-medium'
                      }`}>
                        <span>Category: {selectedCategoryDef.label}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(null)}
                          className="hover:text-rose-400 cursor-pointer ml-0.5"
                          title="View all categories"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )}
                  </div>

                  {/* AI Emotional Analysis Trigger */}
                  <button
                    type="button"
                    onClick={() => analyzeEmotionsWithGemini(title, content)}
                    disabled={isAnalyzingEmotions || (!title.trim() && !content.trim())}
                    title="Gemini will analyze your writing to detect your state of mind and emotional quotient"
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all cursor-pointer ${
                      isAnalyzingEmotions
                        ? isDark
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : 'bg-teal-100 text-teal-800 border-teal-300'
                        : (!title.trim() && !content.trim())
                        ? 'opacity-40 cursor-not-allowed border-transparent text-neutral-400'
                        : isDark
                          ? 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border-neutral-700 hover:border-teal-500/40'
                          : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200 shadow-2xs hover:border-teal-300'
                    }`}
                  >
                    <Sparkles className={`w-3 h-3 text-teal-500 ${isAnalyzingEmotions ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzingEmotions ? 'Analyzing EQ...' : 'Gemini Emotional Analysis'}</span>
                  </button>
                </div>

                {/* 4 State of Mind Categories (same frame size as Intention categories, full text displayed) */}
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-2">
                  {STATE_OF_MIND_CATEGORIES.map(cat => {
                    const isSelected = selectedCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => handleCategoryClick(cat.key)}
                        className={`px-2.5 py-0.5 sm:py-1 rounded-full whitespace-nowrap transition-all text-xs font-medium cursor-pointer ${
                          isSelected
                            ? isDark
                              ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40 shadow-[0_0_12px_rgba(20,184,166,0.25)] font-semibold'
                              : 'bg-teal-100 text-teal-900 border border-teal-400 shadow-2xs font-semibold'
                            : isDark
                              ? 'text-neutral-400 hover:text-neutral-200 bg-neutral-950/50 border border-white/[0.06] hover:border-teal-500/30'
                              : 'text-neutral-600 hover:text-neutral-900 bg-white/80 border border-stone-200 hover:border-teal-300 shadow-2xs'
                        }`}
                      >
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* DEDICATED FRAME LISTING EMOTIONS (Req 3: Multi-select within or across categories, all hashtagged) */}
                <div className={`p-2.5 rounded-xl border transition-all mb-2.5 ${
                  isDark 
                    ? 'bg-neutral-950/60 border-white/[0.08]' 
                    : 'bg-white/90 border-stone-200/90 shadow-2xs'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-mono uppercase tracking-wider font-semibold ${
                        isDark ? 'text-teal-300' : 'text-teal-800'
                      }`}>
                        {selectedCategory
                          ? `Emotions · ${selectedCategoryDef?.label}`
                          : 'Emotions · All Categories (Pick any within or across categories)'}
                      </span>
                      {selectedEmotions.length > 0 && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                          isDark 
                            ? 'bg-teal-500/20 text-teal-200 border-teal-500/40' 
                            : 'bg-teal-100 text-teal-900 border-teal-300 font-semibold'
                        }`}>
                          <span>{selectedEmotions.length} hashtagged</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmotions([]);
                              setMood(undefined);
                              setTags(prev => prev.filter(t => !MOODS.some(m => m.key.toLowerCase() === t.toLowerCase())));
                            }}
                            className="hover:text-rose-500 cursor-pointer ml-0.5"
                            title="Clear all emotion hashtags"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      )}
                    </div>

                    {selectedCategory && (
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(null)}
                        className={`text-[10px] font-mono hover:underline cursor-pointer font-medium ${
                          isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-700 hover:text-teal-900'
                        }`}
                      >
                        View all categories
                      </button>
                    )}
                  </div>

                  {/* Emotion Pills: user can select any number of emotions within or across categories */}
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                    {categoryEmotions.map(m => {
                      const isSelected = selectedEmotions.includes(m.key);
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => handleMoodSelect(m.key)}
                          className={`px-2.5 py-0.5 sm:py-1 rounded-full whitespace-nowrap transition-all text-xs font-medium cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? isDark
                                ? 'bg-teal-500/30 text-teal-100 border border-teal-500/60 shadow-[0_0_10px_rgba(20,184,166,0.3)] font-semibold'
                                : 'bg-teal-600 text-white border border-teal-700 shadow-2xs font-semibold'
                              : isDark
                                ? 'bg-neutral-900 text-neutral-300 border border-neutral-700/80 hover:text-white hover:border-teal-500/40'
                                : 'bg-white text-stone-700 border border-stone-300/80 hover:text-stone-900 hover:border-teal-300 shadow-2xs'
                          }`}
                        >
                          <span>{isSelected ? `#${m.label}` : m.label}</span>
                          {isSelected && <Check className="w-3 h-3 text-emerald-300 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Real-time Emotion Status Message */}
                {emotionStatusMessage && (
                  <div className={`mb-2 px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 ${
                    isDark ? 'bg-teal-950/50 text-teal-300 border border-teal-500/30' : 'bg-teal-50 text-teal-800 border border-teal-200'
                  }`}>
                    <Sparkles className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span>{emotionStatusMessage}</span>
                  </div>
                )}

                {/* EQ Mindful Insight Card if generated */}
                {eqInsight && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-2 p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                      isDark
                        ? 'bg-teal-950/30 border-teal-500/20 text-teal-200'
                        : 'bg-teal-50/80 border-teal-200 text-teal-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 font-mono text-[11px] font-semibold mb-0.5">
                        <span>EQ Insight: {eqInsight.emotionalQuotient}</span>
                        {eqInsight.tone && <span className="opacity-70 font-normal">• {eqInsight.tone}</span>}
                      </div>
                      <p className="text-[11px] opacity-85 leading-relaxed">{eqInsight.mindfulObservation}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEqInsight(null)}
                      className="p-1 hover:opacity-100 opacity-60 text-xs cursor-pointer"
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}

                {/* Emotional Tags saved with reflection (Req 3: All should be # hashtagged to the particular reflection) */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2 px-1">
                    <Tag className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}>
                      Emotion Hashtags:
                    </span>
                    {tags.map((t, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
                          isDark
                            ? 'bg-neutral-800 text-teal-300 border-neutral-700'
                            : 'bg-white text-teal-900 border-teal-200 shadow-2xs font-medium'
                        }`}
                      >
                        <span>#{t}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTags(prev => prev.filter((_, i) => i !== idx));
                            setSelectedEmotions(prev => prev.filter(e => e.toLowerCase() !== t.toLowerCase()));
                            if (mood === t) {
                              const remaining = selectedEmotions.filter(e => e.toLowerCase() !== t.toLowerCase());
                              setMood(remaining.length > 0 ? remaining[0] : undefined);
                            }
                          }}
                          className="hover:text-rose-500 cursor-pointer ml-0.5"
                          title={`Remove #${t} hashtag`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 2. Intention Header */}
                <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Compass className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                      <span className={`text-xs sm:text-[13px] font-mono uppercase tracking-wider font-semibold ${
                        isDark ? 'text-teal-300' : 'text-teal-900'
                      }`}>
                        Intention
                      </span>
                      {selectedIntentionDef && (
                        <span className={`hidden sm:inline-flex items-center text-xs font-mono px-2 py-0.5 rounded-full border ${
                          isDark 
                            ? 'bg-teal-500/15 border-teal-500/30 text-teal-300' 
                            : 'bg-teal-50 border-teal-200 text-teal-900 font-medium'
                        }`}>
                          <span>{selectedIntentionDef.label}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean Intention Pills */}
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-2">
                    {INTENTIONS.map(it => {
                      const isSelected = intention === it.key;
                      return (
                        <button
                          key={it.key}
                          type="button"
                          onClick={() => setIntention(it.key)}
                          className={`px-2.5 py-0.5 sm:py-1 rounded-full whitespace-nowrap transition-all text-xs font-medium cursor-pointer ${
                            isSelected
                              ? isDark
                                ? 'bg-teal-500/20 text-teal-200 border border-teal-500/40 shadow-[0_0_12px_rgba(20,184,166,0.25)] font-semibold'
                                : 'bg-teal-100 text-teal-900 border border-teal-400 shadow-2xs font-semibold'
                              : isDark
                                ? 'text-neutral-400 hover:text-neutral-200 bg-neutral-950/50 border border-white/[0.06] hover:border-teal-500/30'
                                : 'text-neutral-600 hover:text-neutral-900 bg-white/80 border border-stone-200 hover:border-teal-300 shadow-2xs'
                          }`}
                        >
                          <span>{it.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Stationery Actions (Add Photo, Location, Speak) Placed Below Intention */}
                <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {/* Insert Photo Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Insert photo(s) into this reflection or paste from clipboard"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                        photos.length > 0
                          ? isDark
                            ? 'bg-teal-500/20 text-teal-200 border-teal-500/40'
                            : 'bg-teal-100 text-teal-900 border-teal-300 font-semibold'
                          : isDark
                            ? 'bg-neutral-950/60 hover:bg-neutral-900 text-neutral-300 border-white/[0.08]'
                            : 'bg-white hover:bg-stone-50 text-neutral-700 border-stone-300 shadow-2xs'
                      }`}
                    >
                      <ImageIcon className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                      <span>Add Photo</span>
                      {photos.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center ml-0.5">
                          {photos.length}
                        </span>
                      )}
                    </button>

                    {/* Tag Location Button */}
                    <button
                      type="button"
                      onClick={() => setIsLocationModalOpen(true)}
                      title="Tag a mindful location with Google Maps Platform"
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                        location
                          ? isDark
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'bg-blue-50 text-blue-900 border-blue-300'
                          : isDark
                            ? 'bg-neutral-950/60 hover:bg-neutral-900 text-neutral-300 border-white/[0.08]'
                            : 'bg-white hover:bg-stone-50 text-neutral-700 border-stone-300 shadow-2xs'
                      }`}
                    >
                      <MapPin className={`w-3.5 h-3.5 ${location ? 'text-blue-500' : isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                      <span>{location ? location.name.slice(0, 18) + (location.name.length > 18 ? '...' : '') : 'Location'}</span>
                    </button>

                    {/* Speak / Voice Reflection Button */}
                    <button
                      type="button"
                      onClick={() => setIsVoiceModalOpen(true)}
                      title="Speak reflection with real-time transcription and Gemini polish"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs sm:text-sm font-medium border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 transition-all cursor-pointer shadow-2xs"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>Speak</span>
                    </button>
                  </div>

                  {/* Word count & reading time metrics */}
                  <div className={`text-[11px] font-mono flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${
                    isDark ? 'text-neutral-400 bg-neutral-950/40' : 'text-neutral-600 bg-stone-200/50'
                  }`}>
                    <FileText className={`w-3 h-3 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                    <span>{words}w</span>
                    <span>•</span>
                    <span>{readingTime}m</span>
                  </div>
                </div>
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
                      ? 'border-white/[0.15] text-neutral-400 hover:text-white hover:border-teal-500/50'
                      : 'border-stone-300 text-stone-500 hover:text-stone-900 hover:border-teal-500'
                  }`}
                  title="Add more photos"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[9px] font-mono">Add</span>
                </button>
              </div>
            )}

            {/* Notebook Title Input */}
            <div className="relative z-10 pl-2 sm:pl-3 mb-1.5 shrink-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title of this reflection..."
                maxLength={200}
                className={`w-full bg-transparent font-serif text-xl sm:text-2xl focus:outline-none border-b pb-1 transition-colors ${
                  isDark
                    ? 'text-neutral-100 placeholder:text-neutral-600 border-white/[0.08] focus:border-teal-500/50'
                    : 'text-neutral-900 placeholder:text-stone-400 border-stone-200 focus:border-teal-600'
                }`}
              />
            </div>

            {/* Notebook Textarea Writing Area with full available height and inline dictation button */}
            <div className="relative z-10 pl-2 sm:pl-3 flex-1 flex flex-col min-h-0">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write freely in your spiral notebook. Pour out thoughts, or tap Speak to dictate your voice notes..."
                maxLength={50000}
                className={`w-full flex-1 bg-transparent text-base sm:text-lg leading-[30px] sm:leading-[34px] focus:outline-none resize-none font-light selection:bg-teal-500/20 selection:text-teal-200 min-h-[100px] sm:min-h-[140px] overflow-y-auto ${
                  isDark
                    ? 'text-neutral-200 placeholder:text-neutral-600'
                    : 'text-neutral-800 placeholder:text-stone-400'
                }`}
              />

              {/* Quick Inline Dictation Toggle in corner of notebook paper */}
              <div className="flex items-center justify-end gap-2 pt-0.5 shrink-0">
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
                  {isInlineListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className={`w-3.5 h-3.5 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />}
                </button>
              </div>
            </div>

            {/* NOTEBOOK FOOTER: Sparks Trigger & AI Action Buttons Fully Visible In Frame */}
            <div className={`relative z-10 pt-2.5 mt-auto border-t flex flex-wrap items-center justify-between gap-2 shrink-0 ${
              isDark ? 'border-white/[0.08]' : 'border-stone-200'
            }`}>
              
              {/* 5. COMPACT CLICKABLE SPARK PROMPT CALLOUT */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={onOpenSparks}
                type="button"
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-left cursor-pointer shadow-2xs shrink-0 ${
                  isDark
                    ? 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30 text-teal-200'
                    : 'bg-teal-50/90 hover:bg-teal-100/80 border-teal-200 text-teal-950'
                }`}
              >
                <div className="w-5 h-5 rounded-lg bg-teal-500/20 group-hover:bg-teal-600 text-teal-600 dark:text-teal-400 group-hover:text-white flex items-center justify-center shrink-0 transition-all">
                  <Lightbulb className="w-3 h-3" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
                  <span>Need a spark? Contemplative Questions</span>
                  <ArrowRight className={`w-3 h-3 ${isDark ? 'text-teal-400' : 'text-teal-600'} group-hover:translate-x-0.5 transition-transform`} />
                </div>
              </motion.button>

              {/* AI Thought Actions Deck - Fully Visible Without Truncation */}
              <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-full">
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleLaunchReflection('reflect')}
                  title="Reflect deeply with Gemini AI"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Reflect with Gemini</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleLaunchReflection('socratic')}
                  title="Socratic Inquiry Mirror"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
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
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                    isDark
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-white/[0.08]'
                      : 'bg-white hover:bg-stone-50 text-neutral-800 border-stone-300 shadow-2xs'
                  }`}
                >
                  <Zap className={`w-3 h-3 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
                  <span>Unpack</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSummarize(title || 'Reflection', content)}
                  disabled={!content.trim()}
                  title="Distill Structured Summary"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap ${
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
