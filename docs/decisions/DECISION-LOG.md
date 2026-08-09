# Decision log — Hệ thống quản lý dạy học SaaS

**Phiên bản:** 1.3-draft  
**Ngày chốt:** 26/07/2026  
**Nguồn:** Phỏng vấn yêu cầu giữa khách hàng và đội phát triển

## Cách sử dụng

Decision log là nguồn ưu tiên khi yêu cầu ban đầu mâu thuẫn với quyết định về sau. Mọi thay đổi sau ngày chốt phải tạo quyết định mới; không sửa im lặng nội dung cũ.

| ID | Quyết định cuối cùng | Lý do/tác động | Trạng thái |
|---|---|---|---|
| DEC-001 | V1 bao phủ đầy đủ hệ thống trong một đợt, mục tiêu vận hành 4–6 tháng. | Không chia MVP theo vai trò; cần quản lý phạm vi chặt để tránh trôi yêu cầu. | Chốt |
| DEC-002 | Sản phẩm là SaaS nhiều tenant; mỗi tenant tương ứng một trung tâm/một cơ sở. | Cần cách ly dữ liệu tuyệt đối; chưa có mô hình nhiều chi nhánh trong một tenant. | Chốt |
| DEC-003 | Tài khoản tách riêng giữa các tenant, kể cả cùng một người dạy ở nhiều trung tâm. | Tránh định danh và quyền xuyên tenant trong v1. | Chốt |
| DEC-004 | Super Admin chỉ tạo, khóa/mở tenant và cấp Admin ban đầu. | Không quản lý gói dịch vụ; không tự do truy cập dữ liệu tenant. | Chốt |
| DEC-005 | Vai trò nội bộ gồm Admin, Quản lý học vụ, Kế toán, Giáo viên, Học sinh; tài khoản nhân sự được cộng quyền từ nhiều vai trò. | Hỗ trợ chủ trung tâm kiêm nhiệm; giữ nguyên tắc ít quyền nhất. | Chốt |
| DEC-006 | Chỉ Admin và Kế toán xem tài chính toàn trung tâm; giáo viên chỉ xem lương của mình; học sinh không xem học phí. | Giới hạn dữ liệu nhạy cảm theo nghiệp vụ. | Chốt |
| DEC-007 | Không có tài khoản phụ huynh trong v1. | **Thay thế** quyết định tạm thời có tài khoản phụ huynh. Chỉ lưu tên/SĐT phụ huynh trong hồ sơ học sinh. | Thay thế |
| DEC-008 | Học sinh không được sửa hồ sơ cá nhân; chỉ được xem và đổi mật khẩu. | **Thay thế** yêu cầu ban đầu “học sinh điền và sửa thông tin cá nhân”. | Thay thế |
| DEC-009 | Quản lý tạo tài khoản học sinh; giáo viên chỉ thêm học sinh đã tồn tại vào lớp. | Đã bị thay thế toàn bộ bởi DEC-043: giáo viên không quản lý enrollment. | Thay thế |
| DEC-010 | Hồ sơ học sinh tối giản; hồ sơ giáo viên mở rộng có bằng cấp, hợp đồng và tệp giấy tờ. | Tệp nhân sự chỉ dành cho Admin; học vụ chỉ xem hồ sơ chuyên môn cần thiết. | Chốt |
| DEC-011 | Đăng nhập bằng tên đăng nhập/mật khẩu tạm, bắt đổi lần đầu; không có MFA v1. | Giảm phụ thuộc số điện thoại/email; vẫn cần giới hạn đăng nhập sai và reset an toàn. | Chốt |
| DEC-012 | Quản lý nhập tổng số buổi; hệ thống sinh lịch từ nhiều ca/tuần, ngày nghỉ và ngoại lệ. | Ngày kết thúc dự kiến được tính từ lịch sinh thực tế. | Chốt |
| DEC-013 | Giáo viên tự xây dựng lộ trình nhưng chỉ điền tên/nội dung bài sau buổi học. | Không có mẫu khóa học cố định trong v1. | Chốt |
| DEC-014 | Mỗi lớp có giáo viên chính; mỗi buổi chỉ có một giáo viên thực tế. | Không hỗ trợ đồng giảng hoặc chia tỷ lệ lương. | Chốt |
| DEC-015 | Giáo viên liên hệ quản lý ngoài hệ thống khi cần nghỉ; chỉ quản lý thay giáo viên/hủy/xếp bù trong hệ thống. | **Thu hẹp** yêu cầu ban đầu về luồng giáo viên gửi yêu cầu dạy thay. | Thay thế |
| DEC-016 | Thay giáo viên có hiệu lực ngay, không cần người thay xác nhận trong hệ thống. | Quản lý chịu trách nhiệm đã liên hệ riêng. | Chốt |
| DEC-017 | Hủy buổi giữ bản ghi gốc; buổi bù là bản ghi mới liên kết; buổi hủy không chiếm số thứ tự tiến độ. | Bảo toàn audit và không tính tiến độ/lương hai lần. | Chốt |
| DEC-018 | Check-in không GPS, mở 30 phút trước đến hết buổi; lưu thời điểm, IP và thiết bị. | Phù hợp cả online/tại lớp, giảm xâm phạm vị trí. | Chốt |
| DEC-019 | Có check-in thì hết giờ tự hoàn tất và phát sinh lương; thiếu check-in cần quản lý xác nhận hoặc hủy. | **Thay thế** lựa chọn tạm thời “giáo viên phải tự hoàn tất sau khi có điểm danh + record”. | Thay thế |
| DEC-020 | Điểm danh và record vẫn bắt buộc về hồ sơ nhưng không chặn lương; buổi thiếu dữ liệu có cờ theo dõi. | Tách tính lương khỏi độ đầy đủ hồ sơ nhưng vẫn đo được tuân thủ. | Chốt |
| DEC-021 | Giáo viên được sửa điểm danh và record của buổi đã hoàn tất; mọi thay đổi có audit. | Không cần cơ chế “mở lại buổi”. | Chốt |
| DEC-022 | Tổng học sinh tham gia tự tính từ trạng thái điểm danh; nhận xét học sinh là văn bản tự do và không bắt buộc. | Tránh số tổng lệch danh sách chi tiết. | Chốt |
| DEC-023 | Giáo viên được thêm/bỏ học sinh có hiệu lực học tập ngay; lịch sử enrollment luôn được giữ. | Đã bị thay thế bởi DEC-043: chỉ Admin/Học vụ được thêm hoặc kết thúc enrollment. | Thay thế |
| DEC-024 | Khi giáo viên thêm học sinh, khoản học phí chỉ sinh sau khi quản lý xác nhận; giáo viên không được bỏ học sinh đã nộp tiền. | Đã bị thay thế bởi DEC-043; không còn enrollment do giáo viên tạo hoặc trạng thái chờ xác nhận tương ứng. | Thay thế |
| DEC-025 | Lớp đủ số buổi chuyển `Chờ kết thúc`; quản lý đóng sau khi kiểm tra hồ sơ. | Cho giáo viên thời gian hoàn thiện BTVN/nhận xét; khi đóng học sinh mất quyền lớp. | Chốt |
| DEC-026 | BTVN gắn với buổi, có hạn nộp, tối đa 10 ảnh/lượt, cho nộp lại và đánh dấu trễ đến khi giáo viên đóng bài. | Phù hợp bài làm ảnh; không dùng điểm số. | Chốt |
| DEC-027 | Chấm BTVN bằng trạng thái và nhận xét, không có điểm. | Trạng thái gồm chưa nộp, đã nộp, nộp trễ, yêu cầu làm lại, đã chữa. | Chốt |
| DEC-028 | Giáo viên và quản lý đăng PDF/audio; record chấp nhận mọi URL hợp lệ, không xác minh dịch vụ ngoài. | V1 không tích hợp YouTube/Drive API. | Chốt |
| DEC-029 | Học sinh rời/lớp đóng thì mất quyền nội dung lớp ngay; hệ thống vẫn giữ dữ liệu lịch sử. | Tách quyền truy cập khỏi lưu trữ/audit. | Chốt |
| DEC-030 | Nhận xét giáo viên là góp ý tự do theo đợt; giáo viên chỉ xem tổng hợp khi có ít nhất 5 phản hồi. | Quản lý thấy người gửi; học sinh sửa đến khi đóng đợt. | Chốt |
| DEC-031 | Mỗi lớp có một mức học phí cố định giống nhau cho mọi học sinh; một khoản thu cho mỗi enrollment. | Không hỗ trợ trả góp hoặc học phí riêng theo học sinh trong v1. | Chốt |
| DEC-032 | Học phí ghi đầy đủ ngày, phương thức, tham chiếu, chứng từ tùy chọn; hỗ trợ hoàn một phần/toàn phần. | Báo cáo tiền thu dùng cơ sở thực thu theo ngày giao dịch. | Chốt |
| DEC-033 | Bỏ khái niệm “hệ số lương”; dùng `đơn giá dạy/giờ của lớp`. | **Thay thế** yêu cầu ban đầu hiển thị hệ số lương. | Thay thế |
| DEC-034 | Lương buổi = số phút lịch/60 × đơn giá/giờ có hiệu lực của lớp. | Không có đơn giá riêng theo giáo viên; giáo viên thực tế nhận lương. | Chốt |
| DEC-035 | Đơn giá có ngày hiệu lực; sửa buổi cũ tính lại lương và lưu giá trị cũ/mới. | Không khóa kỳ lương; cần phát hiện trả thiếu/thừa. | Chốt |
| DEC-036 | Theo dõi lương phát sinh, cộng/trừ, đã trả và còn phải trả; hỗ trợ nhiều đợt thanh toán. | Báo cáo đồng thời công nợ và dòng tiền. | Chốt |
| DEC-037 | Thông báo trong hệ thống + email theo sự kiện; không nhắc định kỳ. | Không có SMS/Zalo/Calendar/Meet/cổng thanh toán trong v1. | Chốt |
| DEC-038 | UI tiếng Việt, VND, Asia/Ho_Chi_Minh; quản lý desktop-first, giáo viên/học sinh responsive đầy đủ. | Các tác vụ check-in, điểm danh và nộp ảnh phải dùng tốt trên mobile. | Chốt |
| DEC-039 | Không tùy biến thương hiệu tenant. | Dùng thương hiệu chung của nền tảng trong v1. | Chốt |
| DEC-040 | Không import Excel để tạo tài khoản; được chọn hàng loạt học sinh đã tồn tại vào lớp. | Giảm rủi ro dữ liệu trùng và quy trình sửa lỗi import. | Chốt |
| DEC-041 | V1 đặt mục tiêu 99,5% availability, backup hằng ngày, RPO 24h, RTO 8h. | Mức SaaS tiêu chuẩn cho quy mô tối đa 5.000 học sinh/tenant. | Chốt |
| DEC-042 | Mọi dữ liệu quan trọng phải có audit người/thời gian/giá trị cũ-mới. | Tiêu chí sản phẩm: 100% thay đổi quan trọng truy được nguồn. | Chốt |
| DEC-043 | Chỉ Admin/Học vụ được thêm hoặc bỏ học sinh khỏi lớp. Giáo viên chỉ xem roster và điểm danh học sinh thuộc danh sách của buổi; không được thêm học sinh ngoài lớp. | Thu quyền quản lý sĩ số lớp về đúng vai trò vận hành, tránh thay đổi quyền truy cập và công nợ ngoài kiểm soát; thay thế DEC-009, DEC-023 và DEC-024. | Chốt |
| DEC-044 | Giáo viên có danh sách nhiều lớp đang/đã dạy, tìm theo tên và lọc theo trạng thái, thời gian, vai trò; từ lớp mở được toàn bộ buổi trong thời gian mình được phân công. | Thay màn lớp đơn lẻ bằng cấu trúc drill-down `Lớp của tôi → Lịch sử buổi → Chi tiết buổi`; buổi do giáo viên khác dạy thay hiển thị chỉ đọc. | Chốt |
| DEC-045 | Giáo viên thực tế của buổi được sửa điểm danh, trạng thái/nhận xét BTVN, nhận xét buổi và thêm/sửa điểm kiểm tra kể cả sau khi buổi hoàn tất, giáo viên không còn dạy lớp hoặc lớp đã đóng. | “Bất cứ lúc nào” được giới hạn bằng đúng tenant và đúng giáo viên thực tế; mọi sửa đổi có audit cũ–mới, không đổi trạng thái/lương. Điểm kiểm tra là dữ liệu riêng, không phải điểm BTVN. | Chốt |
| DEC-046 | Không thu link online khi tạo lớp, thiết lập ca lặp hoặc chỉnh lịch từng buổi. Giáo viên thực tế nhập link của buổi Online khi check-in. | Tách dữ liệu tổ chức lịch khỏi dữ liệu vận hành của từng buổi; thay thế phần “phòng/link” trong FR-CLS-006 và mock contract lập lịch. | Chốt |
| DEC-047 | Roster của buổi được tính động từ enrollment có hiệu lực theo ngày học cho đến lúc buổi hoàn tất; khi tự hoàn tất hoặc quản lý xác nhận, hệ thống chụp và khóa roster trong cùng transaction. | Enrollment thay đổi về sau không làm sai lịch sử điểm danh. Dữ liệu nháp của học sinh rời roster trước khi khóa được giữ cho audit nhưng không thuộc snapshot chính thức. | Chốt |
| DEC-048 | Lương buổi tính theo số phút lịch và đơn giá có hiệu lực tại ngày học, sau đó làm tròn đến 1 VND bằng `HALF_UP`. | Cho kết quả xác định, nhất quán giữa Scheduler, xác nhận quản lý và các lần chạy idempotent. | Chốt |
| DEC-049 | Local development bootstrap đúng một `superadmin / 123456` ở scope PLATFORM; mọi tài khoản tạo/reset dùng `123456`, `ACTIVE + READY`, không bắt buộc đổi mật khẩu. Super Admin chỉ quản lý tenant/Admin ban đầu; Admin quản lý mọi tài khoản tenant; Học vụ chỉ quản lý GV/HS thuần. | Tách trust boundary nền tảng/tenant, loại runtime demo seed, đơn giản hóa nghiệm thu local; thay thế phần `MUST_CHANGE` của DEC-008/011 và FR-IAM-003 trong phạm vi development hiện tại. | Chốt |
| DEC-050 | Enrollment dùng khoảng ngày nửa mở `[effective_from, effective_to)`, chỉ một bản ghi `Active` cho mỗi học sinh/lớp; rời/chuyển lớp đóng bản ghi hiện tại và vào lại luôn tạo enrollment cùng khoản `Unpaid` mới. | Bảo toàn lịch sử bất biến, cho phép vào lại và làm rõ hiệu lực mất quyền ngay trong ngày theo `Asia/Ho_Chi_Minh`. Dữ liệu `effective_to` cũ được cộng một ngày khi migrate để giữ nguyên ý nghĩa. | Chốt |
| DEC-051 | Thêm enrollment hàng loạt là all-or-nothing; vượt sĩ số/sức chứa phòng tương lai hoặc trùng lịch học sinh là cảnh báo có ID phải xác nhận. Mọi API ghi FL-06 dùng idempotency key và optimistic version. | Tránh enrollment/học phí/audit dở dang và ngăn thao tác lặp hoặc ghi đè dữ liệu quản lý khác vừa cập nhật. | Chốt |
| DEC-052 | `Scheduled` tự sang `Active` trong chu kỳ Scheduler 30 giây từ buổi đầu chưa hủy; đóng chỉ từ `AwaitingClose`, mở lại chỉ Admin và hủy là terminal. Học sinh mất quyền vẫn thấy thẻ metadata khóa, nhưng API nội dung trả `403`; FL-06 chỉ ghi audit/outbox, không tạo notification mới. | Tách lịch sử khỏi quyền nội dung, giữ hành vi trạng thái xác định và tránh mở rộng delivery notification. URL record bên thứ ba đã lưu ngoài hệ thống không thể bị thu hồi, hệ thống chỉ ngừng trả URL. | Chốt |
| DEC-053 | FL-07 chỉ Admin/Học vụ thay GV, hủy hoặc tạo bù cho buổi `Scheduled`/`PendingConfirmation` chưa check-in; buổi bù giữ ordinal gốc, mỗi buổi hủy chỉ có một successor, chain truy về root. Notification FL-07 chỉ gửi giáo viên bị ảnh hưởng, ghi notification + outbox trong transaction; UI chuông/email worker để FL-14. | Giữ audit/lương/tiến độ xác định, tránh thông báo học sinh ngoài phạm vi đã chốt và ngăn nhiều buổi bù song song cho cùng chuỗi. | Chốt |

## Yêu cầu đã loại khỏi v1

- Tài khoản phụ huynh.
- Học sinh tự sửa thông tin cá nhân.
- Giáo viên gửi/duyệt yêu cầu dạy thay trong hệ thống.
- Hệ số lương hoặc đơn giá riêng theo giáo viên.
- Đồng giảng và chia lương nhiều giáo viên trong một buổi.
- MFA, tenant branding, cổng thanh toán, SMS/Zalo, Google Calendar/Meet.
- Import Excel để tạo tài khoản.
- Giáo viên thêm/bỏ học sinh hoặc quản lý enrollment của lớp.
- Gói thuê bao và quản lý billing SaaS.
- HLD, database schema và đặc tả API trong đợt tài liệu này.

## Quy trình thay đổi

Một thay đổi được chấp nhận khi có: mã `DEC-*` mới, người đề xuất, ngày quyết định, yêu cầu/SRS bị ảnh hưởng, tác động tới flow/wireframe/test và trạng thái phê duyệt. Quyết định cũ được đánh dấu `Thay thế`, không xóa khỏi lịch sử.
