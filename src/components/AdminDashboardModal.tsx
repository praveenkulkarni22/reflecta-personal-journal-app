import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
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
  Server
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { auth, getCurrentUserToken } from '../lib/firebase';
import { AdminMetrics, AdminAuditLog } from '../types';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: 'user' | 'admin' | 'super_admin';
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  userRole = 'user'
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'audit' | 'system' | 'directive'>('metrics');
  const [loading, setLoading] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingRoleUid, setUpdatingRoleUid] = useState<string | null>(null);

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
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen]);

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
            className={`relative w-full max-w-4xl h-[90vh] max-h-[820px] rounded-3xl overflow-hidden border flex flex-col shadow-2xl ${
              isDark
                ? 'bg-[#141417] text-neutral-100 border-white/[0.12] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)]'
                : 'bg-[#faf8f5] text-neutral-900 border-stone-300 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)]'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] dark:border-white/[0.08] shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-50 text-teal-800 border border-teal-200'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg font-semibold tracking-tight">
                      Admin Control & RBAC
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-teal-500/20 text-teal-400 border border-teal-500/30">
                      Privileged
                    </span>
                  </div>
                  <p className="text-xs opacity-70">
                    Zero-Trust Authorization • Server-Side Role Enforcement • Isolated Metadata
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAdminData}
                  disabled={loading}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    isDark ? 'bg-neutral-900 hover:bg-neutral-800 border-white/10' : 'bg-white hover:bg-stone-100 border-stone-300'
                  }`}
                  title="Refresh Metrics"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 px-6 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0 overflow-x-auto no-scrollbar">
              {[
                { id: 'metrics', label: 'Operational Metrics', icon: BarChart3 },
                { id: 'users', label: 'User Registry & RBAC', icon: Users },
                { id: 'audit', label: 'Security Audit Logs', icon: Lock },
                { id: 'system', label: 'System Health', icon: Server },
                { id: 'directive', label: 'RBAC Policy & Threat Model', icon: ShieldCheck }
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isCur = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isCur
                        ? 'bg-teal-600 text-white font-semibold shadow-xs'
                        : isDark
                        ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300'
                        : 'bg-white hover:bg-stone-100 text-neutral-700 border border-stone-200'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {userRole !== 'admin' && userRole !== 'super_admin' ? (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/10 dark:bg-red-950/20 text-red-400 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-red-500/20 text-red-400 shrink-0">
                        <Lock className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-serif text-base font-bold text-red-500 dark:text-red-400">403 Forbidden — Administrative Access Restricted</h4>
                        <p className="text-xs opacity-90 mt-0.5">
                          Your account role is currently assigned as <span className="font-mono font-bold uppercase underline text-amber-400">{userRole}</span>.
                        </p>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-neutral-300">
                      Under strict Zero-Trust RBAC security policies, administrative telemetry and management panels are strictly prohibited for non-administrative roles.
                    </p>
                  </div>

                  {/* Role Classification Matrix for Non-Admin Users */}
                  <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                    <h4 className="font-serif text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-teal-400" />
                      <span>Role Classification Matrix & Capability Boundaries</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      {/* USER ROLE */}
                      <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-teal-400 uppercase font-mono">User Role</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 font-mono">Standard</span>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          Default role assigned to all authenticated journal users.
                        </p>
                        <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1 text-[11px]">
                          <div><strong className="text-teal-300">Scope:</strong> Private <code>users/{'{userId}'}/*</code> Firestore documents.</div>
                          <div><strong className="text-teal-300">Capabilities:</strong> Personal journaling, Socratic dialogue, calendar, personal webhooks.</div>
                          <div><strong className="text-teal-300">Admin Permissions:</strong> None (0).</div>
                        </div>
                      </div>

                      {/* ADMIN ROLE */}
                      <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-400 uppercase font-mono">Admin Role</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">Elevated</span>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          Operational role for platform administrators and security engineers.
                        </p>
                        <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1 text-[11px]">
                          <div><strong className="text-indigo-300">Scope:</strong> Aggregate metrics, user registry, audit logs, health telemetry.</div>
                          <div><strong className="text-indigo-300">Capabilities:</strong> View metrics, manage user roles, review audit logs, configure alerts.</div>
                          <div><strong className="text-indigo-300">Admin Permissions:</strong> Full <code>admin.*</code> scope.</div>
                        </div>
                      </div>

                      {/* SUPER ADMIN ROLE */}
                      <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-400 uppercase font-mono">Super Admin</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold">Master (Max 3)</span>
                        </div>
                        <p className="text-[11px] opacity-80 leading-relaxed">
                          Master security authority for policy overrides and infrastructure management. Strictly capped at 3 Super Admins max.
                        </p>
                        <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1 text-[11px]">
                          <div><strong className="text-amber-300">Scope:</strong> Platform-wide master override and policy control.</div>
                          <div><strong className="text-amber-300">Capabilities:</strong> Role promotion/demotion, security overrides, master audit review.</div>
                          <div><strong className="text-amber-300">Hard Quota Cap:</strong> Maximum 3 Super Admins allowed.</div>
                          <div><strong className="text-amber-300">Admin Permissions:</strong> All <code>admin.*</code> + <code>super_admin.override</code>.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : errorMessage ? (
                <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-500 flex flex-col items-center justify-center text-center space-y-2">
                  <AlertTriangle className="w-8 h-8" />
                  <h4 className="font-semibold text-base">{errorMessage}</h4>
                  <p className="text-xs max-w-md opacity-80">
                    Administrative endpoints strictly enforce role authorization via server-side verification.
                  </p>
                </div>
              ) : loading && !metrics ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3 opacity-70">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-500" />
                  <span className="font-mono text-xs">Authenticating and loading privileged telemetry...</span>
                </div>
              ) : (
                <>
                  {/* TAB 1: OPERATIONAL METRICS */}
                  {activeTab === 'metrics' && metrics && (
                    <div className="space-y-6">
                      {/* Metric Stat Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                          <span className="text-[11px] font-mono opacity-70 block mb-1">Total Users</span>
                          <span className="text-2xl font-serif font-bold text-teal-500">{metrics.totalUsers}</span>
                          <span className="text-[10px] font-mono opacity-60 block mt-1">{metrics.activeUsers24h} active in 24h</span>
                        </div>

                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                          <span className="text-[11px] font-mono opacity-70 block mb-1">Reflections Archived</span>
                          <span className="text-2xl font-serif font-bold text-indigo-400">{metrics.totalJournals}</span>
                          <span className="text-[10px] font-mono opacity-60 block mt-1">~{metrics.avgJournalWordCount} words / entry</span>
                        </div>

                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                          <span className="text-[11px] font-mono opacity-70 block mb-1">Conversations</span>
                          <span className="text-2xl font-serif font-bold text-purple-400">{metrics.totalConversations}</span>
                          <span className="text-[10px] font-mono opacity-60 block mt-1">{metrics.totalSummaries} syntheses</span>
                        </div>

                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                          <span className="text-[11px] font-mono opacity-70 block mb-1">External Notifications</span>
                          <span className="text-2xl font-serif font-bold text-emerald-400">{metrics.notificationDeliveryStats.totalSent}</span>
                          <span className="text-[10px] font-mono opacity-60 block mt-1">
                            {metrics.notificationDeliveryStats.successful} delivered, {metrics.notificationDeliveryStats.failed} failed
                          </span>
                        </div>
                      </div>

                      {/* Mood Distribution */}
                      <div className={`p-5 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                        <h4 className="font-serif text-sm font-semibold mb-3 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-teal-400" />
                          <span>Sanctuary Mood & Emotional Resonance Aggregate</span>
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                          {Object.entries(metrics.moodDistribution).map(([mood, count]) => (
                            <div key={mood} className={`p-2.5 rounded-xl border text-center ${isDark ? 'bg-black/30 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                              <span className="capitalize text-xs font-medium block">{mood}</span>
                              <span className="text-sm font-mono font-bold text-teal-500">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notification Provider Stats */}
                      <div className={`p-5 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                        <h4 className="font-serif text-sm font-semibold mb-3 flex items-center gap-2">
                          <Bell className="w-4 h-4 text-indigo-400" />
                          <span>External Notification Delivery Breakdown</span>
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className={`p-3 rounded-xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <span className="text-xs font-semibold block">Slack Webhooks</span>
                            <span className="text-lg font-mono font-bold text-teal-400">{metrics.notificationDeliveryStats.byProvider.slack || 0}</span>
                          </div>
                          <div className={`p-3 rounded-xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <span className="text-xs font-semibold block">Discord Webhooks</span>
                            <span className="text-lg font-mono font-bold text-indigo-400">{metrics.notificationDeliveryStats.byProvider.discord || 0}</span>
                          </div>
                          <div className={`p-3 rounded-xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <span className="text-xs font-semibold block">Email Alerts</span>
                            <span className="text-lg font-mono font-bold text-rose-400">{metrics.notificationDeliveryStats.byProvider.email || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: USER REGISTRY & RBAC MANAGEMENT */}
                  {activeTab === 'users' && (
                    <div className="space-y-4">
                      {/* Super Admin Quota Status Bar */}
                      {(() => {
                        const superAdminsCount = usersList.filter(u => u.role === 'super_admin').length;
                        const isQuotaFull = superAdminsCount >= 3;
                        return (
                          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isQuotaFull
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                              : isDark
                              ? 'bg-neutral-900/80 border-teal-500/30'
                              : 'bg-teal-50/50 border-teal-200'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-xl ${isQuotaFull ? 'bg-amber-500/20 text-amber-400' : 'bg-teal-500/20 text-teal-400'}`}>
                                <ShieldCheck className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-serif text-sm font-bold">Super Admin Quota Status</h4>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                    isQuotaFull ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  }`}>
                                    {superAdminsCount} / 3 Active
                                  </span>
                                </div>
                                <p className="text-xs opacity-80 mt-0.5">
                                  {isQuotaFull
                                    ? 'Hard Quota Reached (3/3). To assign another user as Super Admin, you must demote an existing Super Admin first.'
                                    : 'Platform access is strictly capped at a maximum of 3 Super Admins for zero-trust security compliance.'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[11px] font-mono block opacity-70">
                                {3 - superAdminsCount} Slot{3 - superAdminsCount === 1 ? '' : 's'} Remaining
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono opacity-70">
                          {usersList.length} registered accounts • Sanitized metadata only (zero private reflection text exposed)
                        </span>
                      </div>

                      <div className="space-y-2">
                        {usersList.map((u) => (
                          <div
                            key={u.uid}
                            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-serif font-semibold text-sm">{u.displayName}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                                  u.role === 'super_admin'
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                    : u.role === 'admin'
                                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                                    : 'bg-black/10 dark:bg-white/10 opacity-75'
                                }`}>
                                  {u.role}
                                </span>
                              </div>
                              <p className="text-xs font-mono opacity-60 truncate">
                                {u.email || 'No email associated'} • UID: {u.uid.slice(0, 10)}...
                              </p>
                              <div className="flex items-center gap-3 text-[11px] font-mono opacity-75">
                                <span>{u.journalCount} journals</span>
                                <span>{u.conversationCount} conversations</span>
                                <span>Active: {new Date(u.lastActive).toLocaleDateString()}</span>
                              </div>
                            </div>

                            {/* RBAC Role Selector */}
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={u.role}
                                disabled={updatingRoleUid === u.uid}
                                onChange={(e) => handleUpdateRole(u.uid, e.target.value as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all cursor-pointer ${
                                  isDark ? 'bg-neutral-800 border-white/10 text-neutral-200' : 'bg-stone-100 border-stone-300 text-neutral-800'
                                }`}
                              >
                                <option value="user">User (Default)</option>
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SECURITY AUDIT LOGS */}
                  {activeTab === 'audit' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono opacity-70">
                          Latest {auditLogs.length} security-relevant events recorded in /adminAuditLogs
                        </span>
                      </div>

                      {auditLogs.length === 0 ? (
                        <div className="p-8 text-center text-xs font-mono opacity-60">
                          No audit events recorded yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {auditLogs.map((log) => (
                            <div
                              key={log.id}
                              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs ${
                                log.outcome === 'denied'
                                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                  : isDark
                                  ? 'bg-neutral-900/60 border-white/5'
                                  : 'bg-white border-stone-200'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                    log.outcome === 'denied' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                                  }`}>
                                    {log.outcome}
                                  </span>
                                  <span className="font-semibold text-neutral-200">{log.action}</span>
                                  <span className="opacity-60 text-[11px]">({log.permission})</span>
                                </div>
                                <div className="opacity-70 text-[11px]">
                                  Actor: {log.actorEmail} ({log.actorUid.slice(0, 8)}...) • Target: {log.targetType}/{log.targetId}
                                </div>
                              </div>

                              <div className="text-[11px] opacity-60 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString()} {new Date(log.timestamp).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: SYSTEM HEALTH */}
                  {activeTab === 'system' && systemHealth && (
                    <div className="space-y-4 font-mono text-xs">
                      <div className={`p-5 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                        <h4 className="font-serif text-sm font-semibold mb-3 flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-teal-400" />
                          <span>Runtime Environment & Compute</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <span className="opacity-60 block">Node.js:</span>
                            <span className="font-bold">{systemHealth.nodeVersion}</span>
                          </div>
                          <div>
                            <span className="opacity-60 block">Uptime:</span>
                            <span className="font-bold">{systemHealth.serverUptime}s</span>
                          </div>
                          <div>
                            <span className="opacity-60 block">Heap Total:</span>
                            <span className="font-bold">{systemHealth.memory?.heapTotalMb} MB</span>
                          </div>
                          <div>
                            <span className="opacity-60 block">Heap Used:</span>
                            <span className="font-bold">{systemHealth.memory?.heapUsedMb} MB</span>
                          </div>
                        </div>
                      </div>

                      <div className={`p-5 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                        <h4 className="font-serif text-sm font-semibold mb-3 flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-indigo-400" />
                          <span>Gemini Model Resilience Ladder</span>
                        </h4>
                        <div className="space-y-1">
                          {systemHealth.services?.fallbackLadderTiers?.map((model: string, mIdx: number) => (
                            <div key={model} className="flex items-center gap-2">
                              <span className="text-teal-400 font-bold">{mIdx + 1}.</span>
                              <span>{model}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: RBAC POLICY & DIRECTIVE */}
                  {activeTab === 'directive' && (
                    <div className="space-y-6 text-xs font-sans">
                      {/* Live Permission Probe Inspector */}
                      <div className={`p-5 rounded-2xl border ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                        <h4 className="font-serif text-sm font-semibold mb-2 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-teal-400" />
                          <span>Interactive RBAC Permission Probe</span>
                        </h4>
                        <p className="text-xs opacity-70 mb-4">
                          Test zero-trust server authorization guards against your active Firebase token and claims in real-time.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2 mb-4">
                          <input
                            type="text"
                            value={probePermission}
                            onChange={(e) => setProbePermission(e.target.value)}
                            placeholder="e.g. admin.dashboard.read, admin.users.manage..."
                            className={`flex-1 px-3 py-2 rounded-xl border font-mono text-xs focus:outline-none ${
                              isDark ? 'bg-neutral-800 border-white/10 text-white' : 'bg-stone-50 border-stone-300 text-stone-900'
                            }`}
                          />
                          <button
                            onClick={() => handleRunPermissionProbe()}
                            disabled={probeResult?.loading}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Probe Policy</span>
                          </button>
                        </div>

                        {/* Quick Probe Presets */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          <span className="text-[11px] opacity-60 mr-1">Presets:</span>
                          {[
                            'admin.dashboard.read',
                            'admin.users.read',
                            'admin.users.manage',
                            'admin.notifications.manage',
                            'admin.system.read',
                            'super_admin.override'
                          ].map(perm => (
                            <button
                              key={perm}
                              onClick={() => {
                                setProbePermission(perm);
                                handleRunPermissionProbe(perm);
                              }}
                              className={`px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors cursor-pointer ${
                                isDark ? 'bg-neutral-800/80 border-white/5 hover:border-teal-500/50' : 'bg-stone-100 border-stone-200 hover:border-teal-500'
                              }`}
                            >
                              {perm}
                            </button>
                          ))}
                        </div>

                        {/* Probe Result Output */}
                        {probeResult && (
                          <div className={`p-4 rounded-xl border font-mono text-xs transition-all ${
                            probeResult.loading
                              ? 'opacity-60 bg-neutral-800/40 border-white/5'
                              : probeResult.outcome?.authorized
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-red-500/10 border-red-500/30 text-red-400'
                          }`}>
                            {probeResult.loading ? (
                              <div className="flex items-center gap-2">
                                <span className="animate-spin text-teal-400">🌀</span>
                                <span>Evaluating server security boundary...</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between font-bold">
                                  <span>STATUS: {probeResult.outcome?.authorized ? '200 AUTHORIZED' : '403 FORBIDDEN'}</span>
                                  <span className="text-[10px] opacity-70">ROLE: {probeResult.outcome?.role || 'user'}</span>
                                </div>
                                <p className="text-[11px] opacity-90">{probeResult.outcome?.message || probeResult.error}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* RBAC Directive Guidelines */}
                      <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                        <h4 className="font-serif text-sm font-semibold flex items-center gap-2">
                          <Lock className="w-4 h-4 text-indigo-400" />
                          <span>Admin Roles Security Directive</span>
                        </h4>

                        <div className="space-y-3 opacity-90 leading-relaxed text-[11.5px]">
                          <div className={`p-3 rounded-xl border ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <h5 className="font-semibold text-teal-400 mb-1">1. Server-Enforced Source of Truth</h5>
                            <p>Administrative privileges are verified on every request using server-side Firebase Admin ID tokens. Client-provided role flags or body fields are strictly ignored.</p>
                          </div>

                          <div className={`p-3 rounded-xl border ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <h5 className="font-semibold text-indigo-400 mb-1">2. Granular Permission Scopes</h5>
                            <p>Each route requires explicit permission matching (e.g. <code>requireAdminPermission('admin.users.manage')</code>). Roles map to strict Sets of granular capabilities.</p>
                          </div>

                          <div className={`p-3 rounded-xl border ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <h5 className="font-semibold text-amber-400 mb-1">3. Notification & External System Directives</h5>
                            <p>External webhooks (Slack/Discord/Email) require strict HTTPS, destination validation with SSRF host blocking, and minimal privacy payloads (summaries only, zero raw text).</p>
                          </div>
                        </div>
                      </div>

                      {/* Official Role Classification Matrix */}
                      <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-neutral-900/60 border-white/5' : 'bg-white border-stone-200 shadow-2xs'}`}>
                        <h4 className="font-serif text-sm font-semibold flex items-center gap-2">
                          <Users className="w-4 h-4 text-teal-400" />
                          <span>Official Role Classification & Permission Scope Matrix</span>
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          {/* USER ROLE */}
                          <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-teal-400 uppercase font-mono">User Role</span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/20 text-teal-300 font-mono">Standard</span>
                            </div>
                            <p className="text-[11px] opacity-80 leading-relaxed">
                              Standard journal author and reflection participant.
                            </p>
                            <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1 text-[11px]">
                              <div><strong className="text-teal-300">Firestore Scope:</strong> Bound strictly to <code>users/{'{userId}'}/*</code>.</div>
                              <div><strong className="text-teal-300">Capabilities:</strong> Reflection prose, AI Socratic chat, memory calendar, personal webhooks.</div>
                              <div><strong className="text-teal-300">Admin Panel:</strong> Completely hidden and forbidden.</div>
                            </div>
                          </div>

                          {/* ADMIN ROLE */}
                          <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-indigo-400 uppercase font-mono">Admin Role</span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-mono font-bold">Elevated</span>
                            </div>
                            <p className="text-[11px] opacity-80 leading-relaxed">
                              Operational administrator with telemetry and RBAC management capabilities.
                            </p>
                            <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1 text-[11px]">
                              <div><strong className="text-indigo-300">Firestore Scope:</strong> Read-only aggregate stats, user registry, audit logs.</div>
                              <div><strong className="text-indigo-300">Capabilities:</strong> View dashboard metrics, assign user roles, audit security logs, monitor health.</div>
                              <div><strong className="text-indigo-300">Admin Permissions:</strong> Full <code>admin.*</code> set.</div>
                            </div>
                          </div>

                          {/* SUPER ADMIN ROLE */}
                          <div className={`p-4 rounded-xl border space-y-2 ${isDark ? 'bg-neutral-800/50 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-400 uppercase font-mono">Super Admin</span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-mono font-bold">Master (Max 3)</span>
                            </div>
                            <p className="text-[11px] opacity-80 leading-relaxed">
                              Master security authority for infrastructure overrides and privilege assignment. Strictly restricted to a maximum quota of 3 Super Admins platform-wide.
                            </p>
                            <div className="border-t border-black/10 dark:border-white/10 pt-2 space-y-1 text-[11px]">
                              <div><strong className="text-amber-300">Firestore Scope:</strong> Platform-wide master override and policy control.</div>
                              <div><strong className="text-amber-300">Capabilities:</strong> Promote/demote admins, override security barriers during incidents, full audit control.</div>
                              <div><strong className="text-amber-300">Hard Quota Cap:</strong> Maximum 3 Super Admins allowed.</div>
                              <div><strong className="text-amber-300">Admin Permissions:</strong> All <code>admin.*</code> + <code>super_admin.override</code>.</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
