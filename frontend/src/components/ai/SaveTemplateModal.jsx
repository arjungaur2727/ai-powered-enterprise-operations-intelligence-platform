/**
 * src/components/ai/SaveTemplateModal.jsx
 * Modal for saving AI-generated SQL as a reusable template.
 */

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function SaveTemplateModal({ isOpen, onClose, onSave, sql, defaultName = "", isLoading = false }) {
  const [form, setForm] = useState({ name: defaultName, description: "", tags: [] });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (isOpen) setForm({ name: defaultName, description: "", tags: [] });
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput("");
  };

  const removeTag = (tag) => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave?.(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900">Save as SQL Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* SQL Preview */}
          {sql && (
            <div
              className="rounded-xl bg-gray-900 px-4 py-3 overflow-y-auto max-h-36 font-mono text-xs text-green-300 leading-relaxed"
            >
              <pre className="whitespace-pre-wrap">{sql}</pre>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="label">Template Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="input"
              placeholder="e.g. Weekly Failed Queries Report"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="input resize-none"
              placeholder="What does this query do?"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 bg-blue-100 text-blue-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-blue-500 hover:text-blue-800">×</button>
                </span>
              ))}
              <span className="flex items-center gap-1 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-xs">
                ai_generated
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Type tag + Enter"
                className="input flex-1 text-sm"
              />
              <button type="button" onClick={addTag} className="btn-secondary text-sm px-3">Add</button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isLoading || !form.name.trim()} className="btn-primary flex-1">
              {isLoading ? "Saving…" : "Save Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
