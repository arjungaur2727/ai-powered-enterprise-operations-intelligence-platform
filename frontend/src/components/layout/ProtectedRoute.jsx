/**
 * src/components/layout/ProtectedRoute.jsx
 *
 * Guards routes by authentication and optional role requirement.
 * - Not authenticated → redirect to /login
 * - Role mismatch → render 403 message
 * - Otherwise → render <Outlet />
 */

import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ShieldX } from "lucide-react";

/**
 * @param {{ roles?: string[] }} props
 * Pass `roles` to restrict access to specific roles (e.g. roles={["admin"]}).
 */
export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface text-text-secondary">
        <ShieldX className="h-16 w-16 text-red-400" />
        <h1 className="text-2xl font-bold text-text-primary">Access Denied</h1>
        <p className="text-sm">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
