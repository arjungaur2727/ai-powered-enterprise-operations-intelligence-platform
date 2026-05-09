/**
 * src/components/alerts/AlertFeed.jsx
 * Paginated list of alert cards with skeleton loading and empty states.
 */
import React from "react";
import { Filter, CheckCircle2, Loader2 } from "lucide-react";
import AlertCard from "./AlertCard";

function SkeletonCard() {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="w-1 bg-gray-200 shrink-0" />
      <div className="flex-1 p-4 space-y-2">
        <div className="flex gap-2">
          <div className="h-5 w-20 rounded-full bg-gray-200" />
          <div className="h-5 w-24 rounded bg-gray-200" />
          <div className="ml-auto h-4 w-16 rounded bg-gray-100" />
        </div>
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-2/3 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function AlertFeed({
  alerts, total, isLoading, onRead, onResolve, onViewDetail, onLoadMore, isManager, hasFilters, onClearFilters,
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (alerts.length === 0 && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h3 className="font-semibold text-gray-900 mb-1">All clear!</h3>
        <p className="text-sm text-gray-500">No active alerts. The platform is running smoothly.</p>
      </div>
    );
  }

  if (alerts.length === 0 && hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
          <Filter className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="font-semibold text-gray-900 mb-1">No alerts match your filters</h3>
        <button onClick={onClearFilters} className="mt-2 text-sm text-blue-600 hover:underline">
          Clear filters
        </button>
      </div>
    );
  }

  const remaining = total - alerts.length;

  return (
    <div className="space-y-2.5">
      {alerts.map((a) => (
        <AlertCard
          key={a.id}
          alert={a}
          onRead={onRead}
          onResolve={onResolve}
          onViewDetail={onViewDetail}
          isManager={isManager}
        />
      ))}
      {remaining > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLoadMore}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Load {Math.min(20, remaining)} more alerts
            <span className="text-xs text-gray-400">({remaining} remaining)</span>
          </button>
        </div>
      )}
    </div>
  );
}
