/**
 * src/api/dashboardApi.js
 * KPI Dashboard & Analytics API calls.
 */
import axiosClient from "./axiosClient";

export async function getKPISummary() {
  const { data } = await axiosClient.get("/api/v1/dashboard/summary");
  return data;
}
export async function getQueryTrend(days = 14) {
  const { data } = await axiosClient.get("/api/v1/dashboard/trends/queries", { params: { days } });
  return data;
}
export async function getUploadTrend(days = 7) {
  const { data } = await axiosClient.get("/api/v1/dashboard/trends/uploads", { params: { days } });
  return data;
}
export async function getPerformanceTrend(days = 14) {
  const { data } = await axiosClient.get("/api/v1/dashboard/trends/performance", { params: { days } });
  return data;
}
export async function getWorkflowStatus() {
  const { data } = await axiosClient.get("/api/v1/dashboard/workflows/status");
  return data;
}
export async function getAIConfidence() {
  const { data } = await axiosClient.get("/api/v1/dashboard/ai/confidence");
  return data;
}
export async function getTokenUsage(days = 14) {
  const { data } = await axiosClient.get("/api/v1/dashboard/ai/token-usage", { params: { days } });
  return data;
}
export async function getActivityFeed(limit = 20) {
  const { data } = await axiosClient.get("/api/v1/dashboard/activity/feed", { params: { limit } });
  return data;
}
export async function getPerformanceAlerts() {
  const { data } = await axiosClient.get("/api/v1/dashboard/alerts/performance");
  return data;
}
export async function getTopTemplates(limit = 5) {
  const { data } = await axiosClient.get("/api/v1/dashboard/top/templates", { params: { limit } });
  return data;
}
export async function getTopUsers(limit = 5) {
  const { data } = await axiosClient.get("/api/v1/dashboard/top/users", { params: { limit } });
  return data;
}
