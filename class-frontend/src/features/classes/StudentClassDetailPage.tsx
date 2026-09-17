import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  ExternalLink,
  MessageSquareText,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { lifecycleRepository } from "../../services/repositories/lifecycleRepository";
import { formatDate, formatDateTime } from "../../shared/lib/format";
import type { StudentTestResult } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { classStatusLabels, classStatusTones } from "./classPresentation";
import { ClassMaterialsPanel } from "../content/ClassMaterialsPanel";

const attendanceLabels: Record<string, string> = {
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  LEFT_EARLY: "Về sớm",
  ABSENT_EXCUSED: "Vắng có phép",
  ABSENT_UNEXCUSED: "Vắng không phép",
};

const scoreFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

const TestResultCard = ({ result }: { result: StudentTestResult }) => {
  const percentage =
    result.score === null ? 0 : Math.min(100, Math.round((result.score / result.maxScore) * 100));

  return (
    <section className="student-test-result" aria-label={`Kết quả ${result.testName}`}>
      <div className="student-test-heading">
        <span className="session-detail-label">
          <ClipboardCheck size={16} aria-hidden="true" />
          Kết quả kiểm tra
        </span>
        <small>{formatDate(result.testDate)}</small>
      </div>
      <div className="student-test-body">
        <div className="student-test-score">
          <strong>{result.score === null ? "—" : scoreFormatter.format(result.score)}</strong>
          <span>/ {scoreFormatter.format(result.maxScore)}</span>
        </div>
        <div className="student-test-copy">
          <h4>{result.testName}</h4>
          {result.score === null ? (
            <p>Giáo viên chưa cập nhật điểm.</p>
          ) : (
            <div
              className="student-score-progress"
              role="progressbar"
              aria-label={`Điểm ${scoreFormatter.format(result.score)} trên ${scoreFormatter.format(result.maxScore)}`}
              aria-valuemin={0}
              aria-valuemax={result.maxScore}
              aria-valuenow={result.score}
            >
              <span style={{ width: `${percentage}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="student-test-comments">
        <div>
          <span>Nhận xét của giáo viên</span>
          <p>{result.comment || "Chưa có nhận xét riêng cho bài kiểm tra."}</p>
        </div>
        {result.testComment ? (
          <div>
            <span>Ghi chú bài kiểm tra</span>
            <p>{result.testComment}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export const StudentClassDetailPage = () => {
  const tenant = useTenant();
  const { classId = "" } = useParams<{ classId: string }>();
  const detail = useQuery({
    queryKey: ["student-class-detail", tenant.id, classId],
    queryFn: () => lifecycleRepository.studentClass(tenant.slug, classId),
    retry: false,
  });
  const sessions = useQuery({
    queryKey: ["student-class-sessions", tenant.id, classId],
    queryFn: () => lifecycleRepository.studentSessions(tenant.slug, classId, 1, 100),
    retry: false,
  });

  if (detail.isPending || sessions.isPending) return <PageSkeleton />;
  if (detail.isError || sessions.isError || !detail.data || !sessions.data) {
    return (
      <StatePanel
        kind="error"
        title="Nội dung lớp không khả dụng"
        description="Bạn không còn quyền truy cập hoặc lớp không thuộc tài khoản này."
        action={
          <Link className="button" to={`/t/${tenant.slug}/app/learning-classes`}>
            <ArrowLeft size={17} />
            Lớp của tôi
          </Link>
        }
      />
    );
  }
  const item = detail.data;

  return (
    <>
      <Link className="back-link" to={`/t/${tenant.slug}/app/learning-classes`}>
        <ArrowLeft size={17} aria-hidden="true" />
        Lớp của tôi
      </Link>
      <PageHeader
        eyebrow={item.code}
        title={item.name}
        subtitle={`${item.teacherName} · ${item.scheduleSummary || "Lịch linh hoạt"}`}
        actions={
          <Badge tone={classStatusTones[item.status]}>{classStatusLabels[item.status]}</Badge>
        }
      />
      <section className="student-class-summary" aria-label="Tóm tắt lớp">
        <div>
          <span>Tiến độ</span>
          <strong>
            {item.completedSessions}/{item.totalSessions} buổi
          </strong>
        </div>
        <div>
          <span>Dự kiến kết thúc</span>
          <strong>
            {item.expectedEndDate ? formatDate(item.expectedEndDate) : "Chưa xác định"}
          </strong>
        </div>
        <div>
          <span>Mô tả</span>
          <strong>{item.description || "Không có mô tả"}</strong>
        </div>
      </section>
      <section className="learning-session-section" aria-labelledby="learning-sessions-heading">
        <ClassMaterialsPanel tenantSlug={tenant.slug} classId={classId} canManage={false} />
        <div className="learning-section-heading">
          <div>
            <span className="eyebrow">NHẬT KÝ HỌC TẬP</span>
            <h2 id="learning-sessions-heading">Các buổi của tôi</h2>
          </div>
          <Badge>{sessions.data.totalItems} buổi</Badge>
        </div>
        {!sessions.data.items.length ? (
          <StatePanel
            kind="empty"
            title="Chưa có buổi trong thời gian tham gia"
            description="Các buổi thuộc thời gian bạn tham gia lớp sẽ xuất hiện tại đây."
          />
        ) : (
          <div className="student-session-list">
            {sessions.data.items.map((session) => (
              <article className="student-session-card" key={session.id}>
                <header>
                  <span className="session-ordinal">
                    {String(session.ordinal).padStart(2, "0")}
                  </span>
                  <span>
                    <small>{formatDateTime(session.startAt)}</small>
                    <h3>{session.lessonName || `Buổi ${session.ordinal}`}</h3>
                    <small>{session.teacherName}</small>
                  </span>
                  <Badge tone={session.attendanceStatus ? "success" : "neutral"}>
                    {session.attendanceStatus
                      ? attendanceLabels[session.attendanceStatus]
                      : "Chưa điểm danh"}
                  </Badge>
                </header>
                <div className="student-session-content">
                  <div>
                    <span className="session-detail-label">
                      <CalendarDays size={15} />
                      Nội dung thực dạy
                    </span>
                    <p>{session.lessonContent || "Giáo viên chưa cập nhật nội dung."}</p>
                    {session.attendanceNote ? (
                      <small>Ghi chú điểm danh: {session.attendanceNote}</small>
                    ) : null}
                  </div>
                  <div>
                    <span className="session-detail-label">
                      <MessageSquareText size={15} />
                      Nhận xét
                    </span>
                    <p>{session.comment || "Chưa có nhận xét riêng."}</p>
                    {session.recordUrl ? (
                      <a
                        className="record-link"
                        href={session.recordUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Mở bản ghi buổi học <ExternalLink size={15} aria-hidden="true" />
                      </a>
                    ) : (
                      <small>Chưa có bản ghi buổi học.</small>
                    )}
                  </div>
                </div>
                {session.testResult ? <TestResultCard result={session.testResult} /> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
};
