import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import { formatCurrency, formatDate, formatDateTime } from "../../shared/lib/format";
import type { CheckInState } from "../../shared/types/domain";
import { Badge, type BadgeTone } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";

const checkInLabels: Record<CheckInState, { label: string; tone: BadgeTone }> = {
  TOO_EARLY: { label: "Chưa đến giờ xác nhận", tone: "neutral" },
  OPEN: { label: "Có thể xác nhận", tone: "success" },
  CHECKED_IN: { label: "Đã xác nhận", tone: "info" },
  WINDOW_CLOSED: { label: "Chờ quản lý xác nhận", tone: "warning" },
  COMPLETED: { label: "Đã hoàn tất", tone: "success" },
  CANCELLED: { label: "Đã hủy", tone: "danger" },
};

export const TeacherDashboardPage = () => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["teacher-dashboard", tenant.id],
    queryFn: () => teachingRepository.getDashboard(tenant.slug),
    refetchInterval: 60_000,
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <StatePanel
        kind="error"
        title="Không thể tải trang tổng quan giảng dạy"
        description="Lịch hôm nay và trạng thái xác nhận buổi dạy chưa thể tải."
        actionLabel="Thử lại"
        onAction={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  const metrics = [
    { label: "Buổi hôm nay", value: data.metrics.todaySessions, icon: CalendarDays },
    { label: "Có thể xác nhận", value: data.metrics.checkInAvailable, icon: CheckCircle2 },
    { label: "Thiếu hồ sơ", value: data.metrics.missingDocumentation, icon: BookOpen },
    { label: "Giờ dạy tháng", value: data.metrics.monthTeachingHours, icon: Clock3 },
  ];

  return (
    <>
      <PageHeader
        eyebrow={formatDate(data.date)}
        title={`Chào ${data.teacherName}`}
        subtitle="Theo dõi lịch hôm nay, xác nhận buổi dạy đúng giờ và hoàn thiện hồ sơ sau buổi."
        actions={
          <Button onClick={() => void navigate(`/t/${tenant.slug}/app/my-classes`)}>
            Lớp của tôi
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        }
      />

      <section className="metrics-grid teaching-metrics" aria-label="Chỉ số giảng dạy">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article className="panel metric-card" key={label}>
            <div className="metric-card-head">
              <p className="metric-label">{label}</p>
              <Icon size={20} aria-hidden="true" />
            </div>
            <p className="metric-value">{value}</p>
          </article>
        ))}
        <article className="panel metric-card">
          <div className="metric-card-head">
            <p className="metric-label">Lương phát sinh tháng</p>
            <Wallet size={20} aria-hidden="true" />
          </div>
          <p className="metric-value metric-currency">
            {formatCurrency(data.metrics.monthAccruedSalary)}
          </p>
          <p className="metric-detail">Số tạm tính từ các buổi đã hoàn tất</p>
        </article>
      </section>

      <section className="panel-flat section-panel" aria-labelledby="today-sessions-title">
        <div className="section-heading-row">
          <span>
            <h2 className="section-title" id="today-sessions-title">
              Buổi dạy hôm nay
            </h2>
            <p>Thời gian xác nhận buổi dạy được tính theo giờ Việt Nam.</p>
          </span>
        </div>
        {data.sessions.length === 0 ? (
          <StatePanel
            kind="empty"
            title="Hôm nay bạn không có buổi dạy"
            description="Bạn có thể xem lịch tuần hoặc lịch sử các lớp đã tham gia."
          />
        ) : (
          <div className="teacher-session-list">
            {data.sessions.map((session) => {
              const state = checkInLabels[session.checkInState];
              return (
                <article className="teacher-session-card" key={session.id}>
                  <div className="teacher-session-time">
                    <strong>
                      {new Intl.DateTimeFormat("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Ho_Chi_Minh",
                      }).format(new Date(session.startAt))}
                    </strong>
                    <small>{formatDateTime(session.endAt).split(",").at(-1)}</small>
                  </div>
                  <div className="teacher-session-main">
                    <span className="class-code">{session.classCode}</span>
                    <h3>
                      {session.className} · Buổi {session.ordinal}
                    </h3>
                    <p>
                      {session.mode === "ONLINE"
                        ? "Trực tuyến"
                        : (session.roomName ?? "Chưa xếp phòng")}
                      {session.substitution ? " · Dạy thay" : ""}
                    </p>
                  </div>
                  <Badge tone={state.tone}>{state.label}</Badge>
                  <Button
                    variant={session.checkInState === "OPEN" ? "primary" : "secondary"}
                    onClick={() => void navigate(`/t/${tenant.slug}/app/sessions/${session.id}`)}
                  >
                    {session.checkInState === "OPEN"
                      ? "Xác nhận buổi dạy"
                      : session.checkInState === "CHECKED_IN"
                        ? "Tiếp tục hồ sơ"
                        : "Xem chi tiết"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};
