import type { PropsWithChildren } from "react";

export const AuthLayout = ({ children }: PropsWithChildren) => (
  <div className="auth-page">
    <aside className="auth-aside">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <img src="/edu-ops-logo.png" alt="" />
        </span>
        <span>
          <span className="brand-name">EDU OPS</span>
          <span className="brand-version">QUẢN LÝ GIẢNG DẠY</span>
        </span>
      </div>
      <div className="auth-statement">
        <p className="eyebrow auth-eyebrow">Vận hành dạy học liền mạch</p>
        <p className="display-title">Mỗi buổi học đều có dấu vết.</p>
        <p>Từ lớp học, hồ sơ buổi đến đối soát — đúng người, đúng tenant, đúng thời điểm.</p>
      </div>
      <p className="auth-meta">Tiếng Việt · VND · Asia/Ho_Chi_Minh</p>
    </aside>
    <main className="auth-main">{children}</main>
  </div>
);
