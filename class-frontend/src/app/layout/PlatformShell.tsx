import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export const PlatformShell = () => {
  const {session,logout}=useAuth(); const navigate=useNavigate(); if(!session) return null;
  const signOut=()=>{logout(); void navigate("/platform/login",{replace:true});};
  return <div className="page-grid platform-grid"><aside className="app-sidebar"><div className="brand"><span className="brand-mark">▦</span><span><span className="brand-name">EDU OPS</span><span className="brand-version">PLATFORM</span></span></div>
    <div className="tenant-chip"><span>Phạm vi tài khoản</span><strong>Nền tảng · toàn hệ thống</strong></div><nav className="sidebar-nav"><p className="nav-section-label">Quản trị</p><NavLink className="nav-link active" to="/platform/app/tenants"><Building2 size={18}/> Trung tâm</NavLink></nav>
    <div className="sidebar-user"><span className="avatar"><ShieldCheck size={18}/></span><span><strong>{session.user.displayName}</strong><small>Super Admin</small></span><button className="icon-button" onClick={signOut} aria-label="Đăng xuất"><LogOut size={17}/></button></div></aside>
    <div className="app-column"><header className="app-topbar"><strong>Điều hành nền tảng</strong><span className="scope-pill">PLATFORM</span></header><main className="app-main"><Outlet/></main></div></div>;
};
