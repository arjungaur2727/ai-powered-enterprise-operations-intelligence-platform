/**
 * src/api/aiApi.js
 * AI Query Assistant API calls.
 */

import axiosClient from "./axiosClient";

export async function generateSQL({ naturalLanguage, sessionGroupId, conversationHistory = [], includeSchema = true }) {
  const { data } = await axiosClient.post("/api/v1/ai/generate", {
    natural_language: naturalLanguage,
    session_group_id: sessionGroupId || null,
    conversation_history: conversationHistory,
    include_schema: includeSchema,
  });
  return data;
}

export async function executeAISession(sessionId) {
  const { data } = await axiosClient.post("/api/v1/ai/execute", { session_id: sessionId });
  return data;
}

export async function askAI({ naturalLanguage, sessionGroupId, conversationHistory = [], autoExecute = false }) {
  const { data } = await axiosClient.post("/api/v1/ai/ask", {
    natural_language: naturalLanguage,
    session_group_id: sessionGroupId || null,
    conversation_history: conversationHistory,
    auto_execute: autoExecute,
  });
  return data;
}

export async function getAIHistory({ skip = 0, limit = 20, sessionGroupId } = {}) {
  const params = { skip, limit };
  if (sessionGroupId) params.session_group_id = sessionGroupId;
  const { data } = await axiosClient.get("/api/v1/ai/history", { params });
  return data;
}

export async function getAISessionDetail(sessionId) {
  const { data } = await axiosClient.get(`/api/v1/ai/history/${sessionId}`);
  return data;
}

export async function saveAsTemplate(sessionId, { name, description, tags = [] }) {
  const { data } = await axiosClient.post(`/api/v1/ai/history/${sessionId}/save-template`, {
    name,
    description,
    tags,
  });
  return data;
}

export async function rateSession(sessionId, { rating, feedback }) {
  const { data } = await axiosClient.post(`/api/v1/ai/history/${sessionId}/rate`, {
    rating,
    feedback,
  });
  return data;
}

export async function getSchemaContext() {
  const { data } = await axiosClient.get("/api/v1/ai/schema");
  return data;
}

export async function refreshSchema() {
  const { data } = await axiosClient.post("/api/v1/ai/schema/refresh");
  return data;
}

export async function getSuggestions() {
  const { data } = await axiosClient.get("/api/v1/ai/suggestions");
  return data;
}
