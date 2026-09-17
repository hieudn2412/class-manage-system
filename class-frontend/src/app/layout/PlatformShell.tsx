import { useEffect, useState } from "react";
import {
  Building2,
  DatabaseZap,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../shared/lib/cn";
import { useAuth } from "../providers/AuthProvider";

export const PlatformShell = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  if (!session) return null;
  const currentLabel = location.pathname.includes("quotas")
    ? "Hạn mức dung lượng"
    : "Trung tâm";
  const signOut = () => {
    logout();
    void navigate("/platform/login", { replace: true });
  };

  return (
    <div className="page-grid platform-grid">
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
            <img src="/edu-ops-logo.png" alt="" />
          </span>
          <span>
            <span className="brand-name">EDU OPS</span>
            <span className="brand-version">QUẢN TRỊ HỆ THỐNG</span>
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
          <span>Quyền truy cập</span>
          <strong>Toàn hệ thống</strong>
        </div>
        <nav className="sidebar-nav">
          <p className="nav-section-label">Quản trị</p>
          <NavLink
            className="nav-link"
            to="/platform/app/tenants"
            onClick={() => setMenuOpen(false)}
          >
            <Building2 size={18} aria-hidden="true" />
            Trung tâm
          </NavLink>
          <NavLink
            className="nav-link"
            to="/platform/app/quotas"
            onClick={() => setMenuOpen(false)}
          >
            <DatabaseZap size={18} aria-hidden="true" />
            Hạn mức dung lượng
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <span className="avatar" aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
          <span>
            <strong>{session.user.displayName}</strong>
            <small>Quản trị viên hệ thống</small>
          </span>
          <button className="icon-button" onClick={signOut} aria-label="Đăng xuất">
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
          <strong className="platform-desktop-title">Quản trị hệ thống</strong>
          <strong className="mobile-page-label">{currentLabel}</strong>
          <span className="scope-pill">TOÀN HỆ THỐNG</span>
        </header>
        <main className="app-main" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
