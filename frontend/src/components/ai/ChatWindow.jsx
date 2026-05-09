/**
 * src/components/ai/ChatWindow.jsx
 * Scrollable chat thread with auto-scroll to bottom.
 */

import React, { useEffect, useRef } from "react";
import UserMessage from "./UserMessage";
import AIMessage from "./AIMessage";
import TypingIndicator from "./TypingIndicator";
import SuggestionChips from "./SuggestionChips";

export default function ChatWindow({
  messages = [],
  suggestions = [],
  isLoading = false,
  onRun,
  onSaveTemplate,
  onRate,
  onRerun,
  canExecute = true,
  executingSessionId = null,
}) {
  const bottomRef = useRef(null);

  // Auto-scroll on new messages or loading state
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {isEmpty && !isLoading ? (
        <SuggestionChips
          suggestions={suggestions}
          onSelect={onRerun}
          isVisible={true}
        />
      ) : (
        <div className="py-4 space-y-1 min-h-full">
          {messages.map((msg, i) => {
            if (msg.type === "user") {
              return (
                <UserMessage
                  key={i}
                  text={msg.data.text}
                  timestamp={msg.data.timestamp}
                  userInitials={msg.data.userInitials || "U"}
                />
              );
            }
            if (msg.type === "ai") {
              return (
                <AIMessage
                  key={i}
                  session={msg.data}
                  onRun={onRun}
                  onSaveTemplate={onSaveTemplate}
                  onRate={onRate}
                  onRerun={onRerun}
                  isExecuting={executingSessionId === (msg.data.session_id || msg.data.id)}
                  canExecute={canExecute}
                />
              );
            }
            if (msg.type === "error") {
              return (
                <div key={i} className="px-4 py-2 flex justify-center">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 max-w-lg text-center">
                    ⚠ {msg.data.message}
                  </div>
                </div>
              );
            }
            return null;
          })}

          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
