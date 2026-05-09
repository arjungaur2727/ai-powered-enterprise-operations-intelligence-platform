/**
 * src/components/upload/UploadHistoryTable.jsx
 *
 * Table of past upload jobs with status badges and clickable rows.
 *
 * Props:
 *   uploads     {UploadHistoryItem[]}
 *   isLoading   {boolean}
 *   onViewDetail(uploadId: string) — called when a row is clicked
 */

import React from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { formatDateTime, formatRowCount } from "../../utils/formatters";

const STATUS_BADGE = {
  success:    "bg-emerald-100 text-emerald-700",
  failed:     "bg-red-100 text-red-700",
  processing: "bg-blue-100 text-blue-700",
  pending:    "bg-amber-100 text-amber-700",
  partial:    "bg-orange-100 text-orange-700",
  deleted:    "bg-gray-100 text-gray-500",
};

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

export default function UploadHistoryTable({ uploads = [], isLoading, onViewDetail }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-6 py-4 border-b border-surface-border">
        <h3 className="font-semibold text-text-primary">Upload History</h3>
        <p className="text-sm text-text-muted mt-0.5">All previous file ingestion jobs</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface">
            <tr>
              {["File Name", "Type", "Target Table", "Rows", "Status", "Uploaded By", "Date"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-surface-border"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : uploads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-text-muted">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-border">
                      <Upload className="h-6 w-6 opacity-40" />
                    </div>
                    <div>
                      <p className="font-medium text-text-secondary">No uploads yet</p>
                      <p className="text-xs mt-0.5">Upload your first file above to get started.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              uploads.map((u, idx) => (
                <tr
                  key={u.id}
                  onClick={() => onViewDetail?.(u.id)}
                  className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                    idx % 2 === 0 ? "bg-white" : "bg-surface/50"
                  }`}
                >
                  {/* File name */}
                  <td className="px-4 py-3 border-b border-surface-border/50">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-text-muted shrink-0" />
                      <span className="font-medium text-text-primary truncate max-w-[160px]">
                        {u.file_name}
                      </span>
                    </div>
                  </td>
                  {/* Type */}
                  <td className="px-4 py-3 border-b border-surface-border/50">
                    <span className="badge bg-gray-100 text-gray-600 uppercase">
                      {u.file_type}
                    </span>
                  </td>
                  {/* Target table */}
                  <td className="px-4 py-3 border-b border-surface-border/50 font-mono text-xs text-text-secondary">
                    {u.target_table}
                  </td>
                  {/* Rows */}
                  <td className="px-4 py-3 border-b border-surface-border/50 text-text-secondary">
                    {u.row_count?.toLocaleString()}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3 border-b border-surface-border/50">
                    <span
                      className={`badge ${STATUS_BADGE[u.status] ?? "bg-gray-100 text-gray-500"} flex items-center gap-1 w-fit`}
                    >
                      {u.status === "processing" && (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      )}
                      {u.status}
                    </span>
                  </td>
                  {/* Uploaded by */}
                  <td className="px-4 py-3 border-b border-surface-border/50 text-text-secondary">
                    {u.uploaded_by_name ?? "—"}
                  </td>
                  {/* Date */}
                  <td className="px-4 py-3 border-b border-surface-border/50 text-text-muted text-xs">
                    {formatDateTime(u.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
