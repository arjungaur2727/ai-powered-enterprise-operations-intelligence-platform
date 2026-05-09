/**
 * src/components/reports/ReportTypeCard.jsx
 * Report template card with type-specific colors, format badges, and action buttons.
 */
import React from "react";
import { BarChart2, Terminal, Upload, GitBranch, Sparkles, Code2, Loader2, Clock } from "lucide-react";

const TYPE_CONFIG = {
  executive_summary: { label: "Executive Summary", color: "bg-blue-600",   textColor: "text-blue-600",   border: "border-blue-200", icon: BarChart2 },
  query_analytics:   { label: "Query Analytics",   color: "bg-purple-600", textColor: "text-purple-600", border: "border-purple-200", icon: Terminal },
  upload_report:     { label: "Upload Report",     color: "bg-emerald-600",textColor: "text-emerald-600",border: "border-emerald-200", icon: Upload },
  workflow_report:   { label: "Workflow Report",   color: "bg-orange-600", textColor: "text-orange-600", border: "border-orange-200", icon: GitBranch },
  ai_usage:          { label: "AI Usage",          color: "bg-pink-600",   textColor: "text-pink-600",   border: "border-pink-200", icon: Sparkles },
  custom_sql:        { label: "Custom SQL",        color: "bg-gray-700",   textColor: "text-gray-700",   border: "border-gray-200", icon: Code2 },
};

export default function ReportTypeCard({ template, onGenerate, onSchedule, isGenerating, canSchedule }) {
  const cfg = TYPE_CONFIG[template.report_type] || TYPE_CONFIG.custom_sql;
  const Icon = cfg.icon;

  return (
    <div className={`relative rounded-xl border bg-white overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${cfg.border}`}>
      {/* Accent strip */}
      <div className={`h-1.5 w-full ${cfg.color}`} />

      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-opacity-10 ${cfg.color.replace("bg-", "bg-").replace("600", "50")}`}>
            <Icon className={`h-5 w-5 ${cfg.textColor}`} />
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color.replace("bg-", "bg-")} bg-opacity-10 ${cfg.textColor}`}>
            {cfg.label}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">{template.name}</h3>
          {template.description && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{template.description}</p>
          )}
          {/* Format badges */}
          <div className="flex gap-1.5 mt-3">
            {(template.output_formats || []).map((fmt) => (
              <span key={fmt} className={`text-xs font-medium px-2 py-0.5 rounded ${fmt === "pdf" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {fmt.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={() => onGenerate(template)}
            disabled={isGenerating}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors
              ${isGenerating ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
          >
            {isGenerating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</> : "Generate Now"}
          </button>
          {canSchedule && (
            <button
              onClick={() => onSchedule(template)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
