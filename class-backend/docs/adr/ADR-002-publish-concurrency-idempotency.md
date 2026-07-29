# ADR-002 — Publish với row lock, recheck và idempotency

- Trạng thái: Accepted
- Ngày: 2026-07-25

## Quyết định

Preview chỉ hỗ trợ quyết định giao diện, không phải quyền giữ lịch. Publish khóa row Class
`FOR UPDATE`, kiểm tra TTL/hash preview, sinh và kiểm tra xung đột lại trên dữ liệu hiện
tại rồi ghi Class, Session, Enrollment, Tuition, Audit, Notification và Outbox trong một
transaction. Mọi publish/override yêu cầu `Idempotency-Key`.

Cùng key và cùng payload trả response đã lưu; cùng key nhưng payload khác trả
`IDEMPOTENCY_CONFLICT`. Version session bảo vệ override song song.

## Hệ quả

Không có publish dở dang hoặc nhân đôi học phí. Hai publish vào cùng một Draft được tuần
tự hóa. Preview có thể stale và client phải chạy lại khi nhận HTTP 409.
