/**
 * src/components/dashboard/DashboardHeader.jsx
 */
import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const ROLE_BADGE = {
  admin:   "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  analyst: "bg-emerald-100 text-emerald-700",
};

export default function DashboardHeader({ userName = "", userRole = "analyst", lastRefreshed, onRefresh, isRefreshing = false, alertCount = 0 }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const firstName = userName.split(" ")[0] || "User";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const getLastUpdated = () => {
    if (!lastRefreshed) return "Never";
    const diffMin = Math.floor((Date.now() - lastRefreshed.getTime()) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin === 1) return "1 minute ago";
    return `${diffMin} minutes ago`;
  };

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {firstName}! 👋
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${ROLE_BADGE[userRole] || ROLE_BADGE.analyst}`}>
            {userRole}
          </span>
          <span className="text-xs text-gray-400">Updated {getLastUpdated()}</span>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>
      {alertCount > 0 && (
        <a href="#alerts" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors">
          ⚠ {alertCount} Performance Alert{alertCount !== 1 ? "s" : ""}
        </a>
      )}
      <p className="mt-1 text-xs text-gray-400">Enterprise Operations Intelligence Platform</p>
    </div>
  );
}
