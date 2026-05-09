/**
 * src/components/reports/ReportTemplateGrid.jsx
 * Responsive grid of report type cards.
 */
import React from "react";
import ReportTypeCard from "./ReportTypeCard";

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="h-1.5 bg-gray-200 w-full" />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="h-11 w-11 rounded-xl bg-gray-200" />
          <div className="h-5 w-24 rounded-full bg-gray-200" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-2/3 rounded bg-gray-200" />
          <div className="flex gap-1.5 pt-2">
            <div className="h-5 w-10 rounded bg-gray-200" />
            <div className="h-5 w-10 rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <div className="h-9 flex-1 rounded-lg bg-gray-200" />
          <div className="h-9 w-24 rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export default function ReportTemplateGrid({ templates, onGenerate, onSchedule, generatingId, canSchedule, isLoading }) {
  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-gray-900">Available Reports</h2>
          <div className="h-5 w-6 rounded-full bg-gray-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-sm">No report templates configured. Contact your administrator.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold text-gray-900">Available Reports</h2>
        <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {templates.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <ReportTypeCard
            key={t.id}
            template={t}
            onGenerate={onGenerate}
            onSchedule={onSchedule}
            isGenerating={generatingId === t.id}
            canSchedule={canSchedule}
          />
        ))}
      </div>
    </div>
  );
}
