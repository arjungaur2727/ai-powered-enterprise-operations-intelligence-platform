/**
 * src/components/upload/ValidationErrorPanel.jsx
 *
 * Displays blocking errors (red) and warnings (yellow) from file validation.
 * Props:
 *   errors {Array}  — ValidationErrorSchema[]
 */

import React from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export default function ValidationErrorPanel({ errors = [] }) {
  if (!errors || errors.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        <p className="text-sm font-medium text-emerald-700">
          No validation issues found. Ready to import.
        </p>
      </div>
    );
  }

  const blocking = errors.filter((e) => e.is_blocking);
  const warnings = errors.filter((e) => !e.is_blocking);

  return (
    <div className="space-y-3">
      {blocking.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="font-semibold text-sm text-red-700">
              {blocking.length} Blocking Error{blocking.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="space-y-1.5 pl-7">
            {blocking.map((e, i) => (
              <li key={i} className="text-sm text-red-600 list-disc">
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <span className="font-semibold text-sm text-amber-700">
              {warnings.length} Warning{warnings.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="space-y-1.5 pl-7">
            {warnings.map((e, i) => (
              <li key={i} className="text-sm text-amber-700 list-disc">
                {e.column && (
                  <span className="font-medium">[{e.column}] </span>
                )}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-text-muted">
        {blocking.length} blocking error{blocking.length !== 1 ? "s" : ""},{" "}
        {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
        {blocking.length > 0 && " — Fix blocking errors before importing."}
      </p>
    </div>
  );
}
