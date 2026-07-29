# EDU OPS — React frontend dùng Spring Boot API

Frontend React chạy ở môi trường development local cho “Hệ thống quản lý dạy học SaaS”,
được triển khai từ SRS, decision log, workflow và wireframe có sẵn trong workspace. Ứng dụng chỉ dùng API thật tại
`class-backend`; không còn MSW hoặc mock runtime.

## Phạm vi đã triển khai

| Màn hình | Requirement            | Workflow            | Chức năng                                                             |
| -------- | ---------------------- | ------------------- | --------------------------------------------------------------------- |
| WF-01    | FR-IAM-003–006         | FL-01, FL-02, FL-04 | Đăng nhập, khóa tài khoản/tenant, quên mật khẩu, bắt đổi mật khẩu tạm |
| WF-03    | FR-RPT-001, FR-NTF     | FL-08, FL-14        | KPI vận hành, buổi thiếu hồ sơ, việc cần xử lý, trạng thái lớp        |
| WF-04    | FR-CLS-007, FR-RPT-006 | FL-05, FL-06        | Tìm kiếm, lọc, sắp xếp, phân trang danh sách lớp                      |
| WF-05    | FR-CLS-001–006         | FL-05               | Draft, nhiều ca, preview xung đột/ngày nghỉ và công bố                |
| WF-06    | FR-CLS-008–012         | FL-06, FL-14        | Chi tiết lớp chỉ đọc, tiến độ, vận hành và hồ sơ buổi                 |
| WF-07    | FR-CLS, FR-SES         | FL-05, FL-07        | Lịch toàn trung tâm và override hình thức/phòng một buổi              |
| WF-18    | FR-SES                 | FL-07               | Lịch dạy cá nhân giáo viên                                            |
| WF-17    | FR-SES-005, FR-RPT-005 | FL-08               | Dashboard giáo viên, buổi hôm nay và CTA check-in                     |
| WF-19/26 | FR-CLS-013–014         | FL-09               | Lớp của tôi, tìm/lọc và lịch sử buổi theo phạm vi                     |
| WF-20/27 | FR-SES-005–017         | FL-08, FL-09        | Check-in, điểm danh, lesson/record, nhận xét và điểm kiểm tra         |

Các module BTVN đầy đủ, tài liệu, trang lương, người dùng, học sinh và Super Admin vẫn
được đánh dấu “Sắp tới” vì chưa có React page trong phạm vi hiện tại.

## Chạy dự án

Yêu cầu Node.js 22 trở lên và backend đang chạy tại `http://localhost:8080`.

```bash
npm install
copy .env.example .env
npm run dev
```

Mở `http://localhost:4173`. Root tự chuyển tới tenant development:
`/t/anh-duong/login`.

Các lệnh kiểm tra:

```bash
npm run lint
npm run typecheck
npm run test
# PostgreSQL và Spring Boot phải đang chạy trước lệnh E2E
npm run test:e2e
```

Production build/preview đang bị vô hiệu hóa có chủ đích. `npm run build` sẽ dừng với
thông báo hướng dẫn dùng `npm run dev`.

## Tài khoản development

Mật khẩu chung: `Demo@123`.

| Tenant      | Tên đăng nhập     | Vai trò / trường hợp                      |
| ----------- | ----------------- | ----------------------------------------- |
| `anh-duong` | `admin.anhduong`  | Admin trung tâm                           |
| `anh-duong` | `hocvu.anhduong`  | Quản lý học vụ                            |
| `anh-duong` | `ketoan.anhduong` | Kế toán                                   |
| `anh-duong` | `gv.lan`          | Giáo viên                                 |
| `anh-duong` | `hs.minhanh`      | Học sinh                                  |
| `anh-duong` | `admin.ketoan`    | Nhiều vai trò, cộng quyền Admin + Kế toán |
| `anh-duong` | `first.login`     | Bắt buộc đổi mật khẩu lần đầu             |
| `anh-duong` | `locked.user`     | Tài khoản bị khóa                         |
| `minh-tam`  | `admin.minhtam`   | Admin tenant B, dùng kiểm tra cách ly     |
| `khoa-son`  | `admin.khoason`   | Tenant bị khóa                            |

Tài khoản và mật khẩu trên chỉ dùng trong development. Không có role switcher production.

## Kiến trúc

```text
src/
├── app/                    # Router, provider, guard, app shell
├── features/               # auth, dashboard, classes, schedules, teaching
├── services/
│   ├── api/                # HTTP client duy nhất
│   └── repositories/       # Contract tới Spring Boot
├── shared/                 # Types, permissions, formatter, UI components
└── test/                   # Test fixture và render helpers; không tham gia runtime
```

Component không gọi `fetch` trực tiếp. Mọi request đi qua repository và `apiRequest`.

Biến môi trường:

- `VITE_API_BASE_URL`: mặc định `http://localhost:8080/api/v1`.

Tenant được xác định bằng `/t/:tenantSlug/...` trước đăng nhập. Sau đăng nhập, backend chỉ
tin `tenantId` trong JWT. API trả RFC 7807 gồm `code`, `message`, `fieldErrors`, `traceId`
và `retryAfterSeconds` khi bị giới hạn đăng nhập. Phản hồi 401 tự xóa phiên frontend.

## Accessibility và responsive

- Semantic heading, table, form label, status/alert và breadcrumb.
- Focus ring rõ, skip link, thao tác bàn phím và touch target tối thiểu 44px.
- Màu trạng thái luôn đi cùng nhãn chữ.
- Desktop tối ưu ở 1440px; sidebar chuyển thành drawer trên mobile 390px.
- Bảng là vùng duy nhất được phép cuộn ngang trên màn hình hẹp.

## Hợp đồng backend

- OpenAPI 3.1 nằm tại `../class-backend/docs/openapi.yaml`.
- Phân trang backend là 1-based và trả `items`, `page`, `pageSize`, `totalItems`,
  `totalPages`.
- Backend trả 401 cho phiên hết hạn, 403 cho thiếu quyền hoặc sai object scope, 423 cho
  tài khoản/tenant bị khóa.
- Thao tác thêm học sinh vào lớp chỉ thuộc Quản lý; giáo viên chỉ chọn học sinh tham gia
  buổi học theo quyết định hiện hành.
