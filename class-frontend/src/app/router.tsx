import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { TenantProvider } from "./providers/TenantProvider";
import { RequireAnyPermission, RequireAuth, RequirePermission, RequireTenantScope } from "./guards";
import { PERMISSIONS } from "../shared/lib/permissions";
import { PageSkeleton } from "../shared/ui/Skeleton";
import { RouteErrorPage } from "./pages/RouteErrorPage";

const LoginPage = lazy(() =>
  import("../features/auth/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("../features/auth/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ChangePasswordPage = lazy(() =>
  import("../features/auth/ChangePasswordPage").then((module) => ({
    default: module.ChangePasswordPage,
  })),
);
const DashboardPage = lazy(() =>
  import("../features/dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const ClassListPage = lazy(() =>
  import("../features/classes/ClassListPage").then((module) => ({
    default: module.ClassListPage,
  })),
);
const ClassDetailPage = lazy(() =>
  import("../features/classes/ClassDetailPage").then((module) => ({
    default: module.ClassDetailPage,
  })),
);
const ClassWizardPage = lazy(() =>
  import("../features/classes/ClassWizardPage").then((module) => ({
    default: module.ClassWizardPage,
  })),
);
const ManagementSchedulePage = lazy(() =>
  import("../features/schedules/ManagementSchedulePage").then((module) => ({
    default: module.ManagementSchedulePage,
  })),
);
const TeacherSchedulePage = lazy(() =>
  import("../features/schedules/TeacherSchedulePage").then((module) => ({
    default: module.TeacherSchedulePage,
  })),
);
const TeacherDashboardPage = lazy(() =>
  import("../features/teaching/TeacherDashboardPage").then((module) => ({
    default: module.TeacherDashboardPage,
  })),
);
const MyClassesPage = lazy(() =>
  import("../features/teaching/MyClassesPage").then((module) => ({
    default: module.MyClassesPage,
  })),
);
const MyClassSessionsPage = lazy(() =>
  import("../features/teaching/MyClassSessionsPage").then((module) => ({
    default: module.MyClassSessionsPage,
  })),
);
const SessionOperationsPage = lazy(() =>
  import("../features/teaching/SessionOperationsPage").then((module) => ({
    default: module.SessionOperationsPage,
  })),
);
const RoleLandingPage = lazy(() =>
  import("./pages/RoleLandingPage").then((module) => ({
    default: module.RoleLandingPage,
  })),
);
const ForbiddenPage = lazy(() =>
  import("./pages/ForbiddenPage").then((module) => ({ default: module.ForbiddenPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);

const withSuspense = (content: ReactNode) => (
  <Suspense fallback={<PageSkeleton />}>{content}</Suspense>
);

const TenantRoot = () => (
  <TenantProvider>
    <Outlet />
  </TenantProvider>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/t/anh-duong/login" replace />,
  },
  {
    path: "/t/:tenantSlug",
    element: <TenantRoot />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "login", element: withSuspense(<LoginPage />) },
      { path: "forgot-password", element: withSuspense(<ForgotPasswordPage />) },
      { path: "change-password", element: withSuspense(<ChangePasswordPage />) },
      { path: "403", element: withSuspense(<ForbiddenPage />) },
      {
        path: "app",
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: withSuspense(<RoleLandingPage />) },
          {
            path: "dashboard",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_MANAGEMENT_DASHBOARD}>
                  {withSuspense(<DashboardPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "classes",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_CLASSES}>
                  {withSuspense(<ClassListPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "classes/new",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.MANAGE_CLASSES}>
                  {withSuspense(<ClassWizardPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "classes/:classId/edit",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.MANAGE_CLASSES}>
                  {withSuspense(<ClassWizardPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "classes/:classId",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_CLASSES}>
                  {withSuspense(<ClassDetailPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "schedule",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_MANAGEMENT_SCHEDULE}>
                  {withSuspense(<ManagementSchedulePage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "teaching-schedule",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_OWN_SCHEDULE}>
                  {withSuspense(<TeacherSchedulePage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "teacher-dashboard",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_OWN_TEACHING}>
                  {withSuspense(<TeacherDashboardPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "my-classes",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_OWN_TEACHING}>
                  {withSuspense(<MyClassesPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "my-classes/:classId",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_OWN_TEACHING}>
                  {withSuspense(<MyClassSessionsPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "sessions/:sessionId",
            element: (
              <RequireTenantScope>
                <RequireAnyPermission
                  permissions={[
                    PERMISSIONS.VIEW_OWN_TEACHING,
                    PERMISSIONS.MANAGE_SESSION_VERIFICATION,
                  ]}
                >
                  {withSuspense(<SessionOperationsPage />)}
                </RequireAnyPermission>
              </RequireTenantScope>
            ),
          },
        ],
      },
      { path: "*", element: withSuspense(<NotFoundPage />) },
    ],
  },
  { path: "*", element: withSuspense(<NotFoundPage />) },
]);
