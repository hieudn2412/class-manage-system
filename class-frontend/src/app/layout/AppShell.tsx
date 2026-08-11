import { useState } from "react";
import {
  BookOpen,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  School,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { useTenant } from "../providers/TenantProvider";
import { hasPermission, PERMISSIONS, roleLabels } from "../../shared/lib/permissions";
import { Badge } from "../../shared/ui/Badge";
import { cn } from "../../shared/lib/cn";
import { NotificationBell } from "../../features/content/NotificationBell";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  to?: string;
  planned?: boolean;
}

export const AppShell = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, logout } = useAuth();
  const tenant = useTenant();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  if (!session) return null;
  const base = `/t/${tenantSlug ?? tenant.slug}/app`;
  const canDashboard = hasPermission(session.user.roles, PERMISSIONS.VIEW_MANAGEMENT_DASHBOARD);
  const canClasses = hasPermission(session.user.roles, PERMISSIONS.VIEW_CLASSES);
  const canManageSchedule = hasPermission(session.user.roles, PERMISSIONS.VIEW_MANAGEMENT_SCHEDULE);
  const canViewOwnSchedule = hasPermission(session.user.roles, PERMISSIONS.VIEW_OWN_SCHEDULE);
  const canViewOwnTeaching = hasPermission(session.user.roles, PERMISSIONS.VIEW_OWN_TEACHING);
  const canViewOwnLearning = hasPermission(session.user.roles, PERMISSIONS.VIEW_OWN_LEARNING);
  const canViewHomework = hasPermission(session.user.roles, PERMISSIONS.VIEW_HOMEWORK);
  const canSubmitHomework = hasPermission(session.user.roles, PERMISSIONS.SUBMIT_HOMEWORK);
  const canFinance = hasPermission(session.user.roles, PERMISSIONS.VIEW_FINANCE);
  const canViewSalary = hasPermission(session.user.roles, PERMISSIONS.VIEW_SALARY);
  const canViewOwnSalary = hasPermission(session.user.roles, PERMISSIONS.VIEW_OWN_SALARY);
  const canAccounts = hasPermission(session.user.roles, PERMISSIONS.MANAGE_TENANT_ACCOUNTS) || hasPermission(session.user.roles, PERMISSIONS.MANAGE_LEARNING_ACCOUNTS);
  const canManageTenantEmail = hasPermission(session.user.roles, PERMISSIONS.MANAGE_TENANT_EMAIL);
  const isPlatform = hasPermission(session.user.roles, PERMISSIONS.VIEW_PLATFORM_TENANTS);

  const navItems: NavItem[] = [
    ...(canDashboard
      ? [{ label: "Dashboard trung tâm", icon: LayoutDashboard, to: `${base}/dashboard` }]
      : []),
    ...(canClasses ? [{ label: "Danh sách lớp", icon: BookOpen, to: `${base}/classes` }] : []),
    ...(canManageSchedule
      ? [{ label: "Thời khóa biểu", icon: School, to: `${base}/schedule` }]
      : []),
    ...(canViewHomework
      ? [{ label: "BTVN", icon: ClipboardList, to: `${base}/homeworks` }]
      : []),
    ...(isPlatform ? [{ label: "Quản trị tenant", icon: ShieldCheck, planned: true }] : []),
    ...(canViewOwnSchedule
      ? [
          ...(canViewOwnTeaching
            ? [
                {
                  label: "Dashboard giáo viên",
                  icon: LayoutDashboard,
                  to: `${base}/teacher-dashboard`,
                },
              ]
            : []),
          { label: "Lịch dạy", icon: School, to: `${base}/teaching-schedule` },
          { label: "Lớp của tôi", icon: BookOpen, to: `${base}/my-classes` },
          ...(canViewOwnSalary
            ? [{ label: "Lương của tôi", icon: CircleDollarSign, to: `${base}/my-salary` }]
            : []),
        ]
      : []),
    ...(canViewOwnLearning
      ? [
          { label: "Lớp của tôi", icon: GraduationCap, to: `${base}/learning-classes` },
          ...(canSubmitHomework
            ? [{ label: "BTVN của tôi", icon: ClipboardList, to: `${base}/student-homeworks` }]
            : []),
        ]
      : []),
    ...(canAccounts
      ? [{ label: "Người dùng", icon: Users, to: `${base}/accounts` }]
      : []),
    ...(canManageTenantEmail
      ? [{ label: "Gmail thông báo", icon: Mail, to: `${base}/settings/email` }]
      : []),
    ...(canViewSalary
      ? [{ label: "Bảng lương", icon: CircleDollarSign, to: `${base}/finance/salaries` }]
      : canFinance
        ? [{ label: "Tài chính", icon: CircleDollarSign, planned: true }]
        : []),
  ];

  const handleLogout = () => {
    void navigate(`/t/${tenant.slug}/login`, {
      replace: true,
      state: null,
      flushSync: true,
    });
    logout();
  };

  const currentLabel =
    navItems.find((item) => item.to && location.pathname.startsWith(item.to))?.label ?? "Trang chủ";
  const primaryRole = session.user.roles[0];

  return (
    <div className="page-grid">
      <a href="#main-content" className="skip-link">
        Bỏ qua điều hướng
      </a>
      {menuOpen ? (
        <button
          className="mobile-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside className={cn("app-sidebar", menuOpen && "open")} aria-label="Điều hướng chính">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ▦
          </span>
          <span>
            <span className="brand-name">EDU OPS</span>
            <span className="brand-version">OPERATIONS / V1</span>
          </span>
          <button
            className="icon-button mobile-menu-button ml-auto"
            onClick={() => setMenuOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="tenant-chip">
          <span>Tenant đang làm việc</span>
          <strong>{tenant.name}</strong>
        </div>
        <nav className="sidebar-nav">
          <p className="nav-section-label">Không gian làm việc</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            if (!item.to || item.planned) {
              return (
                <div className="nav-planned" key={item.label}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                  <Badge>Sắp tới</Badge>
                </div>
              );
            }
            return (
              <NavLink
                className={({ isActive }) => cn("nav-link", isActive && "active")}
                to={item.to}
                key={item.label}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">
            {session.user.displayName
              .split(" ")
              .slice(-2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
          <span>
            <strong>{session.user.displayName}</strong>
            <small>{primaryRole ? roleLabels[primaryRole] : "Chưa gán vai trò"}</small>
          </span>
          <button className="icon-button" onClick={handleLogout} aria-label="Đăng xuất">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </aside>
      <div className="app-column">
        <header className="app-topbar">
          <button
            className="icon-button mobile-menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Mở menu"
            aria-expanded={menuOpen}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <span>EDU OPS</span>
            <ChevronRight size={14} aria-hidden="true" />
            <span>{currentLabel}</span>
          </nav>
          <strong className="mobile-page-label">{currentLabel}</strong>
          <div className="topbar-actions">
            <NotificationBell tenantSlug={tenant.slug} base={base} />
          </div>
        </header>
        <main className="app-main" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
