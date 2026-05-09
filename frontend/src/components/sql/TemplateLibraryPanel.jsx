/**
 * src/components/sql/TemplateLibraryPanel.jsx
 *
 * Searchable, tag-filtered sidebar list of SQL templates.
 *
 * Props:
 *   templates        {SQLTemplateResponse[]}
 *   selectedTemplate {SQLTemplateResponse|null}
 *   onSelectTemplate {(template) => void}
 *   onCreateNew      {() => void}
 *   onEditTemplate   {(template) => void}
 *   onDeleteTemplate {(id) => void}
 *   isLoading        {boolean}
 *   currentUser      {User}
 */

import React, { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import TemplateCard from "./TemplateCard";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-surface-border p-3 space-y-2">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-2 bg-gray-200 rounded w-full" />
      <div className="h-2 bg-gray-200 rounded w-1/2" />
    </div>
  );
}

export default function TemplateLibraryPanel({
  templates = [],
  selectedTemplate,
  onSelectTemplate,
  onCreateNew,
  onEditTemplate,
  onDeleteTemplate,
  isLoading,
  currentUser,
}) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);

  // Collect all unique tags
  const allTags = [...new Set(templates.flatMap((t) => t.tags || []))];

  // Client-side filter
  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesTag = !activeTag || (t.tags || []).includes(activeTag);
    return matchesSearch && matchesTag;
  });

  const canCreate = currentUser?.role !== "analyst";

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="input pl-9 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                activeTag === tag
                  ? "bg-primary text-white"
                  : "bg-surface-border text-text-muted hover:bg-primary/10"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Template list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border p-6 text-center">
            <p className="text-sm text-text-muted">
              {search || activeTag
                ? "No templates match your filter."
                : "No templates yet."}
            </p>
            {canCreate && !search && !activeTag && (
              <p className="text-xs text-text-muted mt-1">
                Create your first SQL template below.
              </p>
            )}
          </div>
        ) : (
          filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isSelected={selectedTemplate?.id === t.id}
              onSelect={() => onSelectTemplate?.(t)}
              onEdit={() => onEditTemplate?.(t)}
              onDelete={() => onDeleteTemplate?.(t.id)}
              currentUser={currentUser}
            />
          ))
        )}
      </div>

      {/* Create button */}
      {canCreate && (
        <button
          id="sql-new-template-btn"
          onClick={onCreateNew}
          className="btn-primary flex items-center justify-center gap-2 text-sm py-2"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      )}
    </div>
  );
}
