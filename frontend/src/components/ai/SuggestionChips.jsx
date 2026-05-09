/**
 * src/components/ai/SuggestionChips.jsx
 * Empty state with pre-built example question chips.
 */

import React from "react";
import { Sparkles } from "lucide-react";

const CATEGORY_ICON = {
  Analytics: "💹",
  Operations: "⚙️",
  Reporting: "📊",
  Performance: "⚡",
};

export default function SuggestionChips({ suggestions = [], onSelect, isVisible = true }) {
  if (!isVisible || suggestions.length === 0) return null;

  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4">
      {/* Hero */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Enterprise Operations AI</h2>
        <p className="text-gray-500 text-center max-w-sm">
          Ask anything about your data in plain English. I'll generate the SQL for you.
        </p>
      </div>

      {/* Chips grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map((chip) => (
          <button
            key={chip.label}
            onClick={() => onSelect?.(chip.query)}
            className="group text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-400 hover:shadow-md transition-all duration-150"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">
                {CATEGORY_ICON[chip.category] || "🔍"}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-800 group-hover:text-blue-600 transition-colors">
                  {chip.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{chip.query}</p>
                <span className="mt-1.5 inline-block text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                  {chip.category}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-400 text-center">
        Or type your own question below ↓
      </p>
    </div>
  );
}
