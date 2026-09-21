import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { scheduleRepository } from "../../services/repositories/scheduleRepository";
import { getTodayInBusinessTimezone, getWeekStart } from "../../shared/lib/calendar";
import { formatDate } from "../../shared/lib/format";
import { hasPermission, PERMISSIONS } from "../../shared/lib/permissions";
import type { CalendarSession } from "../../shared/types/domain";
import { Button } from "../../shared/ui/Button";
import { FilterDisclosure } from "../../shared/ui/FilterDisclosure";
import { Select } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { PublishedSessionOverrideModal } from "./components/PublishedSessionOverrideModal";
import { SessionDetailsModal } from "./components/SessionDetailsModal";
import { SessionMutationModal } from "./components/SessionMutationModal";
import { WeekNavigator } from "./components/WeekNavigator";
import { WeeklyCalendar } from "./components/WeeklyCalendar";

export const ManagementSchedulePage = () => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekStart = searchParams.get("week") ?? getWeekStart(getTodayInBusinessTimezone());
  const teacherId = searchParams.get("teacherId") ?? "";
  const roomId = searchParams.get("roomId") ?? "";
  const [selectedSessions, setSelectedSessions] = useState<CalendarSession[]>([]);
  const [editingSession, setEditingSession] = useState<CalendarSession | null>(null);
  const [mutatingSession, setMutatingSession] = useState<{
    action: "SUBSTITUTE_TEACHER" | "CANCEL_SESSION" | "CREATE_MAKEUP";
    session: CalendarSession;
  } | null>(null);
  const canManage = Boolean(
    session && hasPermission(session.user.roles, PERMISSIONS.MANAGE_SESSION_SCHEDULE),
  );

  const optionsQuery = useQuery({
    queryKey: ["schedule-options", tenant.id],
    queryFn: () => scheduleRepository.getOptions(tenant.slug),
  });
  const scheduleQuery = useQuery({
    queryKey: ["management-schedule", tenant.id, weekStart, teacherId, roomId],
    queryFn: () =>
      scheduleRepository.getManagementSchedule(tenant.slug, {
        weekStart,
        teacherId,
        roomId,
      }),
    placeholderData: (previous) => previous,
  });

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  return (
    <>
      <PageHeader
        eyebrow="LỊCH TOÀN TRUNG TÂM"
        title="Thời khóa biểu toàn trung tâm"
        subtitle={`Tuần ${formatDate(weekStart)}–${formatDate(
          scheduleQuery.data?.weekEnd ?? weekStart,
        )}. Các lớp cùng ca được gom để kiểm tra nhanh.`}
        actions={
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            In lịch tuần
          </Button>
        }
      />
      <FilterDisclosure
        label="Bộ lọc"
        className="schedule-toolbar"
        activeCount={[roomId, teacherId].filter(Boolean).length}
        primary={
          <WeekNavigator weekStart={weekStart} onChange={(value) => updateParam("week", value)} />
        }
      >
        <div className="filter-collapse-grid schedule-filters">
          <Select
            label="Phòng"
            value={roomId}
            onChange={(event) => updateParam("roomId", event.target.value)}
            disabled={optionsQuery.isPending}
          >
            <option value="">Tất cả phòng</option>
            {optionsQuery.data?.rooms.map((room) => (
              <option value={room.id} key={room.id}>
                {room.code}
                {room.status === "INACTIVE" ? " · Ngừng hoạt động" : ""}
              </option>
            ))}
          </Select>
          <Select
            label="Giáo viên"
            value={teacherId}
            onChange={(event) => updateParam("teacherId", event.target.value)}
            disabled={optionsQuery.isPending}
          >
            <option value="">Tất cả giáo viên</option>
            {optionsQuery.data?.teachers.map((teacher) => (
              <option value={teacher.id} key={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </Select>
        </div>
      </FilterDisclosure>

      {scheduleQuery.isPending ? (
        <div role="status" aria-label="Đang tải thời khóa biểu">
          <Skeleton className="h-16 w-full mb-3" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : scheduleQuery.isError || !scheduleQuery.data ? (
        <StatePanel
          kind="error"
          title="Không thể tải thời khóa biểu"
          description="Tuần và bộ lọc hiện tại vẫn được giữ để bạn thử lại."
          actionLabel="Thử lại"
          onAction={() => void scheduleQuery.refetch()}
        />
      ) : scheduleQuery.data.sessions.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Không có buổi trong tuần này"
          description="Chuyển tuần hoặc bỏ bộ lọc để xem lịch khác."
        />
      ) : (
        <WeeklyCalendar schedule={scheduleQuery.data} onSelectSessions={setSelectedSessions} />
      )}

      <SessionDetailsModal
        sessions={selectedSessions}
        canManage={canManage}
        onClose={() => setSelectedSessions([])}
        onEdit={(selected) => {
          setSelectedSessions([]);
          setEditingSession(selected);
        }}
        onSubstitute={(selected) => {
          setSelectedSessions([]);
          setMutatingSession({ action: "SUBSTITUTE_TEACHER", session: selected });
        }}
        onCancel={(selected) => {
          setSelectedSessions([]);
          setMutatingSession({ action: "CANCEL_SESSION", session: selected });
        }}
        onCreateMakeup={(selected) => {
          setSelectedSessions([]);
          setMutatingSession({ action: "CREATE_MAKEUP", session: selected });
        }}
        onOpen={(selected) => {
          setSelectedSessions([]);
          void navigate(`/t/${tenant.slug}/app/sessions/${selected.id}`);
        }}
      />
      {optionsQuery.data && editingSession ? (
        <PublishedSessionOverrideModal
          key={`${editingSession.id}-${editingSession.version}`}
          session={editingSession}
          options={optionsQuery.data}
          onClose={() => setEditingSession(null)}
          onSaved={() => setEditingSession(null)}
        />
      ) : null}
      {optionsQuery.data && mutatingSession ? (
        <SessionMutationModal
          key={`${mutatingSession.action}-${mutatingSession.session.id}-${mutatingSession.session.version}`}
          action={mutatingSession.action}
          session={{
            id: mutatingSession.session.id,
            className: mutatingSession.session.className,
            classCode: mutatingSession.session.classCode,
            ordinal: mutatingSession.session.ordinal,
            startAt: mutatingSession.session.startAt,
            endAt: mutatingSession.session.endAt,
            actualTeacherId: mutatingSession.session.actualTeacherId,
            actualTeacherName: mutatingSession.session.teacherName,
            mode: mutatingSession.session.mode,
            roomId: mutatingSession.session.roomId,
            version: mutatingSession.session.version,
          }}
          options={optionsQuery.data}
          onClose={() => setMutatingSession(null)}
          onSaved={() => setMutatingSession(null)}
        />
      ) : null}
    </>
  );
};
