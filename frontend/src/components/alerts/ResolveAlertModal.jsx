/**
 * src/components/alerts/ResolveAlertModal.jsx
 */
import React, { useState } from "react";
import { X, Loader2, AlertCircle, AlertTriangle, Info } from "lucide-react";

const SEV_ICON = { critical: AlertCircle, warning: AlertTriangle, info: Info };
const SEV_COLOR = { critical: "text-red-500", warning: "text-orange-500", info: "text-blue-500" };

export default function ResolveAlertModal({ isOpen, onClose, onConfirm, alert, isResolving }) {
  const [note, setNote] = useState("");
  if (!isOpen || !alert) return null;
  const Icon = SEV_ICON[alert.severity] || Info;

  const handleConfirm = () => {
    onConfirm(note.trim() || null);
    setNote("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Resolve Alert</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Alert preview */}
          <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
            <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${SEV_COLOR[alert.severity]}`} />
            <div>
              <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.message}</p>
            </div>
          </div>
          {/* Resolution note */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Resolution Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Describe how this issue was resolved or acknowledged..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{note.length}/500</p>
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={isResolving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {isResolving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isResolving ? "Resolving…" : "Confirm Resolution"}
          </button>
        </div>
      </div>
    </div>
  );
}
