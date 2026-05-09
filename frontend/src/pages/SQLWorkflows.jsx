/**
 * src/pages/SQLWorkflows.jsx
 *
 * Master SQL Automation page with three tabs:
 *   1. Editor — Template library + SQL editor + results
 *   2. Scheduled Workflows — WorkflowListTable
 *   3. Execution History — full-width history table
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Calendar, Clock, History, Plus, Terminal } from "lucide-react";

import AppLayout from "../components/layout/AppLayout";
import SQLEditorPanel from "../components/sql/SQLEditorPanel";
import TemplateLibraryPanel from "../components/sql/TemplateLibraryPanel";
import ExecutionResultPanel from "../components/sql/ExecutionResultPanel";
import WorkflowListTable from "../components/sql/WorkflowListTable";
import ScheduleWorkflowModal from "../components/sql/ScheduleWorkflowModal";
import QueryHistoryDrawer from "../components/sql/QueryHistoryDrawer";

import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  executeSQL, exportHistoryCSV,
  getHistory,
  getWorkflows, createWorkflow, updateWorkflow, toggleWorkflow, runWorkflowNow,
  deleteWorkflow,
} from "../api/sqlApi";
import { useAuth } from "../context/AuthContext";
import { formatDuration } from "../utils/formatters";

const TABS = [
  { id: "editor",    label: "Editor",    icon: Terminal },
  { id: "workflows", label: "Workflows", icon: Calendar },
  { id: "history",   label: "History",   icon: History },
];

// Status badge helper (history table)
const HIST_STATUS = {
  success: "bg-emerald-100 text-emerald-700",
  failed:  "bg-red-100 text-red-700",
  timeout: "bg-orange-100 text-orange-700",
};

export default function SQLWorkflows() {
  const { user } = useAuth();
  const resultRef = useRef(null);

  // Tab
  const [activeTab, setActiveTab] = useState("editor");

  // Templates
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [queryText, setQueryText] = useState("");

  // Execution
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Workflows
  const [workflows, setWorkflows] = useState([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [isWorkflowModalOpen, setWorkflowModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);

  // Template modal
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: "", description: "", query_text: "", tags: "", is_public: false });
  const [templateSaving, setTemplateSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const data = await getTemplates({ limit: 50 });
      setTemplates(data);
    } catch { /* silent */ }
    finally { setTemplatesLoading(false); }
  }, []);

  const loadWorkflows = useCallback(async () => {
    setWorkflowsLoading(true);
    try {
      const data = await getWorkflows({ limit: 50 });
      setWorkflows(data);
    } catch { /* silent */ }
    finally { setWorkflowsLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await getHistory({ limit: 30 });
      setHistory(data);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (activeTab === "workflows") loadWorkflows();
    if (activeTab === "history") loadHistory();
  }, [activeTab, loadWorkflows, loadHistory]);

  // ---------------------------------------------------------------------------
  // SQL Execution
  // ---------------------------------------------------------------------------
  const handleExecute = async (query, params) => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const result = await executeSQL({
        templateId: selectedTemplate?.id,
        queryText: selectedTemplate ? undefined : query,
        params,
      });
      setExecutionResult(result);

      if (result.status === "success") {
        toast.success(`✓ ${result.row_count.toLocaleString()} rows in ${formatDuration(result.execution_ms)}`);
      } else {
        toast.error(`Query failed: ${(result.error_message || "").slice(0, 80)}`);
      }

      // Auto-scroll to results
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Execution failed.";
      toast.error(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Template CRUD
  // ---------------------------------------------------------------------------
  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: "", description: "", query_text: queryText, tags: "", is_public: false });
    setTemplateModalOpen(true);
  };

  const handleEditTemplate = (tmpl) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      name: tmpl.name,
      description: tmpl.description || "",
      query_text: tmpl.query_text,
      tags: (tmpl.tags || []).join(", "),
      is_public: tmpl.is_public,
    });
    setTemplateModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    setTemplateSaving(true);
    try {
      const payload = {
        name: templateForm.name,
        description: templateForm.description,
        query_text: templateForm.query_text,
        tags: templateForm.tags ? templateForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        is_public: templateForm.is_public,
      };
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload);
        toast.success("Template updated.");
      } else {
        await createTemplate(payload);
        toast.success("Template created.");
      }
      setTemplateModalOpen(false);
      loadTemplates();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed.");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      toast.success("Template deleted.");
      loadTemplates();
    } catch {
      toast.error("Delete failed.");
    }
  };

  // ---------------------------------------------------------------------------
  // Workflow handlers
  // ---------------------------------------------------------------------------
  const handleSaveWorkflow = async (formData) => {
    setWorkflowSaving(true);
    try {
      if (editingWorkflow) {
        await updateWorkflow(editingWorkflow.id, formData);
        toast.success("Workflow updated.");
      } else {
        await createWorkflow(formData);
        toast.success("Workflow scheduled.");
      }
      setWorkflowModalOpen(false);
      setEditingWorkflow(null);
      loadWorkflows();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed.");
    } finally {
      setWorkflowSaving(false);
    }
  };

  const handleToggleWorkflow = async (id) => {
    try {
      await toggleWorkflow(id);
      loadWorkflows();
    } catch { toast.error("Toggle failed."); }
  };

  const handleRunNow = async (id) => {
    try {
      const result = await runWorkflowNow(id);
      toast.success(`Workflow executed: ${result.row_count} rows in ${formatDuration(result.execution_ms)}`);
      loadWorkflows();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Run failed.");
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <AppLayout title="SQL Automation">
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary">SQL Automation Engine</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Build, execute, and schedule SQL queries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "editor" && (
              <button
                onClick={() => setHistoryOpen(true)}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Clock className="h-4 w-4" />
                History
              </button>
            )}
            {activeTab === "workflows" && (
              <button
                onClick={() => { setEditingWorkflow(null); setWorkflowModalOpen(true); }}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus className="h-4 w-4" />
                New Workflow
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-surface-border rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-white text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── EDITOR TAB ── */}
        {activeTab === "editor" && (
          <div className="flex gap-4 min-h-[600px]">
            {/* Template sidebar */}
            <div className="w-72 shrink-0">
              <div className="card h-full overflow-hidden">
                <h3 className="font-semibold text-sm text-text-primary mb-3">Template Library</h3>
                <TemplateLibraryPanel
                  templates={templates}
                  selectedTemplate={selectedTemplate}
                  onSelectTemplate={(t) => {
                    setSelectedTemplate(t);
                    setQueryText(t.query_text);
                    setExecutionResult(null);
                  }}
                  onCreateNew={handleCreateTemplate}
                  onEditTemplate={handleEditTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  isLoading={templatesLoading}
                  currentUser={user}
                />
              </div>
            </div>

            {/* Editor + results */}
            <div className="flex-1 space-y-4">
              <SQLEditorPanel
                initialQuery={queryText}
                onQueryChange={setQueryText}
                onExecute={handleExecute}
                isLoading={isExecuting}
                templateName={selectedTemplate?.name ?? null}
                paramSchema={selectedTemplate?.param_schema ?? null}
              />
              <div ref={resultRef}>
                <ExecutionResultPanel
                  result={executionResult}
                  isLoading={isExecuting}
                  onExport={exportHistoryCSV}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── WORKFLOWS TAB ── */}
        {activeTab === "workflows" && (
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-text-primary">Scheduled Workflows</h3>
                <p className="text-sm text-text-muted mt-0.5">
                  {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} configured
                </p>
              </div>
            </div>
            <div className="p-4">
              <WorkflowListTable
                workflows={workflows}
                isLoading={workflowsLoading}
                onToggle={handleToggleWorkflow}
                onEdit={(wf) => { setEditingWorkflow(wf); setWorkflowModalOpen(true); }}
                onDelete={async (id) => {
                  if (!confirm("Delete this workflow?")) return;
                  try {
                    await deleteWorkflow(id);
                    toast.success("Workflow deleted.");
                    loadWorkflows();
                  } catch (err) {
                    toast.error(err?.response?.data?.detail || "Delete failed.");
                  }
                }}
                onRunNow={handleRunNow}
              />
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-border">
              <h3 className="font-semibold text-text-primary">Execution History</h3>
              <p className="text-sm text-text-muted mt-0.5">All recent query executions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface">
                  <tr>
                    {["Query", "Source", "Status", "Rows", "Duration", "Template", "Executed At"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-surface-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {[...Array(7)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-gray-200 rounded w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-text-muted text-sm">
                        No query history yet. Run a query in the Editor tab.
                      </td>
                    </tr>
                  ) : (
                    history.map((h, idx) => (
                      <tr key={h.id} className={idx % 2 === 0 ? "bg-white" : "bg-surface/50"}>
                        <td className="px-4 py-2.5 border-b border-surface-border/50 max-w-xs">
                          <p className="font-mono text-xs text-text-secondary truncate" title={h.query_text}>
                            {h.query_text.slice(0, 60)}{h.query_text.length > 60 ? "…" : ""}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 border-b border-surface-border/50">
                          <span className="badge bg-blue-100 text-blue-700 capitalize">{h.source}</span>
                        </td>
                        <td className="px-4 py-2.5 border-b border-surface-border/50">
                          <span className={`badge ${HIST_STATUS[h.status] ?? "bg-gray-100 text-gray-500"}`}>{h.status}</span>
                        </td>
                        <td className="px-4 py-2.5 border-b border-surface-border/50 text-xs text-text-secondary">
                          {h.row_count?.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 border-b border-surface-border/50 text-xs text-text-secondary">
                          {formatDuration(h.execution_ms)}
                        </td>
                        <td className="px-4 py-2.5 border-b border-surface-border/50 text-xs text-text-muted">
                          {h.template_name || "—"}
                        </td>
                        <td className="px-4 py-2.5 border-b border-surface-border/50 text-xs text-text-muted">
                          {new Date(h.executed_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* History drawer */}
      <QueryHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setHistoryOpen(false)}
        onRerun={(q) => { setQueryText(q); setSelectedTemplate(null); }}
      />

      {/* Workflow modal */}
      <ScheduleWorkflowModal
        isOpen={isWorkflowModalOpen}
        onClose={() => { setWorkflowModalOpen(false); setEditingWorkflow(null); }}
        onSave={handleSaveWorkflow}
        templates={templates}
        editingWorkflow={editingWorkflow}
        isLoading={workflowSaving}
      />

      {/* Template create/edit modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
              <h2 className="font-bold text-lg text-text-primary">
                {editingTemplate ? "Edit Template" : "New SQL Template"}
              </h2>
              <button onClick={() => setTemplateModalOpen(false)} className="text-text-muted hover:text-text-primary">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Name</label>
                <input type="text" value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={templateForm.description} onChange={(e) => setTemplateForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="input resize-none" />
              </div>
              <div>
                <label className="label">SQL Query</label>
                <SQLEditorPanel
                  initialQuery={templateForm.query_text}
                  onQueryChange={(q) => setTemplateForm((f) => ({ ...f, query_text: q }))}
                  onExecute={() => {}}
                  isLoading={false}
                />
              </div>
              <div>
                <label className="label">Tags <span className="font-normal text-text-muted">(comma-separated)</span></label>
                <input type="text" value={templateForm.tags} onChange={(e) => setTemplateForm((f) => ({ ...f, tags: e.target.value }))} placeholder="finance, weekly, partners" className="input" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={templateForm.is_public} onChange={(e) => setTemplateForm((f) => ({ ...f, is_public: e.target.checked }))} className="rounded" />
                <span className="text-sm text-text-secondary">Make public (visible to all users)</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setTemplateModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleSaveTemplate} disabled={templateSaving} className="btn-primary flex-1">
                  {templateSaving ? "Saving…" : editingTemplate ? "Update" : "Create Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
