import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, FileWarning, LockKeyhole } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import { formatDateTime } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { PageHeader } from "../../shared/ui/PageHeader";
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

export const MyClassSessionsPage = () => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const { classId = "" } = useParams<{ classId: string }>();
  const [params, setParams] = useSearchParams();
  const page = Math.max(Number(params.get("page") ?? "1"), 1);
  const query = useQuery({
    queryKey: ["teacher-class-sessions", tenant.id, classId, page],
    queryFn: () => teachingRepository.getClassSessions(tenant.slug, classId, page, 20),
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
  return (
    <>
      <Link className="back-link" to={`/t/${tenant.slug}/app/my-classes`}>
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại Lớp của tôi
      </Link>
      <PageHeader
        eyebrow={`${learningClass.code} · WF-26`}
        title={learningClass.name}
        subtitle={`Đã hoàn tất ${learningClass.completedSessions}/${learningClass.totalSessions} buổi. Mở từng buổi để xem roster, nhận xét và điểm kiểm tra.`}
      />
      {sessions.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Lớp chưa có buổi học"
          description="Các buổi đã lên lịch hoặc đã dạy sẽ xuất hiện tại đây."
        />
      ) : (
        <>
          <div className="teacher-history-list">
            {sessions.items.map((item) => (
              <article className="panel teacher-history-card" key={item.id}>
                <div className="teacher-history-ordinal">
                  <small>BUỔI</small>
                  <strong>{item.ordinal}</strong>
                </div>
                <div className="teacher-history-main">
                  <header>
                    <h2>{item.lessonName || "Chưa nhập tên bài học"}</h2>
                    <Badge
                      tone={
                        item.status === "COMPLETED"
                          ? "success"
                          : item.status === "CANCELLED"
                            ? "danger"
                            : "info"
                      }
                    >
                      {statusLabel(item.status)}
                    </Badge>
                  </header>
                  <p>
                    {formatDateTime(item.startAt)} · {item.actualTeacherName}
                  </p>
                  <div className="history-meta">
                    <span>
                      Tham gia: {item.participatedStudents}/{item.rosterStudents}
                    </span>
                    <span>{item.testResultCount} kết quả kiểm tra</span>
                    {item.readOnly ? (
                      <span>
                        <LockKeyhole size={15} aria-hidden="true" /> Chỉ đọc
                      </span>
                    ) : null}
                    {item.missingDocumentation ? (
                      <span className="text-warning">
                        <FileWarning size={15} aria-hidden="true" /> Thiếu hồ sơ
                      </span>
                    ) : null}
                  </div>
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
            onPageChange={(value) => {
              const next = new URLSearchParams(params);
              next.set("page", String(value));
              setParams(next);
            }}
          />
        </>
      )}
    </>
  );
};
