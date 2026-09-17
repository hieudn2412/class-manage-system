import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { ApiError } from "../../shared/types/api";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { AuthLayout } from "../auth/AuthLayout";

export const PlatformLoginPage = () => {
  const { platformLogin } = useAuth(); const navigate = useNavigate();
  const [username,setUsername]=useState("superadmin"); const [password,setPassword]=useState("123456");
  const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError("");
    try { await platformLogin(username,password,true); void navigate("/platform/app/tenants",{replace:true}); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Không thể đăng nhập nền tảng."); }
    finally { setBusy(false); }
  };
  return <AuthLayout><section className="auth-card"><div className="tenant-label"><ShieldCheck size={16}/> Khu vực quản trị hệ thống</div>
    <header className="auth-card-header"><p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p><h1>Đăng nhập quản trị hệ thống</h1><p>Quản lý các trung tâm và tài khoản quản trị ban đầu.</p></header>
    <form className="auth-form" onSubmit={(event)=>void submit(event)}>{error && <div className="form-alert" role="alert">{error}</div>}
      <Input label="Tên đăng nhập" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" />
      <Input label="Mật khẩu" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
      <Button type="submit" loading={busy}>Đăng nhập nền tảng</Button></form>
    <footer className="auth-footer"><span>Chỉ dành cho quản trị viên hệ thống</span><span>EDU OPS</span></footer>
  </section></AuthLayout>;
};
