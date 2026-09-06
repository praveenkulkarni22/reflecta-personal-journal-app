import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LandingPage } from './components/LandingPage';
import { JournalEditor } from './components/JournalEditor';
import { ConversationView } from './components/ConversationView';
import { HistoryArchive } from './components/HistoryArchive';
import { CalendarView } from './components/CalendarView';
import { NotebookPageFlipper } from './components/NotebookPageFlipper';
import { SummaryModal } from './components/SummaryModal';
import { InnerLandscapeModal } from './components/InnerLandscapeModal';
import { InnerLandscapeView } from './components/InnerLandscapeView';
import { FlipbookReader } from './components/FlipbookReader';
import { PromptSparkModal } from './components/PromptSparkModal';
import { AdminDashboardView } from './components/AdminDashboardView';
import { NotificationSettingsView } from './components/NotificationSettingsView';
import { ThankYouPage } from './components/ThankYouPage';
import { InteractiveBackground } from './components/InteractiveBackground';
import { useTheme } from './context/ThemeContext';
import { 
  UserProfile, 
  JournalEntry, 
  Conversation, 
  ConversationMessage, 
  ConversationSummary, 
  InnerLandscapeSynthesis,
  PromptSpark,
  AuthNotice,
  CalendarEvent
} from './types';
import { 
  auth, 
  signInWithGoogle, 
  logOut, 
  onAuthChange,
  getCurrentUserToken
} from './lib/firebase';
import { 
  syncUserProfile, 
  saveJournalEntry, 
  fetchUserJournals, 
  deleteJournalEntry, 
  createConversation,
  fetchUserConversations,
  fetchConversationMessages,
  appendConversationMessage,
  saveConversationSummary,
  fetchUserSummaries,
  saveLandscapeSynthesis,
  fetchLatestLandscapeSynthesis,
  saveCalendarEvent,
  fetchUserCalendarEvents,
  deleteCalendarEvent,
  toggleCalendarEventCompletion
} from './lib/firestoreService';
import { ambientSound } from './lib/audioSynth';
import confetti from 'canvas-confetti';

export default function App() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'journal' | 'conversations' | 'archive' | 'calendar' | 'landscape' | 'notifications' | 'admin'>('journal');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Data state
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [landscapeSynthesis, setLandscapeSynthesis] = useState<InnerLandscapeSynthesis | null>(null);

  // Active working state
  const [showThankYou, setShowThankYou] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<Partial<JournalEntry>>({
    title: '',
    content: '',
    mood: 'thoughtful',
    intention: 'free_expression'
  });
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  
  // Statuses
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [lastModelUsed, setLastModelUsed] = useState<string>('gemini-3.6-flash');
  const [genError, setGenError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);

  // Modals
  const [activeSummary, setActiveSummary] = useState<ConversationSummary | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isLandscapeModalOpen, setIsLandscapeModalOpen] = useState(false);
  const [isFlipbookOpen, setIsFlipbookOpen] = useState(false);
  const [isSparksOpen, setIsSparksOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const isBootstrapAdmin = Boolean(
          firebaseUser.email && (
            firebaseUser.email.toLowerCase() === 'praveenkulkarni22@gmail.com' ||
            firebaseUser.email.toLowerCase().includes('admin')
          )
        );

        const profile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          createdAt: new Date().toISOString(),
          role: isBootstrapAdmin ? 'admin' : 'user'
        };
        setUser(profile);
        setAuthNotice(null);
        setShowThankYou(false);
        
        try {
          await syncUserProfile(profile);
          await loadUserData(firebaseUser.uid);
          
          // Verify role with server RBAC engine
          const token = await getCurrentUserToken();
          if (token) {
            const roleRes = await fetch('/api/auth/me', {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (roleRes.ok) {
              const roleData = await roleRes.json();
              setUser(prev => prev ? { ...prev, role: roleData.role || 'user' } : null);
            }
          }
        } catch (err) {
          console.warn('Failed to sync profile / load user data / verify role:', err);
        }
      } else {
        setUser(null);
        setJournals([]);
        setConversations([]);
        setSummaries([]);
        setEvents([]);
        setLandscapeSynthesis(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const syncUserSanitizedTelemetry = async (
    currentJournals: JournalEntry[],
    currentConvs: Conversation[],
    currentSums: ConversationSummary[],
    currentUser?: UserProfile | null
  ) => {
    try {
      const token = await getCurrentUserToken();
      if (!token) return;

      const moodCounts: Record<string, number> = {};
      let wordCountSum = 0;
      currentJournals.forEach(j => {
        if (j.mood) {
          moodCounts[j.mood] = (moodCounts[j.mood] || 0) + 1;
        }
        if (j.content) {
          const words = j.content.trim().split(/\s+/).filter(Boolean).length;
          wordCountSum += words;
        }
      });

      await fetch('/api/users/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: currentUser?.displayName || user?.displayName,
          journalCount: currentJournals.length,
          conversationCount: currentConvs.length,
          summaryCount: currentSums.length,
          wordCountSum,
          moodCounts
        })
      });
    } catch (err) {
      console.debug('Telemetry sync note:', err);
    }
  };

  const loadUserData = async (uid: string) => {
    try {
      const [userJournals, userConvs, userSums, latestLandscape, userEvents] = await Promise.all([
        fetchUserJournals(uid),
        fetchUserConversations(uid),
        fetchUserSummaries(uid),
        fetchLatestLandscapeSynthesis(uid),
        fetchUserCalendarEvents(uid)
      ]);
      setJournals(userJournals);
      setConversations(userConvs);
      setSummaries(userSums);
      setLandscapeSynthesis(latestLandscape);
      setEvents(userEvents);
      // Synchronize sanitized counts for the administrative aggregated dashboard (zero private content sent)
      syncUserSanitizedTelemetry(userJournals, userConvs, userSums, user);
    } catch (e) {
      console.warn('Error fetching Firestore user collections:', e);
    }
  };

  // Sign In Handler with Enterprise Feedback
  const handleSignIn = async () => {
    try {
      setAuthLoading(true);
      setAuthNotice(null);
      setShowThankYou(false);
      await signInWithGoogle();
      showToast('Welcome to your Reflecta sanctuary.');
    } catch (error: any) {
      const errorCode = error?.code || '';
      const isUserCancellation = 
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request' ||
        errorCode === 'auth/user-cancelled';

      if (!isUserCancellation) {
        console.error('Sign in failed:', error);
      } else {
        console.info('Sign-in cancelled by user:', errorCode);
      }
      
      if (isUserCancellation) {
        setAuthNotice({
          type: 'cancelled',
          title: 'Sign-In Request Cancelled',
          message: 'The Google Identity verification window was closed before completing authentication. No credentials or session changes were committed. You can securely resume whenever you are ready.',
          details: `Event code: ${errorCode || 'auth/user-cancelled'} • Session status: Unchanged`,
          timestamp: new Date().toISOString()
        });
        showToast('Google Sign-In was cancelled. Ready whenever you wish.');
      } else if (errorCode === 'auth/popup-blocked') {
        setAuthNotice({
          type: 'blocked',
          title: 'Pop-Up Window Blocked by Browser',
          message: 'Your browser prevented the Google Sign-In pop-up from opening. Please enable pop-ups for this site in your browser settings to complete authentication.',
          details: 'Event code: auth/popup-blocked • Browser security restriction',
          timestamp: new Date().toISOString()
        });
        showToast('Pop-up was blocked by your browser settings.');
      } else if (errorCode === 'auth/network-request-failed') {
        setAuthNotice({
          type: 'error',
          title: 'Network Communication Failure',
          message: 'A network connectivity issue prevented secure handshake with Google Identity servers. Please verify your internet connection and try again.',
          details: 'Event code: auth/network-request-failed',
          timestamp: new Date().toISOString()
        });
        showToast('Network error during authentication.');
      } else {
        setAuthNotice({
          type: 'error',
          title: 'Authentication Incomplete',
          message: 'An unexpected issue occurred while authenticating with Google. Please try again or check account credentials.',
          details: error?.message ? `Event code: ${errorCode || 'unknown'} - ${error.message}` : undefined,
          timestamp: new Date().toISOString()
        });
        showToast('Sign-in could not be completed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Sign Out Handler with Peaceful Sanctuary Transition
  const handleSignOut = async () => {
    try {
      await logOut();
      // Keep Sanctuary Soundscape playing in peaceful mode (30% volume) seamlessly
      ambientSound.autoStartPeacefulMode(0.30);
      setShowThankYou(true);
      showToast('Signed out safely. Thank you for reflecting.');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Save Journal Entry
  const handleSaveEntry = async (entry: Partial<JournalEntry>) => {
    if (!user) return;
    setIsSaving(true);
    try {
      const saved = await saveJournalEntry(user.uid, {
        title: entry.title || 'Untitled Reflection',
        content: entry.content || '',
        mood: entry.mood || 'thoughtful',
        intention: entry.intention || 'free_expression',
        wordCount: entry.wordCount || 0,
        entryDate: entry.entryDate,
        photos: entry.photos,
        location: entry.location,
        voiceRecorded: entry.voiceRecorded,
        id: entry.id
      });
      setCurrentEntry(saved);
      setJournals(prev => {
        const idx = prev.findIndex(j => j.id === saved.id);
        const updated = idx >= 0 ? [...prev] : [saved, ...prev];
        if (idx >= 0) updated[idx] = saved;
        syncUserSanitizedTelemetry(updated, conversations, summaries, user);
        return updated;
      });
      showToast('Reflection safely stored in your vault.');

      // Asynchronously trigger server-side notification classification pipeline
      (async () => {
        try {
          const token = await getCurrentUserToken();
          if (token && saved.id) {
            fetch('/api/notifications/classify-and-trigger', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                journalId: saved.id,
                title: saved.title,
                content: saved.content,
                mood: saved.mood
              })
            }).catch(err => console.debug('Background notification trigger notice:', err));
          }
        } catch (e) {
          // Non-blocking background notification error
        }
      })();
    } catch (err: any) {
      console.error('Error saving journal:', err);
      showToast('Failed to save to cloud vault. Stored locally.');
    } finally {
      setIsSaving(false);
    }
  };

  // Calendar Event & Milestone Handlers
  const handleSaveCalendarEvent = async (eventData: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    if (!user) return;
    try {
      const saved = await saveCalendarEvent(user.uid, eventData);
      setEvents(prev => {
        const idx = prev.findIndex(e => e.id === saved.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved].sort((a, b) => a.date.localeCompare(b.date));
      });
      showToast('Milestone saved to sanctuary calendar.');
    } catch (err) {
      console.error('Failed to save calendar event:', err);
      showToast('Failed to save event.');
    }
  };

  const handleDeleteCalendarEvent = async (eventId: string) => {
    if (!user) return;
    try {
      await deleteCalendarEvent(user.uid, eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      showToast('Milestone removed.');
    } catch (err) {
      console.error('Failed to delete event:', err);
      showToast('Failed to delete event.');
    }
  };

  const handleToggleCalendarEventComplete = async (eventId: string, isCompleted: boolean) => {
    if (!user) return;
    try {
      await toggleCalendarEventCompletion(user.uid, eventId, isCompleted);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, isCompleted } : e));
    } catch (err) {
      console.error('Failed to toggle event completion:', err);
    }
  };

  const handleAddEntryForDate = (dateStr: string) => {
    setCurrentEntry({
      title: `Reflection — ${dateStr}`,
      content: '',
      mood: 'thoughtful',
      intention: 'free_expression',
      entryDate: dateStr
    });
    setActiveTab('journal');
    showToast(`Composing reflection for ${dateStr}`);
  };

  // Delete Journal Entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteJournalEntry(user.uid, entryId);
      setJournals(prev => {
        const updated = prev.filter(j => j.id !== entryId);
        syncUserSanitizedTelemetry(updated, conversations, summaries, user);
        return updated;
      });
      if (currentEntry.id === entryId) {
        setCurrentEntry({ title: '', content: '', mood: 'thoughtful', intention: 'free_expression' });
      }
      showToast('Reflection removed from vault.');
    } catch (err) {
      console.error('Delete entry error:', err);
      showToast('Failed to delete entry.');
    }
  };

  // Start / Switch into Conversation
  const handleStartReflection = async (context: string, mode: 'reflect' | 'brainstorm' | 'socratic' | 'unpack') => {
    if (!user) return;

    try {
      const title = currentEntry.title || 'Reflective Dialogue';
      const conv = await createConversation(user.uid, title, currentEntry.id);
      setActiveConversation(conv);
      setConversations(prev => [conv, ...prev]);
      setActiveTab('conversations');
      setConversationMessages([]);

      // Send initial contextual message
      await handleSendMessage(context, mode, conv.id);
    } catch (err) {
      console.error('Failed to start reflection session:', err);
      showToast('Could not initialize reflection session.');
    }
  };

  // Send Message in Multi-Turn Conversation
  const handleSendMessage = async (msgText: string, mode: string, targetConvId?: string) => {
    if (!user) return;
    const convId = targetConvId || activeConversation?.id;
    if (!convId) return;

    setIsGenerating(true);
    setGenError(null);

    // Append user message immediately
    const userMsg = await appendConversationMessage(user.uid, convId, {
      role: 'user',
      content: msgText,
      promptMode: mode
    });
    setConversationMessages(prev => [...prev, userMsg]);

    try {
      const token = await getCurrentUserToken();
      const historyPayload = conversationMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: msgText,
          history: historyPayload,
          mode,
          reflectionContext: currentEntry.content || ''
        })
      });

      if (!res.ok) {
        throw new Error('Server returned generation error');
      }

      const data = await res.json();
      if (data.modelUsed) setLastModelUsed(data.modelUsed);

      // Append assistant message
      const assistantMsg = await appendConversationMessage(user.uid, convId, {
        role: 'assistant',
        content: data.reply,
        promptMode: mode
      });
      setConversationMessages(prev => [...prev, assistantMsg]);

      // Soft meditative chime
      ambientSound.playGentleChime();
    } catch (err: any) {
      console.error('Chat error:', err);
      setGenError('Reflecta is temporarily paused. Your thought is preserved. Click Retry to continue.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Summarize Conversation or Reflection
  const handleSummarize = async (title?: string, content?: string) => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const token = await getCurrentUserToken();
      const res = await fetch('/api/gemini/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          reflectionTitle: title || currentEntry.title || activeConversation?.title || 'Reflection',
          reflectionContent: content || currentEntry.content || '',
          messages: conversationMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.summary) {
        throw new Error(data?.error || 'Failed to distill summary');
      }

      const summaryPayload = data?.summary || {};
      const summaryId = `summary_${Date.now()}`;
      const fullSummary: ConversationSummary = {
        id: summaryId,
        conversationId: activeConversation?.id || 'direct_journal',
        userId: user.uid,
        title: summaryPayload.title || title || currentEntry.title || 'Distilled Insight',
        mainThemes: Array.isArray(summaryPayload.mainThemes) && summaryPayload.mainThemes.length > 0 
          ? summaryPayload.mainThemes 
          : ['Personal Clarity', 'Mindful Presence'],
        importantThoughts: Array.isArray(summaryPayload.importantThoughts) ? summaryPayload.importantThoughts : [],
        keyInsights: Array.isArray(summaryPayload.keyInsights) ? summaryPayload.keyInsights : [],
        reflectiveQuestions: Array.isArray(summaryPayload.reflectiveQuestions) ? summaryPayload.reflectiveQuestions : [],
        suggestedNextSteps: Array.isArray(summaryPayload.suggestedNextSteps) ? summaryPayload.suggestedNextSteps : [],
        createdAt: new Date().toISOString()
      };

      await saveConversationSummary(user.uid, fullSummary);
      setSummaries(prev => [fullSummary, ...prev]);
      setActiveSummary(fullSummary);
      setIsSummaryModalOpen(true);
      
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#34d399', '#6ee7b7']
      });

      if (data?.quotaDepleted) {
        showToast('Reflection distilled in mindful offline mode.');
      }
    } catch (err) {
      console.error('Summarize error:', err);
      showToast('Failed to distill summary.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Longitudinal Landscape Synthesizer (Original Enhancement)
  const handleSynthesizeLandscape = async () => {
    if (!user || journals.length === 0) return;
    setIsSynthesizing(true);
    try {
      const token = await getCurrentUserToken();
      const res = await fetch('/api/gemini/synthesize-landscape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          entries: journals.slice(0, 30).map(j => ({
            title: j.title,
            content: j.content,
            mood: j.mood,
            intention: j.intention,
            createdAt: j.createdAt
          }))
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data?.landscape) {
        throw new Error(data?.error || 'Failed to synthesize landscape');
      }

      const landscapePayload = data?.landscape || {};
      const synthId = `landscape_${Date.now()}`;
      const fullSynth: InnerLandscapeSynthesis = {
        id: synthId,
        userId: user.uid,
        generatedAt: new Date().toISOString(),
        entryCountAnalyzed: journals.length,
        corePillars: Array.isArray(landscapePayload.corePillars) ? landscapePayload.corePillars : [],
        growthVectors: Array.isArray(landscapePayload.growthVectors) ? landscapePayload.growthVectors : [],
        personalMantra: landscapePayload.personalMantra || 'I give myself permission to pause, breathe, and trust my journey.',
        contemplativeInquiry: landscapePayload.contemplativeInquiry || 'What brings you the deepest sense of peace today?'
      };

      await saveLandscapeSynthesis(user.uid, fullSynth);
      setLandscapeSynthesis(fullSynth);
      showToast(data?.quotaDepleted ? 'Inner Landscape synthesized in offline mode.' : 'Inner Landscape synthesized.');
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#10b981', '#a855f7', '#38bdf8']
      });
    } catch (err) {
      console.error('Landscape synthesis error:', err);
      showToast('Failed to synthesize landscape.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Reopen past conversation
  const handleSelectConversation = async (conv: Conversation) => {
    if (!user) return;
    setActiveConversation(conv);
    try {
      const msgs = await fetchConversationMessages(user.uid, conv.id);
      setConversationMessages(msgs);
      setActiveTab('conversations');
    } catch (e) {
      console.warn('Failed to load conversation messages:', e);
    }
  };

  // Select spark
  const handleSelectSpark = (spark: PromptSpark) => {
    setCurrentEntry({
      title: spark.title,
      content: `Prompt: "${spark.prompt}"\n\n`,
      mood: 'thoughtful',
      intention: 'free_expression'
    });
    setActiveTab('journal');
  };

  // If initial auth check is running
  if (authLoading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 ${
        isDark ? 'bg-neutral-950 text-neutral-400' : 'bg-neutral-100 text-neutral-600'
      } space-y-4`}>
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-pulse">
          <span className="font-serif text-2xl font-bold">R</span>
        </div>
        <p className="text-xs font-mono tracking-wider uppercase opacity-60">
          Entering Reflecta Sanctuary...
        </p>
      </div>
    );
  }

  // If user signed out, show the Thank You / Visit Again page with 10s transition
  if (showThankYou && !user) {
    return (
      <ThankYouPage
        onReturnHome={() => setShowThankYou(false)}
        onSignInAgain={() => {
          setShowThankYou(false);
          handleSignIn();
        }}
      />
    );
  }

  // Unauthenticated Landing Page
  if (!user) {
    return (
      <div className={`min-h-screen relative transition-colors duration-500 ${
        isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-slate-50 text-neutral-900'
      }`}>
        <InteractiveBackground />
        <LandingPage
          onSignIn={handleSignIn}
          isLoading={authLoading}
          authNotice={authNotice}
          onClearNotice={() => setAuthNotice(null)}
        />
        {toastMessage && (
          <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border text-xs shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            isDark
              ? 'bg-neutral-900/90 border-teal-500/30 text-teal-200'
              : 'bg-white/95 border-teal-500/40 text-teal-900 shadow-teal-500/10'
          }`}>
            {toastMessage}
          </div>
        )}
      </div>
    );
  }

  // Authenticated Sanctuary Dashboard
  return (
    <div className={`min-h-screen relative transition-colors duration-300 ${
      isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-neutral-100/90 text-neutral-900'
    } selection:bg-teal-500/20 selection:text-teal-200`}>
      
      {/* Interactive Physics Starry Canvas Layer */}
      <InteractiveBackground />

      <div className="relative z-10 flex min-h-screen">
        {/* Side Frame (Sidebar) */}
        <Sidebar
          userRole={user?.role || 'user'}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenLandscape={() => setActiveTab('landscape')}
          onOpenFlipbook={() => setIsFlipbookOpen(true)}
          onOpenNotifications={() => setActiveTab('notifications')}
          onOpenAdmin={() => setActiveTab('admin')}
          isFlipbookOpen={isFlipbookOpen}
          isLandscapeOpen={activeTab === 'landscape'}
          onNewReflection={() => {
            setCurrentEntry({
              title: '',
              content: '',
              mood: 'thoughtful',
              intention: 'free_expression',
              entryDate: new Date().toISOString().slice(0, 10)
            });
            setActiveTab('journal');
          }}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          journalCount={journals.length}
          eventsCount={events.length}
        />

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? 'ml-[64px]' : 'ml-0 md:ml-60'
        }`}>
          {/* Navigation Header */}
          <Navbar
            user={user}
            userRole={user?.role || 'user'}
            activeTab={activeTab}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onOpenSparks={() => setIsSparksOpen(true)}
            onOpenNotifications={() => setActiveTab('notifications')}
            onOpenAdmin={() => setActiveTab('admin')}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />

          {/* Main Workspace */}
          <main className="flex-1 w-full min-w-0 flex flex-col p-2 sm:p-3 md:p-4 h-[calc(100vh-65px)] max-h-[calc(100vh-65px)] overflow-hidden">
            <NotebookPageFlipper pageKey={activeTab}>
              {activeTab === 'journal' && (
                <JournalEditor
                  currentEntry={currentEntry}
                  onSaveEntry={handleSaveEntry}
                  onStartReflection={handleStartReflection}
                  onSummarize={(title, content) => handleSummarize(title, content)}
                  onOpenSparks={() => setIsSparksOpen(true)}
                  isSaving={isSaving}
                  existingEntries={journals}
                  onSelectDateEntry={(entry) => setCurrentEntry(entry)}
                />
              )}

              {activeTab === 'conversations' && (
                <div className={`relative flex-1 p-3.5 sm:p-5 sm:pl-8 sm:pr-6 transition-colors duration-200 flex flex-col min-h-0 w-full max-w-full overflow-hidden ${
                  isDark ? 'bg-[#18181b] text-neutral-100' : 'bg-[#fdfbf7] text-neutral-900'
                }`}>
                  <div className={`absolute top-0 bottom-0 left-0 w-px border-r-2 border-dashed ${
                    isDark ? 'border-neutral-700/60' : 'border-stone-300/80'
                  }`} />
                  <div className={`absolute top-0 bottom-0 left-3 sm:left-5 w-px ${
                    isDark ? 'bg-rose-500/20' : 'bg-rose-400/40'
                  }`} />
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
                    style={{
                      backgroundImage: isDark
                        ? 'repeating-linear-gradient(to bottom, transparent, transparent 29px, rgba(255,255,255,0.06) 29px, rgba(255,255,255,0.06) 30px)'
                        : 'repeating-linear-gradient(to bottom, transparent, transparent 29px, rgba(0,0,0,0.06) 29px, rgba(0,0,0,0.06) 30px)'
                    }}
                  />
                  <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-y-auto">
                    <ConversationView
                      messages={conversationMessages}
                      onSendMessage={(msg, mode) => handleSendMessage(msg, mode)}
                      onSummarize={() => handleSummarize()}
                      onBackToJournal={() => setActiveTab('journal')}
                      isGenerating={isGenerating}
                      modelUsed={lastModelUsed}
                      conversationTitle={activeConversation?.title || currentEntry.title}
                      error={genError}
                      onRetryLast={() => {
                        const lastUserMsg = [...conversationMessages].reverse().find(m => m.role === 'user');
                        if (lastUserMsg) {
                          handleSendMessage(lastUserMsg.content, lastUserMsg.promptMode || 'reflect');
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                <CalendarView
                  entries={journals}
                  events={events}
                  onAddEntryForDate={handleAddEntryForDate}
                  onOpenEntry={(entry) => {
                    setCurrentEntry(entry);
                    setActiveTab('journal');
                  }}
                  onSaveEvent={handleSaveCalendarEvent}
                  onDeleteEvent={handleDeleteCalendarEvent}
                  onToggleEventComplete={handleToggleCalendarEventComplete}
                />
              )}

              {activeTab === 'archive' && (
                <div className={`relative flex-1 p-3.5 sm:p-5 sm:pl-8 sm:pr-6 transition-colors duration-200 flex flex-col min-h-0 w-full max-w-full overflow-hidden ${
                  isDark ? 'bg-[#18181b] text-neutral-100' : 'bg-[#fdfbf7] text-neutral-900'
                }`}>
                  <div className={`absolute top-0 bottom-0 left-0 w-px border-r-2 border-dashed ${
                    isDark ? 'border-neutral-700/60' : 'border-stone-300/80'
                  }`} />
                  <div className={`absolute top-0 bottom-0 left-3 sm:left-5 w-px ${
                    isDark ? 'bg-rose-500/20' : 'bg-rose-400/40'
                  }`} />
                  <div 
                    className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
                    style={{
                      backgroundImage: isDark
                        ? 'repeating-linear-gradient(to bottom, transparent, transparent 29px, rgba(255,255,255,0.06) 29px, rgba(255,255,255,0.06) 30px)'
                        : 'repeating-linear-gradient(to bottom, transparent, transparent 29px, rgba(0,0,0,0.06) 29px, rgba(0,0,0,0.06) 30px)'
                    }}
                  />
                  <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-y-auto pr-2">
                    <HistoryArchive
                      entries={journals}
                      conversations={conversations}
                      summaries={summaries}
                      onSelectEntry={(entry) => {
                        setCurrentEntry(entry);
                        setActiveTab('journal');
                      }}
                      onSelectConversation={handleSelectConversation}
                      onDeleteEntry={handleDeleteEntry}
                      onOpenFlipbook={() => setIsFlipbookOpen(true)}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'landscape' && (
                <InnerLandscapeView
                  synthesis={landscapeSynthesis}
                  entries={journals}
                  onSynthesize={handleSynthesizeLandscape}
                  isSynthesizing={isSynthesizing}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationSettingsView entriesCount={journals.length} />
              )}

              {activeTab === 'admin' && (
                <AdminDashboardView userRole={user?.role || 'user'} />
              )}
            </NotebookPageFlipper>
          </main>
        </div>
      </div>

      {/* MODALS */}
      <SummaryModal
        summary={activeSummary}
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
      />

      <InnerLandscapeModal
        synthesis={landscapeSynthesis}
        entries={journals}
        onSynthesize={handleSynthesizeLandscape}
        isSynthesizing={isSynthesizing}
        isOpen={isLandscapeModalOpen}
        onClose={() => setIsLandscapeModalOpen(false)}
      />

      <FlipbookReader
        entries={journals}
        isOpen={isFlipbookOpen}
        onClose={() => setIsFlipbookOpen(false)}
        onSelectEntry={(entry) => {
          setCurrentEntry(entry);
          setActiveTab('journal');
        }}
        onNewReflection={() => {
          setCurrentEntry({
            title: '',
            content: '',
            mood: 'thoughtful',
            intention: 'free_expression',
            entryDate: new Date().toISOString().slice(0, 10)
          });
          setActiveTab('journal');
          setIsFlipbookOpen(false);
        }}
        onOpenSparks={() => {
          setIsFlipbookOpen(false);
          setIsSparksOpen(true);
        }}
      />

      <PromptSparkModal
        isOpen={isSparksOpen}
        onClose={() => setIsSparksOpen(false)}
        onSelectSpark={handleSelectSpark}
      />

      {/* Accessible Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border text-xs shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200 ${
          isDark
            ? 'bg-neutral-900/90 border-emerald-500/30 text-emerald-300'
            : 'bg-white/95 border-emerald-500/40 text-emerald-800 shadow-emerald-500/10'
        }`}>
          {toastMessage}
        </div>
      )}

    </div>
  );
}
