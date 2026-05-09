/**
 * src/components/sql/SQLEditorPanel.jsx
 *
 * Dark-themed SQL editor with formatting, line numbers,
 * Ctrl+Enter execution, and parameter inputs.
 *
 * Props:
 *   initialQuery   {string}
 *   onQueryChange  {(q: string) => void}
 *   onExecute      {(q: string, params: object) => void}
 *   isLoading      {boolean}
 *   templateName   {string|null}
 *   paramSchema    {object|null}  — {param_name: {type, required, default}}
 */

import React, { useEffect, useRef, useState } from "react";
import { Play, Trash2, WrapText, Loader2, Terminal } from "lucide-react";

const SQL_KEYWORDS = ["SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER",
  "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "AS", "ON", "AND", "OR",
  "NOT", "IN", "IS", "NULL", "DISTINCT", "COUNT", "SUM", "AVG", "MAX", "MIN"];

function formatSQL(query) {
  const keywords = ["FROM", "WHERE", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN",
    "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "AND", "OR"];
  let result = query;
  keywords.forEach((kw) => {
    result = result.replace(new RegExp(`\\b${kw}\\b`, "gi"), `\n${kw}`);
  });
  return result
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export default function SQLEditorPanel({
  initialQuery = "",
  onQueryChange,
  onExecute,
  isLoading = false,
  templateName = null,
  paramSchema = null,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [params, setParams] = useState({});
  const textareaRef = useRef(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleChange = (e) => {
    setQuery(e.target.value);
    onQueryChange?.(e.target.value);
  };

  const handleKeyDown = (e) => {
    // Tab → 2 spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newVal = query.slice(0, start) + "  " + query.slice(end);
      setQuery(newVal);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
    // Ctrl/Cmd + Enter → execute
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  const handleExecute = () => {
    if (!query.trim()) return;
    onExecute?.(query, params);
  };

  const handleFormat = () => {
    const formatted = formatSQL(query);
    setQuery(formatted);
    onQueryChange?.(formatted);
  };

  const lineCount = query.split("\n").length;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 shadow-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 bg-gray-800 px-4 py-2.5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-green-400" />
          {templateName ? (
            <span className="text-xs font-medium text-green-300 bg-green-900/40 px-2 py-0.5 rounded-full">
              {templateName}
            </span>
          ) : (
            <span className="text-xs text-gray-400">SQL Editor</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{lineCount} lines · {query.length} chars</span>
          <button
            onClick={handleFormat}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
            title="Format SQL"
          >
            <WrapText className="h-3 w-3" />
            Format
          </button>
          <button
            onClick={() => { setQuery(""); onQueryChange?.(""); }}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-700 hover:text-red-400 transition-colors"
            title="Clear editor"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            id="sql-run-btn"
            onClick={handleExecute}
            disabled={isLoading || !query.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-dark px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-white" />
            )}
            {isLoading ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex bg-gray-900">
        {/* Line numbers */}
        <div className="select-none px-3 py-4 text-right text-xs text-gray-600 font-mono leading-6 border-r border-gray-700 min-w-[3rem]">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1}>{i + 1}</div>
          ))}
        </div>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="SELECT * FROM your_table WHERE ..."
          spellCheck={false}
          rows={Math.max(10, lineCount + 2)}
          className="flex-1 resize-y bg-transparent px-4 py-4 font-mono text-sm text-green-300 placeholder-gray-600 outline-none leading-6 min-h-[200px]"
          style={{ caretColor: "#4ade80" }}
        />
      </div>

      {/* Keyboard hint */}
      <div className="bg-gray-800 px-4 py-1.5 border-t border-gray-700 flex items-center gap-4">
        <span className="text-xs text-gray-500">
          <kbd className="bg-gray-700 text-gray-300 rounded px-1 py-0.5 text-[10px]">Ctrl</kbd>+
          <kbd className="bg-gray-700 text-gray-300 rounded px-1 py-0.5 text-[10px]">Enter</kbd>{" "}
          to run
        </span>
        <span className="text-xs text-gray-500">
          <kbd className="bg-gray-700 text-gray-300 rounded px-1 py-0.5 text-[10px]">Tab</kbd>{" "}
          to indent
        </span>
        {query.length > 2000 && (
          <span className="text-xs text-amber-400">⚠ Large query — consider adding LIMIT</span>
        )}
      </div>

      {/* Parameter inputs */}
      {paramSchema && Object.keys(paramSchema).length > 0 && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
            Query Parameters
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(paramSchema).map(([name, meta]) => (
              <div key={name}>
                <label className="text-xs text-gray-400 flex items-center gap-1">
                  <span className="font-mono text-green-400">:{name}</span>
                  <span className="text-gray-600">({meta.type || "string"})</span>
                  {meta.required && (
                    <span className="text-red-400 text-[10px]">required</span>
                  )}
                </label>
                <input
                  type="text"
                  value={params[name] ?? meta.default ?? ""}
                  onChange={(e) =>
                    setParams((p) => ({ ...p, [name]: e.target.value }))
                  }
                  placeholder={meta.default ?? "value"}
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs font-mono text-green-300 outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
