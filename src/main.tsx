import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy-loaded pages
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Applicant pages
const ApplicantDashboard = lazy(() => import("./pages/applicant/Dashboard.tsx"));
const ApplicantApplicationsPage = lazy(() => import("./pages/applicant/Applications.tsx"));
import { ApplicantApplicationDetail } from "./pages/applicant/Applications.tsx";
const ApprovalJourneyPage = lazy(() => import("./pages/applicant/Journey.tsx"));
const DocumentsPage = lazy(() => import("./pages/applicant/Documents.tsx"));
const CompliancePage = lazy(() => import("./pages/applicant/Compliance.tsx"));
const SchemesPage = lazy(() => import("./pages/applicant/Schemes.tsx"));
const NotificationsPage = lazy(() => import("./pages/applicant/NotificationsPage.tsx"));
const ActivityPage = lazy(() => import("./pages/applicant/Activity.tsx"));
const ProfilePage = lazy(() => import("./pages/applicant/Profile.tsx"));

// Department pages
const DepartmentDashboard = lazy(() => import("./pages/department/Dashboard.tsx"));
const DepartmentApplicationsPage = lazy(() => import("./pages/department/Applications.tsx"));
import { DepartmentApplicationReview } from "./pages/department/Applications.tsx";
const DepartmentQueriesPage = lazy(() => import("./pages/department/Queries.tsx"));
const DepartmentInspectionsPage = lazy(() => import("./pages/department/Inspections.tsx"));
const DepartmentSlaPage = lazy(() => import("./pages/department/Sla.tsx"));
const DepartmentRulesPage = lazy(() => import("./pages/department/Rules.tsx"));
const DepartmentReportsPage = lazy(() => import("./pages/department/Reports.tsx"));
const DepartmentAuditPage = lazy(() => import("./pages/department/Audit.tsx"));

// Admin pages
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard.tsx"));
const AdminRulesPage = lazy(() => import("./pages/admin/Rules.tsx"));
const AdminUsersPage = lazy(() => import("./pages/admin/Users.tsx"));
const AdminAuditPage = lazy(() => import("./pages/admin/Audit.tsx"));

// Layouts (imported synchronously — small files)
import { RequireRole } from "@/components/app/AppShell";
import { ApplicantShell, DepartmentShell, AdminShell } from "@/components/app/layouts";

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">{this.state.message}</p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage({ type: "iframe-route-change", path: location.pathname }, "*");
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

// Wrapper for lazy routes (Suspense boundary per route)
function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth/applicant" element={<AuthPage mode="applicant" />} />
              <Route path="/auth/applicant/signup" element={<AuthPage mode="applicant" initialView="signup" />} />
              <Route path="/auth/department" element={<AuthPage mode="department" />} />

              {/* Applicant routes */}
              <Route
                path="/applicant"
                element={
                  <RequireRole roles={["applicant"]}>
                    <ApplicantShell />
                  </RequireRole>
                }
              >
                <Route index element={<Navigate to="/applicant/dashboard" replace />} />
                <Route path="dashboard" element={<LazyRoute><ApplicantDashboard /></LazyRoute>} />
                <Route path="applications" element={<LazyRoute><ApplicantApplicationsPage /></LazyRoute>} />
                <Route path="applications/:applicationId" element={<LazyRoute><ApplicantApplicationDetail /></LazyRoute>} />
                <Route path="journey" element={<LazyRoute><ApprovalJourneyPage /></LazyRoute>} />
                <Route path="documents" element={<LazyRoute><DocumentsPage /></LazyRoute>} />
                <Route path="compliance" element={<LazyRoute><CompliancePage /></LazyRoute>} />
                <Route path="schemes" element={<LazyRoute><SchemesPage /></LazyRoute>} />
                <Route path="notifications" element={<LazyRoute><NotificationsPage /></LazyRoute>} />
                <Route path="activity" element={<LazyRoute><ActivityPage /></LazyRoute>} />
                <Route path="profile" element={<LazyRoute><ProfilePage /></LazyRoute>} />
              </Route>

              {/* Department routes */}
              <Route
                path="/department"
                element={
                  <RequireRole roles={["dept_officer", "dept_supervisor"]}>
                    <DepartmentShell />
                  </RequireRole>
                }
              >
                <Route index element={<Navigate to="/department/dashboard" replace />} />
                <Route path="dashboard" element={<LazyRoute><DepartmentDashboard /></LazyRoute>} />
                <Route path="applications" element={<LazyRoute><DepartmentApplicationsPage /></LazyRoute>} />
                <Route path="applications/:applicationId" element={<LazyRoute><DepartmentApplicationReview /></LazyRoute>} />
                <Route path="queries" element={<LazyRoute><DepartmentQueriesPage /></LazyRoute>} />
                <Route path="inspections" element={<LazyRoute><DepartmentInspectionsPage /></LazyRoute>} />
                <Route path="sla" element={<LazyRoute><DepartmentSlaPage /></LazyRoute>} />
                <Route path="rules" element={<LazyRoute><DepartmentRulesPage /></LazyRoute>} />
                <Route path="reports" element={<LazyRoute><DepartmentReportsPage /></LazyRoute>} />
                <Route path="audit" element={<LazyRoute><DepartmentAuditPage /></LazyRoute>} />
              </Route>

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <RequireRole roles={["admin"]}>
                    <AdminShell />
                  </RequireRole>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<LazyRoute><AdminDashboard /></LazyRoute>} />
                <Route path="rules" element={<LazyRoute><AdminRulesPage /></LazyRoute>} />
                <Route path="users" element={<LazyRoute><AdminUsersPage /></LazyRoute>} />
                <Route path="audit" element={<LazyRoute><AdminAuditPage /></LazyRoute>} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
