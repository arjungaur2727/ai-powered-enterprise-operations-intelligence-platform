/**
 * src/hooks/useDashboard.js
 * Custom hook — parallel data fetching for the KPI dashboard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getKPISummary, getQueryTrend, getUploadTrend, getWorkflowStatus,
  getAIConfidence, getActivityFeed, getPerformanceAlerts, getTopTemplates,
  getPerformanceTrend, getTokenUsage,
} from "../api/dashboardApi";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useDashboard({ isManager = false, isAdmin = false } = {}) {
  const [summary, setSummary] = useState(null);
  const [queryTrend, setQueryTrend] = useState(null);
  const [uploadTrend, setUploadTrend] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [aiConfidence, setAiConfidence] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [performanceAlerts, setPerformanceAlerts] = useState([]);
  const [topTemplates, setTopTemplates] = useState([]);
  const [performanceTrend, setPerformanceTrend] = useState(null);
  const [tokenUsage, setTokenUsage] = useState([]);
  const [loading, setLoading] = useState({ summary: true, charts: true, feed: true, alerts: true });
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const intervalRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setLoading({ summary: true, charts: true, feed: true, alerts: true });
    setError(null);

    const tasks = [
      getKPISummary(),
      getQueryTrend(14),
      getUploadTrend(7),
      getWorkflowStatus(),
      getAIConfidence(),
      getActivityFeed(20),
      getTopTemplates(5),
      ...(isManager || isAdmin ? [getPerformanceAlerts(), getPerformanceTrend(14), getTokenUsage(14)] : []),
    ];

    const results = await Promise.allSettled(tasks);
    let idx = 0;

    const get = () => results[idx++];

    const r0 = get(); if (r0.status === "fulfilled") setSummary(r0.value);
    const r1 = get(); if (r1.status === "fulfilled") setQueryTrend(r1.value);
    const r2 = get(); if (r2.status === "fulfilled") setUploadTrend(r2.value);
    const r3 = get(); if (r3.status === "fulfilled") setWorkflowStatus(r3.value);
    const r4 = get(); if (r4.status === "fulfilled") setAiConfidence(r4.value);
    const r5 = get(); if (r5.status === "fulfilled") setActivityFeed(r5.value || []);
    const r6 = get(); if (r6.status === "fulfilled") setTopTemplates(r6.value || []);

    if (isManager || isAdmin) {
      const r7 = get(); if (r7?.status === "fulfilled") setPerformanceAlerts(r7.value || []);
      const r8 = get(); if (r8?.status === "fulfilled") setPerformanceTrend(r8.value);
      const r9 = get(); if (r9?.status === "fulfilled") setTokenUsage(r9.value || []);
    }

    setLastRefreshed(new Date());
    setLoading({ summary: false, charts: false, feed: false, alerts: false });
  }, [isManager, isAdmin]);

  // Individual re-fetchers for period changes
  const refetchQueryTrend = useCallback(async (days) => {
    try { setQueryTrend(await getQueryTrend(days)); } catch { /* silent */ }
  }, []);

  const refetchUploadTrend = useCallback(async (days) => {
    try { setUploadTrend(await getUploadTrend(days)); } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchAll]);

  return {
    summary, queryTrend, uploadTrend, workflowStatus, aiConfidence,
    activityFeed, performanceAlerts, topTemplates, performanceTrend, tokenUsage,
    loading, error, lastRefreshed,
    refetch: fetchAll, refetchQueryTrend, refetchUploadTrend,
  };
}
