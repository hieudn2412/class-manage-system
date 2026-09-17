import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Printer } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { scheduleRepository } from "../../services/repositories/scheduleRepository";
import { getTodayInBusinessTimezone, getWeekStart } from "../../shared/lib/calendar";
import { formatDate } from "../../shared/lib/format";
import type { CalendarSession } from "../../shared/types/domain";
import { Button } from "../../shared/ui/Button";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { SessionDetailsModal } from "./components/SessionDetailsModal";
import { WeekNavigator } from "./components/WeekNavigator";
import { WeeklyCalendar } from "./components/WeeklyCalendar";

export const TeacherSchedulePage = () => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekStart = searchParams.get("week") ?? getWeekStart(getTodayInBusinessTimezone());
  const [selectedSessions, setSelectedSessions] = useState<CalendarSession[]>([]);
  const query = useQuery({
    queryKey: ["teacher-schedule", tenant.id, weekStart],
    queryFn: () => scheduleRepository.getOwnSchedule(tenant.slug, weekStart),
    placeholderData: (previous) => previous,
  });

  const changeWeek = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("week", value);
    setSearchParams(next);
  };
  const substitutionCount =
    query.data?.sessions.filter((session) => session.isSubstitution).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="LỊCH CÁ NHÂN"
        title="Lịch dạy của tôi"
        subtitle={`Tuần ${formatDate(weekStart)}–${formatDate(
          query.data?.weekEnd ?? weekStart,
        )}. Lịch chính và dạy thay hiển thị trong cùng một nguồn.`}
        actions={
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            In lịch
          </Button>
        }
      />
      <section className="schedule-toolbar teacher-schedule-toolbar">
        <WeekNavigator weekStart={weekStart} onChange={changeWeek} />
      </section>
      {substitutionCount > 0 ? (
        <div className="schedule-notice" role="status">
          <ArrowLeftRight size={20} aria-hidden="true" />
          <span>
            <strong>{substitutionCount} buổi dạy thay trong tuần</strong>
            <small>Các buổi này được hiển thị cùng lịch dạy chính của bạn.</small>
          </span>
        </div>
      ) : null}

      {query.isPending ? (
        <div role="status" aria-label="Đang tải lịch dạy">
          <Skeleton className="h-16 w-full mb-3" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : query.isError || !query.data ? (
        <StatePanel
          kind="error"
          title="Không thể tải lịch dạy"
          description="Tuần hiện tại vẫn được giữ. Hãy thử lại khi kết nối ổn định."
          actionLabel="Thử lại"
          onAction={() => void query.refetch()}
        />
      ) : query.data.sessions.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Bạn không có buổi dạy trong tuần này"
          description="Dùng điều hướng tuần để xem lịch quá khứ hoặc tương lai."
        />
      ) : (
        <WeeklyCalendar schedule={query.data} onSelectSessions={setSelectedSessions} />
      )}
      <SessionDetailsModal
        sessions={selectedSessions}
        canManage={false}
        onClose={() => setSelectedSessions([])}
        onEdit={() => undefined}
        onOpen={(selected) => {
          setSelectedSessions([]);
          void navigate(`/t/${tenant.slug}/app/sessions/${selected.id}`);
        }}
      />
    </>
  );
};
