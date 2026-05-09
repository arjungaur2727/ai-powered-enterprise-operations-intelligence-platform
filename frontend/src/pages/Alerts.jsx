/**
 * src/pages/Alerts.jsx
 * Alerts & Notifications page — 3 tabs: Feed, Rules, Notification Log.
 */
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bell, Settings, Mail, Loader2, Send } from "lucide-react";
import AppLayout from "../components/layout/AppLayout";
import AlertsHeader from "../components/alerts/AlertsHeader";
import AlertFeed from "../components/alerts/AlertFeed";
import AlertDetailDrawer from "../components/alerts/AlertDetailDrawer";
import ResolveAlertModal from "../components/alerts/ResolveAlertModal";
import AlertRulesTable from "../components/alerts/AlertRulesTable";
import CreateRuleModal from "../components/alerts/CreateRuleModal";
import NotificationLogTable from "../components/alerts/NotificationLogTable";
import { useAuth } from "../context/AuthContext";
import {
  createAlertRule, createManualAlert, deleteAlertRule, getAlertRules,
  getAlerts, getNotificationLog, getUnreadCount, markAlertRead,
  markAllRead, resolveAlert, sendTestEmail, toggleAlertRule, updateAlertRule,
} from "../api/alertsApi";

const TABS = [
  { id: "feed",          label: "Alert Feed",       icon: Bell },
  { id: "rules",        label: "Alert Rules",       icon: Settings },
  { id: "notifications", label: "Notification Log",  icon: Mail },
];

const DEFAULT_FILTERS = { severity: "", alertType: "", isResolved: false, isRead: undefined };

export default function Alerts() {
  const { user } = useAuth();
  const isManager = ["manager", "admin"].includes(user?.role);
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState("feed");
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadData, setUnreadData] = useState({ count: 0, critical: 0, warning: 0, info: 0 });
  const [rules, setRules] = useState([]);
  const [notifLogs, setNotifLogs] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [skip, setSkip] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [isResolvingId, setIsResolvingId] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [isLoading, setIsLoading] = useState({ alerts: true, rules: false, logs: false });

  // Build summary from state for header
  const summary = { total, unread_count: unreadData.count, critical_count: unreadData.critical, warning_count: unreadData.warning };

  const fetchAlerts = useCallback(async (newSkip = 0, replace = true) => {
    setIsLoading((l) => ({ ...l, alerts: true }));
    try {
      const result = await getAlerts({
        skip: newSkip, limit: 20,
        severity: filters.severity || undefined,
        alertType: filters.alertType || undefined,
        isResolved: filters.isResolved,
        isRead: filters.isRead,
      });
      setAlerts((prev) => replace ? result.alerts : [...prev, ...result.alerts]);
      setTotal(result.total);
      setUnreadData({ count: result.unread_count, critical: result.critical_count, warning: result.warning_count, info: 0 });
    } catch { toast.error("Failed to load alerts"); }
    finally { setIsLoading((l) => ({ ...l, alerts: false })); }
  }, [filters]);

  const fetchRules = useCallback(async () => {
    if (!isManager) return;
    setIsLoading((l) => ({ ...l, rules: true }));
    try { setRules(await getAlertRules()); } catch { toast.error("Failed to load rules"); }
    finally { setIsLoading((l) => ({ ...l, rules: false })); }
  }, [isManager]);

  const fetchLogs = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading((l) => ({ ...l, logs: true }));
    try { setNotifLogs(await getNotificationLog()); } catch { toast.error("Failed to load notification log"); }
    finally { setIsLoading((l) => ({ ...l, logs: false })); }
  }, [isAdmin]);

  useEffect(() => { fetchAlerts(0, true); setSkip(0); }, [filters]);
  useEffect(() => { if (isManager) fetchRules(); }, [isManager]);
  useEffect(() => { if (isAdmin && activeTab === "notifications") fetchLogs(); }, [isAdmin, activeTab]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const handleMarkRead = async (id) => {
    try {
      await markAlertRead(id);
      setAlerts((a) => a.map((x) => x.id === id ? { ...x, is_read: true } : x));
      setUnreadData((u) => ({ ...u, count: Math.max(0, u.count - 1) }));
    } catch { toast.error("Failed to mark as read"); }
  };

  const handleMarkAllRead = async () => {
    try {
      const { message } = await markAllRead();
      setAlerts((a) => a.map((x) => ({ ...x, is_read: true })));
      setUnreadData((u) => ({ ...u, count: 0 }));
      toast.success(message || "All alerts marked as read");
    } catch { toast.error("Failed to mark all as read"); }
  };

  const handleViewDetail = (alert) => {
    setSelectedAlert(alert);
    setIsDetailOpen(true);
    if (!alert.is_read) handleMarkRead(alert.id);
  };

  const handleResolve = async (note) => {
    if (!resolveTarget) return;
    setIsResolvingId(resolveTarget.id);
    try {
      const updated = await resolveAlert(resolveTarget.id, note);
      setAlerts((a) => a.map((x) => x.id === updated.id ? updated : x));
      if (selectedAlert?.id === updated.id) setSelectedAlert(updated);
      setResolveTarget(null);
      toast.success("Alert resolved");
      setUnreadData((await getUnreadCount()));
    } catch { toast.error("Failed to resolve alert"); }
    finally { setIsResolvingId(null); }
  };

  const handleCreateManual = async () => {
    const title = prompt("Alert title:");
    const message = prompt("Alert message:");
    const severity = prompt("Severity (info/warning/critical):", "warning");
    if (!title || !message) return;
    try {
      const result = await createManualAlert({ title, message, severity: severity || "warning", notify_users: true });
      setAlerts((a) => [result, ...a]);
      setTotal((t) => t + 1);
      toast.success("Manual alert created");
    } catch { toast.error("Failed to create alert"); }
  };

  const handleSaveRule = async (data) => {
    setIsSavingRule(true);
    try {
      if (editingRule) {
        const updated = await updateAlertRule(editingRule.id, data);
        setRules((r) => r.map((x) => x.id === updated.id ? updated : x));
        toast.success("Rule updated");
      } else {
        const created = await createAlertRule(data);
        setRules((r) => [created, ...r]);
        toast.success("Alert rule created");
      }
      setIsRuleModalOpen(false);
      setEditingRule(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save rule");
    } finally { setIsSavingRule(false); }
  };

  const handleToggleRule = async (id) => {
    try {
      const updated = await toggleAlertRule(id);
      setRules((r) => r.map((x) => x.id === updated.id ? updated : x));
    } catch { toast.error("Failed to toggle rule"); }
  };

  const handleDeleteRule = async (id) => {
    try {
      await deleteAlertRule(id);
      setRules((r) => r.filter((x) => x.id !== id));
      toast.success("Rule deactivated");
    } catch { toast.error("Failed to delete rule"); }
  };

  const handleLoadMore = async () => {
    const newSkip = skip + 20;
    setSkip(newSkip);
    await fetchAlerts(newSkip, false);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) return;
    setSendingTest(true);
    try {
      await sendTestEmail(testEmail);
      toast.success(`Test email sent to ${testEmail}`);
      setTestEmail("");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "object" ? detail.hint || detail.message : detail || "Failed to send test email");
    } finally { setSendingTest(false); }
  };

  const hasFilters = !!(filters.severity || filters.alertType || filters.isResolved !== false || filters.isRead !== undefined);

  return (
    <AppLayout title="Alerts & Notifications">
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <AlertsHeader
          summary={summary}
          onMarkAllRead={handleMarkAllRead}
          onCreateManual={handleCreateManual}
          isManager={isManager}
          isAdmin={isAdmin}
          filters={filters}
          onFilterChange={setFilter}
        />

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 gap-1">
          {TABS.filter((t) => {
            if (t.id === "rules") return isManager;
            if (t.id === "notifications") return isAdmin;
            return true;
          }).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-sm font-medium transition-colors
                ${activeTab === id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
              <Icon className="h-4 w-4" />
              {label}
              {id === "feed" && total > 0 && (
                <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{total}</span>
              )}
              {id === "rules" && rules.length > 0 && (
                <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{rules.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "feed" && (
          <AlertFeed
            alerts={alerts}
            total={total}
            isLoading={isLoading.alerts}
            onRead={handleMarkRead}
            onResolve={(a) => setResolveTarget(a)}
            onViewDetail={handleViewDetail}
            onLoadMore={handleLoadMore}
            isManager={isManager}
            hasFilters={hasFilters}
            onClearFilters={() => setFilters(DEFAULT_FILTERS)}
          />
        )}

        {activeTab === "rules" && isManager && (
          <AlertRulesTable
            rules={rules}
            isLoading={isLoading.rules}
            onEdit={(r) => { setEditingRule(r); setIsRuleModalOpen(true); }}
            onToggle={handleToggleRule}
            onDelete={handleDeleteRule}
            onCreateNew={() => { setEditingRule(null); setIsRuleModalOpen(true); }}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === "notifications" && isAdmin && (
          <div className="space-y-6">
            <NotificationLogTable
              logs={notifLogs}
              isLoading={isLoading.logs}
              onRefresh={fetchLogs}
            />
            {/* Test email */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <h4 className="font-semibold text-gray-900 text-sm">Send Test Email</h4>
              <p className="text-xs text-gray-500">Verify your SMTP configuration by sending a test alert email.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSendTestEmail()}
                />
                <button
                  onClick={handleSendTestEmail}
                  disabled={!testEmail || sendingTest}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sendingTest ? "Sending…" : "Send Test"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overlays */}
      <AlertDetailDrawer
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        alert={selectedAlert}
        onResolve={(a) => { setResolveTarget(a); setIsDetailOpen(false); }}
        isManager={isManager}
      />
      <ResolveAlertModal
        isOpen={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        onConfirm={handleResolve}
        alert={resolveTarget}
        isResolving={!!isResolvingId}
      />
      <CreateRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => { setIsRuleModalOpen(false); setEditingRule(null); }}
        onSave={handleSaveRule}
        editingRule={editingRule}
        isSaving={isSavingRule}
      />
    </AppLayout>
  );
}
