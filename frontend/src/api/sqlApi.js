/**
 * src/api/sqlApi.js
 * SQL Automation Engine API calls.
 */

import axiosClient from "./axiosClient";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------
export async function getTemplates({ search, tags, skip = 0, limit = 20 } = {}) {
  const params = { skip, limit };
  if (search) params.search = search;
  if (tags) params.tags = tags;
  const { data } = await axiosClient.get("/api/v1/sql/templates", { params });
  return data;
}

export async function createTemplate(payload) {
  const { data } = await axiosClient.post("/api/v1/sql/templates", payload);
  return data;
}

export async function updateTemplate(id, payload) {
  const { data } = await axiosClient.put(`/api/v1/sql/templates/${id}`, payload);
  return data;
}

export async function deleteTemplate(id) {
  const { data } = await axiosClient.delete(`/api/v1/sql/templates/${id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------
export async function executeSQL({ templateId, queryText, params = {} } = {}) {
  const body = { params };
  if (templateId) body.template_id = templateId;
  if (queryText) body.query_text = queryText;
  const { data } = await axiosClient.post("/api/v1/sql/execute", body);
  return data;
}

export async function executeRaw(queryText) {
  const { data } = await axiosClient.post("/api/v1/sql/execute/raw", { query_text: queryText });
  return data;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export async function getHistory({
  skip = 0,
  limit = 20,
  source,
  status,
  templateId,
  dateFrom,
  dateTo,
} = {}) {
  const params = { skip, limit };
  if (source) params.source = source;
  if (status) params.status = status;
  if (templateId) params.template_id = templateId;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  const { data } = await axiosClient.get("/api/v1/sql/history", { params });
  return data;
}

export async function getHistoryDetail(id) {
  const { data } = await axiosClient.get(`/api/v1/sql/history/${id}`);
  return data;
}

export async function exportHistoryCSV(id) {
  const response = await axiosClient.get(`/api/v1/sql/history/${id}/export`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement("a");
  a.href = url;
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  a.download = match ? match[1] : `query_${id.slice(0, 8)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------
export async function getWorkflows({ skip = 0, limit = 20, isActive } = {}) {
  const params = { skip, limit };
  if (isActive !== undefined) params.is_active = isActive;
  const { data } = await axiosClient.get("/api/v1/sql/workflows", { params });
  return data;
}

export async function createWorkflow(payload) {
  const { data } = await axiosClient.post("/api/v1/sql/workflows", payload);
  return data;
}

export async function updateWorkflow(id, payload) {
  const { data } = await axiosClient.put(`/api/v1/sql/workflows/${id}`, payload);
  return data;
}

export async function toggleWorkflow(id) {
  const { data } = await axiosClient.patch(`/api/v1/sql/workflows/${id}/toggle`);
  return data;
}

export async function runWorkflowNow(id) {
  const { data } = await axiosClient.post(`/api/v1/sql/workflows/${id}/run-now`);
  return data;
}

export async function deleteWorkflow(id) {
  const { data } = await axiosClient.delete(`/api/v1/sql/workflows/${id}`);
  return data;
}
