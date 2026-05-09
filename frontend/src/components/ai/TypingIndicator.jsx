/**
 * src/components/ai/TypingIndicator.jsx
 * Animated "AI is thinking" dots indicator.
 */

import React from "react";

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-2">
      {/* AI Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-700 shadow-sm">
        <span className="text-white text-xs font-bold">AI</span>
      </div>

      {/* Bubble */}
      <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-2 w-2 rounded-full bg-gray-400"
              style={{
                animation: "ai-bounce 1.2s infinite ease-in-out",
                animationDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Analyzing your question…</p>
      </div>

      <style>{`
        @keyframes ai-bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40%            { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
