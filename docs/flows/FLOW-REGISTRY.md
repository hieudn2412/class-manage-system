# Flow registry — Hệ thống quản lý dạy học SaaS

**Phiên bản:** 1.2-draft  
**Ngày:** 25/07/2026

Mỗi flow có một nguồn Mermaid (`sources/*.mmd`) và hai bản render (`rendered/svg`, `rendered/png`). Nguồn là bản chính; ảnh phải được tạo lại khi nguồn thay đổi.

| ID | Tên luồng | Nguồn | SVG | PNG | Yêu cầu chính | Màn hình |
|---|---|---|---|---|---|---|
| FL-01 | System context và ranh giới tenant | [MMD](sources/FL-01-system-context.mmd) | [SVG](rendered/svg/FL-01-system-context.svg) | [PNG](rendered/png/FL-01-system-context.png) | FR-TEN, NFR-SEC | WF-01–WF-27 |
| FL-02 | Use case và RBAC | [MMD](sources/FL-02-rbac-use-cases.mmd) | [SVG](rendered/svg/FL-02-rbac-use-cases.svg) | [PNG](rendered/png/FL-02-rbac-use-cases.png) | FR-IAM, FR-PPL, FR-CLS-013 | WF-01, WF-02, WF-09, WF-10, WF-19, WF-26, WF-27 |
| FL-03 | Mô hình miền khái niệm | [MMD](sources/FL-03-conceptual-domain.mmd) | [SVG](rendered/svg/FL-03-conceptual-domain.svg) | [PNG](rendered/png/FL-03-conceptual-domain.png) | Toàn bộ thực thể | WF-03–WF-27 |
| FL-04 | Tenant và vòng đời tài khoản | [MMD](sources/FL-04-account-lifecycle.mmd) | [SVG](rendered/svg/FL-04-account-lifecycle.svg) | [PNG](rendered/png/FL-04-account-lifecycle.png) | FR-TEN, FR-IAM | WF-01, WF-02, WF-09, WF-10 |
| FL-05 | Tạo lớp và sinh lịch | [MMD](sources/FL-05-class-schedule-generation.mmd) | [SVG](rendered/svg/FL-05-class-schedule-generation.svg) | [PNG](rendered/png/FL-05-class-schedule-generation.png) | FR-CLS-001–007 | WF-04, WF-05, WF-07, WF-11 |
| FL-06 | Vòng đời lớp và enrollment | [MMD](sources/FL-06-class-enrollment-lifecycle.mmd) | [SVG](rendered/svg/FL-06-class-enrollment-lifecycle.svg) | [PNG](rendered/png/FL-06-class-enrollment-lifecycle.png) | FR-CLS-008–014, FR-ENR | WF-06, WF-10, WF-19, WF-24, WF-26 |
| FL-07 | Dạy thay, hủy và dạy bù | [MMD](sources/FL-07-substitution-cancel-makeup.mmd) | [SVG](rendered/svg/FL-07-substitution-cancel-makeup.svg) | [PNG](rendered/png/FL-07-substitution-cancel-makeup.png) | FR-SES-001–004, FR-PAY-009 | WF-07, WF-08, WF-18 |
| FL-08 | Check-in và tự hoàn tất | [MMD](sources/FL-08-checkin-auto-completion.mmd) | [SVG](rendered/svg/FL-08-checkin-auto-completion.svg) | [PNG](rendered/png/FL-08-checkin-auto-completion.png) | FR-SES-005–008, FR-PAY-002 | WF-08, WF-17, WF-20 |
| FL-09 | Lớp giáo viên, lịch sử buổi và hồ sơ học sinh | [MMD](sources/FL-09-attendance-session-record.mmd) | [SVG](rendered/svg/FL-09-attendance-session-record.svg) | [PNG](rendered/png/FL-09-attendance-session-record.png) | FR-CLS-013–014, FR-SES-009–017 | WF-19, WF-20, WF-26, WF-27 |
| FL-10 | BTVN, tài liệu và quyền truy cập | [MMD](sources/FL-10-homework-materials.mmd) | [SVG](rendered/svg/FL-10-homework-materials.svg) | [PNG](rendered/png/FL-10-homework-materials.png) | FR-HW, FR-MAT, FR-SES-015–016 | WF-21, WF-24, WF-25, WF-26, WF-27 |
| FL-11 | Học phí và hoàn tiền | [MMD](sources/FL-11-tuition-refund.mmd) | [SVG](rendered/svg/FL-11-tuition-refund.svg) | [PNG](rendered/png/FL-11-tuition-refund.png) | FR-ENR-003–005, FR-FIN | WF-06, WF-13, WF-14 |
| FL-12 | Lương, điều chỉnh và thanh toán | [MMD](sources/FL-12-salary-payment.mmd) | [SVG](rendered/svg/FL-12-salary-payment.svg) | [PNG](rendered/png/FL-12-salary-payment.png) | FR-PAY, FR-RPT-002 | WF-13, WF-15, WF-22 |
| FL-13 | Nhận xét giáo viên và ẩn danh | [MMD](sources/FL-13-teacher-feedback.mmd) | [SVG](rendered/svg/FL-13-teacher-feedback.svg) | [PNG](rendered/png/FL-13-teacher-feedback.png) | FR-FBK | WF-12, WF-25 |
| FL-14 | State map, thông báo và audit | [MMD](sources/FL-14-state-notification-audit.mmd) | [SVG](rendered/svg/FL-14-state-notification-audit.svg) | [PNG](rendered/png/FL-14-state-notification-audit.png) | FR-RPT, FR-NTF, FR-AUD, FR-SES-016–017 | WF-03, WF-13, WF-16, WF-27 |

## Quy ước trạng thái

- Nút viền đậm: trạng thái nghiệp vụ bền vững.
- Hình thoi: quyết định/validation.
- Nhánh nét đứt hoặc cảnh báo: ngoại lệ cần con người xử lý.
- Các tác vụ tạo tiền, thông báo và audit phải idempotent.
- `MissingDocumentation` là cờ song song với `Session.Completed`, không phải một trạng thái thay thế.
- FL-08/FL-09 đã được đồng bộ với `DEC-047`: roster động trước completion và snapshot khóa trong transaction completion.

## Checklist kiểm tra flow

- [x] Có happy path.
- [x] Có nhánh validation/xung đột chính.
- [x] Có trạng thái quan sát được cho người dùng.
- [x] Có đường xử lý thất bại hoặc hành động khôi phục.
- [x] Có quan hệ tới requirement và wireframe.
- [x] Có nguồn Mermaid.
- [x] Có bản render SVG/PNG.
