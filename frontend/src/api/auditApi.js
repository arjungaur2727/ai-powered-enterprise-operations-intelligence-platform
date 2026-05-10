/**
 * frontend/src/api/auditApi.js
 * API client for Audit Logs & System Monitoring
 * Updated to use centralized axiosClient.
 */

import axiosClient from "./axiosClient";

export async function getAuditLogs(params) {
  const response = await axiosClient.get("/api/v1/audit", {
    params,
  });
  return response.data;
}

export async function getAuditSummary() {
  const response = await axiosClient.get("/api/v1/audit/summary");
  return response.data;
}

export async function exportAuditLogs(filters) {
  const response = await axiosClient.get("/api/v1/audit/export", {
    params: filters,
    responseType: "blob",
  });

  const today = new Date().toISOString().split("T")[0];
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `audit_log_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return true;
}

export async function getUserActivity(userId) {
  const response = await axiosClient.get(`/api/v1/audit/user/${userId}`);
  return response.data;
}

export async function getEntityAuditLog(entityType, entityId) {
  const response = await axiosClient.get(`/api/v1/audit/entity/${entityType}/${entityId}`);
  return response.data;
}

export async function getSystemHealth() {
  const response = await axiosClient.get("/api/v1/monitoring/health");
  return response.data;
}

export async function getPlatformStats() {
  const response = await axiosClient.get("/api/v1/monitoring/stats");
  return response.data;
}

export async function getHealthSnapshots(hours = 24) {
  const response = await axiosClient.get("/api/v1/monitoring/snapshots", {
    params: { hours },
  });
  return response.data;
}

export async function getSchedulerJobs() {
  const response = await axiosClient.get("/api/v1/monitoring/scheduler");
  return response.data;
}
