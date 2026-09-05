import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Bell, 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Shield, 
  RefreshCw, 
  ExternalLink,
  MessageSquare,
  Mail,
  Zap
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUserToken } from '../lib/firebase';
import { NotificationSetting, NotificationEventRecord, NotificationEventType, NotificationProvider } from '../types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_EVENT_TYPES: { id: NotificationEventType; label: string; description: string; emoji: string }[] = [
  { id: 'goal', label: 'Goals & Milestones', description: 'Intentions, commitments, and target habits', emoji: '🎯' },
  { id: 'idea', label: 'Ideas & Sparks', description: 'Creative proposals, brainstorming, and concepts', emoji: '💡' },
  { id: 'reminder', label: 'Mindful Reminders', description: 'Action items, notes-to-self, and dates', emoji: '⏰' },
  { id: 'highlight', label: 'Joyful Highlights', description: 'Standout achievements, celebrations, and gratitude peaks', emoji: '✨' },
  { id: 'reflection', label: 'Deep Reflections', description: 'General contemplative prose and emotional synthesis', emoji: '🌿' }
];

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [history, setHistory] = useState<NotificationEventRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<Record<string, { loading: boolean; success?: boolean; error?: string }>>({});

  // Form State for new Channel
  const [provider, setProvider] = useState<NotificationProvider>('slack');
  const [channelName, setChannelName] = useState<string>('');
  const [destinationUrl, setDestinationUrl] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [selectedEvents, setSelectedEvents] = useState<NotificationEventType[]>(['goal', 'idea', 'reminder', 'highlight']);
  const [privacyLevel, setPrivacyLevel] = useState<'minimal' | 'with_summary'>('minimal');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchData = async () => {
    const token = await getCurrentUserToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
        setSettings(data.settings || []);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load notifications data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleToggleEvent = (type: NotificationEventType) => {
    setSelectedEvents(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const token = await getCurrentUserToken();
    if (!token) {
      setFormError('Please sign in to configure alerts.');
      return;
    }

    if (selectedEvents.length === 0) {
      setFormError('Please select at least one reflection category.');
      return;
    }

    if ((provider === 'slack' || provider === 'discord') && !destinationUrl.trim()) {
      setFormError(`Please enter a valid webhook URL for ${provider.toUpperCase()}.`);
      return;
    }

    if (provider === 'email' && !recipientEmail.trim()) {
      setFormError('Please enter a recipient email address.');
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
          destinationUrl: (provider === 'slack' || provider === 'discord') ? destinationUrl.trim() : undefined,
          recipientEmail: provider === 'email' ? recipientEmail.trim() : undefined,
          eventTypes: selectedEvents,
          privacyLevel,
          enabled: true
        })
      });

      const data = await res.json();
      if (res.ok) {
        setIsAdding(false);
        setDestinationUrl('');
        setRecipientEmail('');
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
    if (!token) return;
    try {
      const res = await fetch(`/api/notifications/settings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSettings(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Delete error:', err);
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
          provider: setting.provider,
          destinationUrl: setting.destinationUrl,
          recipientEmail: setting.recipientEmail,
          privacyLevel: setting.privacyLevel
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTestStatus(prev => ({ ...prev, [setting.id]: { loading: false, success: true } }));
        await fetchData(); // Refresh history
      } else {
        setTestStatus(prev => ({ ...prev, [setting.id]: { loading: false, success: false, error: data.error } }));
      }
    } catch (err: any) {
      setTestStatus(prev => ({ ...prev, [setting.id]: { loading: false, success: false, error: err.message } }));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full max-w-2xl h-[88vh] max-h-[780px] rounded-3xl overflow-hidden border flex flex-col shadow-2xl ${
              isDark
                ? 'bg-[#141417] text-neutral-100 border-white/[0.12] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)]'
                : 'bg-[#faf8f5] text-neutral-900 border-stone-300 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-semibold tracking-tight">
                    External Notifications & Alerts
                  </h3>
                  <p className="text-xs opacity-70">
                    Slack • Discord • Email • Server-Side SSRF Protected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Privacy & Zero-Trust Notice */}
            <div className={`px-6 py-2.5 border-b flex items-center gap-2 text-[11px] font-mono ${
              isDark ? 'bg-neutral-900/60 border-white/5 text-neutral-300' : 'bg-stone-100/80 border-stone-200 text-stone-700'
            }`}>
              <Shield className="w-4 h-4 text-teal-500 shrink-0" />
              <span>
                <strong>Data Minimization:</strong> Alerts transmit only sanitized titles, category tags, and timestamps. Raw journals are never transmitted externally.
              </span>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
              {/* Channel List Header & Add Button */}
              <div className="flex items-center justify-between">
                <span className="font-serif text-base font-semibold">Active Channels</span>
                {!isAdding && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Channel</span>
                  </button>
                )}
              </div>

              {/* ADD CHANNEL FORM */}
              {isAdding && (
                <motion.form
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleSaveSetting}
                  className={`p-5 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-neutral-900/80 border-teal-500/30' : 'bg-white border-teal-600/30 shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-sm font-semibold text-teal-500">Configure New Notification Destination</span>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="text-xs opacity-60 hover:opacity-100"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Provider Selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'slack', label: 'Slack Webhook', icon: MessageSquare },
                      { id: 'discord', label: 'Discord Webhook', icon: Zap },
                      { id: 'email', label: 'Email Digest', icon: Mail }
                    ].map(p => {
                      const PIcon = p.icon;
                      const isSel = provider === p.id;
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setProvider(p.id as any)}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-medium transition-all cursor-pointer ${
                            isSel
                              ? 'bg-teal-500/20 text-teal-400 border-teal-500/50 shadow-xs'
                              : isDark
                              ? 'bg-black/40 border-white/5 text-neutral-400'
                              : 'bg-stone-50 border-stone-200 text-neutral-700'
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
                      placeholder="e.g. #mindful-growth or Work Slack"
                      className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none ${
                        isDark ? 'bg-neutral-800 border-white/10 text-white' : 'bg-stone-50 border-stone-300 text-black'
                      }`}
                    />
                  </div>

                  {/* Destination Input */}
                  {provider === 'email' ? (
                    <div>
                      <label className="text-xs font-mono opacity-70 block mb-1">Recipient Email Address</label>
                      <input
                        type="email"
                        required
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none ${
                          isDark ? 'bg-neutral-800 border-white/10 text-white' : 'bg-stone-50 border-stone-300 text-black'
                        }`}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-mono opacity-70 block mb-1">
                        {provider.toUpperCase()} Webhook URL (HTTPS Required)
                      </label>
                      <input
                        type="url"
                        required
                        value={destinationUrl}
                        onChange={(e) => setDestinationUrl(e.target.value)}
                        placeholder={provider === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://discord.com/api/webhooks/...'}
                        className={`w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none ${
                          isDark ? 'bg-neutral-800 border-white/10 text-white' : 'bg-stone-50 border-stone-300 text-black'
                        }`}
                      />
                    </div>
                  )}

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
                                : 'bg-stone-50 border-stone-200 opacity-60'
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
                            : isDark ? 'bg-black/30 border-white/5 opacity-60' : 'bg-stone-50 border-stone-200 opacity-60'
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
                            : isDark ? 'bg-black/30 border-white/5 opacity-60' : 'bg-stone-50 border-stone-200 opacity-60'
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
                      className="px-4 py-2 rounded-xl text-xs font-medium opacity-70 hover:opacity-100"
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
                <div className={`p-8 rounded-2xl border text-center space-y-2 ${
                  isDark ? 'bg-neutral-900/40 border-white/5' : 'bg-white border-stone-200 shadow-2xs'
                }`}>
                  <Bell className="w-8 h-8 mx-auto text-teal-500 opacity-60" />
                  <h4 className="font-serif text-sm font-semibold">No notification destinations configured</h4>
                  <p className="text-xs opacity-70 max-w-sm mx-auto">
                    Connect Slack, Discord, or Email to receive mindful summaries when you log goals, sparks, or milestones.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settings.map(s => {
                    const testState = testStatus[s.id];
                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-semibold text-sm">{s.channelName}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-teal-500/20 text-teal-300">
                              {s.provider}
                            </span>
                          </div>
                          <p className="text-xs font-mono opacity-60 truncate">
                            Destination: {s.destinationUrl ? (s.destinationUrl.length > 32 ? s.destinationUrl.slice(0, 20) + '...' + s.destinationUrl.slice(-8) : s.destinationUrl) : s.recipientEmail}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {s.eventTypes.map(ev => (
                              <span key={ev} className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-black/20 dark:bg-white/10 uppercase">
                                {ev}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleTestPing(s)}
                            disabled={testState?.loading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                              isDark ? 'bg-neutral-800 hover:bg-neutral-700 border-white/10 text-neutral-200' : 'bg-stone-100 hover:bg-stone-200 border-stone-300'
                            }`}
                          >
                            <Send className={`w-3 h-3 ${testState?.loading ? 'animate-spin' : ''}`} />
                            <span>{testState?.loading ? 'Pinging...' : 'Test Alert'}</span>
                          </button>

                          <button
                            onClick={() => handleDeleteSetting(s.id)}
                            className="p-1.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                            title="Remove Channel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* DELIVERY HISTORY LOG */}
              {history.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <span className="font-serif text-sm font-semibold block">Recent Delivery Log</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {history.map(evt => (
                      <div
                        key={evt.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
                          evt.status === 'delivered'
                            ? isDark ? 'bg-black/20 border-white/5 text-neutral-300' : 'bg-stone-50 border-stone-200'
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-2 h-2 rounded-full ${evt.status === 'delivered' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className="font-semibold uppercase">{evt.provider}</span>
                          <span className="opacity-75 truncate">{evt.title}</span>
                        </div>
                        <span className="text-[10px] opacity-60 shrink-0">
                          {new Date(evt.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
