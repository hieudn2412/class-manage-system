import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, BookOpenCheck, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { classRepository } from "../../services/repositories/classRepository";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { classStatusLabels, classStatusTones } from "./classPresentation";
import { hasPermission, PERMISSIONS } from "../../shared/lib/permissions";

type Tab = "overview" | "sessions" | "students" | "materials";

export const ClassDetailPage = () => {
  const tenant = useTenant();
  const { session } = useAuth();
  const { classId = "" } = useParams<{ classId: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const query = useQuery({
    queryKey: ["class-detail", tenant.id, classId],
    queryFn: () => classRepository.getClass(tenant.slug, classId),
    retry: false,
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <StatePanel
        kind="error"
        title="Không tìm thấy hoặc không thể tải lớp"
        description="Lớp có thể không tồn tại, thuộc tenant khác hoặc dữ liệu đang tạm gián đoạn."
        action={
          <Link className="button" to={`/t/${tenant.slug}/app/classes`}>
            <ArrowLeft size={18} aria-hidden="true" />
            Về danh sách lớp
          </Link>
        }
      />
    );
  }

  const item = query.data;
  const canEditDraft = Boolean(
    item.status === "Draft" &&
    session &&
    hasPermission(session.user.roles, PERMISSIONS.MANAGE_CLASSES),
  );
  const progress = Math.round((item.completedSessions / item.totalSessions) * 100);
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Tổng quan" },
    { id: "sessions", label: "Buổi học" },
    { id: "students", label: "Học sinh" },
    { id: "materials", label: "Tài liệu" },
  ];

  return (
    <>
      <Link className="back-link" to={`/t/${tenant.slug}/app/classes`}>
        <ArrowLeft size={17} aria-hidden="true" />
        Danh sách lớp
      </Link>
      <PageHeader
        eyebrow={`WF-06 · ${item.code}`}
        title={item.name}
        subtitle="Trung tâm của tiến độ, lịch, roster và hồ sơ buổi — chế độ chỉ đọc trong vertical slice này."
        actions={
          <>
            <Badge tone={classStatusTones[item.status]}>{classStatusLabels[item.status]}</Badge>
            {canEditDraft ? (
              <Link className="button" to={`/t/${tenant.slug}/app/classes/${item.id}/edit`}>
                Tiếp tục thiết lập
              </Link>
            ) : null}
          </>
        }
      />
      {item.outstandingItems.length ? (
        <div className="detail-alert" role="status">
          <AlertTriangle size={22} aria-hidden="true" />
          <p>
            <strong>{item.outstandingItems.length} việc cần xử lý</strong>
            <br />
            <small>{item.outstandingItems.join(" · ")}</small>
          </p>
        </div>
      ) : null}
      <div className="tabs" role="tablist" aria-label="Nội dung chi tiết lớp">
        {tabs.map((tabItem) => (
          <button
            type="button"
            className={`tab ${tab === tabItem.id ? "active" : ""}`}
            role="tab"
            aria-selected={tab === tabItem.id}
            onClick={() => setTab(tabItem.id)}
            key={tabItem.id}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <section className="metrics-grid" aria-label="Chỉ số lớp học">
            <article className="panel metric-card">
              <p className="metric-label">Tiến độ</p>
              <p className="metric-value">
                {item.completedSessions} / {item.totalSessions}
              </p>
              <p className="metric-detail">{progress}% lộ trình</p>
            </article>
            <article className="panel metric-card">
              <p className="metric-label">Chuyên cần</p>
              <p className="metric-value">{formatPercent(item.attendanceRate)}</p>
              <p className="metric-detail">{item.studentCount} học sinh hiện tại</p>
            </article>
            <article className="panel metric-card">
              <p className="metric-label">BTVN đã hoàn thành</p>
              <p className="metric-value">{formatPercent(item.homeworkCompletionRate)}</p>
              <p className="metric-detail">Theo các bài đã giao</p>
            </article>
            <article className="panel metric-card">
              <p className="metric-label">Dự kiến kết thúc</p>
              <p className="metric-value metric-value-date">
                {item.expectedEndDate ? formatDate(item.expectedEndDate) : "Đủ buổi"}
              </p>
              <p className="metric-detail">{item.scheduleSummary}</p>
            </article>
          </section>
          <div className="detail-grid">
            <section className="panel-flat section-panel">
              <h2 className="section-title">Thông tin vận hành</h2>
              <dl className="definition-grid">
                <div className="definition-item">
                  <dt>Giáo viên chính</dt>
                  <dd>{item.teacher.name}</dd>
                </div>
                <div className="definition-item">
                  <dt>Đơn giá/giờ</dt>
                  <dd>{formatCurrency(item.hourlyRate)}</dd>
                </div>
                <div className="definition-item">
                  <dt>Phòng / hình thức</dt>
                  <dd>
                    {item.room} · {item.deliveryMode}
                  </dd>
                </div>
                <div className="definition-item">
                  <dt>Bài gần nhất</dt>
                  <dd>{item.currentLesson}</dd>
                </div>
              </dl>
            </section>
            <section className="panel-flat section-panel">
              <h2 className="section-title">Hồ sơ buổi gần đây</h2>
              {item.sessions.length ? (
                <ul className="record-list">
                  {item.sessions.map((session) => (
                    <li key={session.id}>
                      <span>
                        <strong>
                          Buổi {session.ordinal} · {session.lessonName}
                        </strong>
                        <small>
                          {formatDateTime(session.startAt)} · {session.teacherName}
                        </small>
                      </span>
                      <Badge tone={session.recordStatus === "COMPLETE" ? "success" : "warning"}>
                        {session.recordStatus === "COMPLETE" ? "Đủ hồ sơ" : "Thiếu record"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">Chưa có hồ sơ buổi để hiển thị.</p>
              )}
            </section>
          </div>
        </>
      ) : null}

      {tab === "sessions" ? (
        item.sessions.length ? (
          <div className="table-shell">
            <table className="data-table">
              <caption className="sr-only">Các buổi học của {item.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Buổi</th>
                  <th scope="col">Thời gian</th>
                  <th scope="col">Bài học</th>
                  <th scope="col">Giáo viên</th>
                  <th scope="col">Chuyên cần</th>
                  <th scope="col">Record</th>
                </tr>
              </thead>
              <tbody>
                {item.sessions.map((session) => (
                  <tr key={session.id}>
                    <td>#{session.ordinal}</td>
                    <td>{formatDateTime(session.startAt)}</td>
                    <td>{session.lessonName}</td>
                    <td>{session.teacherName}</td>
                    <td>
                      {session.attendanceRate === null
                        ? "Chưa điểm danh"
                        : formatPercent(session.attendanceRate)}
                    </td>
                    <td>
                      <Badge tone={session.recordStatus === "COMPLETE" ? "success" : "warning"}>
                        {session.recordStatus === "COMPLETE" ? "Đã có" : "Còn thiếu"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StatePanel
            kind="empty"
            title="Chưa có buổi học"
            description="Danh sách buổi sẽ xuất hiện khi lịch được sinh ở vertical slice tạo lớp."
          />
        )
      ) : null}

      {tab === "students" ? (
        <StatePanel
          kind="empty"
          title={`${item.studentCount} học sinh đang tham gia`}
          description="Roster chi tiết chỉ đọc sẽ được nối khi backend cung cấp contract enrollment. Giáo viên không có quyền thêm hoặc bỏ học sinh."
          action={<Users size={30} aria-hidden="true" />}
        />
      ) : null}

      {tab === "materials" ? (
        <StatePanel
          kind="empty"
          title="Chưa có tài liệu trong mock dataset"
          description="Tài liệu PDF/audio thuộc vertical slice học tập tiếp theo."
          action={<BookOpenCheck size={30} aria-hidden="true" />}
        />
      ) : null}
    </>
  );
};
