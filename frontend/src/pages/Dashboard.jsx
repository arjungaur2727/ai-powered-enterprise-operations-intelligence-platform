import { useState, useEffect, useCallback } from "react";
import AppLayout from "../components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Terminal, GitBranch, Upload, Sparkles,
  Timer, Users, RefreshCw, AlertTriangle
} from "lucide-react";
import KPICard from "../components/ui/KPICard";
import {
  getKPISummary,
  getQueryTrend,
  getActivityFeed,
  getWorkflowStatus,
  getPerformanceAlerts,
  getTopTemplates,
} from "../api/dashboardApi";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar
} from "recharts";
import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP_STYLE } from "../utils/chartTheme";
import toast from "react-hot-toast";

// Safe number utility
const safe = (val, fallback = 0) => {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
};

// Format relative time
const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = ["admin", "manager"].includes(user?.role);

  // ── State ──────────────────────────────────────────────────
  const [summary, setSummary]         = useState(null);
  const [queryTrend, setQueryTrend]   = useState([]);
  const [activityFeed, setActivity]   = useState([]);
  const [alerts, setAlerts]           = useState([]);
  const [topTemplates, setTemplates]  = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const [loading, setLoading] = useState({
    summary: true, trend: true, feed: true, alerts: false
  });
  const [error, setError] = useState(null);

  // ── Fetch All ─────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(prev => ({ ...prev, summary: true, trend: true, feed: true }));
    setError(null);

    const results = await Promise.allSettled([
      getKPISummary(),
      getQueryTrend(14),
      getActivityFeed(10),
      isManager ? getPerformanceAlerts() : Promise.resolve([]),
      isManager ? getTopTemplates(5) : Promise.resolve([]),
    ]);

    // KPI Summary
    if (results[0].status === "fulfilled") {
      setSummary(results[0].value);
    } else {
      setError("Could not load dashboard metrics. Is the backend running?");
      toast.error("Backend connection failed");
    }

    // Query Trend
    if (results[1].status === "fulfilled") {
      const data = results[1].value?.data || [];
      setQueryTrend(data.map(d => ({
        date: new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
        Success: safe(d.value_a),
        Failed:  safe(d.value_b),
      })));
    }

    // Activity Feed
    if (results[2].status === "fulfilled") {
      setActivity(results[2].value || []);
    }

    // Alerts
    if (results[3].status === "fulfilled") {
      setAlerts(results[3].value || []);
    }

    // Top Templates
    if (results[4].status === "fulfilled") {
      setTemplates(results[4].value || []);
    }

    setLoading({ summary: false, trend: false, feed: false, alerts: false });
    setLastRefreshed(new Date());
  }, [isManager]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ── KPI Card Definitions ──────────────────────────────────
  const kpiCards = summary ? [
    {
      title: "Queries Today",
      value: safe(summary.queries_today),
      subtitle: `${safe(summary.queries_success_today)} successful`,
      icon: Terminal,
      accentColor: "blue",
      trend: safe(summary.queries_vs_yesterday) >= 0 ? "up" : "down",
      trendValue: Math.abs(safe(summary.queries_vs_yesterday)),
      onClick: () => navigate("/sql"),
    },
    {
      title: "Active Workflows",
      value: safe(summary.active_workflows),
      subtitle: `${safe(summary.failing_workflows)} failing`,
      icon: GitBranch,
      accentColor: safe(summary.failing_workflows) > 0 ? "red" : "purple",
      trend: "neutral",
      trendValue: safe(summary.workflow_health_pct),
      trendLabel: "health",
      onClick: () => navigate("/sql"),
    },
    {
      title: "Uploads Today",
      value: safe(summary.uploads_today),
      subtitle: `${safe(summary.rows_ingested_today).toLocaleString()} rows ingested`,
      icon: Upload,
      accentColor: "green",
      trend: safe(summary.uploads_vs_yesterday) >= 0 ? "up" : "down",
      trendValue: Math.abs(safe(summary.uploads_vs_yesterday)),
      onClick: () => navigate("/upload"),
    },
    {
      title: "AI Queries Today",
      value: safe(summary.ai_queries_today),
      subtitle: `${safe(summary.ai_tokens_today).toLocaleString()} tokens`,
      icon: Sparkles,
      accentColor: "orange",
      trend: safe(summary.ai_queries_vs_yesterday) >= 0 ? "up" : "down",
      trendValue: Math.abs(safe(summary.ai_queries_vs_yesterday)),
      onClick: () => navigate("/ai"),
    },
    ...(isManager ? [
      {
        title: "Avg Query Time",
        value: safe(summary.avg_execution_ms_today),
        format: "ms",
        subtitle: "Average today",
        icon: Timer,
        accentColor: safe(summary.avg_execution_ms_today) > 3000 ? "red" : "blue",
        trend: "neutral",
        trendValue: 0,
      },
      {
        title: "Active Users",
        value: safe(summary.active_users_today),
        subtitle: `of ${safe(summary.total_users)} total`,
        icon: Users,
        accentColor: "purple",
        trend: "neutral",
        trendValue: 0,
      },
    ] : []),
  ] : [];

  // ── Greeting ──────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] || "there";

  // ── Render ────────────────────────────────────────────────
  return (
    <AppLayout title="Operational Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-primary tracking-tight">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-sm text-ink-secondary mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long", year: "numeric",
                month: "long", day: "numeric"
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-2xs text-ink-tertiary">
                Updated {timeAgo(lastRefreshed.toISOString())}
              </span>
            )}
            <button
              onClick={fetchDashboard}
              disabled={loading.summary}
              className="btn-ghost gap-1.5">
              <RefreshCw
                size={13}
                className={loading.summary ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl
                          bg-danger/5 border border-danger/20 text-danger
                          text-sm animate-fade-in">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <div>
              <span className="font-medium">Connection issue: </span>
              {error}
            </div>
          </div>
        )}

        {/* Performance Alerts */}
        {isManager && alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i}
                   className={`flex items-start gap-3 p-3 rounded-lg
                               border text-sm
                               ${alert.severity === "critical"
                                 ? "bg-danger/5 border-danger/20 text-danger"
                                 : "bg-warning/5 border-warning/20 text-warning"}`}>
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">{alert.title}: </span>
                  <span className="opacity-80">{alert.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KPI Grid */}
        <div className={`grid gap-4
          ${isManager
            ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            : "grid-cols-2 lg:grid-cols-4"}`}>
          {loading.summary
            ? Array.from({ length: isManager ? 6 : 4 }).map((_, i) => (
                <div key={i} className="card p-5 space-y-3 animate-pulse">
                  <div className="skeleton h-4 w-20 rounded" />
                  <div className="skeleton h-8 w-12 rounded" />
                  <div className="skeleton h-3 w-28 rounded" />
                </div>
              ))
            : kpiCards.map((card, i) => (
                <KPICard key={i} {...card} />
              ))
          }
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-ink-primary">
                  Query Execution Trend
                </h3>
                <p className="text-2xs text-ink-tertiary mt-0.5">
                  Last 14 days
                </p>
              </div>
            </div>
            {loading.trend ? (
              <div className="skeleton h-52 rounded-lg" />
            ) : queryTrend.length === 0 ? (
              <div className="h-52 flex flex-col items-center
                              justify-center text-ink-tertiary">
                <Terminal size={24} className="mb-2 opacity-30" />
                <p className="text-sm">No query data yet</p>
                <p className="text-2xs mt-1">Run some SQL queries to see trends</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={queryTrend}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="date" {...CHART_AXIS} />
                  <YAxis {...CHART_AXIS} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#475569" }} />
                  <Line type="monotone" dataKey="Success"
                        stroke="#22C55E" strokeWidth={2}
                        dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Failed"
                        stroke="#EF4444" strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card p-5 flex flex-col">
            <h3 className="text-sm font-semibold text-ink-primary mb-4">
              Recent Activity
            </h3>
            {loading.feed ? (
              <div className="space-y-3">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="skeleton w-7 h-7 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 rounded w-3/4" />
                      <div className="skeleton h-2.5 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityFeed.length === 0 ? (
              <div className="flex-1 flex flex-col items-center
                              justify-center text-ink-tertiary">
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1">
                {activityFeed.map((item, i) => (
                  <div key={i}
                       className="flex items-start gap-2.5
                                  pb-3 border-b border-surface-5/50
                                  last:border-0 last:pb-0">
                    <div className={`w-6 h-6 rounded-md flex-shrink-0
                                     flex items-center justify-center
                                     text-[10px]
                                     ${item.severity === "success"
                                       ? "bg-success/10 text-success"
                                       : item.severity === "error"
                                       ? "bg-danger/10 text-danger"
                                       : "bg-brand/10 text-brand-bright"}`}>
                      {item.event_type === "file_uploaded"  ? "↑" :
                       item.event_type === "ai_query"       ? "✦" :
                       item.event_type === "query_executed" ? "▶" : "●"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink-primary truncate leading-snug">
                        {item.title}
                      </p>
                      <p className="text-2xs text-ink-tertiary mt-0.5 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                    <span className="text-2xs text-ink-disabled flex-shrink-0">
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isManager && topTemplates.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink-primary mb-4">
              Most Used SQL Templates
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-5">
                    {["#","Template","Executions","Success Rate","Avg Time"].map(h => (
                      <th key={h}
                          className="text-left px-3 py-2
                                     text-2xs font-semibold
                                     text-ink-tertiary uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topTemplates.map((t, i) => (
                    <tr key={i}
                        className="border-b border-surface-5/40
                                   hover:bg-surface-3 transition-colors
                                   cursor-pointer"
                        onClick={() => navigate("/sql")}>
                      <td className="px-3 py-2.5 text-ink-tertiary text-xs">
                        #{i + 1}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-ink-primary
                                     text-xs max-w-[180px] truncate">
                        {t.name}
                      </td>
                      <td className="px-3 py-2.5 text-ink-secondary text-xs">
                        {safe(t.execution_count).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className={safe(t.success_rate) >= 90
                          ? "text-success"
                          : safe(t.success_rate) >= 70
                          ? "text-warning"
                          : "text-danger"}>
                          {safe(t.success_rate).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-ink-secondary text-xs">
                        {safe(t.avg_execution_ms) >= 1000
                          ? `${(safe(t.avg_execution_ms)/1000).toFixed(1)}s`
                          : `${Math.round(safe(t.avg_execution_ms))}ms`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
