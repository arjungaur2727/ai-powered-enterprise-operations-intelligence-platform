/**
 * src/api/alertsApi.js — Alert & Notification Engine API client.
 */
import axiosClient from "./axiosClient";

export async function getAlerts({ skip = 0, limit = 20, severity, alertType, isResolved, isRead } = {}) {
  const params = { skip, limit };
  if (severity) params.severity = severity;
  if (alertType) params.alert_type = alertType;
  if (isResolved !== undefined && isResolved !== null) params.is_resolved = isResolved;
  if (isRead !== undefined && isRead !== null) params.is_read = isRead;
  const { data } = await axiosClient.get("/api/v1/alerts", { params });
  return data;
}
export async function getUnreadCount() {
  const { data } = await axiosClient.get("/api/v1/alerts/unread-count");
  return data;
}
export async function getAlertDetail(alertId) {
  const { data } = await axiosClient.get(`/api/v1/alerts/${alertId}`);
  return data;
}
export async function markAlertRead(alertId) {
  const { data } = await axiosClient.patch(`/api/v1/alerts/${alertId}/read`);
  return data;
}
export async function resolveAlert(alertId, resolutionNote) {
  const { data } = await axiosClient.patch(`/api/v1/alerts/${alertId}/resolve`, {
    resolution_note: resolutionNote || null,
  });
  return data;
}
export async function markAllRead() {
  const { data } = await axiosClient.post("/api/v1/alerts/mark-all-read");
  return data;
}
export async function createManualAlert(payload) {
  const { data } = await axiosClient.post("/api/v1/alerts/manual", payload);
  return data;
}
export async function getAlertRules() {
  const { data } = await axiosClient.get("/api/v1/alerts/rules");
  return data;
}
export async function createAlertRule(payload) {
  const { data } = await axiosClient.post("/api/v1/alerts/rules", payload);
  return data;
}
export async function updateAlertRule(id, payload) {
  const { data } = await axiosClient.put(`/api/v1/alerts/rules/${id}`, payload);
  return data;
}
export async function toggleAlertRule(id) {
  const { data } = await axiosClient.patch(`/api/v1/alerts/rules/${id}/toggle`);
  return data;
}
export async function deleteAlertRule(id) {
  await axiosClient.delete(`/api/v1/alerts/rules/${id}`);
}
export async function getNotificationLog({ skip = 0, limit = 50, deliveryStatus } = {}) {
  const params = { skip, limit };
  if (deliveryStatus) params.delivery_status = deliveryStatus;
  const { data } = await axiosClient.get("/api/v1/alerts/notifications", { params });
  return data;
}
export async function sendTestEmail(recipientEmail) {
  const { data } = await axiosClient.post("/api/v1/alerts/test-email", {
    recipient_email: recipientEmail,
  });
  return data;
}
