/**
 * src/components/alerts/AlertCard.jsx
 * Single alert card with severity accent, actions, metric display.
 */
import React, { useState } from "react";
import { AlertCircle, AlertTriangle, Info, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

const SEVERITY_CONFIG = {
  critical: { bar: "bg-red-500",    badge: "bg-red-50 text-red-700",    Icon: AlertCircle,   iconClass: "text-red-500"    },
  warning:  { bar: "bg-orange-400", badge: "bg-orange-50 text-orange-700", Icon: AlertTriangle, iconClass: "text-orange-500" },
  info:     { bar: "bg-blue-400",   badge: "bg-blue-50 text-blue-700",   Icon: Info,          iconClass: "text-blue-500"   },
};

const TYPE_LABELS = {
  threshold_breach: "Threshold Breach",
  workflow_failure: "Workflow Failure",
  upload_error: "Upload Error",
  system_event: "System Event",
  manual: "Manual Alert",
};

export default function AlertCard({ alert, onRead, onResolve, onViewDetail, isManager }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const Icon = cfg.Icon;
  const isLong = alert.message.length > 120;

  const handleCardClick = (e) => {
    if (e.target.closest("button")) return;
    onViewDetail(alert);
  };

  return (
    <div
      onClick={handleCardClick}
      className="relative flex cursor-pointer rounded-lg border border-gray-200 bg-white overflow-hidden transition-all duration-150 hover:bg-gray-50 hover:shadow-sm"
    >
      {/* Left accent bar */}
      <div className={`w-1 shrink-0 ${cfg.bar}`} />

      {/* Unread dot */}
      {!alert.is_read && (
        <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-500" />
      )}

      <div className="flex-1 p-4 min-w-0">
        {/* Header */}
        <div className="flex items-start gap-2 mb-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
            <Icon className={`h-3 w-3 ${cfg.iconClass}`} />
            {alert.severity.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400 mt-0.5">{TYPE_LABELS[alert.alert_type] || alert.alert_type}</span>
          <span className="ml-auto text-xs text-gray-400 shrink-0 pr-4">{alert.time_ago}</span>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-gray-900 text-sm truncate">{alert.title}</h4>

        {/* Message */}
        <div className="mt-1">
          <p className={`text-sm text-gray-600 ${!expanded && isLong ? "line-clamp-2" : ""}`}>
            {alert.message}
          </p>
          {isLong && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="mt-0.5 flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Show more</>}
            </button>
          )}
        </div>

        {/* Metric row */}
        {alert.metric_value !== null && alert.metric_value !== undefined && (
          <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
            <span>Measured: <strong>{alert.metric_value}</strong></span>
            {alert.threshold_value !== null && <span>| Threshold: <strong>{alert.threshold_value}</strong></span>}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {alert.source_entity_type && (
            <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
              From: {alert.source_entity_type}
            </span>
          )}
          {alert.is_resolved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Resolved {alert.resolved_by_name ? `by ${alert.resolved_by_name}` : ""}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {!alert.is_read && (
              <button
                onClick={(e) => { e.stopPropagation(); onRead(alert.id); }}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5 hover:bg-gray-100 transition-colors"
              >
                Mark read
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onViewDetail(alert); }}
              className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50 transition-colors"
            >
              Details
            </button>
            {!alert.is_resolved && isManager && (
              <button
                onClick={(e) => { e.stopPropagation(); onResolve(alert); }}
                className="text-xs text-white bg-blue-600 hover:bg-blue-700 rounded px-2 py-0.5 transition-colors"
              >
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
