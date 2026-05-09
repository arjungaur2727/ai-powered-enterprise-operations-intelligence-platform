/**
 * src/components/ai/AIMessage.jsx
 * Left-aligned AI response card with SQL block, result table, and actions.
 */

import React from "react";
import { AlertCircle } from "lucide-react";
import GeneratedSQLBlock from "./GeneratedSQLBlock";
import ResultMiniTable from "./ResultMiniTable";
import MessageActions from "./MessageActions";

export default function AIMessage({
  session,
  onRun,
  onSaveTemplate,
  onRate,
  onRerun,
  isExecuting = false,
  canExecute = true,
}) {
  if (!session) return null;

  const hasResult = session.was_executed && session.execution_status === "success";
  const hasFailed = session.was_executed && session.execution_status === "failed";
  const isNull = !session.generated_sql;

  return (
    <div className="flex items-start gap-3 px-4 py-2 max-w-4xl">
      {/* AI Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-700 shadow-sm">
        <span className="text-white text-xs font-bold">AI</span>
      </div>

      <div className="flex-1 min-w-0">
        {/* White card */}
        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">

          {/* Explanation */}
          {session.explanation && (
            <p className="text-sm text-gray-700 leading-relaxed">{session.explanation}</p>
          )}

          {/* Null-result (AI couldn't generate) */}
          {isNull && !session.explanation && (
            <p className="text-sm text-gray-500 italic">
              I couldn't find the right data for that question. Try rephrasing or ask about something else.
            </p>
          )}

          {/* SQL block */}
          {session.generated_sql && (
            <GeneratedSQLBlock
              sql={session.generated_sql}
              confidence={session.confidence || "medium"}
              tablesReferenced={session.tables_referenced || []}
              warnings={session.warnings || []}
              onRun={() => onRun?.(session.session_id || session.id)}
              onSaveTemplate={() => onSaveTemplate?.(session.session_id || session.id)}
              isExecuting={isExecuting}
              canExecute={canExecute}
            />
          )}

          {/* Success result */}
          {hasResult && (
            <ResultMiniTable
              columns={session.columns || session.result_columns || []}
              rows={session.rows || session.result_snapshot || []}
              rowCount={session.row_count || 0}
              executionMs={session.execution_ms}
              onExport={() => {}}
            />
          )}

          {/* Error result */}
          {hasFailed && session.error_message && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-red-700">Execution Failed</span>
              </div>
              <p className="font-mono text-xs text-red-600 whitespace-pre-wrap">
                {session.error_message}
              </p>
              <p className="mt-2 text-xs text-red-500">
                💡 Try rephrasing your question or ask the AI to adjust the query.
              </p>
            </div>
          )}

          {/* Actions */}
          <MessageActions
            sessionId={session.session_id || session.id}
            canExecute={canExecute}
            isSaved={session.saved_as_template}
            userRating={session.user_rating}
            onRate={(r) => onRate?.(session.session_id || session.id, r)}
            onSaveTemplate={() => onSaveTemplate?.(session.session_id || session.id)}
            onRerun={onRerun}
            naturalLanguage={session.natural_language}
          />
        </div>

        {/* Metadata footer */}
        <div className="flex items-center gap-3 mt-1 px-1 flex-wrap">
          {session.created_at && (
            <span className="text-[10px] text-gray-400">
              {new Date(session.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {session.total_tokens > 0 && (
            <span className="text-[10px] text-gray-400">{session.total_tokens.toLocaleString()} tokens</span>
          )}
          {session.generation_ms > 0 && (
            <span className="text-[10px] text-gray-400">{session.generation_ms}ms gen</span>
          )}
        </div>
      </div>
    </div>
  );
}
