# Hệ thống quản lý dạy học

Workspace hiện được cấu hình chỉ dành cho development local. Profile/backend production,
frontend production build/preview và mọi cấu hình deploy đều bị vô hiệu hóa.

Workspace được tổ chức thành các phần độc lập:

- [`class-frontend/`](./class-frontend/) — ứng dụng React/Vite hiện có.
- [`class-backend/`](./class-backend/) — Spring Boot API, PostgreSQL/Flyway, auth,
  dashboard và vertical slice lập lịch.
- [`docs/`](./docs/) — SRS, decision log và registry các luồng nghiệp vụ.
- [`wireframes/`](./wireframes/) — prototype HTML và ảnh wireframe.

Quyết định nghiệp vụ mới nhất được áp dụng ở cả hai ứng dụng: URL buổi học online không
được nhập khi tạo lớp, tạo ca hoặc override lịch; giáo viên thực tế bổ sung link khi
check-in (`DEC-046`). Vertical slice vận hành giáo viên đã hỗ trợ dashboard, lớp của tôi,
lịch sử buổi, điểm danh/hồ sơ, điểm kiểm tra, tự hoàn tất, khóa roster và phát sinh lương
tối thiểu (`DEC-047`, `DEC-048`). FL-10 bổ sung BTVN, tài liệu private, upload staging,
quota tenant, ClamAV, notification/email outbox và backup filesystem (`DEC-054`–`DEC-057`).
FL-10.1 thay SMTP global bằng Gmail OAuth riêng từng tenant (`DEC-058`).

Frontend hiện gọi hoàn toàn API Spring Boot thật; MSW, mock service worker và dữ liệu mock
runtime đã được loại bỏ. Xem hướng dẫn chạy tại
[`class-backend/README.md`](./class-backend/README.md) và
[`class-frontend/README.md`](./class-frontend/README.md).

Backup production cho dữ liệu PostgreSQL và file private nằm tại
[`docs/operations/FL-10-backup-restore.md`](./docs/operations/FL-10-backup-restore.md).
