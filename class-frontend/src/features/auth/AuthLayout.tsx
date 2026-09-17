import { CalendarDays, CircleCheckBig, HandCoins } from "lucide-react";
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
        <p className="display-title">Quản lý lớp học dễ dàng hơn.</p>
        <p className="auth-description">
          Theo dõi lịch học, xác nhận buổi dạy và đối soát trên cùng một hệ thống.
        </p>
        <ul className="auth-benefits" aria-label="Các tiện ích nổi bật">
          <li>
            <CalendarDays size={19} aria-hidden="true" />
            Lịch học rõ ràng
          </li>
          <li>
            <CircleCheckBig size={19} aria-hidden="true" />
            Xác nhận buổi dạy nhanh
          </li>
          <li>
            <HandCoins size={19} aria-hidden="true" />
            Đối soát thuận tiện
          </li>
        </ul>
      </div>
      <p className="auth-meta">Dành cho trung tâm đào tạo tại Việt Nam</p>
    </aside>
    <main className="auth-main">{children}</main>
  </div>
);
