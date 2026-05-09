/**
 * frontend/src/api/auditApi.js
 * API client for Audit Logs & System Monitoring
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
  };
};

export async function getAuditLogs(params) {
  const response = await axios.get(`${API_BASE_URL}/api/v1/audit`, {
    params,
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function getAuditSummary() {
  const response = await axios.get(`${API_BASE_URL}/api/v1/audit/summary`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function exportAuditLogs(filters) {
  const response = await axios.get(`${API_BASE_URL}/api/v1/audit/export`, {
    params: filters,
    headers: getAuthHeaders(),
    responseType: 'blob',
  });
  
  const today = new Date().toISOString().split('T')[0];
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `audit_log_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  
  return true;
}

export async function getUserActivity(userId) {
  const response = await axios.get(`${API_BASE_URL}/api/v1/audit/user/${userId}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function getEntityAuditLog(entityType, entityId) {
  const response = await axios.get(`${API_BASE_URL}/api/v1/audit/entity/${entityType}/${entityId}`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function getSystemHealth() {
  const response = await axios.get(`${API_BASE_URL}/api/v1/monitoring/health`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function getPlatformStats() {
  const response = await axios.get(`${API_BASE_URL}/api/v1/monitoring/stats`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function getHealthSnapshots(hours = 24) {
  const response = await axios.get(`${API_BASE_URL}/api/v1/monitoring/snapshots`, {
    params: { hours },
    headers: getAuthHeaders(),
  });
  return response.data;
}

export async function getSchedulerJobs() {
  const response = await axios.get(`${API_BASE_URL}/api/v1/monitoring/scheduler`, {
    headers: getAuthHeaders(),
  });
  return response.data;
}
