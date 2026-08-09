import { useState, type FormEvent } from "react";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { AuthLayout } from "./AuthLayout";

export const TenantLoginGatewayPage = () => {
  const [slug, setSlug] = useState("");
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = slug.trim().toLowerCase();
    if (normalized) void navigate(`/t/${encodeURIComponent(normalized)}/login`);
  };

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="tenant-gateway-title">
        <div className="tenant-label">
          <Building2 size={15} aria-hidden="true" />
          Workspace trung tâm
        </div>
        <header className="auth-card-header">
          <p className="eyebrow">TENANT ACCESS</p>
          <h1 id="tenant-gateway-title">Đăng nhập trung tâm</h1>
          <p>Nhập slug do Super Admin cấp để mở đúng không gian đăng nhập của trung tâm.</p>
        </header>
        <form className="auth-form" onSubmit={submit}>
          <Input
            label="Slug trung tâm"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            placeholder="Ví dụ: anh-duong"
            autoComplete="organization"
            hint="URL đăng nhập sẽ có dạng /t/slug-trung-tam/login"
          />
          <Button type="submit" disabled={!slug.trim()}>
            Tiếp tục đăng nhập
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </form>
        <div className="auth-scope-switch">
          <span>Chưa có trung tâm hoặc cần quản trị nền tảng?</span>
          <Link to="/platform/login">
            <ShieldCheck size={16} aria-hidden="true" />
            Đăng nhập Super Admin
          </Link>
        </div>
      </section>
    </AuthLayout>
  );
};
