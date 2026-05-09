/**
 * src/components/upload/DataPreviewTable.jsx
 *
 * Shows a 10-row data preview with column type badges and editable column mapping.
 *
 * Props:
 *   columns      {ColumnProfileSchema[]}
 *   previewRows  {object[]}
 *   columnMapping {Record<string,string>}
 *   onMappingChange(newMapping: Record<string,string>) — called on edit
 */

import React, { useState } from "react";
import { truncateText } from "../../utils/formatters";

const TYPE_BADGE = {
  integer: "bg-blue-100 text-blue-700",
  float:   "bg-purple-100 text-purple-700",
  string:  "bg-gray-100 text-gray-600",
  date:    "bg-emerald-100 text-emerald-700",
  boolean: "bg-orange-100 text-orange-700",
};

const COLUMN_NAME_RE = /^[a-z][a-z0-9_]{0,62}$/;

export default function DataPreviewTable({
  columns = [],
  previewRows = [],
  columnMapping = {},
  onMappingChange,
}) {
  const [editingMapping, setEditingMapping] = useState({ ...columnMapping });
  const [errors, setErrors] = useState({});

  const handleMappingEdit = (original, newVal) => {
    const updated = { ...editingMapping, [original]: newVal };
    setEditingMapping(updated);

    const err = {};
    if (!newVal || !COLUMN_NAME_RE.test(newVal)) {
      err[original] = "Invalid name";
    }
    setErrors((prev) => ({ ...prev, [original]: err[original] }));
    onMappingChange?.(updated);
  };

  const originalColumns = columns.map((c) => c.column_name);

  return (
    <div className="space-y-6">
      {/* Data preview */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">
          Data Preview{" "}
          <span className="font-normal text-text-muted">(first 10 rows)</span>
        </h3>
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="min-w-full text-sm">
            <thead className="bg-surface sticky top-0">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.column_name}
                    className="whitespace-nowrap px-4 py-2.5 text-left font-semibold text-text-primary border-b border-surface-border"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="truncate max-w-[160px]" title={col.column_name}>
                        {col.column_name}
                      </span>
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium w-fit ${
                          TYPE_BADGE[col.data_type] ?? TYPE_BADGE.string
                        }`}
                      >
                        {col.data_type}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-6 text-center text-text-muted"
                  >
                    No preview data available.
                  </td>
                </tr>
              ) : (
                previewRows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={ri % 2 === 0 ? "bg-white" : "bg-surface"}
                  >
                    {originalColumns.map((col) => (
                      <td
                        key={col}
                        className="whitespace-nowrap px-4 py-2 text-text-secondary border-b border-surface-border/50"
                        title={String(row[col] ?? "")}
                      >
                        {truncateText(String(row[col] ?? "—"), 30)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column mapping editor */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Column Mapping{" "}
          <span className="font-normal text-text-muted">
            — edit destination column names as needed
          </span>
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((col) => {
            const original = col.column_name;
            const mapped = editingMapping[original] ?? columnMapping[original] ?? "";
            const isChanged = mapped !== columnMapping[original];
            const hasError = !!errors[original];

            return (
              <div key={original} className="flex items-center gap-2">
                {/* Original */}
                <span
                  className="min-w-0 truncate text-xs text-text-secondary bg-surface border border-surface-border rounded-lg px-2 py-1.5 flex-1"
                  title={original}
                >
                  {original}
                </span>
                <span className="text-text-muted text-xs shrink-0">→</span>
                {/* Editable mapped name */}
                <input
                  type="text"
                  value={mapped}
                  onChange={(e) => handleMappingEdit(original, e.target.value)}
                  className={`flex-1 min-w-0 text-xs px-2 py-1.5 rounded-lg border outline-none transition-colors ${
                    hasError
                      ? "border-red-400 bg-red-50 focus:ring-1 focus:ring-red-400"
                      : isChanged
                      ? "border-amber-400 bg-amber-50 focus:ring-1 focus:ring-amber-400"
                      : "border-surface-border bg-white focus:ring-1 focus:ring-primary"
                  }`}
                  title={hasError ? errors[original] : ""}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-text-muted">
          <span className="inline-block h-2 w-2 rounded-sm bg-amber-300 mr-1" />
          Yellow = modified from default
        </p>
      </div>
    </div>
  );
}
