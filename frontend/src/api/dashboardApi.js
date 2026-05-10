/**
 * src/api/dashboardApi.js
 * KPI Dashboard & Analytics API calls.
 */
import axiosClient from "./axiosClient";

export async function getKPISummary() {
  try {
    const res = await axiosClient.get("/api/v1/dashboard/summary");
    return res.data;
  } catch (err) {
    console.error("getKPISummary failed:", err.message);
    // Return safe defaults so dashboard doesn't break
    return {
      queries_today: 0, queries_success_today: 0,
      queries_failed_today: 0, queries_vs_yesterday: 0,
      avg_execution_ms_today: 0, uploads_today: 0,
      rows_ingested_today: 0, uploads_vs_yesterday: 0,
      active_workflows: 0, failing_workflows: 0,
      workflow_health_pct: 100, ai_queries_today: 0,
      ai_tokens_today: 0, ai_queries_vs_yesterday: 0,
      active_users_today: 0, total_users: 0,
      query_success_rate_today: 0, upload_success_rate_today: 0,
      ai_execution_rate_today: 0,
    };
  }
}

export async function getQueryTrend(days = 14) {
  try {
    const res = await axiosClient.get(`/api/v1/dashboard/trends/queries?days=${days}`);
    return res.data;
  } catch (err) {
    console.error("getQueryTrend failed:", err.message);
    return { data: [], total_period: 0, period_days: days };
  }
}

export async function getUploadTrend(days = 7) {
  try {
    const res = await axiosClient.get(`/api/v1/dashboard/trends/uploads?days=${days}`);
    return res.data;
  } catch (err) {
    console.error("getUploadTrend failed:", err.message);
    return { data: [], total_uploads: 0, total_rows: 0, period_days: days };
  }
}

export async function getPerformanceTrend(days = 14) {
  try {
    const res = await axiosClient.get(`/api/v1/dashboard/trends/performance?days=${days}`);
    return res.data;
  } catch (err) {
    console.error("getPerformanceTrend failed:", err.message);
    return { data: [], overall_avg_ms: 0, period_days: days };
  }
}

export async function getWorkflowStatus() {
  try {
    const res = await axiosClient.get("/api/v1/dashboard/workflows/status");
    return res.data;
  } catch (err) {
    console.error("getWorkflowStatus failed:", err.message);
    return { healthy: 0, failing: 0, inactive: 0, never_run: 0, total: 0 };
  }
}

export async function getAIConfidence() {
  try {
    const res = await axiosClient.get("/api/v1/dashboard/ai/confidence");
    return res.data;
  } catch (err) {
    console.error("getAIConfidence failed:", err.message);
    return { high: 0, medium: 0, low: 0, total: 0, executed_pct: 0 };
  }
}

export async function getTokenUsage(days = 14) {
  try {
    const res = await axiosClient.get(`/api/v1/dashboard/ai/token-usage?days=${days}`);
    return res.data;
  } catch (err) {
    console.error("getTokenUsage failed:", err.message);
    return [];
  }
}

export async function getActivityFeed(limit = 20) {
  try {
    const res = await axiosClient.get(`/api/v1/dashboard/activity/feed?limit=${limit}`);
    return res.data;
  } catch (err) {
    console.error("getActivityFeed failed:", err.message);
    return [];
  }
}

export async function getPerformanceAlerts() {
  try {
    const res = await axiosClient.get("/api/v1/dashboard/alerts/performance");
    return res.data;
  } catch (err) {
    console.error("getPerformanceAlerts failed:", err.message);
    return [];
  }
}

export async function getTopTemplates(limit = 5) {
  try {
    const res = await axiosClient.get(`/api/v1/dashboard/top/templates?limit=${limit}`);
    return res.data;
  } catch (err) {
    console.error("getTopTemplates failed:", err.message);
    return [];
  }
}

export async function getTopUsers(limit = 5) {
  try {
    const res = await axiosClient.get(`/api/v1/dashboard/top/users?limit=${limit}`);
    return res.data;
  } catch (err) {
    console.error("getTopUsers failed:", err.message);
    return [];
  }
}
