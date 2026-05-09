/**
 * src/components/alerts/AlertBadge.jsx
 * Bell icon with animated unread count badge for Topbar.
 */
import React from "react";
import { Bell } from "lucide-react";

export default function AlertBadge({ count = 0, critical = 0, onClick }) {
  const badgeColor =
    critical > 0 ? "bg-red-500" : count > 0 ? "bg-orange-400" : "bg-blue-400";

  return (
    <button
      onClick={onClick}
      title={count > 0 ? `${count} unread alert${count !== 1 ? "s" : ""}` : "No new alerts"}
      className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <Bell className="h-5 w-5 text-gray-600" />
      {count > 0 && (
        <>
          {critical > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ${badgeColor} opacity-60 animate-ping`} />
          )}
          <span
            className={`absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1
              text-[10px] font-bold text-white ${badgeColor} shadow-sm`}
          >
            {count >= 10 ? "9+" : count}
          </span>
        </>
      )}
    </button>
  );
}
