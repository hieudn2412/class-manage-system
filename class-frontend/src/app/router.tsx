import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { PlatformShell } from "./layout/PlatformShell";
import { TenantProvider } from "./providers/TenantProvider";
import { RequireAnyPermission, RequireAuth, RequirePermission, RequirePlatformScope, RequireTenantScope } from "./guards";
import { PERMISSIONS } from "../shared/lib/permissions";
import { PageSkeleton } from "../shared/ui/Skeleton";
import { RouteErrorPage } from "./pages/RouteErrorPage";

const LoginPage = lazy(() =>
  import("../features/auth/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const TenantLoginGatewayPage = lazy(() =>
  import("../features/auth/TenantLoginGatewayPage").then((module) => ({
    default: module.TenantLoginGatewayPage,
  })),
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
const MyLearningClassesPage = lazy(() =>
  import("../features/classes/MyLearningClassesPage").then((module) => ({
    default: module.MyLearningClassesPage,
  })),
);
const StudentClassDetailPage = lazy(() =>
  import("../features/classes/StudentClassDetailPage").then((module) => ({
    default: module.StudentClassDetailPage,
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
const PlatformLoginPage = lazy(() => import("../features/platform/PlatformLoginPage").then(m=>({default:m.PlatformLoginPage})));
const PlatformTenantListPage = lazy(() => import("../features/platform/PlatformTenantListPage").then(m=>({default:m.PlatformTenantListPage})));
const PlatformQuotaPage = lazy(() => import("../features/platform/PlatformQuotaPage").then(m=>({default:m.PlatformQuotaPage})));
const AccountListPage = lazy(() => import("../features/accounts/AccountListPage").then(m=>({default:m.AccountListPage})));
const AccountFormPage = lazy(() => import("../features/accounts/AccountFormPage").then(m=>({default:m.AccountFormPage})));
const SalaryPayrollPage = lazy(() => import("../features/salary/SalaryPayrollPage").then(m=>({default:m.SalaryPayrollPage})));
const SalaryTeacherDetailPage = lazy(() => import("../features/salary/SalaryTeacherDetailPage").then(m=>({default:m.SalaryTeacherDetailPage})));
const MySalaryPage = lazy(() => import("../features/salary/MySalaryPage").then(m=>({default:m.MySalaryPage})));
const HomeworkWorkspacePage = lazy(() => import("../features/content/HomeworkWorkspacePage").then(m=>({default:m.HomeworkWorkspacePage})));
const HomeworkDetailPage = lazy(() => import("../features/content/HomeworkDetailPage").then(m=>({default:m.HomeworkDetailPage})));
const StudentHomeworksPage = lazy(() => import("../features/content/StudentHomeworksPage").then(m=>({default:m.StudentHomeworksPage})));
const NotificationsPage = lazy(() => import("../features/content/NotificationsPage").then(m=>({default:m.NotificationsPage})));
const TenantEmailSettingsPage = lazy(() => import("../features/content/TenantEmailSettingsPage").then(m=>({default:m.TenantEmailSettingsPage})));

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
    element: withSuspense(<TenantLoginGatewayPage />),
  },
  { path: "/platform/login", element: withSuspense(<PlatformLoginPage />) },
  { path: "/platform/403", element: withSuspense(<ForbiddenPage />) },
  { path: "/platform/app", element: <RequireAuth><RequirePlatformScope><PlatformShell /></RequirePlatformScope></RequireAuth>, children: [
    { index: true, element: <Navigate to="tenants" replace /> },
    { path: "tenants", element: withSuspense(<PlatformTenantListPage />) },
    { path: "quotas", element: withSuspense(<PlatformQuotaPage />) },
  ]},
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
            path: "learning-classes",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_OWN_LEARNING}>
                  {withSuspense(<MyLearningClassesPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "learning-classes/:classId",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_OWN_LEARNING}>
                  {withSuspense(<StudentClassDetailPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "student-homeworks",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.SUBMIT_HOMEWORK}>
                  {withSuspense(<StudentHomeworksPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "student-homeworks/:homeworkId",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.SUBMIT_HOMEWORK}>
                  {withSuspense(<HomeworkDetailPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "homeworks",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_HOMEWORK}>
                  {withSuspense(<HomeworkWorkspacePage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "homeworks/:homeworkId",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_HOMEWORK}>
                  {withSuspense(<HomeworkDetailPage />)}
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
            path: "accounts",
            element: <RequireTenantScope><RequireAnyPermission permissions={[PERMISSIONS.MANAGE_TENANT_ACCOUNTS,PERMISSIONS.MANAGE_LEARNING_ACCOUNTS]}>{withSuspense(<AccountListPage />)}</RequireAnyPermission></RequireTenantScope>,
          },
          {
            path: "accounts/new",
            element: <RequireTenantScope><RequireAnyPermission permissions={[PERMISSIONS.MANAGE_TENANT_ACCOUNTS,PERMISSIONS.MANAGE_LEARNING_ACCOUNTS]}>{withSuspense(<AccountFormPage />)}</RequireAnyPermission></RequireTenantScope>,
          },
          {
            path: "accounts/:accountId",
            element: <RequireTenantScope><RequireAnyPermission permissions={[PERMISSIONS.MANAGE_TENANT_ACCOUNTS,PERMISSIONS.MANAGE_LEARNING_ACCOUNTS]}>{withSuspense(<AccountFormPage />)}</RequireAnyPermission></RequireTenantScope>,
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
          {
            path: "finance/salaries",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_SALARY}>
                  {withSuspense(<SalaryPayrollPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "finance/salaries/:teacherId",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_SALARY}>
                  {withSuspense(<SalaryTeacherDetailPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "my-salary",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_OWN_SALARY}>
                  {withSuspense(<MySalaryPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "notifications",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.VIEW_NOTIFICATIONS}>
                  {withSuspense(<NotificationsPage />)}
                </RequirePermission>
              </RequireTenantScope>
            ),
          },
          {
            path: "settings/email",
            element: (
              <RequireTenantScope>
                <RequirePermission permission={PERMISSIONS.MANAGE_TENANT_EMAIL}>
                  {withSuspense(<TenantEmailSettingsPage />)}
                </RequirePermission>
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
