/**
 * src/components/ai/SessionHistorySidebar.jsx
 * Slide-in left sidebar showing past AI conversations, grouped by date.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import { getAIHistory } from "../../api/aiApi";

function groupByDate(sessions) {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yestStr = yesterday.toDateString();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups = { Today: [], Yesterday: [], "Last 7 Days": [], Older: [] };
  sessions.forEach((s) => {
    const d = new Date(s.created_at);
    if (d.toDateString() === todayStr) groups.Today.push(s);
    else if (d.toDateString() === yestStr) groups.Yesterday.push(s);
    else if (d > weekAgo) groups["Last 7 Days"].push(s);
    else groups.Older.push(s);
  });
  return groups;
}

const STATUS_DOT = {
  success: "bg-emerald-400",
  failed: "bg-red-400",
  null: "bg-amber-400",
};

function SessionItem({ session, onLoad }) {
  const statusKey = session.was_executed ? session.execution_status : null;
  const dotClass = STATUS_DOT[statusKey] || "bg-amber-400";

  return (
    <button
      onClick={() => onLoad?.(session)}
      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200 group"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">
            {session.natural_language}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-gray-400">
              {new Date(session.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {session.saved_as_template && (
              <span className="text-[9px] bg-blue-100 text-blue-600 rounded-full px-1.5 py-0.5">Saved</span>
            )}
            {session.user_rating && (
              <span className="text-[10px] text-amber-500">{"★".repeat(session.user_rating)}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function SessionHistorySidebar({ isOpen, onClose, onLoadSession }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAIHistory({ limit: 50 });
      setSessions(data);
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const filtered = sessions.filter((s) =>
    !search || s.natural_language.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = groupByDate(filtered);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed left-0 top-0 z-50 h-full w-80 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Conversation History</h3>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-gray-50"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No previous conversations.</p>
          ) : (
            Object.entries(grouped).map(([group, items]) =>
              items.length === 0 ? null : (
                <div key={group} className="mb-3">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider px-3 py-1 font-semibold">{group}</p>
                  {items.map((s) => (
                    <SessionItem key={s.id} session={s} onLoad={(sess) => { onLoadSession?.(sess); onClose(); }} />
                  ))}
                </div>
              )
            )
          )}
        </div>
      </div>
    </>
  );
}
