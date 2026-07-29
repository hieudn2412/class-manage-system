# Class Backend

Backend Spring Boot 3.5/Java 17, hiện chỉ chạy trong môi trường development local, cho
vertical slice:

`auth tenant → lập lịch lớp → lịch GV → check-in → hồ sơ/điểm danh → tự hoàn tất → lương`

## Chạy local

Yêu cầu Java 17 và Docker. Dự án có Maven Wrapper ghim Maven `4.0.0-rc-4`,
không cần cài Maven toàn cục.

```powershell
docker compose up -d postgres
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

Để khởi tạo lại database development hoàn toàn bằng Flyway:

```powershell
docker compose down -v
docker compose up -d postgres
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

Lệnh `down -v` chỉ dùng khi chấp nhận xóa volume development
`class-backend_class-postgres-data`.

API mặc định: `http://localhost:8080/api/v1`. Swagger UI:
`http://localhost:8080/swagger-ui.html`. Health check:
`http://localhost:8080/actuator/health`.
PostgreSQL của Compose được publish tại `localhost:55433`; cổng này tránh xung đột với
PostgreSQL cài trực tiếp trên máy development hiện tại.

Dữ liệu profile `dev`:

| Tenant | Tài khoản | Vai trò | Mật khẩu |
|---|---|---|---|
| `anh-duong` | `admin.anhduong` | Admin | `Demo@123` |
| `anh-duong` | `hocvu.anhduong` | Học vụ | `Demo@123` |
| `anh-duong` | `ketoan.anhduong` | Kế toán | `Demo@123` |
| `anh-duong` | `gv.lan` | Giáo viên | `Demo@123` |
| `anh-duong` | `hs.minhanh` | Học sinh | `Demo@123` |
| `anh-duong` | `admin.ketoan` | Admin + Kế toán | `Demo@123` |
| `anh-duong` | `first.login` | Bắt đổi mật khẩu lần đầu | `Demo@123` |
| `anh-duong` | `locked.user` | Tài khoản khóa | `Demo@123` |
| `minh-tam` | `admin.minhtam` | Admin tenant khác | `Demo@123` |
| `khoa-son` | `admin.khoason` | Tenant khóa | `Demo@123` |

Các mật khẩu trên chỉ được tạo bởi initializer của profile `dev`.

Profile `prod` đang bị vô hiệu hóa có chủ đích và sẽ dừng ngay trong giai đoạn nạp cấu
hình nếu bị kích hoạt. Dự án hiện không có cấu hình deploy, Docker image ứng dụng hoặc
runtime production.

## Lệnh kiểm tra

```powershell
.\mvnw.cmd test
.\mvnw.cmd verify
```

Integration test dùng PostgreSQL 17 qua Testcontainers. Migration là nguồn schema duy
nhất; Hibernate không tự tạo hoặc sửa bảng.

## Quy tắc kiến trúc quan trọng

- Tenant lấy duy nhất từ JWT sau đăng nhập; `X-Tenant-Slug` không thể đổi tenant của request.
- Đăng nhập sai bị giới hạn theo tài khoản và IP; JWT cũ mất hiệu lực khi đổi mật khẩu.
- Phiên `MUST_CHANGE` chỉ được gọi endpoint đổi mật khẩu.
- Quên mật khẩu luôn trả thông điệp chung; local chỉ ghi nhận/outbox, chưa gửi email thật.
- Tất cả business table có `tenant_id`; các quan hệ nhạy cảm dùng foreign key ghép
  `(tenant_id, id)` để chặn tham chiếu chéo tenant ở database.
- Preview có TTL và input hash. Publish/override kiểm tra lại xung đột trong transaction.
- Publish dùng row lock, `Idempotency-Key` và transaction duy nhất cho class, session,
  enrollment, học phí, audit, notification và outbox.
- Khoảng lịch là nửa mở `[start, end)`; session `CANCELLED` không chiếm lịch.
- `online_link` được lưu nullable cho check-in tương lai nhưng không xuất hiện trong
  request tạo lớp/ca/override và không bị các API lập lịch cập nhật.
- Roster tính động trước completion và được snapshot khi completion; enrollment đổi sau
  đó không làm thay đổi lịch sử buổi.
- Scheduler và quản lý xác nhận dùng chung completion service có row lock; trạng thái,
  roster, lương, audit và outbox được ghi nguyên tử/idempotent.
- Lương tối thiểu của vertical slice dùng phút lịch × đơn giá hiệu lực và làm tròn 1 VND
  theo `HALF_UP`.

## Tài liệu kỹ thuật

- [OpenAPI](./docs/openapi.yaml)
- [Ma trận truy vết](./docs/TRACEABILITY.md)
- [ADR multi-tenancy](./docs/adr/ADR-001-multitenancy-jwt.md)
- [ADR concurrency/idempotency](./docs/adr/ADR-002-publish-concurrency-idempotency.md)
- [ADR refresh token](./docs/adr/ADR-003-no-refresh-token-v1.md)
- [ADR link online](./docs/adr/ADR-004-online-link-at-checkin.md)
