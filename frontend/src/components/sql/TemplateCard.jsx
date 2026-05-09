/**
 * src/components/sql/TemplateCard.jsx
 *
 * Single SQL template card — tags, execution stats, action buttons.
 *
 * Props:
 *   template   {SQLTemplateResponse}
 *   onSelect   {() => void}
 *   onEdit     {() => void}
 *   onDelete   {() => void}
 *   isSelected {boolean}
 *   currentUser {User}
 */

import React from "react";
import { Clock, Edit2, Play, Tag, Trash2 } from "lucide-react";
import { formatDateTime } from "../../utils/formatters";

const TAG_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
];

function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash += tag.charCodeAt(i);
  return TAG_COLORS[hash % TAG_COLORS.length];
}

export default function TemplateCard({
  template,
  onSelect,
  onEdit,
  onDelete,
  isSelected,
  currentUser,
}) {
  const visibleTags = (template.tags || []).slice(0, 3);
  const extraTags = (template.tags || []).length - 3;
  const canEdit = currentUser?.role !== "analyst";
  const canDelete = currentUser?.role === "admin";

  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer rounded-xl border p-3 transition-all duration-200 ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-surface-border bg-white hover:border-primary/40 hover:shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-sm text-text-primary leading-tight line-clamp-1 flex-1">
          {template.name}
        </p>
        {template.is_public && (
          <span className="shrink-0 text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5">
            Public
          </span>
        )}
      </div>

      {/* Description */}
      {template.description && (
        <p className="mt-1 text-xs text-text-muted line-clamp-2 leading-relaxed">
          {template.description}
        </p>
      )}

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tagColor(tag)}`}
            >
              <Tag className="h-2 w-2" />
              {tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-[10px] text-text-muted">+{extraTags} more</span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mt-2 flex items-center gap-3 text-[10px] text-text-muted">
        <span>▶ {template.execution_count} runs</span>
        {template.last_executed_at && (
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {new Date(template.last_executed_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          <Play className="h-2.5 w-2.5 fill-primary" />
          Run
        </button>
        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-text-secondary hover:bg-surface-border transition-colors"
          >
            <Edit2 className="h-2.5 w-2.5" />
            Edit
          </button>
        )}
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}
