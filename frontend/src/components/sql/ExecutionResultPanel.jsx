/**
 * src/components/sql/ExecutionResultPanel.jsx
 *
 * Displays SQL execution results: status bar, data table, and CSV export.
 *
 * Props:
 *   result     {SQLExecuteResponse|null}
 *   isLoading  {boolean}
 *   onExport   {(historyId) => void}
 */

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Hash,
} from "lucide-react";
import { truncateText, formatDuration } from "../../utils/formatters";
import toast from "react-hot-toast";

const TYPE_ICON = {
  integer: "#",
  float: "~",
  string: "A",
  date: "📅",
  boolean: "◉",
};

function SkeletonTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border animate-pulse">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-surface">
            {[...Array(5)].map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-3 bg-gray-300 rounded w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, ri) => (
            <tr key={ri}>
              {[...Array(5)].map((_, ci) => (
                <td key={ci} className="px-4 py-2.5">
                  <div className="h-2.5 bg-gray-200 rounded w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ExecutionResultPanel({ result, isLoading, onExport }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-gray-200 animate-pulse rounded-xl" />
        <SkeletonTable />
      </div>
    );
  }

  if (!result) return null;

  const isSuccess = result.status === "success";

  return (
    <div className="space-y-3">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-border bg-white px-4 py-3">
        {isSuccess ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        )}

        <span
          className={`badge ${
            isSuccess ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}
        >
          {isSuccess ? "Success" : "Failed"}
        </span>

        {isSuccess && (
          <>
            <span className="badge bg-blue-100 text-blue-700 flex items-center gap-1">
              <Hash className="h-3 w-3" />
              {result.row_count?.toLocaleString()} rows
            </span>
            <span className="badge bg-purple-100 text-purple-700 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(result.execution_ms)}
            </span>
          </>
        )}

        <span className="ml-auto text-xs text-text-muted">
          {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Error panel */}
      {!isSuccess && result.error_message && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-sm text-red-700 mb-1">Query Error</p>
          <p className="font-mono text-xs text-red-600 whitespace-pre-wrap">
            {result.error_message}
          </p>
          <p className="mt-2 text-xs text-red-500">
            Check your query syntax or parameter values.
          </p>
        </div>
      )}

      {/* Data table */}
      {isSuccess && result.rows?.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="min-w-full text-sm">
              <thead className="bg-surface sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs text-text-muted border-b border-surface-border w-10">
                    #
                  </th>
                  {result.columns.map((col) => (
                    <th
                      key={col.name}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-text-primary border-b border-surface-border whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-muted font-mono text-[10px]">
                          {TYPE_ICON[col.type] ?? "?"}
                        </span>
                        {col.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={ri % 2 === 0 ? "bg-white" : "bg-surface/50"}
                  >
                    <td className="px-3 py-2 text-xs text-text-muted border-b border-surface-border/50">
                      {ri + 1}
                    </td>
                    {result.columns.map((col) => (
                      <td
                        key={col.name}
                        className="px-4 py-2 text-xs text-text-secondary border-b border-surface-border/50 cursor-pointer hover:bg-primary/5"
                        title={String(row[col.name] ?? "")}
                        onClick={() => {
                          const val = String(row[col.name] ?? "");
                          navigator.clipboard?.writeText(val).then(() => {
                            toast.success(`Copied: ${val.slice(0, 30)}`, { duration: 1500 });
                          });
                        }}
                      >
                        {truncateText(String(row[col.name] ?? "—"), 50)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">
              Showing {result.rows.length.toLocaleString()} of{" "}
              {result.row_count.toLocaleString()} rows
              {result.row_count > 100 && " — first 100 shown"}
            </p>
            <button
              onClick={() => onExport?.(result.history_id)}
              className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </>
      )}

      {isSuccess && result.rows?.length === 0 && (
        <div className="rounded-xl border border-surface-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">Query returned 0 rows.</p>
        </div>
      )}
    </div>
  );
}
