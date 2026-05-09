/**
 * src/components/alerts/AlertsHeader.jsx
 * Page header with stats bar, filter controls, and action buttons.
 */
import React from "react";
import { Bell, CheckSquare, PenSquare, Settings } from "lucide-react";

const SEVERITY_FILTERS = [
  { label: "All",      value: "" },
  { label: "Critical", value: "critical" },
  { label: "Warning",  value: "warning" },
  { label: "Info",     value: "info" },
];

const STATUS_FILTERS = [
  { label: "All",      isResolved: undefined, isRead: undefined },
  { label: "Unread",   isResolved: false,     isRead: false },
  { label: "Open",     isResolved: false,     isRead: undefined },
  { label: "Resolved", isResolved: true,      isRead: undefined },
];

const TYPE_FILTERS = [
  { label: "All Types",         value: "" },
  { label: "Threshold",         value: "threshold_breach" },
  { label: "Workflow",          value: "workflow_failure" },
  { label: "Upload",            value: "upload_error" },
  { label: "Manual",            value: "manual" },
];

export default function AlertsHeader({
  summary, onMarkAllRead, onCreateManual, isManager, isAdmin,
  filters, onFilterChange,
}) {
  const total = summary?.total ?? 0;
  const unread = summary?.unread_count ?? 0;
  const critical = summary?.critical_count ?? 0;
  const warning = summary?.warning_count ?? 0;

  const activeStatus = STATUS_FILTERS.find((s) =>
    s.isResolved === filters.isResolved && s.isRead === filters.isRead
  ) || STATUS_FILTERS[0];

  const setStatus = (s) => {
    onFilterChange("isResolved", s.isResolved);
    onFilterChange("isRead", s.isRead);
  };

  return (
    <div className="space-y-4">
      {/* Title + actions */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-500" />
            Alerts & Notifications
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Monitor platform health and threshold breaches</p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={onMarkAllRead}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <CheckSquare className="h-4 w-4" /> Mark All Read
            </button>
          )}
          {isManager && (
            <button onClick={onCreateManual}
              className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors">
              <PenSquare className="h-4 w-4" /> Create Alert
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{total} total</span>
        {unread > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">{unread} unread</span>}
        {critical > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">{critical} critical</span>}
        {warning > 0 && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">{warning} warnings</span>}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-3">
        {/* Severity */}
        <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5">
          {SEVERITY_FILTERS.map((f) => (
            <button key={f.value} onClick={() => onFilterChange("severity", f.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filters.severity === f.value ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button key={f.label} onClick={() => setStatus(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeStatus.label === f.label ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Type */}
        <select value={filters.alertType || ""} onChange={(e) => onFilterChange("alertType", e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {TYPE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
    </div>
  );
}
