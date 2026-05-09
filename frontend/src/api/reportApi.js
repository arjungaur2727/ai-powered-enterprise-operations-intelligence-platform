/**
 * src/api/reportApi.js — Reporting Engine API client.
 */
import axiosClient from "./axiosClient";

export async function getReportTemplates() {
  const { data } = await axiosClient.get("/api/v1/reports/templates");
  return data;
}
export async function createReportTemplate(body) {
  const { data } = await axiosClient.post("/api/v1/reports/templates", body);
  return data;
}
export async function updateReportTemplate(id, body) {
  const { data } = await axiosClient.put(`/api/v1/reports/templates/${id}`, body);
  return data;
}
export async function generateReport(body) {
  const { data } = await axiosClient.post("/api/v1/reports/generate", body);
  return data;
}
export async function getReportHistory({ skip = 0, limit = 20, reportType, outputFormat } = {}) {
  const params = { skip, limit };
  if (reportType) params.report_type = reportType;
  if (outputFormat) params.output_format = outputFormat;
  const { data } = await axiosClient.get("/api/v1/reports/history", { params });
  return data;
}
export async function downloadReport(reportId, reportName, outputFormat) {
  const resp = await axiosClient.get(`/api/v1/reports/${reportId}/download`, {
    responseType: "blob",
  });
  triggerFileDownload(resp.data, `${reportName || reportId}.${outputFormat || "pdf"}`);
}
export async function deleteReport(reportId) {
  await axiosClient.delete(`/api/v1/reports/${reportId}`);
}
export async function getSchedules() {
  const { data } = await axiosClient.get("/api/v1/reports/schedules");
  return data;
}
export async function createSchedule(body) {
  const { data } = await axiosClient.post("/api/v1/reports/schedules", body);
  return data;
}
export async function updateSchedule(id, body) {
  const { data } = await axiosClient.put(`/api/v1/reports/schedules/${id}`, body);
  return data;
}
export async function toggleSchedule(id) {
  const { data } = await axiosClient.patch(`/api/v1/reports/schedules/${id}/toggle`);
  return data;
}
export async function deleteSchedule(id) {
  await axiosClient.delete(`/api/v1/reports/schedules/${id}`);
}
export async function previewReport(reportType, dateRangeDays = 7) {
  const { data } = await axiosClient.get(`/api/v1/reports/preview/${reportType}`, {
    params: { date_range_days: dateRangeDays },
  });
  return data;
}

export function triggerFileDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
