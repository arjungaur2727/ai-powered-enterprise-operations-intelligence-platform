/**
 * src/components/sql/QueryHistoryDrawer.jsx
 *
 * Slide-in drawer showing filterable SQL execution history.
 *
 * Props:
 *   isOpen     {boolean}
 *   onClose    {() => void}
 *   onRerun    {(queryText: string) => void}
 */

import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock, RefreshCw, X } from "lucide-react";
import { getHistory } from "../../api/sqlApi";
import { formatDuration } from "../../utils/formatters";

const SOURCE_FILTERS = ["all", "manual", "scheduled", "ai_generated"];
const STATUS_FILTERS = ["all", "success", "failed"];

function HistoryItem({ item, onRerun }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-surface-border rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-surface transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-text-secondary truncate">{item.query_text}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge text-[10px] ${item.source === "manual" ? "bg-blue-100 text-blue-700" : item.source === "scheduled" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
              {item.source}
            </span>
            <span className={`badge text-[10px] ${item.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {item.status}
            </span>
            <span className="text-[10px] text-text-muted">
              {item.row_count?.toLocaleString()} rows · {formatDuration(item.execution_ms)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onRerun?.(item.query_text); }}
            className="p-1 rounded hover:bg-primary/10 text-primary"
            title="Re-run query"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-text-muted" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-surface-border bg-surface px-3 py-2">
          <pre className="text-[10px] font-mono text-text-secondary whitespace-pre-wrap mb-2">
            {item.query_text}
          </pre>
          {item.error_message && (
            <p className="text-[10px] text-red-500 font-mono">{item.error_message}</p>
          )}
          <p className="text-[10px] text-text-muted">
            {new Date(item.executed_at).toLocaleString()}
            {item.template_name && ` · Template: ${item.template_name}`}
            {item.executed_by_name && ` · By: ${item.executed_by_name}`}
          </p>
        </div>
      )}
    </div>
  );
}

export default function QueryHistoryDrawer({ isOpen, onClose, onRerun }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState("all");
  const [queryStatus, setQueryStatus] = useState("all");
  const [skip, setSkip] = useState(0);
  const LIMIT = 15;

  const fetchHistory = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const newSkip = reset ? 0 : skip;
      const data = await getHistory({
        skip: newSkip,
        limit: LIMIT,
        source: source === "all" ? undefined : source,
        status: queryStatus === "all" ? undefined : queryStatus,
      });
      if (reset) {
        setItems(data);
        setSkip(LIMIT);
      } else {
        setItems((prev) => [...prev, ...data]);
        setSkip((s) => s + LIMIT);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [source, queryStatus, skip]);

  useEffect(() => {
    if (isOpen) {
      setSkip(0);
      fetchHistory(true);
    }
  }, [isOpen, source, queryStatus]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-96 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-text-primary">Query History</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-surface-border space-y-2">
          <div className="flex gap-1">
            {SOURCE_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`flex-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors capitalize ${
                  source === s
                    ? "bg-primary text-white"
                    : "bg-surface text-text-muted hover:bg-surface-border"
                }`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setQueryStatus(s)}
                className={`flex-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors capitalize ${
                  queryStatus === s
                    ? "bg-primary text-white"
                    : "bg-surface text-text-muted hover:bg-surface-border"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {items.length === 0 && !isLoading && (
            <p className="text-center text-sm text-text-muted py-8">No history found.</p>
          )}
          {items.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              onRerun={(q) => { onRerun?.(q); onClose(); }}
            />
          ))}
          {/* Load more */}
          {items.length >= LIMIT && (
            <button
              onClick={() => fetchHistory(false)}
              disabled={isLoading}
              className="w-full text-xs text-primary hover:underline py-2"
            >
              {isLoading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
