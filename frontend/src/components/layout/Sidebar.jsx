/**
 * src/components/layout/Sidebar.jsx
 *
 * Dark navigation sidebar with role-filtered nav items.
 * Shows user name, role badge, and logout button at the bottom.
 */

import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  Code2,
  BrainCircuit,
  FileBarChart2,
  BellRing,
  ScrollText,
  Users,
  LogOut,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const ALL_NAV = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, roles: ["admin", "manager", "analyst"] },
  { label: "AI Query Assistant", to: "/ai", icon: BrainCircuit, roles: ["admin", "manager", "analyst"] },
  { label: "Reports", to: "/reports", icon: FileBarChart2, roles: ["admin", "manager", "analyst"] },
  { label: "Data Upload", to: "/upload", icon: Upload, roles: ["admin", "manager"] },
  { label: "SQL Workflows", to: "/sql", icon: Code2, roles: ["admin", "manager"] },
  { label: "Alerts", to: "/alerts", icon: BellRing, roles: ["admin", "manager"] },
  { label: "Audit Logs", to: "/audit", icon: ScrollText, roles: ["admin"] },
  { label: "User Management", to: "/users", icon: Users, roles: ["admin"] },
];

const ROLE_BADGE_CLASS = {
  admin: "badge-admin",
  manager: "badge-manager",
  analyst: "badge-analyst",
};

/** @param {{ onClose?: () => void }} props */
export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = ALL_NAV.filter((item) => item.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar-bg text-sidebar-text select-none">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white leading-tight">Enterprise Ops</p>
          <p className="text-[10px] text-sidebar-text/60 leading-tight">Intelligence Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text/40">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
            <span className={`${ROLE_BADGE_CLASS[user?.role] || "badge"} mt-0.5`}>
              {user?.role}
            </span>
          </div>
        </div>
        <button
          id="sidebar-logout-btn"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-text/70 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-150"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
