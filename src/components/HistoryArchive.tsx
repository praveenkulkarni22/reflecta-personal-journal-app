import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  MessageSquare, 
  Search, 
  Calendar, 
  Trash2, 
  ArrowRight, 
  Sparkles, 
  Filter, 
  BookMarked,
  Clock,
  Layers,
  FileText,
  Smile,
  Compass,
  MapPin,
  Image as ImageIcon
} from 'lucide-react';
import { JournalEntry, Conversation, ConversationSummary } from '../types';
import { formatTimeAgo, formatFullDate, calculateReadingTimeMinutes } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

interface HistoryArchiveProps {
  entries: JournalEntry[];
  conversations: Conversation[];
  summaries: ConversationSummary[];
  onSelectEntry: (entry: JournalEntry) => void;
  onSelectConversation: (conv: Conversation) => void;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onOpenFlipbook: () => void;
}

export const HistoryArchive: React.FC<HistoryArchiveProps> = ({
  entries,
  conversations,
  summaries,
  onSelectEntry,
  onSelectConversation,
  onDeleteEntry,
  onOpenFlipbook
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeSection, setActiveSection] = useState<'journals' | 'conversations' | 'summaries'>('journals');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');

  const filteredEntries = entries.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMood = selectedMood === 'all' || e.mood === selectedMood;
    return matchesSearch && matchesMood;
  });

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessageSnippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSummaries = summaries.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.mainThemes.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto space-y-6"
    >
      
      {/* Top Header & Search Bar (Bento Master Header) */}
      <div className={`p-6 sm:p-8 rounded-3xl border transition-all duration-300 backdrop-blur-2xl space-y-5 ${
        isDark
          ? 'bg-neutral-900/80 border-white/[0.09] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)]'
          : 'bg-white/85 border-black/[0.06] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
      }`}>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className={`text-[10px] font-mono uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              Private Personal Vault
            </span>
            <h2 className={`font-serif text-2xl sm:text-3xl font-medium ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
              Volume Archive & Past Dialogues
            </h2>
          </div>

          {entries.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenFlipbook}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 text-xs font-semibold shadow-[0_4px_14px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.3)] transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Flipbook Reader Mode</span>
            </motion.button>
          )}
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
          
          <div className="sm:col-span-8 relative">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across your thoughts, themes, or insights..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs outline-none transition-all ${
                isDark
                  ? 'bg-neutral-950/70 border border-white/[0.08] focus:border-emerald-500/50 text-neutral-200 placeholder:text-neutral-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                  : 'bg-white border border-black/[0.08] focus:border-emerald-500/50 text-neutral-800 placeholder:text-neutral-400 shadow-2xs'
              }`}
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none cursor-pointer transition-all ${
                isDark
                  ? 'bg-neutral-950/70 border border-white/[0.08] text-neutral-300 focus:border-emerald-500/50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]'
                  : 'bg-white border border-black/[0.08] text-neutral-700 focus:border-emerald-500/50 shadow-2xs'
              }`}
            >
              <option value="all">All Moods</option>
              <option value="calm">🍃 Calm</option>
              <option value="peaceful">🕊️ Peaceful</option>
              <option value="thoughtful">💭 Thoughtful</option>
              <option value="grateful">✨ Grateful</option>
              <option value="energized">⚡ Energized</option>
              <option value="curious">🔭 Curious</option>
              <option value="searching">🧭 Searching</option>
              <option value="overwhelmed">🌊 Overwhelmed</option>
              <option value="disappointed">🌧️ Disappointed</option>
              <option value="sorrow">🥀 Sorrow</option>
              <option value="disgusted">🌪️ Disgusted</option>
              <option value="anxious">⚡ Anxious</option>
              <option value="frustrated">🌋 Frustrated</option>
              <option value="vulnerable">🪶 Vulnerable</option>
              <option value="exhausted">🍂 Exhausted</option>
              <option value="melancholy">🕯️ Melancholy</option>
            </select>
          </div>

        </div>

        {/* Tab Switcher */}
        <div className={`flex items-center gap-2 border-t pt-4 ${isDark ? 'border-white/[0.08]' : 'border-black/[0.06]'}`}>
          
          <button
            onClick={() => setActiveSection('journals')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeSection === 'journals'
                ? isDark
                  ? 'bg-neutral-800 text-emerald-300 border border-white/[0.1] shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'bg-white text-emerald-700 border border-black/[0.08] shadow-sm'
                : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Journal Entries ({filteredEntries.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('conversations')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeSection === 'conversations'
                ? isDark
                  ? 'bg-neutral-800 text-emerald-300 border border-white/[0.1] shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'bg-white text-emerald-700 border border-black/[0.08] shadow-sm'
                : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Reflect Dialogues ({filteredConversations.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('summaries')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeSection === 'summaries'
                ? isDark
                  ? 'bg-neutral-800 text-emerald-300 border border-white/[0.1] shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'bg-white text-emerald-700 border border-black/[0.08] shadow-sm'
                : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Distilled Summaries ({filteredSummaries.length})</span>
          </button>

        </div>

      </div>

      {/* SECTION 1: BENTO GRID JOURNAL ENTRIES */}
      {activeSection === 'journals' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEntries.length === 0 ? (
            <div className={`col-span-2 p-12 text-center rounded-3xl border space-y-2 ${
              isDark ? 'bg-neutral-900/40 border-white/[0.06] text-neutral-500' : 'bg-white/50 border-black/[0.06] text-neutral-400'
            }`}>
              <BookOpen className="w-8 h-8 mx-auto opacity-60" />
              <p className="text-sm">No journal entries found matching your query.</p>
            </div>
          ) : (
            filteredEntries.map(entry => (
              <motion.div
                key={entry.id}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 22 }}
                onClick={() => onSelectEntry(entry)}
                className={`bento-card-hover group relative p-6 rounded-3xl border transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 backdrop-blur-xl ${
                  isDark
                    ? 'bg-neutral-900/75 border-white/[0.08] shadow-[0_15px_35px_-10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'bg-white/85 border-black/[0.06] shadow-[0_15px_35px_-10px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[11px] font-mono flex items-center gap-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      <Clock className={`w-3 h-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <span>{formatTimeAgo(entry.createdAt)}</span>
                    </span>
                    {entry.mood && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium capitalize border ${
                        isDark
                          ? 'bg-neutral-800 text-emerald-300 border-neutral-700/60'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {entry.mood}
                      </span>
                    )}
                  </div>

                  <h3 className={`font-serif text-lg font-medium transition-colors line-clamp-1 mb-2 ${
                    isDark ? 'text-neutral-100 group-hover:text-emerald-300' : 'text-neutral-900 group-hover:text-emerald-600'
                  }`}>
                    {entry.title}
                  </h3>

                  {/* Location & Photo badges if present */}
                  {(entry.location || (entry.photos && entry.photos.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-[10px]">
                      {entry.location && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[130px]">{entry.location.name}</span>
                        </span>
                      )}
                      {entry.photos && entry.photos.length > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                          <ImageIcon className="w-2.5 h-2.5" />
                          <span>{entry.photos.length} {entry.photos.length === 1 ? 'photo' : 'photos'}</span>
                        </span>
                      )}
                    </div>
                  )}

                  <p className={`text-xs leading-relaxed line-clamp-3 font-light ${
                    isDark ? 'text-neutral-400' : 'text-neutral-600'
                  }`}>
                    {entry.content}
                  </p>
                </div>

                <div className={`flex items-center justify-between pt-3 border-t text-[11px] ${
                  isDark ? 'border-white/[0.06] text-neutral-400' : 'border-black/[0.06] text-neutral-500'
                }`}>
                  <span>{entry.wordCount} words</span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Delete this reflection entry from your vault?')) {
                          onDeleteEntry(entry.id);
                        }
                      }}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-neutral-400 hover:text-rose-500 transition-colors"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className={`flex items-center gap-1 font-medium group-hover:translate-x-1 transition-transform ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}>
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* SECTION 2: CONVERSATIONS */}
      {activeSection === 'conversations' && (
        <div className="space-y-3">
          {filteredConversations.length === 0 ? (
            <div className={`p-12 text-center rounded-3xl border space-y-2 ${
              isDark ? 'bg-neutral-900/40 border-white/[0.06] text-neutral-500' : 'bg-white/50 border-black/[0.06] text-neutral-400'
            }`}>
              <MessageSquare className="w-8 h-8 mx-auto opacity-60" />
              <p className="text-sm">No conversations found.</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <motion.div
                key={conv.id}
                whileHover={{ y: -2 }}
                onClick={() => onSelectConversation(conv)}
                className={`group p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 backdrop-blur-xl ${
                  isDark
                    ? 'bg-neutral-900/75 border-white/[0.08] hover:border-emerald-500/40 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'bg-white/85 border-black/[0.06] hover:border-emerald-500/40 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)]'
                }`}
              >
                <div className="space-y-1 max-w-xl">
                  <h4 className={`font-serif text-base transition-colors ${
                    isDark ? 'text-neutral-100 group-hover:text-emerald-300' : 'text-neutral-900 group-hover:text-emerald-600'
                  }`}>
                    {conv.title}
                  </h4>
                  <p className={`text-xs line-clamp-1 font-light ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                    {conv.lastMessageSnippet || 'Reflection session with Gemini'}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[11px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {formatTimeAgo(conv.updatedAt)}
                  </span>
                  <div className={`p-2 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-neutral-800 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-neutral-950'
                      : 'bg-neutral-100 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white'
                  }`}>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* SECTION 3: BENTO SUMMARIES */}
      {activeSection === 'summaries' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSummaries.length === 0 ? (
            <div className={`col-span-2 p-12 text-center rounded-3xl border space-y-2 ${
              isDark ? 'bg-neutral-900/40 border-white/[0.06] text-neutral-500' : 'bg-white/50 border-black/[0.06] text-neutral-400'
            }`}>
              <Layers className="w-8 h-8 mx-auto opacity-60" />
              <p className="text-sm">No distilled summaries found.</p>
            </div>
          ) : (
            filteredSummaries.map(sum => (
              <div
                key={sum.id}
                className={`p-6 rounded-3xl border space-y-4 backdrop-blur-xl ${
                  isDark
                    ? 'bg-neutral-900/75 border-white/[0.08] shadow-[0_15px_35px_-10px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'bg-white/85 border-black/[0.06] shadow-[0_15px_35px_-10px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)]'
                }`}
              >
                <div>
                  <span className={`text-[10px] font-mono uppercase ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    Distilled {formatTimeAgo(sum.createdAt)}
                  </span>
                  <h4 className={`font-serif text-lg font-semibold mt-1 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                    {sum.title}
                  </h4>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {sum.mainThemes.map((t, idx) => (
                    <span
                      key={idx}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                        isDark
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className={`p-3.5 rounded-xl text-xs space-y-1 border ${
                  isDark
                    ? 'bg-neutral-950/60 border-white/[0.06] text-neutral-300'
                    : 'bg-teal-50/60 border-teal-200/60 text-neutral-800'
                }`}>
                  <p className={`text-[10px] font-mono uppercase font-semibold ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
                    Key Breakthrough:
                  </p>
                  <p className="font-light italic line-clamp-2">
                    "{sum.keyInsights[0] || 'Clarified internal priorities.'}"
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </motion.div>
  );
};
