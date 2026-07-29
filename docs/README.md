# Bộ tài liệu Hệ thống quản lý dạy học SaaS

**Phiên bản:** 1.3-draft  
**Ngày cập nhật:** 26/07/2026  
**Ngôn ngữ:** Tiếng Việt  
**Trạng thái:** Sẵn sàng để khách hàng và đội phát triển duyệt

## Mục lục bàn giao

| Tài liệu | Mục đích |
|---|---|
| [SRS](srs/SRS.md) | Đặc tả yêu cầu phần mềm build-ready, quy tắc nghiệp vụ, trạng thái, acceptance criteria và ma trận truy vết |
| [Decision log](decisions/DECISION-LOG.md) | Nguồn quyết định chính thức, bao gồm các yêu cầu đã bị thay thế trong quá trình phỏng vấn |
| [Flow registry](flows/FLOW-REGISTRY.md) | Danh mục 14 sơ đồ, quan hệ giữa workflow, yêu cầu và màn hình |
| [Prototype wireframe](../wireframes/index.html) | Prototype HTML low-fi responsive với 27 nhóm màn hình và các trạng thái tương tác |
| [Ảnh wireframe desktop](../wireframes/screenshots/desktop/) | Ảnh bàn giao khổ desktop 1440px |
| [Ảnh wireframe mobile](../wireframes/screenshots/mobile/) | Ảnh mobile 390px cho các luồng chính giáo viên/học sinh |

## Quy ước định danh

| Tiền tố | Ý nghĩa | Ví dụ |
|---|---|---|
| `FR-*` | Yêu cầu chức năng | `FR-SES-005` |
| `NFR-*` | Yêu cầu phi chức năng | `NFR-PER-001` |
| `BR-*` | Quy tắc nghiệp vụ | `BR-PAY-001` |
| `AC-*` | Acceptance criterion | `AC-SES-005` |
| `FL-*` | Workflow/sơ đồ | `FL-08` |
| `WF-*` | Nhóm màn hình wireframe | `WF-20` |
| `TS-*` | Kịch bản kiểm thử xuyên suốt | `TS-07` |
| `DEC-*` | Quyết định sản phẩm | `DEC-018` |

## Cách đọc tài liệu

1. Đọc [Decision log](decisions/DECISION-LOG.md) để hiểu những quyết định cuối cùng và nội dung đã bị thay thế.
2. Đọc [SRS](srs/SRS.md) theo từng module. Mỗi yêu cầu có acceptance criterion và tham chiếu tới flow/màn hình.
3. Mở [Flow registry](flows/FLOW-REGISTRY.md), sau đó xem bản SVG/PNG hoặc nguồn Mermaid tương ứng.
4. Mở `wireframes/index.html` bằng trình duyệt để chuyển vai trò, màn hình và thử các trạng thái loading/empty/error/confirmation.

## Phạm vi của bộ bàn giao

Bộ tài liệu này mô tả toàn bộ v1, dự kiến thực hiện trong một đợt 4–6 tháng. Workspace hiện đã có các vertical slice xác thực, lập lịch và vận hành giáo viên; SRS vẫn là nguồn phạm vi cho các module tiếp theo. OpenAPI và ma trận truy vết kỹ thuật nằm trong `class-backend/docs`.

## Tiêu chí hoàn chỉnh

- Mọi yêu cầu chức năng có mã ID, business rule hoặc acceptance criterion kiểm chứng được.
- Mọi yêu cầu có tác động giao diện được liên kết tới ít nhất một `WF-*`.
- Mọi nhóm nghiệp vụ được liên kết tới ít nhất một `FL-*`.
- Nguồn Mermaid và bản SVG/PNG được giữ đồng bộ.
- Prototype hoạt động không cần mạng, không dùng dữ liệu thật và không gửi dữ liệu ra ngoài.

## Kiểm tra và tái tạo artifact

- `tools/verify-deliverables.ps1`: kiểm tra số lượng artifact, ID yêu cầu, acceptance criterion và tham chiếu flow/wireframe.
- `wireframes/tools/verify.cjs`: dùng Playwright kiểm tra 27 route ở 1440px/390px, lỗi console, accessible name, overflow và touch target.
- `wireframes/tools/capture.cjs`: tạo 27 ảnh desktop và 10 ảnh mobile.
- `tools/render-flows.ps1`: render 14 nguồn Mermaid sang SVG/PNG; script tự tìm Chromium Playwright hoặc nhận `-ChromePath`.
