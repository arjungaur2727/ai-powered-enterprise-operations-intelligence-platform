/**
 * src/components/ai/ResultMiniTable.jsx
 *
 * Compact inline result table rendered inside AI chat messages.
 */

import React from "react";
import { CheckCircle2, Download, Hash } from "lucide-react";
import toast from "react-hot-toast";

const TYPE_ICON = { integer: "#", float: "~", string: "A", date: "📅", boolean: "◉" };

function truncate(val, len = 40) {
  const s = String(val ?? "");
  return s.length > len ? s.slice(0, len) + "…" : s;
}

function formatMs(ms) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function ResultMiniTable({ columns = [], rows = [], rowCount = 0, executionMs, onExport }) {
  if (!columns.length && !rows.length) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
        <p className="text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Query returned 0 rows.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-700 overflow-hidden">
      {/* Status bar */}
      <div className="bg-emerald-900/30 border-b border-gray-700 px-4 py-2 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Query Successful
        </div>
        <span className="text-xs text-gray-400">{formatMs(executionMs)}</span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Hash className="h-3 w-3" />
          {rowCount?.toLocaleString()} total row{rowCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Partial-result notice */}
      {rowCount > rows.length && (
        <div className="bg-blue-950/30 border-b border-gray-700 px-4 py-1.5">
          <p className="text-[10px] text-blue-300">
            Showing first {rows.length} of {rowCount.toLocaleString()} rows
          </p>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto max-h-72 overflow-y-auto bg-gray-900">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-800 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 w-8 font-normal">#</th>
              {columns.map((col) => (
                <th key={col.name} className="px-3 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">
                  <span className="text-gray-600 mr-1 font-mono">{TYPE_ICON[col.type] || "?"}</span>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={`border-t border-gray-800 hover:bg-blue-950/20 transition-colors ${ri % 2 === 0 ? "" : "bg-gray-800/30"}`}>
                <td className="px-3 py-1.5 text-gray-600">{ri + 1}</td>
                {columns.map((col) => (
                  <td
                    key={col.name}
                    className="px-3 py-1.5 text-gray-300 cursor-pointer"
                    title={String(row[col.name] ?? "")}
                    onClick={() => {
                      const val = String(row[col.name] ?? "");
                      navigator.clipboard?.writeText(val).then(() =>
                        toast.success(`Copied: ${val.slice(0, 30)}`, { duration: 1500 })
                      );
                    }}
                  >
                    {truncate(row[col.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-500">
          {rows.length} of {rowCount?.toLocaleString()} rows displayed
        </span>
        <button
          onClick={onExport}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>
    </div>
  );
}
