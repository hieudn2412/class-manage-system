import type { ApiErrorCode, ApiErrorPayload } from "../types/api";

const apiErrorMessages: Partial<Record<ApiErrorCode, string>> = {
  INVALID_CREDENTIALS: "Tên đăng nhập hoặc mật khẩu chưa đúng. Vui lòng kiểm tra và thử lại.",
  ACCOUNT_LOCKED:
    "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên trung tâm để được hỗ trợ.",
  TENANT_LOCKED: "Trung tâm đang tạm khóa. Vui lòng liên hệ quản trị viên hệ thống.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.",
  UNAUTHENTICATED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  TENANT_REQUIRED:
    "Không xác định được trung tâm đang sử dụng. Vui lòng mở lại từ trang đăng nhập.",
  FORBIDDEN: "Bạn chưa được cấp quyền thực hiện thao tác này.",
  PASSWORD_CHANGE_REQUIRED: "Bạn cần tạo mật khẩu mới trước khi tiếp tục.",
  PASSWORD_CHANGE_NOT_REQUIRED: "Tài khoản này không cần đổi mật khẩu lúc này.",
  PASSWORD_STATE_CHANGED: "Trạng thái mật khẩu đã thay đổi. Vui lòng đăng nhập lại.",
  CURRENT_PASSWORD_INVALID: "Mật khẩu hiện tại chưa đúng. Vui lòng kiểm tra và thử lại.",
  PASSWORD_REUSE_NOT_ALLOWED: "Mật khẩu mới cần khác mật khẩu hiện tại.",
  PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ của bạn. Vui lòng tải lại trang hoặc đăng nhập lại.",
  NOT_FOUND: "Không tìm thấy nội dung bạn cần. Nội dung có thể đã được chuyển hoặc xóa.",
  VALIDATION_ERROR: "Một số thông tin chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.",
  SCHEDULE_CONFLICT: "Lịch đang bị trùng. Vui lòng điều chỉnh thời gian, giáo viên hoặc phòng học.",
  SCHEDULE_PREVIEW_STALE:
    "Lịch đã thay đổi từ lần kiểm tra gần nhất. Vui lòng kiểm tra lại trước khi lưu.",
  WARNING_CONFIRMATION_REQUIRED: "Vui lòng xem và xác nhận các cảnh báo trước khi tiếp tục.",
  PREVIEW_STALE: "Thông tin xem trước đã cũ. Vui lòng kiểm tra lại trước khi lưu.",
  OPTIMISTIC_LOCK_CONFLICT:
    "Nội dung vừa được người khác cập nhật. Vui lòng tải lại và thực hiện lại thay đổi.",
  TEACHER_OVERLAP: "Giáo viên đã có buổi dạy khác trong thời gian này.",
  ROOM_OVERLAP: "Phòng học đã được sử dụng trong thời gian này.",
  STUDENT_OVERLAP: "Một hoặc nhiều học sinh đã có lịch học trong thời gian này.",
  SAME_TEACHER: "Giáo viên được chọn đang là giáo viên của buổi học.",
  MAKEUP_ALREADY_EXISTS: "Buổi học này đã có lịch học bù.",
  MAKEUP_START_IN_PAST: "Thời gian học bù phải sau thời điểm hiện tại.",
  PREVIEW_REQUIRED: "Vui lòng kiểm tra thay đổi trước khi lưu.",
  INVALID_TIME_RANGE: "Thời gian bắt đầu phải sớm hơn thời gian kết thúc.",
  ROOM_REQUIRED: "Vui lòng chọn phòng cho buổi học tại trung tâm.",
  ONLINE_ROOM_NOT_ALLOWED: "Buổi học trực tuyến không cần chọn phòng.",
  CHECK_IN_TOO_EARLY:
    "Chưa đến thời gian xác nhận buổi dạy. Bạn có thể xác nhận từ 30 phút trước giờ học.",
  CHECK_IN_WINDOW_CLOSED: "Đã hết thời gian xác nhận buổi dạy. Vui lòng liên hệ quản lý học vụ.",
  ONLINE_LINK_REQUIRED: "Vui lòng nhập đường dẫn học trực tuyến trước khi xác nhận buổi dạy.",
  NOT_ACTUAL_TEACHER: "Chỉ giáo viên đang phụ trách buổi học mới có thể thực hiện thao tác này.",
  SESSION_NOT_IN_SCOPE: "Bạn không có quyền xem hoặc cập nhật buổi học này.",
  ROSTER_CHANGED: "Danh sách học sinh vừa thay đổi. Vui lòng tải lại trước khi lưu.",
  SESSION_STATE_CONFLICT: "Trạng thái buổi học vừa thay đổi. Vui lòng tải lại và kiểm tra.",
  TEST_SCORE_INVALID: "Điểm kiểm tra chưa hợp lệ. Vui lòng kiểm tra lại.",
  DUPLICATE_TENANT_SLUG: "Đường dẫn trung tâm đã được sử dụng. Vui lòng chọn đường dẫn khác.",
  DUPLICATE_USERNAME: "Tên đăng nhập đã tồn tại trong trung tâm.",
  DUPLICATE_EMAIL: "Email này đã được dùng cho tài khoản khác. Vui lòng nhập email khác.",
  INVALID_ROLE_COMBINATION: "Các vai trò đã chọn chưa thể dùng cùng nhau. Vui lòng chọn lại.",
  LAST_ACTIVE_ADMIN: "Cần giữ lại ít nhất một quản trị viên trung tâm đang hoạt động.",
  SELF_MANAGEMENT_FORBIDDEN:
    "Bạn không thể tự thay đổi trạng thái hoặc quyền của tài khoản đang dùng.",
  INITIAL_ADMIN_NOT_FOUND: "Không tìm thấy quản trị viên đầu tiên của trung tâm.",
  VERSION_CONFLICT: "Thông tin vừa được cập nhật ở nơi khác. Vui lòng tải lại trước khi lưu.",
  CLASS_STATE_CONFLICT: "Trạng thái lớp vừa thay đổi. Vui lòng tải lại và kiểm tra.",
  CLASS_VERSION_CONFLICT: "Thông tin lớp vừa được cập nhật. Vui lòng tải lại trước khi lưu.",
  ENROLLMENT_VERSION_CONFLICT:
    "Thông tin ghi danh vừa được cập nhật. Vui lòng tải lại trước khi lưu.",
  ACTIVE_ENROLLMENT_EXISTS: "Học sinh này đang tham gia lớp.",
  ENROLLMENT_NOT_ACTIVE: "Lượt ghi danh này không còn hiệu lực.",
  ENROLLMENT_BATCH_INVALID:
    "Một hoặc nhiều học sinh chưa thể được thêm vào lớp. Vui lòng kiểm tra lại danh sách.",
  WARNINGS_NOT_ACKNOWLEDGED: "Vui lòng xem và xác nhận các cảnh báo trước khi tiếp tục.",
  OVERPAYMENT_CONFIRMATION_REQUIRED:
    "Số tiền trả đang lớn hơn số tiền còn lại. Vui lòng kiểm tra và xác nhận.",
  PAYMENT_REFERENCE_REQUIRED: "Vui lòng nhập mã tham chiếu cho khoản chuyển khoản.",
  ADJUSTMENT_AMOUNT_REQUIRED: "Vui lòng nhập số tiền cần cộng hoặc trừ.",
  HOURLY_RATE_NOT_FOUND: "Chưa có đơn giá dạy phù hợp cho buổi học này.",
  STUDENT_CLASS_ACCESS_REVOKED: "Bạn không còn quyền truy cập nội dung của lớp này.",
  UPLOAD_FAILED: "Không thể tải tệp lên. Vui lòng kiểm tra kết nối và thử lại.",
  FILE_REQUIRED: "Vui lòng chọn ít nhất một tệp.",
  FILE_TYPE_NOT_ALLOWED: "Định dạng tệp này chưa được hỗ trợ.",
  FILE_TOO_LARGE: "Tệp vượt quá dung lượng cho phép.",
  FILE_SIGNATURE_MISMATCH: "Nội dung tệp không khớp với định dạng đã chọn.",
  MALWARE_DETECTED: "Tệp không vượt qua bước kiểm tra an toàn. Vui lòng chọn tệp khác.",
  CLAMAV_UNAVAILABLE: "Chưa thể kiểm tra độ an toàn của tệp. Vui lòng thử lại sau.",
  TENANT_QUOTA_EXCEEDED:
    "Trung tâm đã dùng hết hạn mức dung lượng. Vui lòng xóa bớt tệp hoặc liên hệ quản trị viên.",
  STAGING_TOKEN_INVALID: "Tệp tải lên đã hết hiệu lực. Vui lòng chọn và tải tệp lên lại.",
  HOMEWORK_NOT_FOUND: "Không tìm thấy bài tập về nhà hoặc bạn không còn quyền truy cập.",
  HOMEWORK_ALREADY_EXISTS_FOR_SESSION: "Buổi học này đã có bài tập về nhà.",
  MATERIAL_NOT_FOUND: "Không tìm thấy tài liệu hoặc bạn không còn quyền truy cập.",
  CONTENT_STATE_CONFLICT: "Nội dung vừa thay đổi. Vui lòng tải lại trước khi tiếp tục.",
  GMAIL_NOT_CONFIGURED: "Tính năng gửi thông báo qua Gmail chưa được thiết lập.",
  GMAIL_OAUTH_STATE_INVALID: "Yêu cầu kết nối Gmail không hợp lệ. Vui lòng bắt đầu lại.",
  GMAIL_OAUTH_STATE_EXPIRED: "Yêu cầu kết nối Gmail đã hết hạn. Vui lòng bắt đầu lại.",
  GMAIL_OAUTH_STATE_USED:
    "Yêu cầu kết nối Gmail này đã được sử dụng. Vui lòng bắt đầu lại nếu cần.",
  GMAIL_SCOPE_MISSING:
    "Gmail chưa cấp đủ quyền gửi thư. Vui lòng kết nối lại và chấp nhận quyền được yêu cầu.",
  GMAIL_EMAIL_UNVERIFIED: "Địa chỉ Gmail chưa được Google xác minh. Vui lòng chọn tài khoản khác.",
  GMAIL_CONNECTION_REQUIRED: "Vui lòng kết nối Gmail trước khi gửi email thông báo.",
  GMAIL_REAUTH_REQUIRED: "Kết nối Gmail đã hết hiệu lực. Vui lòng kết nối lại trước khi gửi.",
  GMAIL_VERSION_CONFLICT: "Kết nối Gmail vừa được cập nhật ở nơi khác. Vui lòng tải lại trang.",
  GMAIL_RATE_LIMITED: "Gmail đang tạm giới hạn số lượt gửi. Vui lòng đợi rồi thử lại.",
  GMAIL_SEND_FAILED: "Không thể gửi thư qua Gmail. Vui lòng kiểm tra kết nối và thử lại.",
  SALARY_NOTIFICATION_ALREADY_SENT:
    "Một số giáo viên đã có thông báo cho kỳ lương này. Vui lòng kiểm tra trước khi gửi lại.",
  TEACHER_NOT_FOUND: "Không tìm thấy giáo viên. Danh sách có thể vừa được cập nhật.",
  SERVER_ERROR: "Hệ thống chưa thể xử lý yêu cầu. Vui lòng thử lại sau.",
};

const friendlierTerms: Array<[RegExp, string]> = [
  [/\btenant\b/gi, "trung tâm"],
  [/\bcheck-?in\b/gi, "xác nhận buổi dạy"],
  [/\brecord\b/gi, "bản ghi buổi học"],
  [/\baudit\b/gi, "lịch sử thay đổi"],
  [/\brevision\b/gi, "lần cập nhật"],
  [/\bversion\b/gi, "lần cập nhật"],
  [/\benrollment\b/gi, "lượt ghi danh"],
  [/\bquota\b/gi, "hạn mức dung lượng"],
  [/\bdeadline\b/gi, "hạn nộp"],
  [/\bupload\b/gi, "tải lên"],
];

export const normalizeUserFacingText = (message: string): string =>
  friendlierTerms.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    message,
  );

export const getApiErrorMessage = (
  payload: Partial<ApiErrorPayload>,
  fallback = "Hệ thống chưa thể xử lý yêu cầu. Vui lòng thử lại sau.",
): string => {
  const mapped = payload.code ? apiErrorMessages[payload.code] : undefined;
  return mapped ?? normalizeUserFacingText(payload.message ?? payload.detail ?? fallback);
};
