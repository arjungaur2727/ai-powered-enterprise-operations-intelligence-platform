/**
 * src/components/alerts/CreateRuleModal.jsx
 * Visual alert rule builder with live condition preview.
 */
import React, { useEffect, useState } from "react";
import { X, Loader2, AlertCircle, AlertTriangle, Info } from "lucide-react";

const METRICS = [
  { value: "query_failure_rate",     label: "Query Failure Rate (%)",    unit: "%",      desc: "% of failed queries in window" },
  { value: "avg_execution_ms",       label: "Avg Execution Time (ms)",   unit: "ms",     desc: "Slow query detection" },
  { value: "upload_failure_rate",    label: "Upload Failure Rate (%)",   unit: "%",      desc: "File import failure monitoring" },
  { value: "workflow_failure_count", label: "Workflow Failure Count",    unit: "",       desc: "Number of broken workflows" },
  { value: "no_activity_hours",      label: "Hours Without Activity",    unit: "hrs",    desc: "Platform idle detection" },
  { value: "ai_token_daily_limit",   label: "Daily AI Token Usage",      unit: "tokens", desc: "Token budget monitoring" },
];

const OPERATORS = [
  { value: "gt",  label: "is greater than" },
  { value: "lt",  label: "is less than" },
  { value: "gte", label: "is ≥" },
  { value: "lte", label: "is ≤" },
  { value: "eq",  label: "equals" },
];

const WINDOWS = [
  { value: 5, label: "5 min" }, { value: 15, label: "15 min" }, { value: 30, label: "30 min" },
  { value: 60, label: "1 hr" }, { value: 360, label: "6 hrs" }, { value: 1440, label: "24 hrs" },
];

const COOLDOWNS = [
  { value: 15, label: "15 min" }, { value: 30, label: "30 min" }, { value: 60, label: "1 hr" },
  { value: 180, label: "3 hrs" }, { value: 360, label: "6 hrs" }, { value: 1440, label: "24 hrs" },
];

const SEV_OPTIONS = [
  { value: "info", label: "Info", Icon: Info, desc: "Informational, no immediate action", cls: "border-blue-400 bg-blue-50 text-blue-700" },
  { value: "warning", label: "Warning", Icon: AlertTriangle, desc: "Needs attention soon", cls: "border-orange-400 bg-orange-50 text-orange-700" },
  { value: "critical", label: "Critical", Icon: AlertCircle, desc: "Requires immediate action", cls: "border-red-500 bg-red-50 text-red-700" },
];

const DEFAULT_STATE = {
  name: "", description: "", metric: "query_failure_rate", operator: "gt",
  threshold_value: 20, window_minutes: 60, severity: "warning",
  cooldown_minutes: 60, notify_roles: ["admin", "manager"],
};

export default function CreateRuleModal({ isOpen, onClose, onSave, editingRule, isSaving }) {
  const [form, setForm] = useState(DEFAULT_STATE);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!isOpen) return;
    if (editingRule) {
      setForm({
        name: editingRule.name, description: editingRule.description || "",
        metric: editingRule.metric, operator: editingRule.operator,
        threshold_value: editingRule.threshold_value, window_minutes: editingRule.window_minutes,
        severity: editingRule.severity, cooldown_minutes: editingRule.cooldown_minutes,
        notify_roles: editingRule.notify_roles || ["admin", "manager"],
      });
    } else { setForm(DEFAULT_STATE); }
  }, [isOpen, editingRule]);

  if (!isOpen) return null;

  const selectedMetric = METRICS.find((m) => m.value === form.metric) || METRICS[0];
  const selectedOp = OPERATORS.find((o) => o.value === form.operator) || OPERATORS[0];
  const wLabel = WINDOWS.find((w) => w.value === form.window_minutes)?.label || `${form.window_minutes} min`;
  const cLabel = COOLDOWNS.find((c) => c.value === form.cooldown_minutes)?.label || `${form.cooldown_minutes} min`;

  const toggleRole = (role) => {
    set("notify_roles", form.notify_roles.includes(role)
      ? form.notify_roles.filter((r) => r !== role)
      : [...form.notify_roles, role]);
  };

  const handleSave = () => {
    onSave({
      name: form.name, description: form.description || undefined,
      metric: form.metric, operator: form.operator,
      threshold_value: parseFloat(form.threshold_value) || 0,
      window_minutes: form.window_minutes, severity: form.severity,
      cooldown_minutes: form.cooldown_minutes, notify_roles: form.notify_roles,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{editingRule ? "Edit Alert Rule" : "Create Alert Rule"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name + Description */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Rule Name</label>
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. High Query Failure Rate"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Metric */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Metric</label>
            <select value={form.metric} onChange={(e) => set("metric", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>)}
            </select>
          </div>

          {/* Condition row */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Condition</label>
            <div className="flex gap-2">
              <select value={form.operator} onChange={(e) => set("operator", e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="relative flex items-center">
                <input type="number" value={form.threshold_value} onChange={(e) => set("threshold_value", e.target.value)}
                  className="w-28 rounded-lg border border-gray-200 pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="absolute right-2.5 text-xs text-gray-400">{selectedMetric.unit}</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-1.5 bg-blue-50 rounded-lg px-3 py-1.5">
              Alert when <strong>{selectedMetric.label}</strong> {selectedOp.label} <strong>{form.threshold_value}{selectedMetric.unit}</strong>
            </p>
          </div>

          {/* Severity */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Severity</label>
            <div className="grid grid-cols-3 gap-2">
              {SEV_OPTIONS.map(({ value, label, Icon, desc, cls }) => (
                <label key={value} className={`flex flex-col gap-1 rounded-xl border-2 cursor-pointer p-3 transition-colors
                  ${form.severity === value ? cls + " border-opacity-100" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" className="sr-only" checked={form.severity === value} onChange={() => set("severity", value)} />
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                  <p className="text-[10px] leading-tight opacity-70">{desc}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Window + Cooldown */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Evaluation Window</label>
              <select value={form.window_minutes} onChange={(e) => set("window_minutes", parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {WINDOWS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Cooldown Period</label>
              <select value={form.cooldown_minutes} onChange={(e) => set("cooldown_minutes", parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {COOLDOWNS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Min time before this rule fires again</p>
            </div>
          </div>

          {/* Notify roles */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Notify Roles</label>
            <div className="flex gap-3">
              {["admin", "manager", "analyst"].map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-blue-600"
                    checked={form.notify_roles.includes(role)} onChange={() => toggleRole(role)} />
                  <span className="text-sm capitalize text-gray-700">{role}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <span className="font-medium">Preview: </span>
            This rule will fire a <strong>{form.severity}</strong> alert when{" "}
            <strong>{selectedMetric.label}</strong> {selectedOp.label}{" "}
            <strong>{form.threshold_value}{selectedMetric.unit}</strong> over the last{" "}
            <strong>{wLabel}</strong>. It won't repeat within <strong>{cLabel}</strong>.
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={isSaving || !form.name || !form.threshold_value}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editingRule ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
