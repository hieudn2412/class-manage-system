# SRS — Hệ thống quản lý dạy học SaaS

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | SRS-EDU-SAAS-001 |
| Phiên bản | 1.2-draft |
| Ngày | 25/07/2026 |
| Trạng thái | Chờ khách hàng duyệt |
| Phạm vi | Toàn bộ v1 |
| Ngôn ngữ/định dạng | Tiếng Việt / Markdown |
| Nguồn quyết định | [DECISION-LOG.md](../decisions/DECISION-LOG.md) |
| Danh mục luồng | [FLOW-REGISTRY.md](../flows/FLOW-REGISTRY.md) |
| Prototype | [wireframes/index.html](../../wireframes/index.html) |

## 1. Mục đích và bối cảnh

### 1.1 Vấn đề cần giải quyết

Trung tâm hiện quản lý lớp, lịch, giờ dạy, lương và học phí bằng Excel; đổi lịch, dạy thay và nhắc việc qua nhóm chat. Dữ liệu bị phân tán, việc đối soát cuối tháng tốn thời gian, khó truy nguyên thay đổi và giáo viên/học sinh không có một nguồn thông tin thống nhất.

Hệ thống v1 cung cấp một nguồn dữ liệu nghiệp vụ duy nhất cho nhiều trung tâm độc lập, liên kết lịch học, buổi dạy, sĩ số, BTVN, tài liệu, học phí và lương mà vẫn cách ly tuyệt đối dữ liệu giữa các tenant.

### 1.2 Mục tiêu sản phẩm

| Mục tiêu | Chỉ số | Mức đích | Thời điểm đo |
|---|---|---|---|
| Giảm công sức vận hành | Thời gian đối soát lịch/lương/học phí | Giảm ≥60% so với Excel | Sau 2 kỳ tháng |
| Tăng mức sử dụng | Tác vụ cốt lõi thực hiện trong hệ thống | ≥90% check-in, điểm danh, BTVN, record và tra lịch | Trong 2 tháng |
| Bảo đảm truy vết | Thay đổi quan trọng có audit | 100% | Từ ngày vận hành |
| Duy trì chất lượng dịch vụ | Availability | ≥99,5%/tháng | Hằng tháng |

### 1.3 Đối tượng đọc

- Khách hàng/Chủ trung tâm: duyệt phạm vi và quy tắc.
- Product/BA/UX: quản lý yêu cầu và thiết kế trải nghiệm.
- Kỹ sư frontend/backend: triển khai hành vi và validation.
- QA: tạo test case từ acceptance criteria và workflow.
- Vận hành/hỗ trợ: hiểu trạng thái, cảnh báo và audit.

## 2. Phạm vi

### 2.1 Trong phạm vi

- Quản trị tenant cơ bản; tài khoản, vai trò và quyền.
- Hồ sơ giáo viên/học sinh; lớp, enrollment, phòng, ngày nghỉ và lịch.
- Check-in, điểm danh, nhận xét, nội dung thực dạy và record.
- BTVN ảnh, chữa bài, tài liệu PDF/audio.
- Khảo sát học sinh nhận xét giáo viên.
- Học phí, hoàn tiền, lương, điều chỉnh và thanh toán.
- Dashboard, báo cáo, xuất Excel/PDF-in, thông báo và audit.
- Web desktop cho quản lý; responsive đầy đủ cho giáo viên/học sinh.

### 2.2 Ngoài phạm vi

- Tài khoản phụ huynh; tenant nhiều cơ sở; tài khoản dùng chung xuyên tenant.
- Billing/gói thuê bao SaaS; tenant branding.
- MFA, SSO, SMS, Zalo, Google Calendar/Meet và cổng thanh toán.
- Import Excel để tạo tài khoản.
- Livestream, lưu video hoặc xác minh URL qua API ngoài.
- Điểm số BTVN, bảng điểm học thuật, chứng chỉ.
- HLD, lựa chọn stack, database schema vật lý và API specification.

## 3. Tác nhân và quyền

### 3.1 Tác nhân

| Tác nhân | Mô tả |
|---|---|
| Super Admin | Nhân sự vận hành nền tảng; chỉ quản lý vòng đời tenant và Admin ban đầu |
| Admin trung tâm | Chủ/đại diện tenant; toàn quyền nghiệp vụ tenant, trừ truy cập dữ liệu tenant khác |
| Quản lý học vụ | Quản lý tài khoản học tập, lớp, lịch, giáo viên, học sinh, buổi và khảo sát |
| Kế toán | Quản lý học phí, hoàn tiền, lương, điều chỉnh, thanh toán và báo cáo tài chính |
| Giáo viên | Xem lịch/lớp được gán, check-in, điểm danh, BTVN, tài liệu, record, nhận xét và lương cá nhân |
| Học sinh | Xem lịch/lớp đang tham gia, nộp BTVN, xem tài liệu/record/nhận xét và gửi phản hồi giáo viên |
| Scheduler | Tác nhân hệ thống sinh lịch, tự chuyển trạng thái buổi và phát thông báo |

### 3.2 Ma trận quyền mức cao

Ký hiệu: `M` quản lý, `V` xem, `O` chỉ dữ liệu của mình/được gán, `—` không quyền.

| Nhóm dữ liệu | Super Admin | Admin | Học vụ | Kế toán | Giáo viên | Học sinh |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Tenant | M | V | — | — | — | — |
| Tài khoản nhân sự/học sinh | — | M | M | V tối thiểu | O/V | O/V |
| Hồ sơ HR giáo viên | — | M | V chuyên môn | — | O/V | — |
| Lớp/lịch/phòng/ngày nghỉ | — | M | M | V | O/M giới hạn | O/V |
| Enrollment | — | M | M | V | O/V | O/V |
| Buổi/điểm danh/record | — | M | M | V | O/M | O/V |
| BTVN/tài liệu | — | M | M | V | O/M | O/M bài của mình |
| Khảo sát giáo viên | — | M | M | — | O/V ẩn danh | O/M phản hồi của mình |
| Học phí/toàn trung tâm | — | M | — | M | — | — |
| Lương | — | M | — | M | O/V | — |
| Audit | — | M | V nghiệp vụ | V tài chính | O/V thay đổi của mình | — |

Tài khoản nội bộ có thể mang nhiều vai trò; quyền hiệu lực là hợp quyền, nhưng mọi truy cập vẫn bị giới hạn bởi `tenant_id`.

## 4. Thuật ngữ và mô hình miền

| Thuật ngữ | Định nghĩa |
|---|---|
| Tenant | Một trung tâm độc lập và một cơ sở vật lý/đơn vị vận hành |
| Lớp | Nhóm học có lịch, học phí, đơn giá dạy/giờ, giáo viên và tổng số buổi |
| Buổi học | Một lần dạy có thời điểm, phòng/hình thức, giáo viên dự kiến/thực tế và hồ sơ dạy |
| Enrollment | Quan hệ học sinh tham gia lớp, có thời điểm vào/ra và quyền truy cập |
| Giáo viên chính | Giáo viên chịu trách nhiệm lớp ở mức tổng thể |
| Giáo viên thực tế | Một giáo viên duy nhất được ghi nhận dạy và nhận lương ở một buổi |
| Hồ sơ buổi | Điểm danh, nội dung thực dạy, nhận xét và URL record |
| Điểm kiểm tra | Kết quả đánh giá riêng gắn học sinh và buổi, gồm tên bài kiểm tra, điểm đạt/tối đa, ngày và nhận xét; không phải điểm BTVN |
| Khoản học phí | Nghĩa vụ tài chính cố định phát sinh đồng thời khi Admin/Học vụ thêm học sinh vào lớp |
| Lương phát sinh | Tiền công hình thành từ buổi hoàn tất cộng/trừ điều chỉnh |

Thực thể khái niệm và quan hệ chi tiết được mô tả tại `FL-03`.

## 5. Quy tắc nghiệp vụ dùng chung

| ID | Quy tắc |
|---|---|
| BR-TEN-001 | Mọi dữ liệu nghiệp vụ phải mang `tenant_id`; truy vấn và thao tác không được trả dữ liệu tenant khác. |
| BR-TEN-002 | Khóa tenant là khóa mềm: chặn đăng nhập tenant nhưng không xóa dữ liệu; Super Admin có thể mở lại. |
| BR-IAM-001 | Username duy nhất trong tenant; cùng username có thể tồn tại ở tenant khác. |
| BR-IAM-002 | Mật khẩu tạm phải đổi ở lần đăng nhập đầu; reset làm mất hiệu lực phiên cũ. |
| BR-CODE-001 | Mã lớp, giáo viên, học sinh do hệ thống sinh, duy nhất trong tenant và không sửa sau khi tạo. |
| BR-TIME-001 | Ngày/giờ nghiệp vụ dùng `Asia/Ho_Chi_Minh`; lưu dấu thời gian đủ để truy vết chính xác. |
| BR-AUD-001 | Tạo/sửa/khóa/hủy dữ liệu quan trọng phải lưu actor, thời gian, tenant, đối tượng, giá trị cũ-mới và lý do nếu yêu cầu. |
| BR-AUD-002 | Audit log không được sửa/xóa bởi người dùng tenant. |
| BR-CLS-001 | Số buổi hoàn tất, không bị hủy, quyết định tiến độ; buổi hủy không chiếm số thứ tự. |
| BR-CLS-002 | Lớp đóng/hủy chấm dứt quyền nội dung lớp của học sinh nhưng không xóa lịch sử. |
| BR-SCH-001 | Không cho giáo viên hoặc phòng có hai buổi trùng thời gian; trùng lịch học sinh chỉ cảnh báo và cần xác nhận. |
| BR-SCH-002 | Tạo lớp, ca lặp và chỉnh lịch buổi không thu link online; với buổi Online, giáo viên thực tế nhập link của đúng buổi khi check-in. |
| BR-SES-001 | Check-in mở từ 30 phút trước đến thời điểm kết thúc theo lịch; ngoài khung cần quản lý xác nhận. |
| BR-SES-002 | Có check-in thì tại giờ kết thúc Scheduler chuyển buổi sang `Completed` và tạo lương. |
| BR-SES-003 | Không check-in thì buổi sang `AwaitingVerification`; chỉ quản lý xác nhận đã dạy hoặc hủy. |
| BR-SES-004 | Thiếu điểm danh hoặc URL record không ngăn hoàn tất/lương, nhưng tạo cờ `MissingDocumentation`. |
| BR-SES-005 | Trước khi hoàn tất, roster được tính từ enrollment có hiệu lực tại ngày học; lúc hoàn tất hệ thống khóa snapshot roster trong cùng transaction với trạng thái và lương. |
| BR-SES-006 | Sau khi roster đã khóa, thêm/bỏ enrollment không thay đổi danh sách lịch sử của buổi; dữ liệu nháp ngoài snapshot chỉ được giữ cho audit. |
| BR-SES-005 | Giáo viên được xem các buổi thuộc thời gian mình được phân công lớp; chỉ giáo viên thực tế của buổi được sửa dữ liệu sư phạm của buổi đó. |
| BR-ATT-001 | `Số tham gia = Có mặt + Đi muộn + Về sớm`; vắng có/không phép không được tính. |
| BR-ATT-002 | Sửa điểm danh, nhận xét buổi, đánh giá BTVN hoặc điểm kiểm tra sau `Completed`/`Closed` không đổi trạng thái buổi, tiến độ hay lương; mọi giá trị cũ–mới phải được audit. |
| BR-TST-001 | Một học sinh có thể có từ 0 đến nhiều điểm kiểm tra trong một buổi; `0 ≤ điểm đạt ≤ điểm tối đa`, điểm tối đa phải lớn hơn 0. |
| BR-TST-002 | Điểm kiểm tra độc lập với BTVN; quy tắc “BTVN không dùng điểm” vẫn giữ nguyên. |
| BR-ENR-001 | Chỉ Admin/Học vụ được tạo hoặc kết thúc enrollment; khi tạo phải đồng thời sinh đúng một khoản học phí `Unpaid` theo mức cố định của lớp. |
| BR-ENR-002 | Giáo viên chỉ xem roster và điểm danh trong phạm vi học sinh thuộc danh sách buổi; không được thêm/bỏ enrollment hoặc đưa học sinh ngoài lớp vào buổi. |
| BR-HW-001 | Mỗi lượt nộp tối đa 10 ảnh JPG/PNG/HEIC; file vượt chính sách bị từ chối trước khi hoàn tất lượt nộp. |
| BR-HW-002 | Sau hạn vẫn cho nộp và gắn `Late` cho đến khi bài được đóng. |
| BR-FBK-001 | Giáo viên chỉ xem phản hồi ẩn danh khi đợt có ít nhất 5 phản hồi hợp lệ. |
| BR-FIN-001 | Một enrollment có tối đa một khoản thu học phí gốc; không hỗ trợ trả góp. |
| BR-FIN-002 | Thu ròng kỳ = tổng giao dịch thu theo ngày xác nhận − tổng hoàn tiền theo ngày hoàn. |
| BR-PAY-001 | Lương buổi = `scheduled_minutes / 60 × class_hourly_rate_effective_at_session_date`. |
| BR-PAY-002 | Chỉ giáo viên thực tế của buổi nhận lương; không có đơn giá riêng giáo viên và không đồng giảng. |
| BR-PAY-003 | Sửa thời lượng/giáo viên/đơn giá hiệu lực của buổi cũ tính lại lương, ghi audit và có thể tạo số dư âm/dương. |
| BR-PAY-004 | Số tiền lương buổi được làm tròn đến 1 VND bằng quy tắc `HALF_UP`; Scheduler và xác nhận quản lý dùng cùng một completion service. |

## 6. Yêu cầu chức năng

Mỗi hàng gồm acceptance criterion ngắn dạng Given/When/Then và liên kết tới workflow/màn hình. Chi tiết nhánh trạng thái được thể hiện trong các sơ đồ `FL-*`.

### 6.1 Tenant, tài khoản và phân quyền

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-TEN-001 | Super Admin xem danh sách, tìm và lọc tenant theo trạng thái. | `AC-TEN-001`: Given nhiều tenant, when lọc `Locked`, then chỉ tenant bị khóa xuất hiện và không lộ dữ liệu nghiệp vụ. | FL-01, FL-04; WF-02 |
| FR-TEN-002 | Super Admin tạo tenant và tài khoản Admin ban đầu. | `AC-TEN-002`: Given tên/mã hợp lệ, when tạo, then tenant hoạt động, Admin nhận mật khẩu tạm và audit được ghi. | FL-04; WF-02 |
| FR-TEN-003 | Super Admin khóa/mở tenant với lý do. | `AC-TEN-003`: When khóa, then toàn bộ tài khoản tenant bị từ chối đăng nhập nhưng dữ liệu giữ nguyên; mở lại khôi phục quyền. | FL-04; WF-02 |
| FR-TEN-004 | Super Admin không được điều hướng/xem dữ liệu nghiệp vụ tenant. | `AC-TEN-004`: When cố truy cập URL nghiệp vụ, then trả từ chối quyền và ghi security audit. | FL-01, FL-04; WF-02 |
| FR-IAM-001 | Admin/Học vụ tạo tài khoản giáo viên và học sinh với mã tự sinh. | `AC-IAM-001`: Given username chưa trùng, when lưu, then tài khoản `Active`, mã bất biến và mật khẩu tạm được cấp. | FL-04; WF-09, WF-10 |
| FR-IAM-002 | Admin gán nhiều vai trò cho nhân sự; không gán vai trò quản lý cho học sinh. | `AC-IAM-002`: When gán Admin+Kế toán, then người dùng nhận hợp quyền; when gán Kế toán cho học sinh, then bị từ chối. | FL-02, FL-04; WF-10 |
| FR-IAM-003 | Người dùng bắt buộc đổi mật khẩu tạm ở lần đầu. | `AC-IAM-003`: Given mật khẩu tạm, when đăng nhập, then chỉ màn đổi mật khẩu truy cập được cho tới khi đổi thành công. | FL-04; WF-01 |
| FR-IAM-004 | Quên mật khẩu qua email nếu có hoặc do Admin đặt lại. | `AC-IAM-004`: When reset, then liên kết/mật khẩu cũ và các phiên đang hoạt động mất hiệu lực. | FL-04; WF-01, WF-10 |
| FR-IAM-005 | Giới hạn đăng nhập sai và hiển thị lỗi không tiết lộ tài khoản tồn tại. | `AC-IAM-005`: After ngưỡng cấu hình, then tài khoản/địa chỉ bị trì hoãn tạm thời và thông điệp dùng chung. | FL-04; WF-01 |
| FR-IAM-006 | Admin khóa/mở tài khoản; không xóa dữ liệu nghiệp vụ. | `AC-IAM-006`: When khóa giáo viên, then không đăng nhập được nhưng lịch sử buổi/lương vẫn truy xuất bởi người có quyền. | FL-04; WF-10 |
| FR-IAM-007 | Học sinh chỉ xem hồ sơ và đổi mật khẩu. | `AC-IAM-007`: When học sinh gửi thao tác sửa hồ sơ, then bị từ chối; đổi mật khẩu hợp lệ vẫn thành công. | FL-02, FL-04; WF-23 |

### 6.2 Hồ sơ người dùng

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-PPL-001 | Hồ sơ học sinh gồm mã, họ tên, username, tên/SĐT phụ huynh và trạng thái. | `AC-PPL-001`: Given thiếu tên hoặc SĐT phụ huynh, when tạo, then hiển thị lỗi trường và không tạo bản ghi. | FL-03, FL-04; WF-09, WF-10 |
| FR-PPL-002 | Hồ sơ giáo viên gồm thông tin liên hệ, môn/kỹ năng, ngày bắt đầu, trạng thái, bằng cấp, hợp đồng và giấy tờ. | `AC-PPL-002`: When Admin tải tệp hợp lệ, then tệp gắn đúng giáo viên và có audit. | FL-03, FL-04; WF-10 |
| FR-PPL-003 | Chỉ Admin xem tệp hợp đồng/giấy tờ HR; Học vụ chỉ xem thông tin chuyên môn. | `AC-PPL-003`: Given Học vụ, when mở hồ sơ, then tab/tệp HR không hiển thị và truy cập trực tiếp bị từ chối. | FL-02, FL-04; WF-10 |
| FR-PPL-004 | Danh bạ hỗ trợ tìm theo mã/tên/username và lọc vai trò/trạng thái. | `AC-PPL-004`: When tìm không dấu theo tên, then trả người khớp trong tenant hiện tại. | FL-04; WF-09 |

### 6.3 Lớp, phòng và lịch

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-CLS-001 | Admin/Học vụ tạo lớp với mã/tên, mô tả, ngày bắt đầu, tổng buổi, học phí, đơn giá/giờ, hình thức, sức chứa và giáo viên chính. | `AC-CLS-001`: Given dữ liệu hợp lệ, when lưu nháp, then lớp `Draft`, mã tự sinh và chưa phát thông báo. | FL-03, FL-05; WF-05 |
| FR-CLS-002 | Một lớp có nhiều mẫu ca lặp lại mỗi tuần. | `AC-CLS-002`: Given Thứ 2 19:00–21:00 và Thứ 5 19:30–21:00, when sinh lịch, then tạo đúng thứ tự cho tới đủ tổng buổi. | FL-05; WF-05 |
| FR-CLS-003 | Quản lý danh mục phòng với sức chứa và trạng thái. | `AC-CLS-003`: When phòng inactive, then không thể chọn cho buổi mới; lịch cũ vẫn hiển thị. | FL-05; WF-11 |
| FR-CLS-004 | Quản lý lịch nghỉ của tenant. | `AC-CLS-004`: Given ngày nghỉ trùng ca, when sinh lịch, then không tạo buổi tính tiến độ tại ngày đó và ngày kết thúc được kéo tới đủ số buổi. | FL-05; WF-11 |
| FR-CLS-005 | Sinh lịch phải chặn trùng giáo viên/phòng và cảnh báo trùng học sinh. | `AC-CLS-005`: Given GV đã có ca trùng, when xác nhận lịch, then lưu bị chặn và hiển thị ca gây xung đột. | FL-05, FL-07; WF-05, WF-07 |
| FR-CLS-006 | Hỗ trợ lớp online/tại lớp và override hình thức/phòng theo từng buổi; không nhập link online trong lúc tạo lớp, tạo ca hoặc chỉnh lịch. | `AC-CLS-006`: When đổi một buổi từ tại lớp sang online, then chỉ buổi đó đổi, không yêu cầu URL và người liên quan nhận thông báo. | FL-05, FL-07; WF-05, WF-07, WF-08 |
| FR-CLS-007 | Danh sách lớp mặc định gồm lớp có ít nhất một buổi trong tháng hiện tại; lọc theo tên/GV/thời gian/trạng thái. | `AC-CLS-007`: Given lớp active không có buổi tháng này, then không xuất hiện mặc định nhưng xuất hiện khi bỏ bộ lọc tháng. | FL-05; WF-04 |
| FR-CLS-008 | Chi tiết lớp hiển thị tiến độ, bài hiện tại, kết thúc dự kiến, chuyên cần, BTVN và buổi thiếu hồ sơ. | `AC-CLS-008`: When một buổi hoàn tất, then tiến độ và dự kiến được cập nhật không tính buổi hủy. | FL-06, FL-08; WF-06 |
| FR-CLS-009 | Giáo viên nhập tên/nội dung thực dạy sau buổi và không lập lộ trình bắt buộc trước lớp. | `AC-CLS-009`: Given buổi đã qua, when GV lưu nội dung, then hiển thị ở lịch sử lớp và audit thay đổi. | FL-06, FL-09; WF-20 |
| FR-CLS-010 | Khi đủ số buổi, lớp tự chuyển `AwaitingClose`; Admin/Học vụ đóng sau kiểm tra. | `AC-CLS-010`: When hoàn tất buổi cuối, then lớp chưa đóng ngay; after quản lý đóng, then học sinh mất quyền nội dung. | FL-06; WF-06 |
| FR-CLS-011 | Admin mở lại lớp đã đóng với lý do. | `AC-CLS-011`: When mở lại, then enrollment hợp lệ được khôi phục quyền, trạng thái trước/sau và lý do được audit. | FL-06; WF-06 |
| FR-CLS-012 | Hủy lớp giữ lịch sử, hủy các buổi tương lai và chấm dứt quyền học sinh. | `AC-CLS-012`: When hủy lớp giữa chừng, then buổi đã dạy/tài chính giữ nguyên, buổi tương lai `Cancelled`. | FL-06, FL-07; WF-06 |
| FR-CLS-013 | Giáo viên xem danh sách tất cả lớp đang dạy hoặc đã từng được phân công/dạy thực tế; hỗ trợ tìm theo tên/mã và lọc trạng thái, thời gian, vai trò. | `AC-CLS-013`: Given giáo viên có nhiều lớp, when tìm tên và lọc `Đã đóng`, then chỉ lớp khớp trong đúng tenant và phạm vi giáo viên xuất hiện. | FL-02, FL-06, FL-09; WF-19 |
| FR-CLS-014 | Từ một lớp, giáo viên xem danh sách mọi buổi trong thời gian mình được phân công, gồm số buổi, ngày/giờ, nội dung, giáo viên thực tế, hồ sơ và trạng thái. | `AC-CLS-014`: When mở lớp đã từng dạy, then buổi trong nhiệm kỳ xuất hiện theo mới nhất; buổi ngoài nhiệm kỳ không lộ và buổi do người khác dạy được đánh dấu chỉ đọc. | FL-06, FL-07, FL-09; WF-26 |

### 6.4 Enrollment và sĩ số

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-ENR-001 | Admin/Học vụ chọn một hoặc nhiều học sinh đã tồn tại để thêm vào lớp. | `AC-ENR-001`: When quản lý thêm nhiều học sinh, then enrollment active ngay, không tạo tài khoản mới và lịch sử ghi actor; tài khoản giáo viên không thấy thao tác này. | FL-06; WF-06 |
| FR-ENR-002 | Enrollment lưu ngày vào, ngày ra, lý do và trạng thái; không xóa lịch sử. | `AC-ENR-002`: When học sinh rời, then dữ liệu buổi trước ngày ra vẫn truy xuất bởi người có quyền. | FL-03, FL-06; WF-06, WF-10 |
| FR-ENR-003 | Khi Admin/Học vụ thêm học sinh, hệ thống tạo enrollment active và đúng một khoản học phí `Unpaid` trong cùng giao dịch. | `AC-ENR-003`: When thêm thành công, then học sinh dùng lớp ngay và Kế toán thấy khoản phải thu; nếu tạo khoản lỗi thì enrollment không được tạo dở dang. | FL-06, FL-11; WF-06, WF-14 |
| FR-ENR-004 | Giáo viên không được thêm hoặc bỏ học sinh khỏi lớp; roster lớp ở chế độ chỉ đọc. | `AC-ENR-004`: Given tài khoản giáo viên, when gọi thao tác hoặc API thay đổi enrollment, then bị từ chối và enrollment không đổi; giáo viên vẫn điểm danh được học sinh thuộc danh sách buổi. | FL-06, FL-09; WF-19, WF-20 |
| FR-ENR-005 | Admin/Học vụ được kết thúc enrollment; giao dịch tài chính không bị xóa. | `AC-ENR-005`: When quản lý kết thúc, then quyền lớp mất ngay và Kế toán có thể tạo refund riêng. | FL-06, FL-11; WF-06, WF-14 |
| FR-ENR-006 | Học sinh chỉ truy cập lớp khi enrollment active và lớp chưa đóng/hủy. | `AC-ENR-006`: When enrollment chuyển Left hoặc lớp Closed, then URL tài liệu/record bị từ chối ngay. | FL-06, FL-10; WF-24 |

### 6.5 Buổi học, dạy thay, check-in và điểm danh

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-SES-001 | Lịch quản lý hiển thị lưới tuần, gom các lớp trùng ca và mở được chi tiết. | `AC-SES-001`: When một ô có 3 lớp, then hiển thị số lượng và danh sách lớp/GV/phòng trong panel. | FL-07; WF-07 |
| FR-SES-002 | Giáo viên xem lịch mọi tuần quá khứ/tương lai; mặc định tuần hiện tại. | `AC-SES-002`: When chuyển tuần, then chỉ hiện buổi giáo viên dự kiến/thực tế có quyền xem. | FL-07; WF-18 |
| FR-SES-003 | Chỉ Admin/Học vụ thay giáo viên một buổi; thay có hiệu lực ngay. | `AC-SES-003`: When chọn GV không trùng lịch, then lịch hai GV cập nhật, GV mới trở thành thực tế và thông báo được phát. | FL-07; WF-08 |
| FR-SES-004 | Quản lý hủy buổi với lý do và tùy chọn tạo buổi bù liên kết. | `AC-SES-004`: When hủy và xếp bù, then buổi gốc `Cancelled`, buổi bù mới liên kết và tiến độ chỉ tính một lần. | FL-07; WF-08 |
| FR-SES-005 | Giáo viên xem danh sách lớp hôm nay và check-in trong cửa sổ hợp lệ; với buổi Online, giáo viên nhập link của riêng buổi tại bước check-in. | `AC-SES-005`: Given hiện tại trong cửa sổ, when check-in, then lưu thời điểm/IP/device, link online nếu áp dụng và trạng thái `CheckedIn`; thao tác lặp là idempotent. | FL-08; WF-17, WF-20 |
| FR-SES-006 | Check-in ngoài cửa sổ bị chặn và chuyển sang luồng quản lý xác nhận. | `AC-SES-006`: When GV check-in quá giờ, then không tự ghi nhận; hiển thị hướng dẫn liên hệ quản lý. | FL-08; WF-20 |
| FR-SES-007 | Scheduler tự hoàn tất buổi có check-in tại giờ kết thúc, khóa roster và tạo lương. | `AC-SES-007`: Given CheckedIn, when tới end time, then trong một transaction roster hợp lệ được snapshot, buổi thành `Completed`, một salary accrual làm tròn `HALF_UP` được tạo và không nhân đôi khi job chạy lại. | FL-08, FL-12; WF-08, WF-20 |
| FR-SES-008 | Buổi thiếu check-in sang `AwaitingVerification`; quản lý xác nhận hoặc hủy. | `AC-SES-008`: When xác nhận đã dạy, then Completed và tạo lương; when hủy, then không tạo lương. | FL-08, FL-12; WF-08 |
| FR-SES-009 | Hệ thống lập danh sách buổi từ enrollment hợp lệ và khóa snapshot khi hoàn tất; giáo viên chỉ chọn trạng thái tham gia cho từng học sinh trong danh sách đó bằng 5 trạng thái và ghi chú. | `AC-SES-009`: Before completion, when enrollment đổi hợp lệ, then roster tải lại phản ánh thay đổi; after completion, enrollment đổi không làm đổi snapshot. When thay trạng thái, tổng tham gia tự tính và không thể thêm học sinh ngoài roster. | FL-06, FL-08, FL-09; WF-20 |
| FR-SES-010 | Giáo viên nhập nhận xét buổi học tự do cho bất kỳ học sinh nào trong danh sách buổi. | `AC-SES-010`: Given học sinh vắng, when nhập nhận xét, then vẫn lưu được và gắn đúng buổi/học sinh. | FL-09; WF-20, WF-27 |
| FR-SES-011 | Giáo viên nhập/sửa URL record hợp lệ và nội dung thực dạy. | `AC-SES-011`: When URL sai cú pháp, then từ chối; when sửa URL hợp lệ, then học sinh thấy link mới và audit giữ link cũ. | FL-09; WF-20, WF-24 |
| FR-SES-012 | Buổi Completed thiếu điểm danh hoặc record có cờ hồ sơ thiếu. | `AC-SES-012`: When thiếu một mục, then lương vẫn tồn tại nhưng dashboard quản lý/lớp hiển thị cờ thiếu cho tới khi bổ sung. | FL-08, FL-09; WF-03, WF-06, WF-08 |
| FR-SES-013 | Giáo viên thực tế sửa điểm danh, record và dữ liệu sư phạm sau `Completed` mà không cần mở lại buổi. | `AC-SES-013`: When sửa, then trạng thái Completed/lương giữ nguyên, audit ghi cũ-mới và cờ hồ sơ được tính lại. | FL-09; WF-20, WF-27 |
| FR-SES-014 | Giáo viên cũ xem lịch sử trong thời gian được phân công; vẫn sửa được buổi mình là giáo viên thực tế, kể cả khi lớp đã đóng, nhưng buổi do người khác dạy là chỉ đọc. | `AC-SES-014`: When rời lớp, then buổi thuộc nhiệm kỳ cũ còn xem được; sửa buổi của mình thành công và được audit, sửa buổi người khác bị từ chối. | FL-02, FL-06, FL-09; WF-19, WF-26, WF-27 |
| FR-SES-015 | Chi tiết buổi đã dạy hiển thị danh sách học sinh với điểm danh, trạng thái/nhận xét BTVN, nhận xét buổi và điểm kiểm tra nếu có. | `AC-SES-015`: When mở một buổi Completed có quyền, then mọi học sinh trong roster snapshot xuất hiện cùng dữ liệu mới nhất, không thêm được học sinh ngoài roster. | FL-03, FL-09, FL-10; WF-27 |
| FR-SES-016 | Giáo viên thực tế được sửa điểm danh, trạng thái/nhận xét BTVN và nhận xét buổi từ trang chi tiết buổi vào bất kỳ thời điểm nào. | `AC-SES-016`: Given lớp Closed và đúng giáo viên thực tế, when lưu thay đổi hợp lệ, then dữ liệu cập nhật, audit có cũ–mới và buổi/lương không đổi; given giáo viên khác, then bị từ chối. | FL-09, FL-10, FL-14; WF-27 |
| FR-SES-017 | Giáo viên thực tế thêm/sửa nhiều điểm kiểm tra cho từng học sinh tại chi tiết buổi, gồm tên bài, điểm đạt, điểm tối đa, ngày và nhận xét tùy chọn. | `AC-SES-017`: When lưu `8.5/10`, then kết quả gắn đúng buổi/học sinh và audit; when điểm âm, vượt tối đa hoặc tối đa bằng 0, then báo lỗi và giữ form. | FL-03, FL-09, FL-14; WF-27 |

### 6.6 BTVN

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-HW-001 | Giáo viên tạo BTVN gắn với buổi, mô tả, hạn nộp, tệp/link và đối tượng cả lớp/nhóm. | `AC-HW-001`: When publish, then học sinh active thuộc đối tượng nhận bài và được thông báo. | FL-10; WF-21, WF-25 |
| FR-HW-002 | BTVN có trạng thái Draft, Published và Closed. | `AC-HW-002`: Given Draft, then học sinh không thấy; Given Closed, then không tạo lượt nộp mới. | FL-10, FL-14; WF-21 |
| FR-HW-003 | Học sinh nộp tối đa 10 ảnh JPG/PNG/HEIC mỗi lượt. | `AC-HW-003`: When chọn 11 ảnh hoặc loại sai, then hiển thị lỗi trước upload và không tạo lượt nộp dở. | FL-10; WF-25 |
| FR-HW-004 | Học sinh được thay/nộp lại; hệ thống giữ lịch sử lượt nộp. | `AC-HW-004`: When nộp lại, then lượt cũ read-only, lượt mới là current và giáo viên xem được timeline. | FL-10; WF-21, WF-25 |
| FR-HW-005 | Nộp sau deadline nhưng trước Closed được gắn Late. | `AC-HW-005`: Given quá hạn, when nộp, then trạng thái `Late` và thời điểm thực tế được lưu. | FL-10; WF-25 |
| FR-HW-006 | Giáo viên chữa bằng trạng thái và nhận xét, không dùng điểm; có thể sửa cùng dữ liệu từ màn BTVN hoặc chi tiết buổi. | `AC-HW-006`: When chọn `Reviewed` và lưu nhận xét ở một trong hai màn, then màn còn lại hiển thị cùng giá trị và học sinh nhận thông báo. | FL-09, FL-10; WF-21, WF-25, WF-27 |
| FR-HW-007 | Giáo viên yêu cầu làm lại; học sinh được nộp lượt mới cho tới khi Closed. | `AC-HW-007`: When `RevisionRequested`, then CTA nộp lại xuất hiện; after Closed, CTA disabled. | FL-10; WF-21, WF-25 |
| FR-HW-008 | Báo cáo lớp hiển thị tỷ lệ nộp/chữa theo bài và thời gian. | `AC-HW-008`: When lọc tháng, then mẫu số chỉ gồm học sinh thuộc đối tượng và active tại thời điểm giao. | FL-10, FL-14; WF-06, WF-13 |

### 6.7 Tài liệu và record cho học sinh

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-MAT-001 | Giáo viên/Quản lý đăng PDF hoặc audio gắn lớp hay buổi. | `AC-MAT-001`: When tệp hợp lệ hoàn tất, then học sinh active thấy đúng vị trí và được thông báo. | FL-10; WF-06, WF-26, WF-24 |
| FR-MAT-002 | Học sinh xem/nghe và tải tệp được cấp. | `AC-MAT-002`: Given enrollment active, when mở tệp, then tải/stream thành công và ghi access log cơ bản. | FL-10; WF-24 |
| FR-MAT-003 | Quyền tệp/record bị thu hồi ngay khi enrollment/lớp không còn active. | `AC-MAT-003`: Given URL cũ, when học sinh đã rời lớp truy cập, then trả từ chối và không lộ metadata tệp. | FL-06, FL-10; WF-24 |
| FR-MAT-004 | Học sinh xem nhận xét buổi và URL record mới nhất của buổi đã được cấp. | `AC-MAT-004`: When GV sửa record, then lần tải trang kế tiếp hiển thị URL mới; URL cũ chỉ còn trong audit. | FL-09, FL-10; WF-24 |

### 6.8 Nhận xét giáo viên

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-FBK-001 | Admin/Học vụ tạo đợt phản hồi với lớp, GV, thời gian mở/đóng và hướng dẫn. | `AC-FBK-001`: When mở đợt, then chỉ học sinh active của lớp thấy form và nhận thông báo. | FL-13; WF-12, WF-25 |
| FR-FBK-002 | Form chỉ có nội dung góp ý tự do; một phản hồi/học sinh/GV/đợt. | `AC-FBK-002`: When gửi lần đầu, then tạo một phản hồi; gửi tiếp cập nhật bản đó thay vì nhân đôi. | FL-13; WF-25 |
| FR-FBK-003 | Học sinh sửa phản hồi tới khi đợt đóng. | `AC-FBK-003`: Given Open, when sửa, then lưu bản mới; Given Closed, then trường read-only. | FL-13; WF-25 |
| FR-FBK-004 | Quản lý xem danh tính và nội dung từng phản hồi. | `AC-FBK-004`: When quản lý mở kết quả, then thấy người gửi và lịch sử chỉnh sửa theo quyền. | FL-13; WF-12 |
| FR-FBK-005 | Giáo viên không thấy danh tính và chỉ thấy tổng hợp khi đủ 5 phản hồi. | `AC-FBK-005`: Given 4 phản hồi, then ẩn nội dung; after phản hồi thứ 5, then hiển thị danh sách ẩn danh. | FL-13; WF-12 |
| FR-FBK-006 | Đóng đợt khóa phản hồi nhưng không xóa kết quả. | `AC-FBK-006`: When đóng, then học sinh không sửa; quản lý và GV đủ ngưỡng tiếp tục xem theo quyền. | FL-13; WF-12 |

### 6.9 Học phí và hoàn tiền

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-FIN-001 | Lớp có một mức học phí cố định áp dụng cho mọi enrollment. | `AC-FIN-001`: When tạo khoản, then số phải thu bằng học phí lớp và UI không cho sửa riêng theo học sinh. | FL-11; WF-05, WF-14 |
| FR-FIN-002 | Hệ thống tự sinh khoản học phí `Unpaid` khi Admin/Học vụ thêm enrollment. | `AC-FIN-002`: When enrollment được tạo, then sinh đúng một khoản theo học phí lớp trong cùng giao dịch; thao tác lặp không nhân đôi. | FL-06, FL-11; WF-06, WF-14 |
| FR-FIN-003 | Admin/Kế toán ghi nhận một giao dịch thu đủ khoản với ngày, phương thức, tham chiếu, chứng từ tùy chọn. | `AC-FIN-003`: When số tiền không bằng số phải thu, then từ chối vì v1 không trả góp; when hợp lệ, then trạng thái Paid. | FL-11; WF-14 |
| FR-FIN-004 | Hỗ trợ tiền mặt/chuyển khoản và tìm theo học sinh/lớp/ngày/trạng thái. | `AC-FIN-004`: When lọc chuyển khoản trong tháng, then chỉ giao dịch xác nhận theo ngày thu thuộc kỳ hiển thị. | FL-11; WF-14 |
| FR-FIN-005 | Admin/Kế toán tạo refund một phần/toàn phần với ngày và lý do. | `AC-FIN-005`: When refund hợp lệ, then trạng thái PartiallyRefunded/FullyRefunded và thu ròng kỳ hoàn giảm tương ứng. | FL-11; WF-14 |
| FR-FIN-006 | Tổng refund không vượt số đã thu chưa hoàn. | `AC-FIN-006`: When yêu cầu hoàn vượt số dư, then từ chối và hiển thị số tối đa có thể hoàn. | FL-11; WF-14 |
| FR-FIN-007 | Giao dịch thu/refund không bị xóa; sai sót được void/điều chỉnh theo quyền và lý do. | `AC-FIN-007`: When void, then bản ghi giữ nguyên, báo cáo loại đúng theo quy tắc và audit đầy đủ. | FL-11; WF-14, WF-16 |
| FR-FIN-008 | Học sinh không thấy số tiền, trạng thái hay giao dịch học phí. | `AC-FIN-008`: When học sinh truy cập route tài chính, then bị từ chối và menu không hiển thị. | FL-02, FL-11; WF-23 |

### 6.10 Lương và thanh toán giáo viên

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-PAY-001 | Quản lý đơn giá dạy/giờ của lớp theo các khoảng hiệu lực không chồng lấn. | `AC-PAY-001`: When thêm mức mới, then ngày hiệu lực không được chồng lấn; lịch sử mức cũ giữ nguyên. | FL-12; WF-05, WF-15 |
| FR-PAY-002 | Tạo lương một lần khi buổi Completed do check-in hoặc quản lý xác nhận. | `AC-PAY-002`: Given 120 phút và 200.000đ/giờ, then accrual = 400.000đ cho GV thực tế. | FL-08, FL-12; WF-08, WF-15, WF-22 |
| FR-PAY-003 | Buổi hủy/awaiting verification chưa xác nhận không phát sinh lương. | `AC-PAY-003`: When hủy buổi, then accrual không tồn tại hoặc được đảo có audit nếu đã tạo sai. | FL-07, FL-12; WF-08, WF-15 |
| FR-PAY-004 | Sửa thời lượng, ngày hoặc GV thực tế của buổi Completed tính lại. | `AC-PAY-004`: When 120 phút đổi 90 phút, then accrual giảm theo mức hiệu lực và ghi giá trị cũ-mới. | FL-12; WF-08, WF-15 |
| FR-PAY-005 | Kế toán thêm khoản cộng/trừ theo tháng với lý do. | `AC-PAY-005`: When thêm khoản −100.000đ, then phải trả giảm và audit ghi người/lý do. | FL-12; WF-15 |
| FR-PAY-006 | Ghi nhiều đợt thanh toán lương với ngày, số tiền, phương thức và tham chiếu. | `AC-PAY-006`: When trả một phần, then đã trả tăng, còn phải trả giảm và giao dịch giữ riêng. | FL-12; WF-15 |
| FR-PAY-007 | Không khóa kỳ; tính lại sau thanh toán có thể tạo thiếu/thừa. | `AC-PAY-007`: Given đã trả 400.000đ, when accrual giảm còn 300.000đ, then số dư hiển thị thừa 100.000đ cần xử lý. | FL-12; WF-15 |
| FR-PAY-008 | Giáo viên xem tháng: tổng giờ, tiền dạy, cộng/trừ, phải trả, đã trả, còn lại và từng buổi. | `AC-PAY-008`: When chọn tháng, then chỉ dữ liệu của chính GV và có drill-down đơn giá/thời lượng từng buổi. | FL-12; WF-22 |
| FR-PAY-009 | Dạy thay dùng giáo viên thực tế nhưng cùng đơn giá hiệu lực của lớp. | `AC-PAY-009`: When quản lý thay GV trước buổi, then toàn bộ accrual thuộc GV thay; GV cũ không có khoản. | FL-07, FL-12; WF-08, WF-15 |

### 6.11 Dashboard, báo cáo và xuất dữ liệu

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-RPT-001 | Dashboard quản lý hiển thị lớp/buổi hôm nay, buổi thiếu hồ sơ, xung đột/cần xác nhận và KPI học tập. | `AC-RPT-001`: When tải dashboard, then KPI dùng cùng bộ lọc thời gian và click dẫn tới danh sách nguồn. | FL-05, FL-08, FL-14; WF-03 |
| FR-RPT-002 | Dashboard tài chính hiển thị thu, hoàn, thu ròng, lương phát sinh, đã trả, công nợ và chênh lệch. | `AC-RPT-002`: When chọn năm, then KPI, biểu đồ tháng và bảng chi tiết dùng cùng cơ sở ngày giao dịch. | FL-11, FL-12; WF-13 |
| FR-RPT-003 | Báo cáo học tập gồm chuyên cần, nộp/chữa BTVN, tiến độ, buổi thiếu hồ sơ và lớp theo trạng thái. | `AC-RPT-003`: When lọc GV/lớp/thời gian, then tất cả widget cập nhật nhất quán. | FL-09, FL-10, FL-14; WF-03, WF-06, WF-13 |
| FR-RPT-004 | Xuất Excel cho danh sách/lương/học phí theo bộ lọc hiện tại. | `AC-RPT-004`: When xuất, then file chứa đúng dữ liệu người dùng được quyền xem và ghi thời điểm/bộ lọc. | FL-02, FL-11, FL-12; WF-04, WF-14, WF-15 |
| FR-RPT-005 | Xuất PDF/in cho báo cáo tổng hợp và thời khóa biểu. | `AC-RPT-005`: When in tuần, then nội dung có tiêu đề, khoảng ngày, timezone và không cắt mất ca. | FL-07, FL-14; WF-07, WF-13 |
| FR-RPT-006 | Danh sách lớn có phân trang, sắp xếp và trạng thái empty/loading/error. | `AC-RPT-006`: When API lỗi/không có dữ liệu, then UI hiển thị trạng thái tương ứng và có retry khi phù hợp. | FL-01, FL-14; WF-03, WF-04, WF-09, WF-13 |

### 6.12 Thông báo và audit

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| FR-NTF-001 | Tạo thông báo trong hệ thống khi đổi/hủy/bù lịch, thay GV, giao/chữa BTVN, có tài liệu/record và mở khảo sát. | `AC-NTF-001`: When sự kiện commit thành công, then đúng người nhận có một thông báo; retry không nhân đôi. | FL-07, FL-10, FL-13; WF-03, WF-17, WF-23 |
| FR-NTF-002 | Gửi email cho cùng sự kiện nếu tài khoản có email. | `AC-NTF-002`: When email thất bại, then giao dịch nghiệp vụ vẫn thành công, lỗi được ghi để retry và thông báo trong app vẫn có. | FL-04, FL-14; WF-01 |
| FR-NTF-003 | Người dùng đánh dấu đã đọc/tất cả đã đọc và mở deep link đúng tenant. | `AC-NTF-003`: When click, then điều hướng đúng đối tượng nếu còn quyền; nếu mất quyền, hiển thị thông báo an toàn. | FL-01, FL-14; WF-03, WF-17, WF-23 |
| FR-NTF-004 | Không chạy nhắc định kỳ trong v1. | `AC-NTF-004`: Given không có sự kiện mới, then hệ thống không tự gửi nhắc lịch/BTVN/học phí. | FL-14; WF-03 |
| FR-AUD-001 | Audit mọi thay đổi lịch, GV, lương, học phí, sĩ số, điểm danh, record, BTVN, nhận xét và điểm kiểm tra. | `AC-AUD-001`: When sửa, then log có actor/time/object/before/after/reason/tenant. | FL-14; WF-16, WF-27 |
| FR-AUD-002 | Admin xem audit toàn tenant; Học vụ/Kế toán chỉ xem phạm vi quyền. | `AC-AUD-002`: When Kế toán lọc audit, then không thấy nội dung HR/nhận xét học sinh ngoài tài chính. | FL-02, FL-14; WF-16 |
| FR-AUD-003 | Audit hỗ trợ lọc người, loại đối tượng, hành động và khoảng thời gian. | `AC-AUD-003`: When lọc object=Session và action=Update, then kết quả đúng tenant và có phân trang. | FL-14; WF-16 |
| FR-AUD-004 | Không cho sửa/xóa audit qua giao diện người dùng. | `AC-AUD-004`: When gọi thao tác sửa/xóa, then từ chối và tạo security log riêng. | FL-14; WF-16 |

## 7. Mô hình trạng thái

### 7.1 Lớp

```text
Draft -> Scheduled -> Active -> AwaitingClose -> Closed
  |          |          |            |             |
  +----------+----------+------------+-----------> Cancelled
Closed --(Admin mở lại + lý do)--> Active/AwaitingClose
```

- `Draft`: chưa công bố/sinh lịch chính thức.
- `Scheduled`: đã có lịch tương lai, chưa tới buổi đầu.
- `Active`: đã bắt đầu và chưa đủ số buổi.
- `AwaitingClose`: đủ số buổi, đang hoàn thiện hồ sơ.
- `Closed`: khóa lớp, học sinh mất quyền.
- `Cancelled`: hủy giữa chừng, giữ lịch sử.

### 7.2 Buổi học

```text
Scheduled -> CheckedIn -> Completed
    |             |          |
    |             |          +--> Completed + MissingDocumentation
    |             +--(end)--------------------------------------^
    +--(end, no check-in)--> AwaitingVerification --> Completed
                                  |
                                  +-----------------> Cancelled
Scheduled -----------------------> Cancelled
Cancelled --(tạo bù)--> MakeupSession[Scheduled]
```

`MissingDocumentation` là cờ độc lập, không phải trạng thái loại trừ; được xóa khi có đủ điểm danh và record.

### 7.3 Enrollment

```text
Admin/Học vụ thêm HS
  |
  +--> Active + TuitionUnpaid --> Active + TuitionPaid
             |
             +--> Left / Transferred (chỉ Admin/Học vụ)

Class Closed/Cancelled => quyền truy cập bị thu hồi dù lịch sử enrollment còn giữ
```

### 7.4 BTVN

```text
Assignment: Draft -> Published -> Closed
Submission: NotSubmitted -> Submitted / Late -> RevisionRequested -> Resubmitted -> Reviewed
```

### 7.5 Học phí và lương

```text
Tuition: Unpaid -> Paid -> PartiallyRefunded -> FullyRefunded
Salary: Accrued + Adjustments - Payments = Outstanding
Outstanding > 0: còn phải trả
Outstanding = 0: đã cân bằng
Outstanding < 0: đã trả thừa
```

## 8. Validation và xử lý lỗi

| Nhóm | Validation/hành vi |
|---|---|
| Tenant | Mã tenant duy nhất toàn nền tảng; tenant Locked không được đăng nhập |
| Username | Bắt buộc, duy nhất trong tenant, chuẩn hóa khoảng trắng/case theo chính sách triển khai |
| Mật khẩu | Tối thiểu 8 ký tự; không hiển thị tài khoản có tồn tại qua lỗi quên mật khẩu |
| Lịch | `end > start`; không chồng GV/phòng; học sinh trùng chỉ cảnh báo có xác nhận |
| Tiền | VND, số nguyên không âm; đơn giá/học phí >0; refund không vượt số dư |
| URL record | URL tuyệt đối hợp lệ `http/https`; không xác minh dịch vụ đích |
| Điểm kiểm tra | Tên và ngày bắt buộc; điểm tối đa >0; điểm đạt từ 0 đến điểm tối đa; chấp nhận số thập phân |
| Ảnh BTVN | Tối đa 10/lượt; JPG/PNG/HEIC; mặc định 10 MB/file, cấu hình được ở mức nền tảng |
| PDF/audio | PDF tối đa 50 MB; MP3/M4A/WAV tối đa 200 MB; cấu hình được |
| Tệp HR | PDF/JPG/PNG tối đa 20 MB; chỉ Admin truy cập |
| Xóa | Dùng khóa mềm/void/kết thúc quan hệ; không hard-delete dữ liệu nghiệp vụ qua UI |
| Đồng thời | Check-in, tự hoàn tất, tạo học phí/lương và phát notification phải idempotent; sửa hồ sơ buổi không được ghi đè im lặng khi dữ liệu đã đổi từ lúc tải |
| Lỗi phụ thuộc | Email/upload lỗi phải có retry phù hợp; không rollback giao dịch nghiệp vụ đã commit trừ khi tệp là dữ liệu bắt buộc |

Thông điệp lỗi phải: chỉ rõ hành động thất bại, không lộ dữ liệu tenant/định danh nhạy cảm, giữ dữ liệu người dùng đã nhập khi an toàn và cung cấp thao tác khôi phục (`Thử lại`, `Sửa dữ liệu`, `Liên hệ quản lý`).

## 9. Mô hình dữ liệu khái niệm

| Thực thể | Thuộc tính nghiệp vụ chính |
|---|---|
| Tenant | code, name, status, created_at, locked_reason |
| User | tenant, username, password_state, status, roles |
| TeacherProfile | code, name, phone, email, skills, start_date, HR documents |
| StudentProfile | code, name, parent_name, parent_phone, status |
| Room | code/name, capacity, status |
| Holiday | date/range, name, treatment |
| Class | code, name, status, start_date, planned_sessions, tuition, capacity, primary_teacher |
| ClassRate | class, hourly_rate, effective_from, effective_to |
| SchedulePattern | class, weekday, start/end, mode, room |
| Session | class, sequence, planned/actual teacher, start/end, mode, room, online_link set at check-in, state, source/makeup link |
| CheckIn | session, teacher, timestamp, IP, device, online link submission if applicable |
| Enrollment | class, student, joined_at, left_at, state, actor |
| Attendance | session, student, status, note, revision metadata |
| StudentEvaluation | session, student, free_text, revision metadata |
| TestResult | session, student, title, score, max_score, assessed_at, comment, revision metadata |
| LessonReport | session, title/content, record_url, missing flags |
| Homework | session, audience, description, deadline, state |
| Submission | homework, student, attempt, submitted_at, state, files |
| HomeworkReview | submission, state, comment, reviewer, timestamp |
| Material | class/session, kind, file, uploader, access state |
| FeedbackCampaign | class, teacher, open/close, state, instructions |
| TeacherFeedback | campaign, student, content, revision metadata |
| TuitionCharge | enrollment, amount, state, created_by |
| TuitionPayment | charge, amount, date, method, reference, proof, confirmer |
| TuitionRefund | payment, amount, date, reason, actor |
| SalaryAccrual | session, teacher, minutes, rate snapshot, amount, revision |
| SalaryAdjustment | teacher, month, amount, reason, actor |
| SalaryPayment | teacher, date, amount, method, reference |
| Notification | user, event key, content, deep link, read state |
| AuditEvent | tenant, actor, object, action, before/after, reason, timestamp |

## 10. Yêu cầu phi chức năng

| ID | Yêu cầu | Acceptance criterion | Tham chiếu |
|---|---|---|---|
| NFR-SEC-001 | Cách ly tenant ở mọi lớp truy cập dữ liệu và file. | `AC-NFR-SEC-001`: Kiểm thử đổi tenant/object ID không đọc/sửa được dữ liệu khác tenant. | FL-01; WF-02 |
| NFR-SEC-002 | Mật khẩu băm mạnh, truyền qua TLS, cookie/session an toàn và giới hạn đăng nhập sai. | `AC-NFR-SEC-002`: Security test không thấy mật khẩu plaintext; phiên bị vô hiệu sau reset/khóa. | FL-04; WF-01 |
| NFR-SEC-003 | File private dùng kiểm tra quyền tại thời điểm tải; không dựa vào URL khó đoán. | `AC-NFR-SEC-003`: URL cũ không truy cập được sau khi enrollment hết hiệu lực. | FL-01, FL-10; WF-24 |
| NFR-PER-001 | 95% trang/danh sách <2 giây; thao tác ghi <3 giây ở quy mô mục tiêu. | `AC-NFR-PER-001`: Load test tenant 5.000 HS/500 lớp đạt percentile đã cam kết. | FL-01; WF-03 |
| NFR-PER-002 | Báo cáo/xuất file thông thường <30 giây; tác vụ dài có trạng thái tiến độ. | `AC-NFR-PER-002`: Export chuẩn hoàn thành trong 30 giây hoặc hiển thị tiến trình/nhận file khi xong. | FL-14; WF-13 |
| NFR-AVL-001 | Availability ≥99,5%/tháng, loại trừ bảo trì đã thông báo. | `AC-NFR-AVL-001`: Báo cáo vận hành tính được uptime và cửa sổ bảo trì. | FL-01; WF-03 |
| NFR-DR-001 | Backup hằng ngày, RPO 24h, RTO 8h; kiểm thử phục hồi định kỳ. | `AC-NFR-DR-001`: Diễn tập khôi phục đạt RPO/RTO và có biên bản. | FL-01; WF-02 |
| NFR-ACC-001 | UI đạt WCAG 2.1 AA: tương phản, bàn phím, focus, nhãn và zoom 200%. | `AC-NFR-ACC-001`: Kiểm thử tự động + thủ công các luồng chính không có lỗi AA nghiêm trọng. | FL-02; WF-01–WF-27 |
| NFR-COM-001 | Hỗ trợ 2 phiên bản mới nhất của Chrome, Edge, Firefox, Safari desktop/mobile. | `AC-NFR-COM-001`: Smoke test luồng chính đạt trên ma trận trình duyệt. | FL-01; WF-01–WF-27 |
| NFR-LOC-001 | Tiếng Việt, VND, định dạng ngày Việt Nam, timezone Asia/Ho_Chi_Minh. | `AC-NFR-LOC-001`: Cùng một buổi hiển thị nhất quán ở lịch, lương và export. | FL-05, FL-12; WF-03–WF-27 |
| NFR-RES-001 | Quản lý desktop-first; toàn bộ luồng GV/HS dùng được từ 320px. | `AC-NFR-RES-001`: Ở 390px không có cuộn ngang ngoài bảng có container; touch target ≥44px. | FL-02; WF-17–WF-27 |
| NFR-AUD-001 | Audit quan trọng bất biến, tra cứu được và đồng bộ thời gian. | `AC-NFR-AUD-001`: Đối chiếu mẫu thay đổi cho thấy đủ actor/before/after/time/tenant. | FL-14; WF-16 |
| NFR-PRI-001 | Khóa mềm, không tự purge dữ liệu v1; xóa vĩnh viễn là quy trình riêng có phê duyệt. | `AC-NFR-PRI-001`: Khóa tenant/tài khoản không làm mất quan hệ và báo cáo lịch sử. | FL-04, FL-14; WF-02, WF-10 |

## 11. Kịch bản kiểm thử xuyên suốt

| ID | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TS-01 | User tenant A thay object ID sang tenant B | Bị từ chối; không lộ metadata; security audit được ghi |
| TS-02 | Nhân sự có vai trò Admin + Kế toán | Thấy hợp quyền; thao tác vẫn giới hạn tenant |
| TS-03 | Sinh lớp 24 buổi với hai ca/tuần và hai ngày nghỉ | Tạo đủ 24 buổi hợp lệ; ngày kết thúc kéo dài; không tạo ca ở ngày nghỉ |
| TS-04 | Xếp GV/phòng trùng, học sinh trùng | GV/phòng bị chặn; học sinh có cảnh báo và xác nhận |
| TS-05 | Quản lý thay GV một buổi | Lịch hai GV đổi ngay; lương tương lai thuộc GV mới; có notification/audit |
| TS-06 | Hủy buổi và tạo bù | Gốc Cancelled, bù liên kết, tiến độ/lương chỉ tính buổi bù khi hoàn tất |
| TS-07 | GV check-in buổi Online đúng cửa sổ, nhập link buổi và thiếu attendance/record | Link được gắn đúng buổi khi check-in; hết giờ Completed, có lương và cờ MissingDocumentation |
| TS-08 | Không check-in, quản lý xác nhận đã dạy | AwaitingVerification -> Completed; lương tạo đúng một lần |
| TS-09 | GV bổ sung điểm danh/record sau Completed | Không đổi trạng thái/lương; cờ thiếu được xóa; audit có cũ-mới |
| TS-10 | Admin/Học vụ thêm HS vào lớp | Enrollment active và tuition Unpaid được tạo nguyên tử; HS dùng lớp ngay |
| TS-11 | GV thử thêm/bỏ HS rồi điểm danh buổi | Thay đổi enrollment bị từ chối; GV chỉ chọn trạng thái cho roster của buổi |
| TS-12 | Nộp BTVN đúng hạn, trễ, nộp lại và sau Closed | Gắn đúng trạng thái/lịch sử; sau Closed bị chặn |
| TS-13 | HS rời lớp dùng URL tệp/record cũ | Bị từ chối ngay; dữ liệu nội bộ vẫn còn |
| TS-14 | Đợt phản hồi có 4 rồi 5 phản hồi | GV không thấy ở 4; thấy nội dung ẩn danh ở 5; quản lý luôn thấy danh tính |
| TS-15 | Thu học phí, hoàn một phần rồi toàn phần | Trạng thái và thu ròng theo ngày giao dịch chính xác |
| TS-16 | Buổi 120 phút, rate 200.000đ/giờ | Lương = 400.000đ cho GV thực tế |
| TS-17 | Đã trả 400.000đ rồi sửa buổi còn 90 phút | Accrual 300.000đ; hiển thị trả thừa 100.000đ; audit đầy đủ |
| TS-18 | Khóa tenant và mở lại | Mọi login tenant bị chặn khi khóa; dữ liệu/phân quyền khôi phục khi mở |
| TS-19 | Email notification thất bại | Nghiệp vụ và in-app notification vẫn thành công; email được ghi retry |
| TS-20 | Dùng prototype ở 1440px và 390px bằng bàn phím | Không link chết/lỗi console; focus rõ; tác vụ chính thực hiện được |
| TS-21 | GV có nhiều lớp tìm/lọc, mở lớp và chọn buổi cũ | Chỉ lớp đúng phạm vi xuất hiện; danh sách buổi đúng nhiệm kỳ, mới nhất trước và phân biệt buổi chỉ đọc |
| TS-22 | GV sửa buổi mình dạy sau khi lớp Closed, thêm điểm 8.5/10 rồi thử 11/10; thử sửa buổi GV khác | Dữ liệu hợp lệ lưu và audit, trạng thái/lương không đổi; điểm vượt tối đa và sửa buổi người khác bị từ chối |

## 12. Ma trận truy vết tổng hợp

| Nhóm yêu cầu | Workflow | Màn hình | Test chính |
|---|---|---|---|
| FR-TEN, FR-IAM, FR-PPL | FL-01, FL-02, FL-04 | WF-01, WF-02, WF-09, WF-10 | TS-01, TS-02, TS-18 |
| FR-CLS | FL-03, FL-05, FL-06, FL-07, FL-09 | WF-04–WF-08, WF-11, WF-19, WF-26 | TS-03, TS-04, TS-06, TS-21 |
| FR-ENR | FL-03, FL-06, FL-11 | WF-06, WF-10, WF-14, WF-19 | TS-10, TS-11, TS-13 |
| FR-SES | FL-03, FL-07, FL-08, FL-09, FL-10, FL-12, FL-14 | WF-07, WF-08, WF-17–WF-20, WF-24, WF-26, WF-27 | TS-05–TS-09, TS-21, TS-22 |
| FR-HW, FR-MAT | FL-06, FL-09, FL-10, FL-14 | WF-06, WF-21, WF-24–WF-27 | TS-12, TS-13, TS-22 |
| FR-FBK | FL-13 | WF-12, WF-25 | TS-14 |
| FR-FIN | FL-06, FL-11 | WF-05, WF-06, WF-14 | TS-10, TS-11, TS-15 |
| FR-PAY | FL-07, FL-08, FL-12 | WF-05, WF-08, WF-15, WF-22 | TS-05, TS-07, TS-08, TS-16, TS-17 |
| FR-RPT, FR-NTF, FR-AUD | FL-01, FL-05, FL-07, FL-10–FL-14 | WF-03, WF-04, WF-13, WF-16, WF-17, WF-23 | TS-19, TS-20 |
| NFR-* | FL-01, FL-02, FL-04, FL-05, FL-10, FL-12, FL-14 | WF-01–WF-27 | TS-01, TS-13, TS-18, TS-20 |

## 13. Rủi ro và giả định

| ID | Nội dung | Xử lý |
|---|---|---|
| R-01 | Tự hoàn tất có thể trả lương cho buổi check-in nhưng không dạy đủ. | Audit check-in, quyền quản lý sửa/hủy và báo cáo ngoại lệ; không dùng GPS theo quyết định khách hàng. |
| R-02 | Không khóa kỳ lương làm số đã trả thay đổi sau chỉnh sửa. | Không sửa giao dịch; hiển thị thiếu/thừa rõ và bắt buộc audit/lý do. |
| R-03 | Thêm/bỏ enrollment tác động đồng thời tới quyền nội dung, danh sách buổi và công nợ. | Chỉ Admin/Học vụ được thao tác; tạo enrollment và khoản Unpaid nguyên tử, có audit và cảnh báo tác động khi kết thúc. |
| R-04 | Mất quyền nội dung ngay khi lớp đóng có thể gây khiếu nại. | UI cảnh báo trước khi đóng/hủy; lịch sử vẫn bảo toàn cho quản lý. |
| R-05 | Không có MFA tăng rủi ro tài khoản quản trị. | Mật khẩu mạnh, rate limit, reset phiên, audit và khuyến nghị bổ sung MFA ở phiên bản sau. |
| R-06 | Cho sửa hồ sơ sư phạm sau khi lớp đóng có thể làm báo cáo lịch sử thay đổi muộn. | Chỉ giáo viên thực tế được sửa; audit bắt buộc, hiển thị lần sửa cuối và không cho thay đổi dữ liệu lịch/lương từ màn này. |
| A-01 | Một tenant không cần nhiều cơ sở trong v1. | Mọi phòng/lịch/báo cáo thuộc cùng tenant. |
| A-02 | Email là tùy chọn với học sinh/giáo viên. | Không có email thì chỉ nhận notification trong app và reset qua Admin. |
| A-03 | Record/tài liệu chỉ cần quyền truy cập ứng dụng; hệ thống không bảo đảm quyền của URL ngoài. | Hiển thị cảnh báo cho người đăng link. |
| A-04 | Các giới hạn dung lượng mặc định có thể cấu hình ở mức nền tảng, không theo tenant. | Ghi rõ trong validation và vận hành. |

## 14. Phê duyệt

Không còn câu hỏi nghiệp vụ mở ở phiên bản này. Mọi thay đổi sau khi duyệt phải tạo `DEC-*` mới và cập nhật đồng thời SRS, flow, wireframe cùng test liên quan.

| Vai trò duyệt | Người duyệt | Ngày | Trạng thái |
|---|---|---|---|
| Khách hàng/Product Owner |  |  | Chờ duyệt |
| Product/BA |  |  | Chờ duyệt |
| Tech Lead |  |  | Chờ duyệt |
| QA Lead |  |  | Chờ duyệt |
