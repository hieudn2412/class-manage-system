# ADR-001 — Tenant context từ JWT và shared schema

- Trạng thái: Accepted
- Ngày: 2026-07-25

## Quyết định

V1 dùng một PostgreSQL shared schema. Mọi business row có `tenant_id`; repository luôn
lọc bằng tenant từ JWT. Foreign key quan trọng tham chiếu `(tenant_id, id)`. Header
`X-Tenant-Slug` chỉ là tương thích tạm thời cho login và bị bỏ qua sau xác thực.

## Hệ quả

Không thể dùng header/query để truy cập tenant khác. Việc quên predicate trong một query
vẫn được giảm rủi ro bởi foreign key tenant-aware, test isolation và service không nhận
tenant ID từ request. Super Admin không tự do truy cập business API của tenant.
