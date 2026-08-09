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
  return <AuthLayout><section className="auth-card"><div className="tenant-label"><ShieldCheck size={16}/> Workspace nền tảng</div>
    <header className="auth-card-header"><p className="eyebrow">PLATFORM CONTROL</p><h1>Đăng nhập Super Admin</h1><p>Quản lý tenant và Admin ban đầu, tách biệt hoàn toàn khỏi dữ liệu nghiệp vụ.</p></header>
    <form className="auth-form" onSubmit={(event)=>void submit(event)}>{error && <div className="form-alert" role="alert">{error}</div>}
      <Input label="Tên đăng nhập" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" />
      <Input label="Mật khẩu" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
      <Button type="submit" loading={busy}>Đăng nhập nền tảng</Button></form>
    <footer className="auth-footer"><span>Local development</span><span>superadmin / 123456</span></footer>
  </section></AuthLayout>;
};
