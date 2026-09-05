/**
 * Data structures for Reflecta Personal Gemini Journal
 */

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
}

export type ReflectionMood = 
  | 'calm' 
  | 'grateful' 
  | 'thoughtful' 
  | 'energized' 
  | 'curious' 
  | 'peaceful'
  | 'searching' 
  | 'overwhelmed'
  | 'disappointed'
  | 'sorrow'
  | 'disgusted'
  | 'anxious'
  | 'frustrated'
  | 'vulnerable'
  | 'exhausted'
  | 'melancholy';

export type ReflectionIntention = 
  | 'free_expression' 
  | 'unpack_friction' 
  | 'gratitude_focus' 
  | 'brainstorm_ideas' 
  | 'decision_clarity' 
  | 'creative_flow';

export interface JournalLocation {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

export interface JournalPhoto {
  id: string;
  url: string; // Base64 data URL or external image URL
  caption?: string;
  name?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood?: ReflectionMood;
  intention?: ReflectionIntention;
  tags?: string[];
  photos?: JournalPhoto[];
  location?: JournalLocation;
  voiceRecorded?: boolean;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  entryDate?: string; // YYYY-MM-DD for calendar backdating / scheduling
  conversationId?: string;
  summaryId?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  promptMode?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageSnippet: string;
  messageCount: number;
  journalEntryId?: string;
  summary?: ConversationSummary;
}

export interface ConversationSummary {
  id: string;
  conversationId: string;
  userId: string;
  title: string;
  mainThemes: string[];
  importantThoughts: string[];
  keyInsights: string[];
  reflectiveQuestions: string[];
  suggestedNextSteps: string[];
  createdAt: string;
}

export interface MindspaceTheme {
  theme: string;
  description: string;
  frequency: number; // 1-100
  keywords: string[];
}

export interface EmotionalCadence {
  mood: string;
  frequency: number;
  narrative: string;
}

export interface InnerLandscapeSynthesis {
  id: string;
  userId: string;
  generatedAt: string;
  entryCountAnalyzed: number;
  corePillars: MindspaceTheme[];
  emotionalCadence: EmotionalCadence[];
  growthVectors: string[];
  personalMantra: string;
  contemplativeInquiry: string;
}

export type AiMode = 'reflect' | 'brainstorm' | 'socratic' | 'summarize' | 'synthesize_themes';

export interface PromptSpark {
  category: string;
  title: string;
  prompt: string;
  subtext: string;
}

export interface AuthNotice {
  type: 'cancelled' | 'blocked' | 'error' | 'info';
  title: string;
  message: string;
  details?: string;
  timestamp?: string;
}

export type CalendarEventCategory = 
  | 'birthday'
  | 'anniversary'
  | 'graduation'
  | 'sports'
  | 'dining'
  | 'wellness'
  | 'travel'
  | 'meeting'
  | 'reminder'
  | 'custom';

export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // e.g. "19:00" or "7:00 PM"
  category: CalendarEventCategory;
  notes?: string;
  isCompleted?: boolean;
  priority?: 'normal' | 'important' | 'celebration';
  recurrence?: EventRecurrence;
  createdAt: string;
  updatedAt: string;
}

