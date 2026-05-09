/**
 * src/components/ai/MessageActions.jsx
 * Compact action row below each AI message: re-ask, star rating, save template.
 */

import React, { useState } from "react";
import { RotateCcw, BookmarkCheck } from "lucide-react";

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(null);
  const display = hovered ?? value ?? 0;

  return (
    <div className="flex items-center gap-0.5" title="Rate this answer">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          className={`text-sm transition-colors ${display >= n ? "text-amber-400" : "text-gray-400"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function MessageActions({
  sessionId,
  canExecute,
  isSaved,
  userRating,
  onRate,
  onSaveTemplate,
  onRerun,
  naturalLanguage,
}) {
  const [rating, setRating] = useState(userRating || null);

  const handleRate = (n) => {
    setRating(n);
    onRate?.(n);
  };

  return (
    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 flex-wrap">
      {/* Re-ask */}
      <button
        onClick={() => onRerun?.(naturalLanguage)}
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-600 transition-colors"
        title="Re-ask this question"
      >
        <RotateCcw className="h-3 w-3" />
        Re-ask
      </button>

      {/* Star rating */}
      <StarRating value={rating} onChange={handleRate} />

      {/* Save template */}
      {canExecute && (
        isSaved ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
            <BookmarkCheck className="h-3 w-3" />
            Saved as Template
          </span>
        ) : (
          <button
            onClick={() => onSaveTemplate?.()}
            className="text-[11px] text-gray-400 hover:text-blue-600 transition-colors underline underline-offset-2"
          >
            Save as Template
          </button>
        )
      )}
    </div>
  );
}
