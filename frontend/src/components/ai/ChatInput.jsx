/**
 * src/components/ai/ChatInput.jsx
 * Auto-expanding textarea with send, auto-execute toggle, and keyboard hints.
 */

import React, { useEffect, useRef, useState } from "react";
import { Loader2, SendHorizonal } from "lucide-react";

export default function ChatInput({
  onSend,
  isLoading = false,
  placeholder = "Ask anything about your data…",
  autoExecute = false,
  onAutoExecuteToggle,
  canAutoExecute = true,
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [text]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    onSend?.(trimmed);
    setText("");
  };

  const charCount = text.length;
  const charColor =
    charCount > 950 ? "text-red-500" : charCount > 800 ? "text-amber-500" : "text-gray-400";

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      {/* Textarea row */}
      <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 focus-within:border-blue-400 focus-within:bg-white transition-colors shadow-sm">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          maxLength={1000}
          disabled={isLoading}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none leading-6 max-h-36 disabled:opacity-60"
        />
        <button
          id="ai-send-btn"
          onClick={handleSend}
          disabled={isLoading || !text.trim()}
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-3">
          {/* Auto-execute toggle */}
          <div className="relative group flex items-center gap-2">
            <button
              type="button"
              onClick={canAutoExecute ? onAutoExecuteToggle : undefined}
              disabled={!canAutoExecute}
              className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors ${
                autoExecute && canAutoExecute ? "bg-blue-600" : "bg-gray-300"
              } ${!canAutoExecute ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              style={{ height: "18px", width: "32px" }}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow ${
                  autoExecute && canAutoExecute ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-xs text-gray-500">Auto-run query</span>
            {!canAutoExecute && (
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
                Execution requires Manager role
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 hidden sm:block">
            Enter to send · Shift+Enter for new line
          </span>
        </div>
        <span className={`text-[10px] ${charColor}`}>{charCount}/1000</span>
      </div>
    </div>
  );
}
