import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CircleCheckBig,
  HandCoins,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";

const highlights = [
  {
    icon: CalendarDays,
    title: "Lịch học rõ ràng",
    description: "Theo dõi lịch tuần, lớp học và phòng học trong một nơi.",
  },
  {
    icon: CircleCheckBig,
    title: "Xác nhận buổi dạy nhanh",
    description: "Giáo viên cập nhật buổi học, học vụ kiểm tra dễ hơn.",
  },
  {
    icon: HandCoins,
    title: "Đối soát thuận tiện",
    description: "Bảng lương, thanh toán và thông báo được gom lại gọn gàng.",
  },
];

export const TenantLoginGatewayPage = () => {
  const [slug, setSlug] = useState("");
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = slug.trim().toLowerCase();
    if (normalized) void navigate(`/t/${encodeURIComponent(normalized)}/login`);
  };

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Điều hướng trang giới thiệu">
        <Link className="landing-brand" to="/" aria-label="EDU OPS">
          <span className="brand-mark" aria-hidden="true">
            <img src="/edu-ops-logo.png" alt="" />
          </span>
          <span>
            <strong>EDU OPS</strong>
            <small>QUẢN LÝ GIẢNG DẠY</small>
          </span>
        </Link>
        <div>
          <Link to="/about">Giới thiệu</Link>
          <Link to="/privacy">Quyền riêng tư</Link>
          <Link to="/terms">Điều khoản</Link>
          <Link className="landing-platform-link" to="/platform/login">
            <ShieldCheck size={16} aria-hidden="true" />
            Quản trị hệ thống
          </Link>
        </div>
      </nav>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow">CỔNG TRUY CẬP EDU OPS</p>
          <h1 id="landing-title">Quản lý lớp học dễ dàng hơn.</h1>
          <p>
            Theo dõi lịch học, xác nhận buổi dạy và đối soát lương trên cùng một hệ thống dành cho
            trung tâm đào tạo tại Việt Nam.
          </p>
          <div className="landing-highlight-grid" aria-label="Các tiện ích nổi bật">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title}>
                  <Icon size={20} aria-hidden="true" />
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </article>
              );
            })}
          </div>
        </div>

        <section className="landing-access-card" aria-labelledby="tenant-gateway-title">
          <div className="tenant-label">
            <Building2 size={15} aria-hidden="true" />
            Đăng nhập trung tâm
          </div>
          <header className="auth-card-header">
            <p className="eyebrow">CHỌN TRUNG TÂM</p>
            <h2 id="tenant-gateway-title">Mở trang đăng nhập của bạn</h2>
            <p>Nhập mã đường dẫn được cấp để tiếp tục vào hệ thống của trung tâm.</p>
          </header>
          <form className="auth-form" onSubmit={submit}>
            <Input
              label="Mã đường dẫn trung tâm"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              placeholder="Ví dụ: danxi"
              autoComplete="organization"
              hint="Bạn có thể hỏi quản trị viên trung tâm nếu chưa biết mã này."
            />
            <Button type="submit" disabled={!slug.trim()}>
              Tiếp tục đăng nhập
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </form>
          <div className="auth-scope-switch">
            <span>Bạn là quản trị viên hệ thống?</span>
            <Link to="/platform/login">
              <ShieldCheck size={16} aria-hidden="true" />
              Đăng nhập quản trị hệ thống
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
};
