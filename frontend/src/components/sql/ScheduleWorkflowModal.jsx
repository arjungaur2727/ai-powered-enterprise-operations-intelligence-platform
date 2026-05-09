/**
 * src/components/sql/ScheduleWorkflowModal.jsx
 *
 * Modal for creating or editing a scheduled SQL workflow.
 *
 * Props:
 *   isOpen          {boolean}
 *   onClose         {() => void}
 *   onSave          {(data) => void}
 *   templates       {SQLTemplateResponse[]}
 *   editingWorkflow {WorkflowResponse|null}
 *   isLoading       {boolean}
 */

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import CronExpressionBuilder from "./CronExpressionBuilder";

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

const DEFAULT_FORM = {
  name: "",
  description: "",
  template_id: "",
  cron_expression: "0 9 * * 1",
  timezone: "UTC",
  param_values: {},
};

export default function ScheduleWorkflowModal({
  isOpen,
  onClose,
  onSave,
  templates = [],
  editingWorkflow = null,
  isLoading = false,
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editingWorkflow) {
      setForm({
        name: editingWorkflow.name || "",
        description: editingWorkflow.description || "",
        template_id: editingWorkflow.template_id || "",
        cron_expression: editingWorkflow.cron_expression || "0 9 * * *",
        timezone: editingWorkflow.timezone || "UTC",
        param_values: editingWorkflow.param_values || {},
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setErrors({});
  }, [editingWorkflow, isOpen]);

  if (!isOpen) return null;

  const selectedTemplate = templates.find((t) => t.id === form.template_id) || null;
  const hasParams = selectedTemplate?.param_schema && Object.keys(selectedTemplate.param_schema).length > 0;

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required.";
    if (!form.template_id) e.template_id = "Select a template.";
    if (!form.cron_expression.trim()) e.cron_expression = "Cron expression is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave?.(form);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <h2 className="font-bold text-lg text-text-primary">
            {editingWorkflow ? "Edit Workflow" : "Schedule SQL Workflow"}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="label">Workflow Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Weekly Revenue Report"
              className={`input ${errors.name ? "border-red-400" : ""}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="label">Description <span className="text-text-muted font-normal">(optional)</span></label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              className="input resize-none"
            />
          </div>

          {/* Template selector */}
          <div>
            <label className="label">SQL Template</label>
            <select
              value={form.template_id}
              onChange={(e) => set("template_id", e.target.value)}
              className={`input ${errors.template_id ? "border-red-400" : ""}`}
            >
              <option value="">— Select a template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {errors.template_id && (
              <p className="text-xs text-red-500 mt-1">{errors.template_id}</p>
            )}
          </div>

          {/* Cron builder */}
          <div>
            <label className="label">Schedule</label>
            <CronExpressionBuilder
              value={form.cron_expression}
              onChange={(v) => set("cron_expression", v)}
            />
          </div>

          {/* Timezone */}
          <div>
            <label className="label">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="input"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* Template params */}
          {hasParams && (
            <div>
              <label className="label">Parameter Values</label>
              <div className="space-y-2 rounded-xl border border-surface-border bg-surface p-3">
                {Object.entries(selectedTemplate.param_schema).map(([name, meta]) => (
                  <div key={name} className="flex items-center gap-3">
                    <label className="text-xs font-mono text-text-secondary w-32 shrink-0">
                      :{name}
                      {meta.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={form.param_values[name] ?? ""}
                      onChange={(e) =>
                        set("param_values", { ...form.param_values, [name]: e.target.value })
                      }
                      placeholder={meta.default ?? `${meta.type || "string"} value`}
                      className="input text-sm flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary flex-1"
            >
              {isLoading ? "Saving…" : editingWorkflow ? "Update Workflow" : "Create Workflow"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
