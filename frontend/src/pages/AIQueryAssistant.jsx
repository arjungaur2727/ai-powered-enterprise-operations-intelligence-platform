/**
 * src/pages/AIQueryAssistant.jsx
 *
 * Master AI Query Assistant page.
 * Chat-style layout: sidebar (history) | chat window | schema explorer
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Database, History, RotateCcw, Sparkles } from "lucide-react";

import AppLayout from "../components/layout/AppLayout";
import ChatWindow from "../components/ai/ChatWindow";
import ChatInput from "../components/ai/ChatInput";
import SchemaExplorer from "../components/ai/SchemaExplorer";
import SessionHistorySidebar from "../components/ai/SessionHistorySidebar";
import SaveTemplateModal from "../components/ai/SaveTemplateModal";

import {
  askAI,
  executeAISession,
  getSchemaContext,
  getSuggestions,
  rateSession,
  refreshSchema,
  saveAsTemplate,
} from "../api/aiApi";
import { useAuth } from "../context/AuthContext";

function getInitials(name = "") {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "U";
}

export default function AIQueryAssistant() {
  const { user } = useAuth();
  const canExecute = user?.role !== "analyst";

  // Chat state
  const [messages, setMessages] = useState([]);
  const [sessionGroupId, setSessionGroupId] = useState(() => crypto.randomUUID());
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [executingSessionId, setExecutingSessionId] = useState(null);
  const [autoExecute, setAutoExecute] = useState(false);

  // Panels
  const [isSchemaOpen, setSchemaOpen] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [schema, setSchema] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Save modal
  const [isSaveModalOpen, setSaveModalOpen] = useState(false);
  const [savingSessionId, setSavingSessionId] = useState(null);
  const [saveDefaultName, setSaveDefaultName] = useState("");
  const [savingSQL, setSavingSQL] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState([]);

  // ---------------------------------------------------------------------------
  // Load suggestions + schema on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    getSuggestions().then(setSuggestions).catch(() => {});
    if (canExecute) {
      setSchemaLoading(true);
      getSchemaContext()
        .then(setSchema)
        .catch(() => {})
        .finally(() => setSchemaLoading(false));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Send message handler
  // ---------------------------------------------------------------------------
  const handleSend = async (text) => {
    // Append user message
    setMessages((prev) => [
      ...prev,
      {
        type: "user",
        data: {
          text,
          timestamp: new Date().toISOString(),
          userInitials: getInitials(user?.full_name),
        },
      },
    ]);

    setIsGenerating(true);

    // Build conversation history (last 6 turns)
    const historyForGPT = conversationHistory.slice(-6);

    try {
      const response = await askAI({
        naturalLanguage: text,
        sessionGroupId,
        conversationHistory: historyForGPT,
        autoExecute: autoExecute && canExecute,
      });

      // Append AI message
      setMessages((prev) => [...prev, { type: "ai", data: response }]);

      // Update conversation history
      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: response.explanation || response.generated_sql || "" },
      ]);

      if (response.was_executed) {
        if (response.execution_status === "success") {
          toast.success(`✓ ${response.row_count.toLocaleString()} rows returned`);
        } else {
          toast.error("Query executed with errors.");
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "AI service unavailable. Try again or use SQL Workflows.";
      setMessages((prev) => [...prev, { type: "error", data: { message: msg } }]);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Run handler
  // ---------------------------------------------------------------------------
  const handleRun = async (sessionId) => {
    if (!canExecute) {
      toast.error("Contact your manager to execute queries.");
      return;
    }
    setExecutingSessionId(sessionId);
    try {
      const result = await executeAISession(sessionId);

      // Update the matching AI message in-place
      setMessages((prev) =>
        prev.map((msg) =>
          msg.type === "ai" && (msg.data.session_id === sessionId || msg.data.id === sessionId)
            ? { ...msg, data: result }
            : msg
        )
      );

      if (result.execution_status === "success") {
        toast.success(`✓ ${result.row_count.toLocaleString()} rows in ${result.execution_ms}ms`);
      } else {
        toast.error("Query execution failed.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Execution failed.");
    } finally {
      setExecutingSessionId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Save template handler
  // ---------------------------------------------------------------------------
  const handleSaveTemplate = (sessionId) => {
    const msg = messages.find(
      (m) => m.type === "ai" && (m.data.session_id === sessionId || m.data.id === sessionId)
    );
    const nl = msg?.data?.natural_language || "";
    const sql = msg?.data?.generated_sql || "";
    const autoName = nl.length > 60 ? nl.slice(0, 57) + "…" : nl;

    setSavingSessionId(sessionId);
    setSaveDefaultName(autoName);
    setSavingSQL(sql);
    setSaveModalOpen(true);
  };

  const handleConfirmSave = async (formData) => {
    setTemplateSaving(true);
    try {
      await saveAsTemplate(savingSessionId, formData);
      toast.success("Template saved! Find it in SQL Workflows.");
      setSaveModalOpen(false);

      // Mark message as saved
      setMessages((prev) =>
        prev.map((msg) =>
          msg.type === "ai" && (msg.data.session_id === savingSessionId || msg.data.id === savingSessionId)
            ? { ...msg, data: { ...msg.data, saved_as_template: true } }
            : msg
        )
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed.");
    } finally {
      setTemplateSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Rate handler
  // ---------------------------------------------------------------------------
  const handleRate = async (sessionId, rating) => {
    try {
      await rateSession(sessionId, { rating });
    } catch { /* silent */ }
  };

  // ---------------------------------------------------------------------------
  // History load
  // ---------------------------------------------------------------------------
  const handleLoadSession = (session) => {
    setMessages([
      { type: "user", data: { text: session.natural_language, timestamp: session.created_at, userInitials: getInitials(user?.full_name) } },
      { type: "ai", data: { ...session, session_id: session.id } },
    ]);
    setConversationHistory([
      { role: "user", content: session.natural_language },
      { role: "assistant", content: session.explanation || session.generated_sql || "" },
    ]);
  };

  // ---------------------------------------------------------------------------
  // Clear chat
  // ---------------------------------------------------------------------------
  const handleClear = () => {
    if (messages.length > 0 && !confirm("Clear conversation? This cannot be undone.")) return;
    setMessages([]);
    setConversationHistory([]);
    setSessionGroupId(crypto.randomUUID());
  };

  // ---------------------------------------------------------------------------
  // Schema refresh (admin)
  // ---------------------------------------------------------------------------
  const handleRefreshSchema = async () => {
    setSchemaLoading(true);
    try {
      const data = await refreshSchema();
      setSchema(data);
      toast.success("Schema refreshed.");
    } catch { toast.error("Schema refresh failed."); }
    finally { setSchemaLoading(false); }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <AppLayout title="AI Query Assistant">
      <div className="flex h-[calc(100vh-4rem)] flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900">AI Query Assistant</h2>
              <p className="text-[10px] text-gray-400">Powered by GPT-4o</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
            {canExecute && (
              <button
                onClick={() => setSchemaOpen((s) => !s)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  isSchemaOpen
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                Schema
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <ChatWindow
              messages={messages}
              suggestions={suggestions}
              isLoading={isGenerating}
              onRun={handleRun}
              onSaveTemplate={handleSaveTemplate}
              onRate={handleRate}
              onRerun={(q) => handleSend(q)}
              canExecute={canExecute}
              executingSessionId={executingSessionId}
            />
            <ChatInput
              onSend={handleSend}
              isLoading={isGenerating}
              placeholder="Ask anything about your data… e.g. 'Show failed queries this week'"
              autoExecute={autoExecute}
              onAutoExecuteToggle={() => setAutoExecute((a) => !a)}
              canAutoExecute={canExecute}
            />
          </div>

          {/* Schema explorer panel (right) */}
          {isSchemaOpen && canExecute && (
            <SchemaExplorer
              schema={schema}
              isLoading={schemaLoading}
              onRefresh={handleRefreshSchema}
              canRefresh={user?.role === "admin"}
            />
          )}
        </div>
      </div>

      {/* Sidebar */}
      <SessionHistorySidebar
        isOpen={isHistoryOpen}
        onClose={() => setHistoryOpen(false)}
        onLoadSession={handleLoadSession}
      />

      {/* Save modal */}
      <SaveTemplateModal
        isOpen={isSaveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleConfirmSave}
        sql={savingSQL}
        defaultName={saveDefaultName}
        isLoading={templateSaving}
      />
    </AppLayout>
  );
}
