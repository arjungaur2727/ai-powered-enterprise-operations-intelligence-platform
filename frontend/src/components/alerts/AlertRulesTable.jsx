/**
 * src/components/alerts/AlertRulesTable.jsx
 * Manage configurable threshold alert rules (admin only).
 */
import React from "react";
import { Edit2, Trash2, Plus, ToggleLeft, ToggleRight } from "lucide-react";

const METRIC_LABELS = {
  query_failure_rate: "Query Failure Rate",
  avg_execution_ms: "Avg Execution Time",
  upload_failure_rate: "Upload Failure Rate",
  workflow_failure_count: "Workflow Failure Count",
  no_activity_hours: "Hours Without Activity",
  ai_token_daily_limit: "Daily AI Token Usage",
};

const SEV_BADGE = {
  critical: "bg-red-50 text-red-700",
  warning: "bg-orange-50 text-orange-700",
  info: "bg-blue-50 text-blue-700",
};

export default function AlertRulesTable({ rules, isLoading, onEdit, onToggle, onDelete, onCreateNew, isAdmin }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Alert Rules</h3>
          <p className="text-xs text-gray-500 mt-0.5">Automated threshold monitoring rules</p>
        </div>
        {isAdmin && (
          <button onClick={onCreateNew}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4" /> New Rule
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No alert rules configured.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Rule Name", "Metric", "Condition", "Severity", "Window", "Cooldown", "Active", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.description && <p className="text-xs text-gray-400 mt-0.5 max-w-[160px] truncate">{r.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{METRIC_LABELS[r.metric] || r.metric}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">
                    {r.operator_label} <strong>{r.threshold_display}</strong>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEV_BADGE[r.severity] || SEV_BADGE.info}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.window_minutes} min</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.cooldown_minutes} min</td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <button onClick={() => onToggle(r.id)} className={`${r.is_active ? "text-blue-600" : "text-gray-400"} hover:opacity-80 transition-opacity`}>
                        {r.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                      </button>
                    ) : (
                      <span className={`text-xs font-medium ${r.is_active ? "text-emerald-600" : "text-gray-400"}`}>
                        {r.is_active ? "Active" : "Disabled"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => onEdit(r)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => onDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
