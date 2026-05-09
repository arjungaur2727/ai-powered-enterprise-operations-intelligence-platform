/**
 * src/components/alerts/NotificationLogTable.jsx
 * Email delivery audit log for admin view.
 */
import React, { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

function StatusBadge({ status }) {
  const map = {
    sent:    { cls: "bg-emerald-50 text-emerald-700", Icon: CheckCircle2, label: "Sent" },
    failed:  { cls: "bg-red-50 text-red-700",         Icon: XCircle,      label: "Failed" },
    pending: { cls: "bg-yellow-50 text-yellow-700",   Icon: Clock,        label: "Pending" },
    bounced: { cls: "bg-orange-50 text-orange-700",   Icon: AlertTriangle, label: "Bounced" },
  };
  const cfg = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <cfg.Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

export default function NotificationLogTable({ logs, isLoading, onRefresh }) {
  const [statusFilter, setStatusFilter] = useState("");
  const filtered = statusFilter ? logs.filter((l) => l.delivery_status === statusFilter) : logs;
  const hasSent = logs.some((l) => l.delivery_status === "sent");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Email Notification Log</h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5">
            {["", "sent", "failed", "pending"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${statusFilter === s ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={onRefresh} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* SMTP warning if no emails sent */}
      {!hasSent && !isLoading && logs.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Email notifications may not be configured. Use the <strong>Test Email</strong> section below to verify SMTP settings.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No notification logs found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Alert", "Recipient", "Subject", "Status", "Sent At", "Error"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate text-xs">{log.alert_title || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{log.recipient_email}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate">{log.subject || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={log.delivery_status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {log.sent_at ? new Date(log.sent_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {log.error_message && (
                      <span title={log.error_message} className="text-xs text-red-500 cursor-help max-w-[120px] truncate block">
                        {log.error_message.slice(0, 40)}{log.error_message.length > 40 ? "…" : ""}
                      </span>
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
