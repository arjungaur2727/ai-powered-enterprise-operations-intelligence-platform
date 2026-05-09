/**
 * src/components/ai/SchemaExplorer.jsx
 * Collapsible tree panel showing live DB tables and columns.
 */

import React, { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";

function rowDot(count) {
  if (count > 1000) return "bg-emerald-400";
  if (count > 100) return "bg-amber-400";
  return "bg-gray-400";
}

function TypeBadge({ type }) {
  const raw = type.toUpperCase();
  const short = raw.includes("VARCHAR") ? "VARCHAR"
    : raw.includes("TIMESTAMP") ? "TS"
    : raw.includes("UUID") ? "UUID"
    : raw.includes("BOOLEAN") ? "BOOL"
    : raw.includes("INTEGER") || raw.includes("INT") ? "INT"
    : raw.includes("TEXT") ? "TEXT"
    : raw.includes("JSONB") ? "JSONB"
    : raw.slice(0, 6);

  const color = raw.includes("UUID") ? "bg-purple-100 text-purple-700"
    : raw.includes("TIMESTAMP") ? "bg-blue-100 text-blue-700"
    : raw.includes("BOOLEAN") ? "bg-pink-100 text-pink-700"
    : raw.includes("INTEGER") || raw.includes("INT") ? "bg-emerald-100 text-emerald-700"
    : raw.includes("JSONB") ? "bg-amber-100 text-amber-700"
    : "bg-gray-100 text-gray-600";

  return <span className={`text-[9px] font-mono rounded px-1 py-0.5 ${color}`}>{short}</span>;
}

function TableRow({ table, isFiltered }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors rounded-lg group text-left"
      >
        {open ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" /> : <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />}
        <span className={`w-2 h-2 rounded-full shrink-0 ${rowDot(table.row_count_estimate || 0)}`} />
        <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{table.table_name}</span>
        <span className="text-[10px] text-gray-400 shrink-0">
          {(table.row_count_estimate || 0).toLocaleString()}
        </span>
      </button>

      {open && (
        <div className="ml-6 mb-1 space-y-0.5">
          {table.columns.map((col) => (
            <div key={col.name} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-blue-50 group cursor-default">
              <span className="text-[10px] text-gray-700 flex-1 truncate font-mono">{col.name}</span>
              <TypeBadge type={col.type} />
              {col.is_primary_key && <span title="Primary Key" className="text-[9px]">🔑</span>}
              {col.is_foreign_key && (
                <span title={`FK → ${col.fk_references}`} className="text-[9px] cursor-help">🔗</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchemaExplorer({ schema, isLoading, onRefresh, canRefresh = false }) {
  const [search, setSearch] = useState("");

  const filteredTables = (schema?.tables || []).filter(
    (t) =>
      !search ||
      t.table_name.toLowerCase().includes(search.toLowerCase()) ||
      t.columns.some((c) => c.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white w-64 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Schema Explorer</h3>
        {canRefresh && (
          <button onClick={onRefresh} className="text-gray-400 hover:text-blue-600 transition-colors" title="Refresh schema">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tables…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-gray-50"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            {search ? "No matches" : "No schema available"}
          </p>
        ) : (
          filteredTables.map((t) => <TableRow key={t.table_name} table={t} />)
        )}
      </div>

      {/* Footer */}
      {schema && (
        <div className="px-4 py-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-400">
            {schema.table_count} tables · {schema.total_columns} columns
          </p>
          {schema.last_refreshed && (
            <p className="text-[10px] text-gray-400">
              Updated {new Date(schema.last_refreshed).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
