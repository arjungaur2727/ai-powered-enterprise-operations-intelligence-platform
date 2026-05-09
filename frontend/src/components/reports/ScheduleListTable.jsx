/**
 * src/components/reports/ScheduleListTable.jsx
 * Table of all active report schedules with edit/toggle/delete actions.
 */
import React from "react";
import { Edit2, Trash2, Play, ToggleLeft, ToggleRight, Mail, HardDrive } from "lucide-react";
import { formatRelativeTime } from "../../utils/formatters";

function DeliveryIcon({ method }) {
  if (method === "both") return (
    <span className="flex items-center gap-1 text-xs text-gray-500"><Mail className="h-3.5 w-3.5" />Email + Store</span>
  );
  return <span className="flex items-center gap-1 text-xs text-gray-500"><HardDrive className="h-3.5 w-3.5" />Store Only</span>;
}

export default function ScheduleListTable({ schedules, isLoading, onEdit, onToggle, onDelete, onRunNow }) {
  if (isLoading) return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />)}
    </div>
  );

  if (!schedules || schedules.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-sm">No scheduled reports. Create one to automate report delivery.</p>
    </div>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
          <tr>
            {["Name", "Template", "Schedule", "Format", "Delivery", "Next Run", "Last Status", "Active", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {schedules.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">{s.template_name || "—"}</td>
              <td className="px-4 py-3 text-gray-600 text-xs">{s.cron_human_readable || s.cron_expression}</td>
              <td className="px-4 py-3">
                <span className={`rounded text-xs font-medium px-1.5 py-0.5 ${s.output_format === "pdf" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                  {s.output_format?.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-3"><DeliveryIcon method={s.delivery_method} /></td>
              <td className="px-4 py-3 text-gray-400 text-xs">{s.next_run_at ? formatRelativeTime(s.next_run_at) : "—"}</td>
              <td className="px-4 py-3">
                {s.last_run_status ? (
                  <span className={`rounded-full text-xs font-medium px-2 py-0.5 ${s.last_run_status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    {s.last_run_status}
                  </span>
                ) : <span className="text-gray-400 text-xs">Never run</span>}
              </td>
              <td className="px-4 py-3">
                <button onClick={() => onToggle(s.id)} className={`transition-colors ${s.is_active ? "text-blue-600 hover:text-blue-700" : "text-gray-400 hover:text-gray-600"}`}>
                  {s.is_active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onRunNow(s)} title="Run now" className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onEdit(s)} title="Edit" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => onDelete(s.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
