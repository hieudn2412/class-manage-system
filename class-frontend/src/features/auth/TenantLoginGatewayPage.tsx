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
          Cổng đăng nhập trung tâm
        </div>
        <header className="auth-card-header">
          <p className="eyebrow">CHỌN TRUNG TÂM</p>
          <h1 id="tenant-gateway-title">Đăng nhập trung tâm</h1>
          <p>Nhập mã đường dẫn được cấp để mở trang đăng nhập của trung tâm bạn.</p>
        </header>
        <form className="auth-form" onSubmit={submit}>
          <Input
            label="Mã đường dẫn trung tâm"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            placeholder="Ví dụ: anh-duong"
            autoComplete="organization"
            hint="Bạn có thể hỏi quản trị viên trung tâm nếu chưa biết mã này."
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
            Đăng nhập quản trị hệ thống
          </Link>
        </div>
      </section>
    </AuthLayout>
  );
};
