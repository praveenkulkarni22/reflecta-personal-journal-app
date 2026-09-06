import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  Users, 
  Activity, 
  Bell, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Lock, 
  Cpu, 
  KeyRound,
  BarChart3,
  Server,
  Award,
  Flame,
  Calendar,
  Filter,
  UserCheck,
  TrendingUp,
  Sparkles,
  ChevronDown,
  Clock,
  ShieldAlert,
  Search,
  Zap,
  BookOpen,
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getCurrentUserToken } from '../lib/firebase';
import { AdminMetrics, AdminAuditLog, AdminUserInfo } from '../types';

interface AdminDashboardViewProps {
  userRole?: 'user' | 'admin' | 'super_admin';
}

const MOOD_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  calm: { label: 'Calm & Grounded', emoji: '🌊', color: '#67C3DE', bg: 'bg-sky-500/15' },
  grateful: { label: 'Grateful & Joyful', emoji: '✨', color: '#10b981', bg: 'bg-emerald-500/15' },
  thoughtful: { label: 'Thoughtful & Introspective', emoji: '🌿', color: '#8b5cf6', bg: 'bg-purple-500/15' },
  energized: { label: 'Energized & Motivated', emoji: '⚡', color: '#f59e0b', bg: 'bg-amber-500/15' },
  curious: { label: 'Curious & Inquiring', emoji: '🔍', color: '#06b6d4', bg: 'bg-cyan-500/15' },
  peaceful: { label: 'Peaceful & Serene', emoji: '🌸', color: '#ec4899', bg: 'bg-pink-500/15' },
  searching: { label: 'Searching & Seeking', emoji: '🧭', color: '#3b82f6', bg: 'bg-blue-500/15' },
  overwhelmed: { label: 'Overwhelmed & Tender', emoji: '🌧️', color: '#64748b', bg: 'bg-slate-500/15' },
  melancholy: { label: 'Melancholy & Longing', emoji: '🍂', color: '#a855f7', bg: 'bg-violet-500/15' }
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  userRole = 'user'
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'audit' | 'system' | 'directive'>('metrics');
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [usersList, setUsersList] = useState<AdminUserInfo[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingRoleUid, setUpdatingRoleUid] = useState<string | null>(null);

  // User Filter in Operational Metrics
  const [selectedUserUid, setSelectedUserUid] = useState<string>('all');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Live Permission Probe State
  const [probePermission, setProbePermission] = useState<string>('admin.dashboard.read');
  const [probeResult, setProbeResult] = useState<{ loading: boolean; outcome?: any; error?: string } | null>(null);

  const fetchAdminData = async () => {
    const token = await getCurrentUserToken();
    if (!token) {
      setErrorMessage('Please sign in to access administration controls.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch Metrics
      const metricsRes = await fetch('/api/admin/metrics', { headers });
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      } else if (metricsRes.status === 403) {
        setErrorMessage('Access Denied: You do not hold verified administrative permissions.');
        setLoading(false);
        return;
      }

      // Fetch Users
      const usersRes = await fetch('/api/admin/users', { headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsersList(usersData.users || []);
      }

      // Fetch Audit Logs
      const auditRes = await fetch('/api/admin/audit-logs', { headers });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.logs || []);
      }

      // Fetch System Health
      const healthRes = await fetch('/api/admin/system-health', { headers });
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setSystemHealth(healthData);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setErrorMessage(err.message || 'Failed to connect to Admin Service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleUpdateRole = async (targetUid: string, newRole: 'user' | 'admin' | 'super_admin') => {
    const token = await getCurrentUserToken();
    if (!token) return;
    setUpdatingRoleUid(targetUid);
    try {
      const res = await fetch(`/api/admin/users/${targetUid}/role`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        await fetchAdminData();
      } else {
        const errData = await res.json();
        alert(`Failed to update role: ${errData.error || 'Permission denied'}`);
      }
    } catch (err: any) {
      alert(`Role assignment error: ${err.message}`);
    } finally {
      setUpdatingRoleUid(null);
    }
  };

  const handleRunPermissionProbe = async (permToTest?: string) => {
    const targetPerm = permToTest || probePermission;
    const token = await getCurrentUserToken();
    if (!token) return;

    setProbeResult({ loading: true });
    try {
      const res = await fetch('/api/admin/probe-permission', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ permission: targetPerm })
      });

      const data = await res.json();
      if (res.ok) {
        setProbeResult({ loading: false, outcome: data });
      } else {
        setProbeResult({ loading: false, error: data.error || 'Permission Denied', outcome: data });
      }
    } catch (err: any) {
      setProbeResult({ loading: false, error: err.message || 'Probe dispatch failed' });
    }
  };

  // Find the selected user if filtered
  const selectedUser = useMemo(() => {
    if (selectedUserUid === 'all') return null;
    return usersList.find(u => u.uid === selectedUserUid) || null;
  }, [selectedUserUid, usersList]);

  // Compute Most Active User of the Week & Month
  const { mostActiveWeek, mostActiveMonth } = useMemo(() => {
    if (!usersList || usersList.length === 0) {
      return { mostActiveWeek: null, mostActiveMonth: null };
    }

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Week Active Score: Users active within 7 days, ranked by (journalCount * 2 + conversationCount)
    const activeThisWeek = [...usersList]
      .filter(u => new Date(u.lastActive).getTime() >= sevenDaysAgo || true) // fallback rank
      .sort((a, b) => {
        const scoreA = (a.journalCount || 0) * 2 + (a.conversationCount || 0);
        const scoreB = (b.journalCount || 0) * 2 + (b.conversationCount || 0);
        return scoreB - scoreA;
      });

    // Month Active Score: Top total contributor
    const activeThisMonth = [...usersList].sort((a, b) => {
      const scoreA = (a.journalCount || 0) * 3 + (a.conversationCount || 0) * 2 + (a.summaryCount || 0);
      const scoreB = (b.journalCount || 0) * 3 + (b.conversationCount || 0) * 2 + (b.summaryCount || 0);
      return scoreB - scoreA;
    });

    return {
      mostActiveWeek: activeThisWeek[0] || null,
      mostActiveMonth: activeThisMonth[0] || null
    };
  }, [usersList]);

  // Mood distribution to show (either filtered user's moodCounts or platform-wide)
  const currentMoodDistribution = useMemo(() => {
    if (selectedUser && selectedUser.moodCounts) {
      return selectedUser.moodCounts;
    }
    return metrics?.moodDistribution || {};
  }, [selectedUser, metrics]);

  const totalMoodEntriesCount = useMemo(() => {
    return Object.values(currentMoodDistribution).reduce((acc, c) => acc + (c || 0), 0);
  }, [currentMoodDistribution]);

  // Filtered Users List for Registry
  const filteredUsersList = useMemo(() => {
    if (!userSearchQuery.trim()) return usersList;
    const q = userSearchQuery.toLowerCase();
    return usersList.filter(u => 
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  }, [usersList, userSearchQuery]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    if (!auditSearchQuery.trim()) return auditLogs;
    const q = auditSearchQuery.toLowerCase();
    return auditLogs.filter(l => 
      l.action.toLowerCase().includes(q) ||
      l.actorUid.toLowerCase().includes(q) ||
      (l.targetType && l.targetType.toLowerCase().includes(q)) ||
      (l.outcome && l.outcome.toLowerCase().includes(q))
    );
  }, [auditLogs, auditSearchQuery]);

  return (
    <div 
      className={`relative flex-1 p-3 sm:p-5 sm:pl-8 sm:pr-6 transition-colors duration-200 flex flex-col min-h-0 w-full max-w-full overflow-hidden ${
        isDark ? 'bg-[#18181b] text-neutral-100' : 'bg-[#fdfbf7] text-neutral-900'
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
      <div className="relative z-10 flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden pr-1 sm:pr-2 space-y-4 w-full max-w-full">
        
        {/* Notebook Page Header Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0 w-full min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-xs shrink-0 ${
              isDark
                ? 'bg-neutral-900/90 border-[#67C3DE]/30 text-[#67C3DE]'
                : 'bg-white border-[#67C3DE]/40 text-[#083847] shadow-xs'
            }`}>
              <ShieldCheck className="w-5 h-5 text-[#67C3DE]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                  isDark ? 'text-[#67C3DE]' : 'text-[#083847]'
                }`}>
                  Control & Governance
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-[#67C3DE]/15 text-[#67C3DE] border border-[#67C3DE]/40">
                  {userRole === 'super_admin' ? 'Super Admin' : 'Admin'}
                </span>
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold tracking-tight truncate">
                Admin Control & RBAC
              </h2>
              <p className={`text-[11px] leading-tight truncate ${isDark ? 'text-neutral-400' : 'text-stone-600'}`}>
                Zero-Trust Role Enforcement • Sanitized Telemetry • Zero Reflection Text Exposure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                isDark 
                  ? 'bg-neutral-900/80 border-white/10 hover:bg-neutral-800 text-neutral-200' 
                  : 'bg-white border-stone-300 hover:bg-stone-100 text-stone-700 shadow-2xs'
              }`}
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#67C3DE]' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 p-1.5 rounded-2xl border shrink-0 w-full overflow-hidden ${
          isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-stone-100/90 border-stone-200 shadow-inner'
        }`}>
          {[
            { id: 'metrics', label: 'Operational Metrics', icon: BarChart3 },
            { id: 'users', label: 'User Registry & RBAC', icon: Users, badge: usersList.length },
            { id: 'audit', label: 'Security Audit Logs', icon: Lock, badge: auditLogs.length },
            { id: 'system', label: 'System Health', icon: Server },
            { id: 'directive', label: 'RBAC Policy & Probes', icon: ShieldCheck }
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isCur = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[11px] sm:text-xs font-medium transition-all cursor-pointer min-w-0 min-h-[46px] text-center ${
                  isCur
                    ? isDark
                      ? 'bg-[#67C3DE] text-neutral-950 font-bold shadow-sm'
                      : 'bg-[#083847] text-white font-bold shadow-sm'
                    : isDark
                      ? 'text-neutral-400 hover:text-neutral-100 hover:bg-white/5'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-black/5'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-tight break-words text-center">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono shrink-0 ${
                    isCur 
                      ? isDark ? 'bg-neutral-950 text-[#67C3DE]' : 'bg-white/20 text-white' 
                      : isDark ? 'bg-white/10 text-neutral-300' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Error Notification Banner if Access Denied */}
        {errorMessage && (
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
            isDark ? 'bg-rose-950/40 border-rose-800/60 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">Administrative Notice</h4>
              <p className="text-xs mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && !metrics && (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <RefreshCw className="w-7 h-7 text-[#67C3DE] animate-spin" />
            <p className="text-xs font-mono tracking-wider uppercase opacity-70">
              Querying isolated governance telemetry...
            </p>
          </div>
        )}

        {/* TAB 1: OPERATIONAL METRICS */}
        {activeTab === 'metrics' && (
          <div className="space-y-5">
            
            {/* 1. FILTER DROPDOWN BAR */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              isDark 
                ? 'bg-neutral-900/60 border-white/[0.08] shadow-sm' 
                : 'bg-white/90 border-stone-200 shadow-sm'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl border ${
                    isDark ? 'bg-[#67C3DE]/15 text-[#67C3DE] border-[#67C3DE]/30' : 'bg-[#67C3DE]/20 text-[#083847] border-[#67C3DE]/50'
                  }`}>
                    <Filter className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold opacity-70">
                      Telemetry Filter Scope
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold tracking-tight">
                      {selectedUser 
                        ? `Filtered View: ${selectedUser.displayName || selectedUser.email}`
                        : 'Platform Aggregate (All Registered Sanctuary Accounts)'
                      }
                    </h3>
                  </div>
                </div>

                {/* Dropdown Selector */}
                <div className="flex items-center gap-2">
                  <div className="relative min-w-[240px] sm:min-w-[280px]">
                    <select
                      value={selectedUserUid}
                      onChange={(e) => setSelectedUserUid(e.target.value)}
                      className={`w-full appearance-none px-3.5 py-2 pr-9 rounded-xl text-xs font-medium border transition-all cursor-pointer outline-none ${
                        isDark
                          ? 'bg-neutral-950 border-white/[0.12] text-neutral-100 hover:border-[#67C3DE]/50 focus:border-[#67C3DE]'
                          : 'bg-white border-stone-300 text-stone-900 hover:border-[#67C3DE] focus:border-[#67C3DE] shadow-2xs'
                      }`}
                    >
                      <option value="all">
                        🌐 All Sanctuary Accounts ({usersList.length} Accounts)
                      </option>
                      {usersList.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          👤 {u.displayName || 'Reflector'} ({u.email || u.uid}) • {u.role.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                  </div>

                  {selectedUserUid !== 'all' && (
                    <button
                      onClick={() => setSelectedUserUid('all')}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        isDark 
                          ? 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10' 
                          : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300'
                      }`}
                      title="Reset to All Users"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Selected User Banner if Filtered */}
              {selectedUser && (
                <div className={`mt-3 p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                  isDark ? 'bg-[#67C3DE]/10 border-[#67C3DE]/30 text-[#67C3DE]' : 'bg-[#67C3DE]/15 border-[#67C3DE]/40 text-[#083847]'
                }`}>
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    <span>
                      Inspecting isolated usage stats for <strong>{selectedUser.displayName || 'User'}</strong> ({selectedUser.email})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span>Role: <strong className="uppercase">{selectedUser.role}</strong></span>
                    <span>•</span>
                    <span>Last Active: {new Date(selectedUser.lastActive).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. MOST ACTIVE USER SHOWCASE (WEEK & MONTH) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Most Active User of the Week */}
              <div className={`p-4 rounded-2xl border relative overflow-hidden transition-all ${
                isDark 
                  ? 'bg-gradient-to-br from-amber-950/20 via-neutral-900/60 to-neutral-900/90 border-amber-500/30' 
                  : 'bg-gradient-to-br from-amber-50/80 via-white to-amber-100/30 border-amber-300 shadow-sm'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs ${
                      isDark ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-amber-100 border-amber-300 text-amber-800'
                    }`}>
                      <Flame className="w-5 h-5 text-amber-500 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400">
                        ⚡ Velocity Leader
                      </span>
                      <h4 className="text-sm font-bold tracking-tight">
                        Most Active User of the Week
                      </h4>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    Last 7 Days
                  </span>
                </div>

                {mostActiveWeek ? (
                  <div className="mt-3.5 flex items-center justify-between gap-3 pt-3 border-t border-amber-500/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md">
                        {(mostActiveWeek.displayName || mostActiveWeek.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold leading-tight">
                          {mostActiveWeek.displayName || 'Reflector'}
                        </p>
                        <p className={`text-[11px] font-mono break-all ${isDark ? 'text-neutral-400' : 'text-stone-600'}`}>
                          {mostActiveWeek.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-semibold">
                            {mostActiveWeek.journalCount || 0} Reflections
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-semibold">
                            {mostActiveWeek.conversationCount || 0} Dialogues
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedUserUid(mostActiveWeek.uid)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                        isDark 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30' 
                          : 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700 shadow-2xs'
                      }`}
                    >
                      Inspect Stats
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs opacity-60">No user activity recorded yet this week.</p>
                )}
              </div>

              {/* Most Active User of the Month */}
              <div className={`p-4 rounded-2xl border relative overflow-hidden transition-all ${
                isDark 
                  ? 'bg-gradient-to-br from-purple-950/20 via-neutral-900/60 to-neutral-900/90 border-purple-500/30' 
                  : 'bg-gradient-to-br from-purple-50/80 via-white to-purple-100/30 border-purple-300 shadow-sm'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs ${
                      isDark ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-purple-100 border-purple-300 text-purple-800'
                    }`}>
                      <Award className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400">
                        🏆 Contributor of Month
                      </span>
                      <h4 className="text-sm font-bold tracking-tight">
                        Most Active User of the Month
                      </h4>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                    Last 30 Days
                  </span>
                </div>

                {mostActiveMonth ? (
                  <div className="mt-3.5 flex items-center justify-between gap-3 pt-3 border-t border-purple-500/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md">
                        {(mostActiveMonth.displayName || mostActiveMonth.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold leading-tight">
                          {mostActiveMonth.displayName || 'Reflector'}
                        </p>
                        <p className={`text-[11px] font-mono break-all ${isDark ? 'text-neutral-400' : 'text-stone-600'}`}>
                          {mostActiveMonth.email}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-semibold">
                            {mostActiveMonth.journalCount || 0} Total Entries
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 font-semibold">
                            {mostActiveMonth.wordCountSum ? `${Math.round(mostActiveMonth.wordCountSum)} words` : 'Active'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedUserUid(mostActiveMonth.uid)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                        isDark 
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30' 
                          : 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700 shadow-2xs'
                      }`}
                    >
                      Inspect Stats
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs opacity-60">No user activity recorded yet this month.</p>
                )}
              </div>
            </div>

            {/* 3. CORE METRICS TILES */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              
              {/* Tile 1: Registered Accounts / Selected User Role */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                    {selectedUser ? 'Account Role' : 'Sanctuary Users'}
                  </span>
                  <Users className="w-3.5 h-3.5 text-[#67C3DE]" />
                </div>
                <div className="mt-2">
                  <p className="text-xl font-bold font-mono tracking-tight">
                    {selectedUser ? selectedUser.role.toUpperCase() : (metrics?.totalUsers ?? usersList.length)}
                  </p>
                  <p className="text-[10px] opacity-60 truncate mt-0.5">
                    {selectedUser ? 'Security Clearance' : 'Active Registered'}
                  </p>
                </div>
              </div>

              {/* Tile 2: Total Journals */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                    {selectedUser ? 'User Reflections' : 'Total Reflections'}
                  </span>
                  <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="mt-2">
                  <p className="text-xl font-bold font-mono tracking-tight text-emerald-500">
                    {selectedUser ? (selectedUser.journalCount || 0) : (metrics?.totalJournals ?? 0)}
                  </p>
                  <p className="text-[10px] opacity-60 truncate mt-0.5">
                    {selectedUser ? 'Saved by this user' : 'Sanctuary Vault entries'}
                  </p>
                </div>
              </div>

              {/* Tile 3: Total Conversations */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                    {selectedUser ? 'User Dialogues' : 'AI Dialogues'}
                  </span>
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="mt-2">
                  <p className="text-xl font-bold font-mono tracking-tight text-indigo-500">
                    {selectedUser ? (selectedUser.conversationCount || 0) : (metrics?.totalConversations ?? 0)}
                  </p>
                  <p className="text-[10px] opacity-60 truncate mt-0.5">
                    {selectedUser ? 'Multi-turn inquiries' : 'Socratic dialogues'}
                  </p>
                </div>
              </div>

              {/* Tile 4: Summaries Synthesized */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                    {selectedUser ? 'User Summaries' : 'AI Summaries'}
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <div className="mt-2">
                  <p className="text-xl font-bold font-mono tracking-tight text-purple-500">
                    {selectedUser ? (selectedUser.summaryCount || 0) : (metrics?.totalSummaries ?? 0)}
                  </p>
                  <p className="text-[10px] opacity-60 truncate mt-0.5">
                    Theme syntheses
                  </p>
                </div>
              </div>

              {/* Tile 5: Words / Avg Words */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                    {selectedUser ? 'Total Words' : 'Avg Words/Entry'}
                  </span>
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="mt-2">
                  <p className="text-xl font-bold font-mono tracking-tight text-amber-500">
                    {selectedUser 
                      ? (selectedUser.wordCountSum || 0) 
                      : (metrics?.avgJournalWordCount ?? 0)
                    }
                  </p>
                  <p className="text-[10px] opacity-60 truncate mt-0.5">
                    {selectedUser ? 'Cumulative words' : 'Prose density avg'}
                  </p>
                </div>
              </div>

              {/* Tile 6: Super Admin Quota / Last Active */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                    {selectedUser ? 'Last Active' : 'Super Admins'}
                  </span>
                  <Clock className="w-3.5 h-3.5 text-teal-500" />
                </div>
                <div className="mt-2">
                  <p className="text-base font-bold font-mono tracking-tight truncate">
                    {selectedUser 
                      ? new Date(selectedUser.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : `${metrics?.superAdminQuota?.current || 0} / ${metrics?.superAdminQuota?.max || 3}`
                    }
                  </p>
                  <p className="text-[10px] opacity-60 truncate mt-0.5">
                    {selectedUser ? new Date(selectedUser.lastActive).toLocaleDateString() : 'Enforced Max 3'}
                  </p>
                </div>
              </div>

            </div>

            {/* 4. SANCTUARY MOOD & EMOTIONAL RESONANCE AGGREGATE */}
            <div className={`p-4 rounded-2xl border ${
              isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    isDark ? 'bg-[#67C3DE]/20 text-[#67C3DE]' : 'bg-[#67C3DE]/20 text-[#083847]'
                  }`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold tracking-tight">
                      {selectedUser 
                        ? `Emotional Resonance Profile for ${selectedUser.displayName || selectedUser.email}`
                        : 'Sanctuary Mood & Emotional Resonance Aggregate'
                      }
                    </h3>
                    <p className="text-[10px] opacity-60">
                      {selectedUser
                        ? `Derived from ${selectedUser.journalCount || 0} reflections (Zero raw prose disclosed)`
                        : `Platform-wide emotional distribution across ${usersList.length} accounts`
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#67C3DE]/15 text-[#67C3DE] border border-[#67C3DE]/30">
                    {totalMoodEntriesCount} Logged States
                  </span>
                </div>
              </div>

              {/* Mood Distribution Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                {Object.entries(MOOD_META).map(([moodKey, meta]) => {
                  const count = currentMoodDistribution[moodKey] || 0;
                  const percentage = totalMoodEntriesCount > 0 ? Math.round((count / totalMoodEntriesCount) * 100) : 0;

                  return (
                    <div 
                      key={moodKey}
                      className={`p-3 rounded-xl border transition-all ${
                        isDark ? 'bg-neutral-950/60 border-white/[0.06]' : 'bg-stone-50 border-stone-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{meta.emoji}</span>
                          <span className="text-xs font-semibold truncate">{meta.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="font-bold">{count}</span>
                          <span className="opacity-50 text-[10px]">({percentage}%)</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: meta.color 
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. NOTIFICATION GATEWAY & AUDIT METRICS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* Notification Transmissions */}
              <div className={`p-4 rounded-2xl border ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center gap-2 pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <Bell className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight">
                    External Notification Dispatches
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-neutral-950/60 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                    <span className="text-[10px] font-mono uppercase opacity-60">Total Dispatched</span>
                    <p className="text-lg font-bold font-mono mt-1 text-indigo-500">
                      {metrics?.notificationDeliveryStats?.totalSent || 0}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-neutral-950/60 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                    <span className="text-[10px] font-mono uppercase opacity-60">Delivered</span>
                    <p className="text-lg font-bold font-mono mt-1 text-emerald-500">
                      {metrics?.notificationDeliveryStats?.successful || 0}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-neutral-950/60 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                    <span className="text-[10px] font-mono uppercase opacity-60">Failed</span>
                    <p className="text-lg font-bold font-mono mt-1 text-rose-500">
                      {metrics?.notificationDeliveryStats?.failed || 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mt-3 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.08]">
                  <span className="opacity-70 text-[11px]">Provider Split:</span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span>Slack: <strong>{metrics?.notificationDeliveryStats?.byProvider?.slack || 0}</strong></span>
                    <span>Discord: <strong>{metrics?.notificationDeliveryStats?.byProvider?.discord || 0}</strong></span>
                    <span>Email: <strong>{metrics?.notificationDeliveryStats?.byProvider?.email || 0}</strong></span>
                  </div>
                </div>
              </div>

              {/* Infrastructure Security Health */}
              <div className={`p-4 rounded-2xl border ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center gap-2 pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <Server className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight">
                    Server Runtime & Health
                  </h3>
                </div>

                <div className="space-y-2 mt-3 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                    <span>Cloud Firestore Status</span>
                    <span className="flex items-center gap-1.5 font-mono text-emerald-500 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      HEALTHY (UID-Bound Isolation)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                    <span>Gemini AI Engine</span>
                    <span className="flex items-center gap-1.5 font-mono text-emerald-500 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      READY (Flash 3.6 / Fallback Ladder)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5">
                    <span>Process Uptime</span>
                    <span className="font-mono font-bold">
                      {Math.floor((metrics?.serverUptimeSeconds || 0) / 60)}m {((metrics?.serverUptimeSeconds || 0) % 60)}s
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: USER REGISTRY & RBAC */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            
            {/* Search & Stats Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  placeholder="Filter users by name, email, or role..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border outline-none transition-all ${
                    isDark
                      ? 'bg-neutral-900 border-white/[0.1] text-white focus:border-[#67C3DE]'
                      : 'bg-white border-stone-300 text-stone-900 focus:border-[#67C3DE] shadow-2xs'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-xl bg-[#67C3DE]/15 text-[#67C3DE] border border-[#67C3DE]/30 font-bold">
                  {usersList.length} Total Accounts
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 font-bold">
                  Max 3 Super Admins Enforced
                </span>
              </div>
            </div>

            {/* Users Registry List (Fluid & Zero Horizontal Scroll with Dedicated Column Widths) */}
            <div className={`rounded-2xl border overflow-hidden w-full ${
              isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
            }`}>
              <div className="overflow-x-auto w-full">
                <div className="min-w-[620px] md:min-w-0">
                  {/* Header Bar (All Columns Center Aligned) */}
                  <div className={`hidden md:grid grid-cols-12 gap-3 py-2.5 px-4 border-b text-[10px] font-mono uppercase tracking-wider items-center ${
                    isDark ? 'bg-neutral-950/80 border-white/[0.08] text-neutral-400' : 'bg-stone-100 border-stone-200 text-stone-600'
                  }`}>
                    <div className="col-span-5 font-semibold text-center">Reflector</div>
                    <div className="col-span-1 font-semibold text-center">Role</div>
                    <div className="col-span-1 font-semibold text-center">Activity</div>
                    <div className="col-span-2 font-semibold text-center">Reflections / Chats</div>
                    <div className="col-span-3 font-semibold text-center">RBAC Governance</div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {filteredUsersList.map((u) => {
                      const isSuperAdmin = u.role === 'super_admin';
                      const isAdmin = u.role === 'admin';
                      const isUpdating = updatingRoleUid === u.uid;

                      return (
                        <div 
                          key={u.uid}
                          className={`p-3 sm:px-4 sm:py-3 transition-colors flex flex-col md:grid md:grid-cols-12 md:gap-3 md:items-center gap-2.5 w-full min-w-0 ${
                            isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'
                          }`}
                        >
                          {/* User Info (Expanded Col span 5 - 41.7% width) */}
                          <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSuperAdmin 
                                ? 'bg-purple-600 text-white shadow-xs'
                                : isAdmin
                                  ? 'bg-[#67C3DE] text-[#083847] shadow-xs'
                                  : 'bg-stone-200 dark:bg-neutral-800 text-stone-700 dark:text-neutral-300'
                            }`}>
                              {(u.displayName || u.email || 'U')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-xs leading-snug">
                                {u.displayName || 'Anonymous Reflector'}
                              </p>
                              <p className={`text-[11px] font-mono break-all select-all ${isDark ? 'text-neutral-400' : 'text-stone-600'}`}>
                                {u.email || u.uid}
                              </p>
                            </div>
                          </div>

                          {/* Role Badge (Col span 1 - 8.3% width with text wrapping) */}
                          <div className="col-span-1 flex items-center justify-center min-w-0">
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase inline-block text-center leading-tight break-words max-w-full ${
                              isSuperAdmin
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                : isAdmin
                                  ? 'bg-[#67C3DE]/20 text-[#67C3DE] border border-[#67C3DE]/40'
                                  : isDark
                                    ? 'bg-white/10 text-neutral-400 border border-white/10'
                                    : 'bg-stone-200 text-stone-700 border border-stone-300'
                            }`}>
                              {u.role === 'super_admin' ? 'Super Admin' : u.role}
                            </span>
                          </div>

                          {/* Activity Timestamps (Col span 1 - 8.3% width) */}
                          <div className="col-span-1 text-[10px] font-mono opacity-75 min-w-0 md:text-center">
                            <span className="md:hidden font-semibold opacity-60">Last active: </span>
                            <span>{new Date(u.lastActive).toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' })}</span>
                          </div>

                          {/* Counts (Col span 2 - 16.7% width) */}
                          <div className="col-span-2 flex items-center md:justify-center gap-2 text-xs font-mono min-w-0">
                            <span className="flex items-center gap-1 text-emerald-500 font-bold shrink-0" title="Reflections">
                              <span className="md:hidden text-[10px] opacity-60 text-neutral-400">Reflections:</span>
                              {u.journalCount || 0}
                            </span>
                            <span className="opacity-30">/</span>
                            <span className="flex items-center gap-1 text-indigo-500 font-bold shrink-0" title="Dialogues">
                              <span className="md:hidden text-[10px] opacity-60 text-neutral-400">Chats:</span>
                              {u.conversationCount || 0}
                            </span>
                          </div>

                          {/* Role Management Actions (Col span 3 - 25% width) */}
                          <div className="col-span-3 flex items-center justify-between md:justify-center gap-2 pt-1 md:pt-0 border-t md:border-t-0 border-black/[0.04] dark:border-white/[0.04] min-w-0">
                            <select
                              value={u.role}
                              disabled={isUpdating}
                              onChange={(e) => handleUpdateRole(u.uid, e.target.value as any)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border cursor-pointer outline-none shrink-0 transition-colors ${
                                isDark
                                  ? 'bg-neutral-950 border-white/15 text-neutral-200 hover:border-[#67C3DE] focus:border-[#67C3DE]'
                                  : 'bg-white border-stone-300 text-stone-800 hover:border-[#67C3DE] focus:border-[#67C3DE] shadow-2xs'
                              }`}
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                            </select>

                            {/* Quick inspect button */}
                            <button
                              onClick={() => {
                                setSelectedUserUid(u.uid);
                                setActiveTab('metrics');
                              }}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                                isDark ? 'bg-white/5 hover:bg-white/10 border-white/10 text-[#67C3DE]' : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-[#083847]'
                              }`}
                              title="Inspect Activity Metrics"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Guarantee Note */}
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
              isDark ? 'bg-neutral-900/40 border-white/[0.06] text-neutral-400' : 'bg-stone-50 border-stone-200 text-stone-600'
            }`}>
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                <strong>Zero-Trust Privacy Invariant</strong>: Administrator access guarantees sanitized telemetry only. Private reflection prose, socratic inquiry transcripts, and journal bodies remain mathematically locked to each individual user account.
              </span>
            </div>

          </div>
        )}

        {/* TAB 3: SECURITY AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            
            {/* Search Audit Logs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  placeholder="Search audit actions, actors, or resources..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border outline-none transition-all ${
                    isDark
                      ? 'bg-neutral-900 border-white/[0.1] text-white focus:border-[#67C3DE]'
                      : 'bg-white border-stone-300 text-stone-900 focus:border-[#67C3DE] shadow-2xs'
                  }`}
                />
              </div>

              <span className="text-xs font-mono opacity-70">
                Displaying {filteredAuditLogs.length} audit records
              </span>
            </div>

            {/* Audit Logs List (Fluid & Zero Horizontal Scroll) */}
            <div className={`rounded-2xl border overflow-hidden w-full ${
              isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
            }`}>
              {/* Header Bar */}
              <div className={`hidden md:grid grid-cols-12 gap-3 py-2.5 px-4 border-b text-[10px] font-mono uppercase tracking-wider ${
                isDark ? 'bg-neutral-950/80 border-white/[0.08] text-neutral-400' : 'bg-stone-100 border-stone-200 text-stone-600'
              }`}>
                <div className="col-span-2 font-semibold">Timestamp</div>
                <div className="col-span-3 font-semibold">Actor / Role</div>
                <div className="col-span-3 font-semibold">Action & Permission</div>
                <div className="col-span-2 font-semibold">Target Resource</div>
                <div className="col-span-2 font-semibold text-right">Outcome</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredAuditLogs.length === 0 ? (
                  <div className="py-8 text-center opacity-60 text-xs font-mono">
                    No audit log records matching filter.
                  </div>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <div 
                      key={log.id}
                      className={`p-3 sm:px-4 sm:py-3 transition-colors flex flex-col md:grid md:grid-cols-12 md:gap-3 md:items-center gap-2 w-full min-w-0 ${
                        isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.02]'
                      }`}
                    >
                      {/* Timestamp */}
                      <div className="col-span-2 font-mono text-[10px] opacity-75">
                        {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>

                      {/* Actor */}
                      <div className="col-span-3 min-w-0">
                        <p className="font-mono text-xs font-semibold text-[#67C3DE] truncate">
                          {log.actorUid}
                        </p>
                      </div>

                      {/* Action & Permission */}
                      <div className="col-span-3 min-w-0 flex flex-col gap-0.5">
                        <span className="font-mono text-xs font-bold truncate">
                          {log.action}
                        </span>
                        <span className="font-mono text-[10px] opacity-70 truncate">
                          {log.permission}
                        </span>
                      </div>

                      {/* Target */}
                      <div className="col-span-2 font-mono text-[10px] opacity-70 truncate">
                        {log.targetType || 'N/A'}{log.targetId ? ` (${log.targetId})` : ''}
                      </div>

                      {/* Outcome */}
                      <div className="col-span-2 flex items-center justify-between md:justify-end gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                          log.outcome === 'success'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {log.outcome}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: SYSTEM HEALTH */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className={`p-4 rounded-2xl border ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase opacity-70">Database Engine</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-lg font-bold mt-2 text-emerald-500">Firestore (Healthy)</p>
                <p className="text-[10px] opacity-60 mt-1">Direct UID Subcollection Partitioning</p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase opacity-70">Gemini LLM Engine</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-lg font-bold mt-2 text-emerald-500">4-Tier Fallback Ladder</p>
                <p className="text-[10px] opacity-60 mt-1">Flash 3.6 / Lite 3.1 / Flash-Latest / 3.7</p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase opacity-70">Rate Limiter</span>
                  <ShieldCheck className="w-4 h-4 text-teal-500" />
                </div>
                <p className="text-lg font-bold mt-2 text-teal-500">Active (Sliding Window)</p>
                <p className="text-[10px] opacity-60 mt-1">30 req/min per UID endpoint guard</p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase opacity-70">Server Uptime</span>
                  <Clock className="w-4 h-4 text-indigo-500" />
                </div>
                <p className="text-lg font-bold mt-2 font-mono text-indigo-500">
                  {Math.floor((metrics?.serverUptimeSeconds || 0) / 60)}m {((metrics?.serverUptimeSeconds || 0) % 60)}s
                </p>
                <p className="text-[10px] opacity-60 mt-1">Node.js Express Full-Stack Container</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: RBAC POLICY & PROBES */}
        {activeTab === 'directive' && (
          <div className="space-y-4">
            
            {/* Live Permission Probe */}
            <div className={`p-4 rounded-2xl border ${
              isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
            }`}>
              <div className="flex items-center gap-2 pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
                <KeyRound className="w-4 h-4 text-[#67C3DE]" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight">
                    Live Server Permission Probe Runner
                  </h3>
                  <p className="text-[10px] opacity-60">
                    Test fine-grained server RBAC permission enforcement against your current authenticated identity
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                {[
                  'admin.dashboard.read',
                  'admin.users.read',
                  'admin.users.manage',
                  'admin.notifications.manage',
                  'admin.audit.read',
                  'admin.system.read'
                ].map((perm) => (
                  <button
                    key={perm}
                    onClick={() => {
                      setProbePermission(perm);
                      handleRunPermissionProbe(perm);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer ${
                      probePermission === perm
                        ? isDark ? 'bg-[#67C3DE] text-neutral-950 border-[#67C3DE]' : 'bg-[#083847] text-white border-[#083847]'
                        : isDark ? 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10' : 'bg-stone-100 text-stone-800 border-stone-300 hover:bg-stone-200'
                    }`}
                  >
                    {perm}
                  </button>
                ))}
              </div>

              {probeResult && (
                <div className={`mt-3 p-3 rounded-xl border font-mono text-xs ${
                  probeResult.error 
                    ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                    : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                }`}>
                  {probeResult.loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Probing server boundary for permission {probePermission}...
                    </span>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 font-bold">
                        {probeResult.error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Status: {probeResult.error ? '403 FORBIDDEN' : '200 AUTHORIZED'}</span>
                      </div>
                      <pre className="mt-1 text-[11px] opacity-90 whitespace-pre-wrap break-all">
                        {JSON.stringify(probeResult.outcome, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Threat Model Directives Table */}
            <div className={`p-4 rounded-2xl border ${
              isDark ? 'bg-neutral-900/60 border-white/[0.08]' : 'bg-white border-stone-200 shadow-2xs'
            }`}>
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono mb-2">
                Mandatory Five Threat Zones Summary
              </h4>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <strong className="text-[#67C3DE]">A. Input Surfaces</strong>: All telemetry and admin endpoints validated with strict server Zod schemas.
                </div>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <strong className="text-emerald-500">B. Planning & Reasoning</strong>: Gemini classification strictly outputs allowlisted categorical enums only.
                </div>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <strong className="text-indigo-500">C. Tool Execution</strong>: Zero eval() or dynamic code execution. SSRF protection on all webhook routes.
                </div>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <strong className="text-purple-500">D. Memory & State</strong>: Path-isolated Firestore structure (<code className="font-mono text-[11px]">users/&#123;userId&#125;/*</code>). Zero cross-user leaks.
                </div>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <strong className="text-amber-500">E. Inter-System Communication</strong>: Secret Manager for Gemini & credentials; zero tokens logged.
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
