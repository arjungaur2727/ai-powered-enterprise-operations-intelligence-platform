/**
 * src/pages/Dashboard.jsx
 *
 * Main analytics dashboard — KPI cards + placeholder chart section.
 */

import React, { useState } from "react";
import { BarChart2, Workflow, Upload, BellRing, BarChart3 } from "lucide-react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import KPICard from "../components/ui/KPICard";
import { useAuth } from "../context/AuthContext";

const KPI_DATA = [
  {
    id: "total-queries",
    title: "Total Queries Run",
    value: "2,847",
    icon: BarChart2,
    trend: "up",
    trendValue: "+18%",
    color: "bg-blue-500",
  },
  {
    id: "active-workflows",
    title: "Active Workflows",
    value: "12",
    icon: Workflow,
    trend: "up",
    trendValue: "+3",
    color: "bg-violet-500",
  },
  {
    id: "uploads-today",
    title: "Uploads Today",
    value: "7",
    icon: Upload,
    trend: "neutral",
    trendValue: "Today",
    color: "bg-emerald-500",
  },
  {
    id: "pending-alerts",
    title: "Pending Alerts",
    value: "4",
    icon: BellRing,
    trend: "down",
    trendValue: "-2",
    color: "bg-amber-500",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar — desktop always visible, mobile overlay */}
      <div
        className={`fixed inset-0 z-20 bg-black/40 md:hidden transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          title="Dashboard"
          onMenuToggle={() => setSidebarOpen((o) => !o)}
          unreadCount={4}
        />

        <main className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
          {/* Welcome */}
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              Welcome back,{" "}
              <span className="text-primary">{user?.full_name?.split(" ")[0]}</span> 👋
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              Here&apos;s what&apos;s happening across your operations today.
            </p>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {KPI_DATA.map((kpi) => (
              <KPICard key={kpi.id} {...kpi} />
            ))}
          </div>

          {/* Placeholder chart section */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-text-primary">Analytics Overview</h3>
                <p className="text-sm text-text-secondary">Query volume over the last 30 days</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center h-64 rounded-xl bg-surface border-2 border-dashed border-surface-border text-text-muted">
              <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Analytics coming in Phase 5</p>
              <p className="text-sm mt-1 opacity-70">Live data charts will appear here</p>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card">
              <h3 className="font-semibold text-text-primary mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {[
                  { label: "AI query executed", time: "2 min ago", color: "bg-blue-500" },
                  { label: "CSV uploaded successfully", time: "15 min ago", color: "bg-emerald-500" },
                  { label: "Workflow scheduled", time: "1 hour ago", color: "bg-violet-500" },
                  { label: "Alert triggered: threshold exceeded", time: "3 hours ago", color: "bg-amber-500" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${item.color}`} />
                    <span className="text-sm text-text-primary flex-1">{item.label}</span>
                    <span className="text-xs text-text-muted">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-text-primary mb-3">System Status</h3>
              <div className="space-y-3">
                {[
                  { label: "API Server", status: "Operational" },
                  { label: "Database", status: "Operational" },
                  { label: "AI Service", status: "Operational" },
                  { label: "Scheduler", status: "Operational" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{item.label}</span>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
