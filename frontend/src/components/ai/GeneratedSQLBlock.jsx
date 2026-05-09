/**
 * src/components/ai/GeneratedSQLBlock.jsx
 *
 * Dark syntax-highlighted SQL block with confidence badge,
 * copy, run, and save-template actions.
 */

import React, { useState } from "react";
import { CheckCircle2, Copy, Loader2, Play, Save, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// SQL Syntax Highlighter (pure JS — no external lib, XSS-safe)
// ---------------------------------------------------------------------------
const SQL_KEYWORDS = [
  "SELECT","FROM","WHERE","JOIN","LEFT","RIGHT","INNER","OUTER","FULL","CROSS",
  "ON","GROUP\\s+BY","ORDER\\s+BY","HAVING","LIMIT","OFFSET","AS","AND","OR","NOT",
  "IN","LIKE","IS","NULL","COUNT","SUM","AVG","MIN","MAX","DATE_TRUNC","INTERVAL",
  "DISTINCT","CASE","WHEN","THEN","ELSE","END","WITH","UNION","ALL","BETWEEN",
  "EXISTS","COALESCE","NOW","CURRENT_DATE","EXTRACT","CAST",
];

function highlightSQL(sql) {
  if (!sql) return "";

  // Escape HTML
  let escaped = sql
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // String literals (orange)
  escaped = escaped.replace(
    /'([^']*)'/g,
    "<span style='color:#FBBF24'>'$1'</span>"
  );

  // Numbers (purple)
  escaped = escaped.replace(
    /\b(\d+)\b/g,
    "<span style='color:#A78BFA'>$1</span>"
  );

  // Keywords (blue)
  const kwPattern = new RegExp(`\\b(${SQL_KEYWORDS.join("|")})\\b`, "gi");
  escaped = escaped.replace(
    kwPattern,
    "<span style='color:#60A5FA;font-weight:600'>$1</span>"
  );

  // Comments (gray)
  escaped = escaped.replace(
    /(--[^\n]*)/g,
    "<span style='color:#6B7280;font-style:italic'>$1</span>"
  );

  return escaped;
}

const CONFIDENCE_STYLES = {
  high:   { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "High Confidence" },
  medium: { bg: "bg-amber-500/20",   text: "text-amber-400",   label: "Medium Confidence" },
  low:    { bg: "bg-red-500/20",     text: "text-red-400",     label: "Low Confidence" },
};

export default function GeneratedSQLBlock({
  sql,
  confidence = "medium",
  tablesReferenced = [],
  warnings = [],
  onCopy,
  onRun,
  onSaveTemplate,
  isExecuting = false,
  canExecute = true,
}) {
  const [copied, setCopied] = useState(false);

  const conf = CONFIDENCE_STYLES[confidence] || CONFIDENCE_STYLES.medium;

  const handleCopy = () => {
    navigator.clipboard?.writeText(sql || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    onCopy?.();
  };

  if (!sql) {
    return (
      <div className="rounded-lg bg-amber-950/30 border border-amber-800/40 p-4 mt-2">
        <p className="text-amber-300 text-sm">
          ⚠ The AI couldn't generate SQL for this question. Try rephrasing or ask about a different aspect of your data.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-gray-700 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-gray-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">Generated SQL</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${conf.bg} ${conf.text}`}>
            {conf.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            {copied ? (
              <><CheckCircle2 className="h-3 w-3 text-emerald-400" /> Copied!</>
            ) : (
              <><Copy className="h-3 w-3" /> Copy</>
            )}
          </button>
        </div>
      </div>

      {/* Code area */}
      <div
        className="bg-gray-900 px-5 py-4 overflow-x-auto max-h-64 overflow-y-auto"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
      >
        <pre
          className="text-sm leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: highlightSQL(sql) }}
        />
      </div>

      {/* Tables referenced */}
      {tablesReferenced.length > 0 && (
        <div className="bg-gray-800 px-4 py-2 flex items-center gap-2 flex-wrap border-t border-gray-700">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Uses:</span>
          {tablesReferenced.map((t) => (
            <span key={t} className="text-[10px] bg-blue-900/50 text-blue-300 rounded px-1.5 py-0.5 font-mono">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-950/40 border-t border-amber-800/40 px-4 py-2.5">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-xs text-amber-300">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2.5 flex items-center gap-2">
        <div className="relative group">
          <button
            onClick={onRun}
            disabled={isExecuting || !canExecute}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              canExecute
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            } disabled:opacity-70`}
          >
            {isExecuting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
            {isExecuting ? "Running…" : "Run Query"}
          </button>
          {!canExecute && (
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-gray-900 text-gray-300 text-xs rounded px-2 py-1 whitespace-nowrap border border-gray-700 z-10">
              Managers can execute queries
            </div>
          )}
        </div>

        {canExecute && (
          <button
            onClick={onSaveTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <Save className="h-3 w-3" />
            Save as Template
          </button>
        )}
      </div>
    </div>
  );
}
