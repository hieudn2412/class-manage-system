# ADR-004 — Link online được nhập tại check-in

- Trạng thái: Accepted
- Ngày: 2026-07-25
- Thay thế phần link online trong kế hoạch vertical slice cũ

Theo `DEC-046`, tạo lớp, ca lặp, preview và override lịch chỉ quản lý hình thức cùng
phòng. Các request DTO không có `onlineUrl`. Cột `class_sessions.online_link` vẫn nullable
để luồng check-in tương lai cho giáo viên bổ sung link. Các câu lệnh publish đặt cột này
`NULL`; override chỉ cập nhật `mode`, `room_id` và `version`, không được xóa hay thay link
đã có.
