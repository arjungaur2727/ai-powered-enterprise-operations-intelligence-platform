/**
 * src/components/ui/KPICard.jsx — Enhanced KPI card with trends, skeleton, click navigation.
 */
import React from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatTokenCount } from "../../utils/formatters";

function formatValue(value, format) {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "percentage": return `${Number(value).toFixed(1)}%`;
    case "ms": return `${Math.round(value)}ms`;
    case "tokens": return formatTokenCount(value);
    default: return Number(value).toLocaleString();
  }
}

const ACCENT = {
  blue:   { icon: "bg-blue-100",   text: "text-blue-600" },
  green:  { icon: "bg-emerald-100", text: "text-emerald-600" },
  orange: { icon: "bg-orange-100", text: "text-orange-600" },
  purple: { icon: "bg-purple-100", text: "text-purple-600" },
  yellow: { icon: "bg-yellow-100", text: "text-yellow-600" },
  indigo: { icon: "bg-indigo-100", text: "text-indigo-600" },
  red:    { icon: "bg-red-100",    text: "text-red-600" },
};

export default function KPICard({
  title, value, subtitle, icon: Icon,
  iconColor, accentColor = "blue", trend = "neutral",
  trendValue = 0, trendLabel = "vs yesterday",
  isLoading = false, onClick, format = "number",
  color, // legacy prop compatibility
}) {
  const accent = ACCENT[accentColor] || ACCENT.blue;
  const bgClass = iconColor || accent.icon;
  const textClass = accent.text;

  if (isLoading) {
    return (
      <div className="card animate-pulse flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-xl bg-gray-200" />
          <div className="h-5 w-16 rounded-full bg-gray-200" />
        </div>
        <div className="space-y-2">
          <div className="h-8 w-24 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="h-3 w-20 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const isPositive = trendValue > 0;
  const isNegative = trendValue < 0;
  const trendDisplay = Math.abs(trendValue).toFixed(1);

  return (
    <div
      onClick={onClick}
      className={`card flex flex-col gap-3 transition-all duration-200
        ${onClick ? "cursor-pointer hover:shadow-md hover:border-blue-200" : ""}
      `}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bgClass}`}>
          {Icon && <Icon className={`h-5 w-5 ${textClass}`} />}
        </div>
        {/* Trend badge */}
        {trend !== "neutral" && trendValue !== 0 ? (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
          }`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{trendDisplay}%
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-500">
            <Minus className="h-3 w-3" /> —
          </span>
        )}
      </div>

      {/* Metric */}
      <div>
        <p className="text-3xl font-bold text-gray-900 tracking-tight leading-tight">
          {formatValue(value, format)}
        </p>
        <p className="mt-0.5 text-sm font-medium text-gray-500">{title}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 text-xs text-gray-400">
        {subtitle && <span>{subtitle}</span>}
        {trendValue !== 0 && (
          <span className={`ml-auto font-medium ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
            {isPositive ? "↑" : "↓"} {trendDisplay}% {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
}
