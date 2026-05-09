/**
 * src/components/sql/WorkflowListTable.jsx
 *
 * Table of scheduled SQL workflows with status, toggle, and actions.
 *
 * Props:
 *   workflows  {WorkflowResponse[]}
 *   isLoading  {boolean}
 *   onToggle   {(id) => void}
 *   onEdit     {(workflow) => void}
 *   onDelete   {(id) => void}
 *   onRunNow   {(id) => void}
 */

import React from "react";
import { Calendar, Edit2, Play, Trash2 } from "lucide-react";
import { formatDateTime } from "../../utils/formatters";

const STATUS_BADGE = {
  success: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

function Toggle({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        active ? "bg-primary" : "bg-gray-300"
      }`}
      title={active ? "Disable workflow" : "Enable workflow"}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
          active ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export default function WorkflowListTable({
  workflows = [],
  isLoading,
  onToggle,
  onEdit,
  onDelete,
  onRunNow,
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="min-w-full text-sm">
        <thead className="bg-surface">
          <tr>
            {["Name", "Template", "Schedule", "Next Run", "Last Run", "Status", "Actions"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-surface-border"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : workflows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-3 text-text-muted">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-border">
                    <Calendar className="h-5 w-5 opacity-40" />
                  </div>
                  <div>
                    <p className="font-medium text-text-secondary text-sm">No scheduled workflows</p>
                    <p className="text-xs mt-0.5">Create one to automate your SQL queries.</p>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            workflows.map((wf, idx) => (
              <tr
                key={wf.id}
                className={idx % 2 === 0 ? "bg-white" : "bg-surface/50"}
              >
                {/* Name */}
                <td className="px-4 py-3 border-b border-surface-border/50">
                  <div className="flex items-center gap-2">
                    <Toggle active={wf.is_active} onToggle={() => onToggle?.(wf.id)} />
                    <div>
                      <p className="font-medium text-text-primary">{wf.name}</p>
                      {wf.failure_count > 0 && (
                        <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">
                          {wf.failure_count} failure{wf.failure_count > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                {/* Template */}
                <td className="px-4 py-3 border-b border-surface-border/50 text-text-secondary text-xs">
                  {wf.template_name || "—"}
                </td>
                {/* Schedule */}
                <td className="px-4 py-3 border-b border-surface-border/50">
                  <p className="text-xs text-text-secondary">{wf.cron_human_readable}</p>
                  <p className="text-[10px] text-text-muted font-mono mt-0.5">{wf.cron_expression}</p>
                </td>
                {/* Next run */}
                <td className="px-4 py-3 border-b border-surface-border/50 text-xs text-text-muted">
                  {wf.next_run_at ? formatDateTime(wf.next_run_at) : "—"}
                </td>
                {/* Last run */}
                <td className="px-4 py-3 border-b border-surface-border/50 text-xs text-text-muted">
                  {wf.last_run_at ? formatDateTime(wf.last_run_at) : "Never"}
                </td>
                {/* Status */}
                <td className="px-4 py-3 border-b border-surface-border/50">
                  {wf.last_run_status ? (
                    <span className={`badge ${STATUS_BADGE[wf.last_run_status] ?? "bg-gray-100 text-gray-500"}`}>
                      {wf.last_run_status}
                    </span>
                  ) : (
                    <span className="badge bg-gray-100 text-gray-500">Never run</span>
                  )}
                </td>
                {/* Actions */}
                <td className="px-4 py-3 border-b border-surface-border/50">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onRunNow?.(wf.id)}
                      title="Run now"
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                    >
                      <Play className="h-3.5 w-3.5 fill-primary" />
                    </button>
                    <button
                      onClick={() => onEdit?.(wf)}
                      title="Edit"
                      className="p-1.5 rounded-lg hover:bg-surface-border text-text-muted transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete?.(wf.id)}
                      title="Delete"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
