/**
 * src/App.jsx
 *
 * Root component — wraps AuthProvider + Toaster, defines all routes.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/layout/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import DataUpload from "./pages/DataUpload";
import SQLWorkflows from "./pages/SQLWorkflows";
import AIQueryAssistant from "./pages/AIQueryAssistant";
import Reports from "./pages/Reports";
import Alerts from "./pages/Alerts";
import AuditLogs from "./pages/AuditLogs";

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontSize: "14px",
            fontFamily: "Inter, system-ui, sans-serif",
            borderRadius: "10px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* All authenticated users */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ai" element={<AIQueryAssistant />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          {/* Manager + Admin */}
          <Route element={<ProtectedRoute roles={["manager", "admin"]} />}>
            <Route path="/upload" element={<DataUpload />} />
            <Route path="/sql" element={<SQLWorkflows />} />
            <Route path="/alerts" element={<Alerts />} />
          </Route>

          {/* Admin only */}
          <Route element={<ProtectedRoute roles={["admin"]} />}>
            <Route path="/audit" element={<AuditLogs />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
