/**
 * src/components/layout/Topbar.jsx
 * Top navigation bar with page title, live alert badge, and user avatar.
 */
import React, { useCallback, useState } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AlertBadge from "../alerts/AlertBadge";
import { useInterval } from "../../hooks/useInterval";
import { getUnreadCount } from "../../api/alertsApi";

export default function Topbar({ title, onMenuToggle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unreadData, setUnreadData] = useState({ count: 0, critical: 0, warning: 0, info: 0 });

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const fetchUnread = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setUnreadData(data);
    } catch {
      // Silently fail — badge not critical
    }
  }, []);

  // Fetch on mount, then poll every 60s
  useState(() => { fetchUnread(); }, []);
  useInterval(fetchUnread, 60_000);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-surface-border bg-surface-card px-4 md:px-6">
      {/* Left: hamburger (mobile) + title */}
      <div className="flex items-center gap-3">
        <button
          id="topbar-menu-toggle"
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-text-secondary hover:bg-surface hover:text-text-primary transition-colors md:hidden"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
      </div>

      {/* Right: alert badge + avatar */}
      <div className="flex items-center gap-2">
        <AlertBadge
          count={unreadData.count}
          critical={unreadData.critical}
          onClick={() => navigate("/alerts")}
        />

        {/* User avatar */}
        <div
          title={user?.full_name}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-bold cursor-default"
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
