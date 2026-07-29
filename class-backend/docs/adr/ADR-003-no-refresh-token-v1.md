# ADR-003 — Không có refresh token trong v1

- Trạng thái: Accepted
- Ngày: 2026-07-25

V1 phát access token JWT có TTL cấu hình và không lưu refresh token. Khi hết hạn người
dùng đăng nhập lại. `tokenVersion` được đưa vào claim để chuẩn bị cho cơ chế vô hiệu hóa
token khi khóa tài khoản/đổi mật khẩu ở slice sau. Quyết định này giữ phạm vi auth hiện
tại nhỏ, tránh bổ sung cookie/session lifecycle ngoài SRS.
