/**
 * src/components/alerts/AlertDetailDrawer.jsx
 * Slide-in right drawer with full alert context.
 */
import React from "react";
import { X, AlertCircle, AlertTriangle, Info, Mail, MailX, ExternalLink, CheckCircle2 } from "lucide-react";

const SEV = {
  critical: { label: "CRITICAL", cls: "bg-red-50 text-red-700 border-red-200", Icon: AlertCircle },
  warning:  { label: "WARNING",  cls: "bg-orange-50 text-orange-700 border-orange-200", Icon: AlertTriangle },
  info:     { label: "INFO",     cls: "bg-blue-50 text-blue-700 border-blue-200", Icon: Info },
};

const TYPE_LABELS = {
  threshold_breach: "Threshold Breach", workflow_failure: "Workflow Failure",
  upload_error: "Upload Error", system_event: "System Event", manual: "Manual Alert",
};

function Row({ label, value }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-gray-400 w-36 shrink-0">{label}</span>
      <span className="text-gray-800 font-medium">{value || "—"}</span>
    </div>
  );
}

export default function AlertDetailDrawer({ isOpen, onClose, alert, onResolve, isManager }) {
  if (!isOpen || !alert) return null;
  const sev = SEV[alert.severity] || SEV.info;
  const SevIcon = sev.Icon;

  const sourceLinks = { workflow: "/sql", upload: "/upload", query: "/sql" };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex w-full max-w-md flex-col bg-white shadow-2xl overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${sev.cls}`}>
              <SevIcon className="h-4 w-4" />
              {sev.label}
            </span>
            <span className="text-xs text-gray-400">{TYPE_LABELS[alert.alert_type] || alert.alert_type}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Details */}
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-1">{alert.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{alert.message}</p>
          </div>

          <div className="space-y-1.5">
            <Row label="Triggered" value={alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : "—"} />
            <Row label="Time ago" value={alert.time_ago} />
            {alert.source_entity_type && (
              <div className="flex gap-3 text-sm">
                <span className="text-gray-400 w-36 shrink-0">Source</span>
                <span className="text-gray-800 font-medium flex items-center gap-1">
                  {alert.source_entity_type}
                  {sourceLinks[alert.source_entity_type] && (
                    <a href={sourceLinks[alert.source_entity_type]} className="text-blue-500 hover:text-blue-600">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Metric comparison */}
          {alert.metric_value !== null && alert.metric_value !== undefined && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Metric Comparison
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-200">
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">Measured Value</p>
                  <p className="text-2xl font-bold text-red-600">{alert.metric_value}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">Threshold</p>
                  <p className="text-2xl font-bold text-gray-400">{alert.threshold_value ?? "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Resolution */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Resolution Status
            </div>
            <div className="px-4 py-3">
              {alert.is_resolved ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Resolved
                  </div>
                  {alert.resolved_by_name && <Row label="Resolved by" value={alert.resolved_by_name} />}
                  {alert.resolved_at && <Row label="Resolved at" value={new Date(alert.resolved_at).toLocaleString()} />}
                  {alert.resolution_note && (
                    <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
                      {alert.resolution_note}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-2">This alert is still open.</p>
                  {isManager && (
                    <button
                      onClick={() => onResolve(alert)}
                      className="rounded-lg border border-blue-600 text-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-50 transition-colors"
                    >
                      Resolve This Alert
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notification info */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Email Notification
            </div>
            <div className="px-4 py-3 flex items-center gap-2">
              {alert.email_sent ? (
                <Mail className="h-4 w-4 text-emerald-500" />
              ) : (
                <MailX className="h-4 w-4 text-gray-300" />
              )}
              <span className="text-sm text-gray-700">
                {alert.email_sent
                  ? `Sent to ${(alert.notified_emails || []).join(", ") || "recipients"}`
                  : "No email sent"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3">
          <button onClick={onClose} className="w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
