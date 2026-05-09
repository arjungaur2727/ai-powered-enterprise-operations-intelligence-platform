/**
 * src/components/ai/UserMessage.jsx
 * Right-aligned user chat bubble.
 */

import React from "react";

function initials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

export default function UserMessage({ text, timestamp, userInitials = "U" }) {
  return (
    <div className="flex items-end justify-end gap-2 px-4 py-1.5 max-w-[85%] ml-auto">
      <div className="flex flex-col items-end">
        {/* Bubble */}
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm max-w-xl">
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{text}</p>
        </div>
        {/* Timestamp */}
        {timestamp && (
          <span className="text-[10px] text-gray-400 mt-1 pr-1">
            {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 shadow-sm">
        <span className="text-white text-xs font-bold">{userInitials}</span>
      </div>
    </div>
  );
}
