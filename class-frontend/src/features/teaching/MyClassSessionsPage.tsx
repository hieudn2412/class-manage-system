import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileWarning,
  FilterX,
  LockKeyhole,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import { formatDateTime } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Select } from "../../shared/ui/FormField";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";

const statusLabel = (value: string) =>
  ({
    SCHEDULED: "Đã lên lịch",
    IN_PROGRESS: "Đang diễn ra",
    COMPLETED: "Đã hoàn tất",
    PENDING_CONFIRMATION: "Chờ xác nhận",
    CANCELLED: "Đã hủy",
  })[value] ?? value;

const classStatusLabel = (value: string) =>
  ({
    SCHEDULED: "Đã xếp lịch",
    ACTIVE: "Đang dạy",
    AWAITING_CLOSE: "Chờ kết thúc",
    CLOSED: "Đã đóng",
    CANCELLED: "Đã hủy",
  })[value] ?? value;

export const MyClassSessionsPage = () => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const { classId = "" } = useParams<{ classId: string }>();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const page = Math.max(Number(params.get("page") ?? "1"), 1);
  const setFilter = (key: "status" | "page", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  };
  const query = useQuery({
    queryKey: ["teacher-class-sessions", tenant.id, classId, status, page],
    queryFn: () =>
      teachingRepository.getClassSessions(tenant.slug, classId, {
        status,
        page,
        pageSize: 20,
      }),
    enabled: Boolean(classId),
    placeholderData: (previous) => previous,
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <StatePanel
        kind="error"
        title="Không thể tải lịch sử buổi"
        description="Lớp có thể không còn thuộc phạm vi giảng dạy của bạn hoặc kết nối bị gián đoạn."
        actionLabel="Thử lại"
        onAction={() => void query.refetch()}
      />
    );
  }

  const { learningClass, sessions } = query.data;
  const progress = Math.round(
    Math.min(
      (learningClass.completedSessions / Math.max(learningClass.totalSessions, 1)) * 100,
      100,
    ),
  );
  return (
    <div className="teaching-page teacher-class-sessions-page">
      <Link className="back-link" to={`/t/${tenant.slug}/app/my-classes`}>
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại Lớp của tôi
      </Link>
      <section className="panel teacher-class-hero" aria-labelledby="teacher-class-title">
        <div className="teacher-class-hero-main">
          <div>
            <p className="eyebrow">{learningClass.code} · WF-26</p>
            <h1 className="page-title" id="teacher-class-title">
              {learningClass.name}
            </h1>
            <p className="subtitle">
              Mở từng buổi để xem danh sách học sinh, nhận xét và kết quả kiểm tra.
            </p>
          </div>
          <Badge
            tone={
              learningClass.status === "CANCELLED"
                ? "danger"
                : learningClass.status === "CLOSED"
                  ? "neutral"
                  : "info"
            }
          >
            {classStatusLabel(learningClass.status)}
          </Badge>
        </div>
        <div className="teacher-class-hero-progress">
          <span>
            <strong>
              {learningClass.completedSessions}/{learningClass.totalSessions}
            </strong>
            <small>buổi đã hoàn tất</small>
          </span>
          <div className="progress-track" aria-label={`Tiến độ lớp ${progress}%`}>
            <div className="progress-value" style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
        </div>
      </section>

      <section className="panel-flat teacher-session-toolbar" aria-label="Lọc lịch sử buổi">
        <Select
          label="Trạng thái buổi"
          value={status}
          onChange={(event) => setFilter("status", event.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="SCHEDULED">Đã lên lịch</option>
          <option value="IN_PROGRESS">Đang diễn ra</option>
          <option value="PENDING_CONFIRMATION">Chờ xác nhận</option>
          <option value="COMPLETED">Đã hoàn tất</option>
          <option value="CANCELLED">Đã hủy</option>
        </Select>
        <div className="teacher-session-result" aria-live="polite">
          <CalendarDays size={18} aria-hidden="true" />
          <span>
            <strong>{sessions.totalItems}</strong> buổi phù hợp
          </span>
        </div>
        {status ? (
          <Button variant="ghost" onClick={() => setFilter("status", "")}>
            <FilterX size={16} aria-hidden="true" />
            Xóa bộ lọc
          </Button>
        ) : null}
      </section>

      {sessions.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title={status ? "Không có buổi học phù hợp" : "Lớp chưa có buổi học"}
          description={
            status
              ? "Hãy chọn trạng thái khác hoặc xóa bộ lọc để xem toàn bộ lịch sử."
              : "Các buổi đã lên lịch hoặc đã dạy sẽ xuất hiện tại đây."
          }
          action={
            status ? (
              <Button variant="secondary" onClick={() => setFilter("status", "")}>
                Xem tất cả buổi
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="teacher-history-list teacher-session-timeline">
            {sessions.items.map((item) => (
              <article className="panel teacher-history-card" key={item.id}>
                <div className="teacher-history-ordinal">
                  <small>BUỔI</small>
                  <strong>{item.ordinal}</strong>
                </div>
                <div className="teacher-history-main">
                  <h2>{item.lessonName || "Chưa nhập tên bài học"}</h2>
                  <p>
                    {formatDateTime(item.startAt)} · {item.actualTeacherName}
                  </p>
                  <div className="history-meta">
                    <span>
                      Tham gia: {item.participatedStudents}/{item.rosterStudents}
                    </span>
                    {item.hasTest ? (
                      <Badge tone="warning">
                        <ClipboardCheck size={14} aria-hidden="true" /> Kiểm tra
                      </Badge>
                    ) : null}
                    {item.readOnly ? (
                      <span>
                        <LockKeyhole size={15} aria-hidden="true" /> Chỉ đọc
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="teacher-history-status">
                  <Badge
                    tone={
                      item.status === "COMPLETED"
                        ? "success"
                        : item.status === "CANCELLED"
                          ? "danger"
                          : item.status === "PENDING_CONFIRMATION"
                            ? "warning"
                            : "info"
                    }
                  >
                    {statusLabel(item.status)}
                  </Badge>
                  {item.missingDocumentation ? (
                    <small>
                      <FileWarning size={14} aria-hidden="true" /> Cần bổ sung hồ sơ
                    </small>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void navigate(`/t/${tenant.slug}/app/sessions/${item.id}`)}
                >
                  Xem buổi
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </article>
            ))}
          </div>
          <Pagination
            page={sessions.page}
            totalPages={sessions.totalPages}
            totalItems={sessions.totalItems}
            itemLabel="buổi"
            onPageChange={(value) => setFilter("page", String(value))}
          />
        </>
      )}
    </div>
  );
};
