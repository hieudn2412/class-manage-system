import { Building2, DatabaseZap, LogOut, ShieldCheck } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export const PlatformShell = () => {
  const {session,logout}=useAuth(); const navigate=useNavigate(); if(!session) return null;
  const signOut=()=>{logout(); void navigate("/platform/login",{replace:true});};
  return <div className="page-grid platform-grid"><aside className="app-sidebar"><div className="brand"><span className="brand-mark" aria-hidden="true"><img src="/edu-ops-logo.png" alt="" /></span><span><span className="brand-name">EDU OPS</span><span className="brand-version">QUẢN TRỊ HỆ THỐNG</span></span></div>
    <div className="tenant-chip"><span>Quyền truy cập</span><strong>Toàn hệ thống</strong></div><nav className="sidebar-nav"><p className="nav-section-label">Quản trị</p><NavLink className="nav-link" to="/platform/app/tenants"><Building2 size={18}/> Trung tâm</NavLink><NavLink className="nav-link" to="/platform/app/quotas"><DatabaseZap size={18}/> Hạn mức dung lượng</NavLink></nav>
    <div className="sidebar-user"><span className="avatar"><ShieldCheck size={18}/></span><span><strong>{session.user.displayName}</strong><small>Quản trị viên hệ thống</small></span><button className="icon-button" onClick={signOut} aria-label="Đăng xuất"><LogOut size={17}/></button></div></aside>
    <div className="app-column"><header className="app-topbar"><strong>Quản trị hệ thống</strong><span className="scope-pill">TOÀN HỆ THỐNG</span></header><main className="app-main"><Outlet/></main></div></div>;
};
