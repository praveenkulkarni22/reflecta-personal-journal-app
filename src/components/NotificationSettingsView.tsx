import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Shield, 
  RefreshCw, 
  MessageSquare,
  Zap,
  Check
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUserToken, auth } from '../lib/firebase';
import { 
  fetchUserNotificationSettings, 
  saveUserNotificationSetting, 
  deleteUserNotificationSetting 
} from '../lib/firestoreService';
import { NotificationSetting, NotificationEventRecord, NotificationEventType, NotificationProvider } from '../types';

const AVAILABLE_EVENT_TYPES: { id: NotificationEventType; label: string; description: string; emoji: string }[] = [
  { id: 'goal', label: 'Goals & Milestones', description: 'Intentions, commitments, and target habits', emoji: '🎯' },
  { id: 'idea', label: 'Ideas & Sparks', description: 'Creative proposals, brainstorming, and concepts', emoji: '💡' },
  { id: 'reminder', label: 'Mindful Reminders', description: 'Action items, notes-to-self, and dates', emoji: '⏰' },
  { id: 'highlight', label: 'Joyful Highlights', description: 'Standout achievements, celebrations, and gratitude peaks', emoji: '✨' },
  { id: 'reflection', label: 'Deep Reflections', description: 'General contemplative prose and emotional synthesis', emoji: '🌿' }
];

interface NotificationSettingsViewProps {
  entriesCount?: number;
}

export const NotificationSettingsView: React.FC<NotificationSettingsViewProps> = ({
  entriesCount = 0
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [history, setHistory] = useState<NotificationEventRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<Record<string, {
    loading: boolean;
    success?: boolean;
    error?: string;
    message?: string;
    previewUrl?: string;
    transport?: string;
  }>>({});

  // Form State for new Channel (Slack or Discord)
  const [provider, setProvider] = useState<'slack' | 'discord'>('slack');
  const [channelName, setChannelName] = useState<string>('');
  const [destinationUrl, setDestinationUrl] = useState<string>('');
  const [selectedEvents, setSelectedEvents] = useState<NotificationEventType[]>(['goal', 'idea', 'reminder', 'highlight']);
  const [privacyLevel, setPrivacyLevel] = useState<'minimal' | 'with_summary'>('minimal');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchData = async () => {
    const token = await getCurrentUserToken();
    const currentUid = auth.currentUser?.uid;
    if (!token && !currentUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let loadedSettings: NotificationSetting[] = [];
      let loadedHistory: NotificationEventRecord[] = [];

      // 1. Fetch from server API
      if (token) {
        try {
          const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          };

          const [settingsRes, historyRes] = await Promise.all([
            fetch('/api/notifications/settings', { headers }),
            fetch('/api/notifications/history', { headers })
          ]);

          if (settingsRes.ok) {
            const data = await settingsRes.json();
            if (data.settings && Array.isArray(data.settings)) {
              loadedSettings = data.settings;
            }
          }
          if (historyRes.ok) {
            const data = await historyRes.json();
            if (data.events && Array.isArray(data.events)) {
              loadedHistory = data.events;
            }
          }
        } catch (serverErr) {
          console.warn('Server notification fetch warning:', serverErr);
        }
      }

      // 2. Fetch directly from Firestore to ensure persistent webhooks across reboots & logouts
      if (currentUid) {
        try {
          const clientSettings = await fetchUserNotificationSettings(currentUid);
          if (clientSettings && clientSettings.length > 0) {
            const map = new Map<string, NotificationSetting>();
            // Add client settings with stable unique keys
            for (let i = 0; i < clientSettings.length; i++) {
              const s = clientSettings[i];
              const safeId = s.id || `setting-client-${i}`;
              map.set(safeId, { ...s, id: safeId });
            }
            // Merge with server settings (which has masked URLs and server validation)
            for (let j = 0; j < loadedSettings.length; j++) {
              const s = loadedSettings[j];
              const safeId = s.id || `setting-server-${j}`;
              const existing = map.get(safeId);
              map.set(safeId, existing ? { ...existing, ...s, id: safeId } : { ...s, id: safeId });
            }
            loadedSettings = Array.from(map.values());

            // If server store had no settings (e.g. after server reload/restart), re-sync them to server
            if (token && (!loadedSettings || loadedSettings.length > 0)) {
              for (const s of clientSettings) {
                if (s.provider && (s.destinationUrl || s.recipientEmail)) {
                  fetch('/api/notifications/settings', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      id: s.id,
                      provider: s.provider,
                      channelName: s.channelName || `${s.provider.toUpperCase()} Alerts`,
                      destinationUrl: s.destinationUrl,
                      recipientEmail: s.recipientEmail,
                      eventTypes: s.eventTypes || ['reflection', 'goal', 'highlight'],
                      privacyLevel: s.privacyLevel || 'with_summary',
                      enabled: s.enabled ?? true
                    })
                  }).catch(() => {});
                }
              }
            }
          }
        } catch (fsErr) {
          console.warn('Firestore settings read warning:', fsErr);
        }
      }

      // Filter exclusively for configured Discord and Slack webhooks, removing EmailDigest
      const normalizedSettings = loadedSettings
        .filter(s => s.provider === 'slack' || s.provider === 'discord')
        .map((s, idx) => ({
          ...s,
          id: s.id || `setting-${idx}-${Date.now()}`
        }));

      // Ensure every history item belongs to active webhook providers
      const normalizedHistory = loadedHistory
        .filter(h => h.provider === 'slack' || h.provider === 'discord')
        .map((h, idx) => ({
          ...h,
          id: h.id || `evt-${idx}-${h.deliveredAt || Date.now()}`
        }));

      setSettings(normalizedSettings);
      setHistory(normalizedHistory);
    } catch (err) {
      console.error('Failed to load notifications data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleEvent = (type: NotificationEventType) => {
    setSelectedEvents(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const token = await getCurrentUserToken();
    const currentUid = auth.currentUser?.uid;
    if (!token) {
      setFormError('Please sign in to configure alerts.');
      return;
    }

    if (selectedEvents.length === 0) {
      setFormError('Please select at least one reflection category.');
      return;
    }

    if (!destinationUrl.trim()) {
      setFormError(`Please enter a valid webhook URL for ${provider.toUpperCase()}.`);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          channelName: channelName.trim() || `${provider.toUpperCase()} Alerts`,
          destinationUrl: destinationUrl.trim(),
          eventTypes: selectedEvents,
          privacyLevel,
          enabled: true
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Also persist directly into Cloud Firestore for persistent storage across app restarts & sessions
        if (currentUid && data.setting) {
          try {
            await saveUserNotificationSetting(currentUid, {
              ...data.setting,
              destinationUrl: destinationUrl.trim(),
              userId: currentUid
            });
          } catch (fsErr) {
            console.warn('Client Firestore save notification note:', fsErr);
          }
        }

        setIsAdding(false);
        setDestinationUrl('');
        setChannelName('');
        await fetchData();
      } else {
        setFormError(data.error || 'Failed to register notification destination');
      }
    } catch (err: any) {
      setFormError(err.message || 'Network error saving setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSetting = async (id: string) => {
    const token = await getCurrentUserToken();
    const currentUid = auth.currentUser?.uid;
    setSettings(prev => prev.filter(s => s.id !== id));

    // Delete from Firestore directly
    if (currentUid) {
      deleteUserNotificationSetting(currentUid, id).catch(() => {});
    }

    // Delete from server API
    if (token) {
      try {
        await fetch(`/api/notifications/settings/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  const handleTestPing = async (setting: NotificationSetting) => {
    const token = await getCurrentUserToken();
    if (!token) return;
    setTestStatus(prev => ({ ...prev, [setting.id]: { loading: true } }));

    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          settingId: setting.id,
          provider: setting.provider,
          destinationUrl: setting.destinationUrl,
          privacyLevel: setting.privacyLevel
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTestStatus(prev => ({
          ...prev,
          [setting.id]: {
            loading: false,
            success: true,
            message: data.message || 'Test alert transmitted successfully to webhook!'
          }
        }));
        await fetchData(); // Refresh history
      } else {
        setTestStatus(prev => ({
          ...prev,
          [setting.id]: {
            loading: false,
            success: false,
            error: data.error || 'Failed to dispatch test notification'
          }
        }));
      }
    } catch (err: any) {
      setTestStatus(prev => ({ ...prev, [setting.id]: { loading: false, success: false, error: err.message } }));
    }
  };

  return (
    <div className="relative flex-1 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden animate-in fade-in duration-300">
      
      {/* SPIRAL NOTEBOOK PAPER PAGE */}
      <div 
        className={`relative flex-1 p-3.5 sm:p-5 sm:pl-8 sm:pr-6 transition-colors duration-200 flex flex-col min-h-0 w-full max-w-full overflow-x-hidden ${
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

        {/* NOTEBOOK CONTENT CONTAINER */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-y-auto pr-1 sm:pr-2 space-y-5">
          
          {/* Notebook Page Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-xs shrink-0 ${
                isDark
                  ? 'bg-neutral-900/90 border-[#67C3DE]/30 text-[#67C3DE]'
                  : 'bg-white border-[#67C3DE]/40 text-[#083847] shadow-xs'
              }`}>
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                    isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                  }`}>
                    Integrations Suite
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                    isDark ? 'bg-[#67C3DE]/15 text-[#67C3DE] border-[#67C3DE]/30' : 'bg-[#67C3DE]/20 text-[#083847] border-[#67C3DE]/40'
                  }`}>
                    {settings.length} Active {settings.length === 1 ? 'Channel' : 'Channels'}
                  </span>
                </div>
                <h2 className={`font-serif text-xl sm:text-2xl font-medium tracking-tight ${
                  isDark ? 'text-neutral-100' : 'text-neutral-900'
                }`}>
                  Alerts & Webhooks
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Channel</span>
                </button>
              )}
            </div>
          </div>

          {/* Privacy & Zero-Trust Notice */}
          <div className={`px-4 py-2.5 rounded-xl border flex items-start sm:items-center gap-2 text-[11px] font-mono ${
            isDark ? 'bg-neutral-900/60 border-white/5 text-neutral-300' : 'bg-stone-50 border-stone-200 text-stone-700'
          }`}>
            <Shield className="w-4 h-4 text-teal-500 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>Zero-Trust Security & Data Minimization:</strong> Webhooks transmit only sanitized metadata. Your private journal content remains encrypted and isolated in Firestore.
            </span>
          </div>

          {/* Body */}
          <div className="space-y-6">
            {/* ADD CHANNEL FORM */}
            {isAdding && (
              <motion.form
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSaveSetting}
                className={`p-5 rounded-2xl border space-y-4 ${
                  isDark ? 'bg-neutral-900/80 border-teal-500/30' : 'bg-white border-stone-200 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif text-sm font-semibold text-teal-500">Configure New Notification Destination</span>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {/* Provider Selector - Slack & Discord Webhooks */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'slack', label: 'Slack Webhook', icon: MessageSquare },
                    { id: 'discord', label: 'Discord Webhook', icon: Zap }
                  ].map(p => {
                    const PIcon = p.icon;
                    const isSel = provider === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setProvider(p.id as any)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-medium transition-all cursor-pointer ${
                          isSel
                            ? 'bg-teal-500/20 text-teal-400 border-teal-500/50 shadow-xs'
                            : isDark
                            ? 'bg-black/40 border-white/5 text-neutral-400'
                            : 'bg-stone-50 border-stone-200 text-neutral-700 hover:bg-stone-100'
                        }`}
                      >
                        <PIcon className="w-4 h-4" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Channel Name */}
                <div>
                  <label className="text-xs font-mono opacity-70 block mb-1">Friendly Name (Optional)</label>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="e.g. #mindful-growth or Work Alerts"
                    className={`w-full max-w-full px-3.5 py-2 rounded-xl text-xs border outline-none box-border ${
                      isDark ? 'bg-neutral-800 border-white/10 text-white' : 'bg-stone-50 border-stone-300 text-black focus:border-teal-500'
                    }`}
                  />
                </div>

                {/* Webhook Destination Input */}
                <div className="min-w-0 w-full">
                  <label className="text-xs font-mono opacity-70 block mb-1">
                    {provider.toUpperCase()} Webhook URL (HTTPS Required)
                  </label>
                  <input
                    type="url"
                    required
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder={provider === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://discord.com/api/webhooks/...'}
                    className={`w-full max-w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none box-border ${
                      isDark ? 'bg-neutral-800 border-white/10 text-white' : 'bg-stone-50 border-stone-300 text-black focus:border-teal-500'
                    }`}
                  />
                </div>

                {/* Event Subscriptions */}
                <div>
                  <label className="text-xs font-mono opacity-70 block mb-1.5">Trigger on Event Categories</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {AVAILABLE_EVENT_TYPES.map(ev => {
                      const isChecked = selectedEvents.includes(ev.id);
                      return (
                        <button
                          type="button"
                          key={ev.id}
                          onClick={() => handleToggleEvent(ev.id)}
                          className={`p-2.5 rounded-xl border text-left flex items-start gap-2 text-xs transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-teal-500/10 border-teal-500/40 text-teal-300'
                              : isDark
                              ? 'bg-black/30 border-white/5 opacity-60'
                              : 'bg-stone-50 border-stone-200 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <span className="text-sm shrink-0">{ev.emoji}</span>
                          <div>
                            <span className="font-semibold block">{ev.label}</span>
                            <span className="text-[10px] opacity-75 font-mono">{ev.description}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Privacy Level */}
                <div>
                  <label className="text-xs font-mono opacity-70 block mb-1">Privacy Scope</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPrivacyLevel('minimal')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        privacyLevel === 'minimal'
                          ? 'bg-teal-500/20 border-teal-500/40 text-teal-400 font-semibold'
                          : isDark ? 'bg-black/30 border-white/5 opacity-60' : 'bg-stone-50 border-stone-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <span className="block font-medium">Minimal Metadata Only</span>
                      <span className="text-[10px] opacity-75 font-mono block">Title + Tag + Timestamp only</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrivacyLevel('with_summary')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        privacyLevel === 'with_summary'
                          ? 'bg-teal-500/20 border-teal-500/40 text-teal-400 font-semibold'
                          : isDark ? 'bg-black/30 border-white/5 opacity-60' : 'bg-stone-50 border-stone-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <span className="block font-medium">Include Safe Essence</span>
                      <span className="text-[10px] opacity-75 font-mono block">Includes 1-sentence safe takeaway</span>
                    </button>
                  </div>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-all cursor-pointer"
                  >
                    {isSaving ? 'Registering...' : 'Save Channel'}
                  </button>
                </div>
              </motion.form>
            )}

            {/* LIST OF REGISTERED CHANNELS */}
            {loading ? (
              <div className="py-12 flex justify-center opacity-60">
                <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
              </div>
            ) : settings.length === 0 && !isAdding ? (
              <div className={`p-8 rounded-2xl border text-center space-y-3 ${
                isDark ? 'bg-neutral-900/40 border-white/5' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <Bell className="w-8 h-8 mx-auto text-teal-500 opacity-60" />
                <h4 className="font-serif text-sm font-semibold">No notification destinations configured</h4>
                <p className="text-xs opacity-70 max-w-sm mx-auto">
                  Connect Slack or Discord webhooks to receive mindful summaries when you log goals, sparks, or milestones.
                </p>
              </div>
            ) : (
              <div className="space-y-3 min-w-0 w-full max-w-full">
                {settings.map((s, sIdx) => {
                  const settingKey = s.id ? `setting-${s.id}` : `setting-${sIdx}-${s.provider}-${s.destinationUrl || ''}`;
                  const testState = s.id ? testStatus[s.id] : undefined;
                  return (
                    <div
                      key={settingKey}
                      className={`p-4 rounded-2xl border flex flex-col gap-3.5 min-w-0 w-full max-w-full overflow-hidden ${
                        isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0 w-full">
                        {/* Channel Details & Wrapped Webhook */}
                        <div className="space-y-2.5 min-w-0 flex-1 w-full overflow-hidden">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="font-serif font-semibold text-sm break-words">{s.channelName}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-teal-500/20 text-teal-300 shrink-0">
                              {s.provider}
                            </span>
                          </div>

                          {/* Wrapped Webhook Destination URL Box */}
                          <div className={`p-2.5 rounded-xl border text-xs font-mono min-w-0 w-full max-w-full overflow-hidden ${
                            isDark ? 'bg-black/30 border-white/5 text-neutral-300' : 'bg-stone-50 border-stone-200 text-stone-700'
                          }`}>
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block mb-1">
                              Webhook Destination URL:
                            </span>
                            <p className="break-all whitespace-normal break-words leading-relaxed select-all min-w-0 w-full">
                              {s.destinationUrlMasked || s.destinationUrl}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 min-w-0">
                            {s.eventTypes?.map((ev, evIdx) => (
                              <span 
                                key={`${settingKey}-ev-${ev}-${evIdx}`} 
                                className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/20 dark:bg-white/10 uppercase shrink-0"
                              >
                                {ev}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons: Always visible and aligned without horizontal scrolling */}
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                          <button
                            onClick={() => handleTestPing(s)}
                            disabled={testState?.loading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                              isDark ? 'bg-neutral-800 hover:bg-neutral-700 border-white/10 text-neutral-200' : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-black'
                            }`}
                          >
                            <Send className={`w-3 h-3 shrink-0 ${testState?.loading ? 'animate-spin' : ''}`} />
                            <span>{testState?.loading ? 'Dispatching...' : 'Test Alert'}</span>
                          </button>

                          <button
                            onClick={() => handleDeleteSetting(s.id)}
                            className="p-1.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer shrink-0"
                            title="Remove Webhook Channel"
                          >
                            <Trash2 className="w-4 h-4 shrink-0" />
                          </button>
                        </div>
                      </div>

                      {/* Dynamic Test Feedback */}
                      {testState && !testState.loading && (
                        <div className={`p-3 rounded-xl text-xs flex flex-col gap-1.5 border transition-all min-w-0 w-full max-w-full overflow-hidden ${
                          testState.success
                            ? (isDark ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50 border-emerald-300 text-emerald-900')
                            : (isDark ? 'bg-red-950/40 border-red-500/30 text-red-200' : 'bg-red-50 border-red-300 text-red-900')
                        }`}>
                          <div className="flex items-start gap-2 font-medium min-w-0 w-full">
                            <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${testState.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="break-words break-all leading-relaxed min-w-0 flex-1">
                              {testState.message || (testState.success ? 'Test alert transmitted successfully to webhook!' : testState.error)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* DELIVERY HISTORY LOG */}
            {history.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] min-w-0 w-full">
                <span className="font-serif text-sm font-semibold block">Recent Delivery Log</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto overflow-x-hidden pr-1 min-w-0 w-full">
                  {history.map((evt, evtIdx) => {
                    const eventKey = evt.id ? `history-${evt.id}` : `history-${evtIdx}-${evt.deliveredAt || ''}-${evt.provider}`;
                    return (
                      <div
                        key={eventKey}
                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono min-w-0 w-full max-w-full ${
                          evt.status === 'delivered'
                            ? isDark ? 'bg-black/20 border-white/5 text-neutral-300' : 'bg-stone-50 border-stone-200'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${evt.status === 'delivered' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="font-semibold uppercase text-teal-500 shrink-0">{evt.provider}</span>
                          <span className="opacity-75 break-words break-all truncate">{evt.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-[10px] opacity-60">
                          {evt.destinationMasked && (
                            <span className="break-all truncate max-w-[140px] sm:max-w-[220px]">{evt.destinationMasked}</span>
                          )}
                          <span>
                            {new Date(evt.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
