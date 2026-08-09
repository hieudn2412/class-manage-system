import {
  ArrowLeftRight,
  CalendarClock,
  CalendarPlus,
  MapPin,
  UserRound,
  UserRoundCheck,
  Video,
  XCircle,
} from "lucide-react";
import { formatDateTime } from "../../../shared/lib/format";
import type { CalendarSession } from "../../../shared/types/domain";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Modal } from "../../../shared/ui/Modal";
import { ScheduleStateBadge } from "./ScheduleStateBadge";

interface SessionDetailsModalProps {
  sessions: CalendarSession[];
  canManage: boolean;
  onClose: () => void;
  onEdit: (session: CalendarSession) => void;
  onOpen: (session: CalendarSession) => void;
  onSubstitute?: (session: CalendarSession) => void;
  onCancel?: (session: CalendarSession) => void;
  onCreateMakeup?: (session: CalendarSession) => void;
}

export const SessionDetailsModal = ({
  sessions,
  canManage,
  onClose,
  onEdit,
  onOpen,
  onSubstitute,
  onCancel,
  onCreateMakeup,
}: SessionDetailsModalProps) => (
  <Modal
    open={sessions.length > 0}
    title={sessions.length > 1 ? `${sessions.length} lớp cùng ca` : "Chi tiết buổi học"}
    onClose={onClose}
  >
    <div className="session-detail-list">
      {sessions.map((session) => (
        <article className="session-detail-card" key={session.id}>
          <header>
            <span>
              <small>{session.classCode}</small>
              <strong>
                {session.className} · Buổi {session.ordinal}
                {session.isMakeup ? " · Dạy bù" : ""}
              </strong>
            </span>
            <span className="session-detail-badges">
              <ScheduleStateBadge state={session.scheduleState} />
              {session.isMakeup ? <Badge tone="warning">Dạy bù</Badge> : null}
              {session.isSubstitution ? <Badge tone="info">Dạy thay</Badge> : null}
            </span>
          </header>
          <dl>
            <div>
              <dt>
                <CalendarClock size={15} aria-hidden="true" />
                Thời gian
              </dt>
              <dd>{formatDateTime(session.startAt)}</dd>
            </div>
            <div>
              <dt>
                <UserRound size={15} aria-hidden="true" />
                Giáo viên
              </dt>
              <dd>{session.teacherName}</dd>
            </div>
            <div>
              <dt>
                {session.mode === "ONLINE" ? (
                  <Video size={15} aria-hidden="true" />
                ) : (
                  <MapPin size={15} aria-hidden="true" />
                )}
                Hình thức
              </dt>
              <dd>{session.mode === "ONLINE" ? "Online" : session.roomName}</dd>
            </div>
          </dl>
          {session.cancellationReason ? (
            <p className="session-detail-reason">Lý do hủy: {session.cancellationReason}</p>
          ) : null}
          {canManage ? (
            <div className="session-detail-actions">
              <Button type="button" variant="secondary" onClick={() => onEdit(session)}>
                <ArrowLeftRight size={17} aria-hidden="true" />
                Điều chỉnh hình thức / phòng
              </Button>
              {session.allowedActions.includes("SUBSTITUTE_TEACHER") && onSubstitute ? (
                <Button type="button" variant="secondary" onClick={() => onSubstitute(session)}>
                  <UserRoundCheck size={17} aria-hidden="true" />
                  Thay giáo viên
                </Button>
              ) : null}
              {session.allowedActions.includes("CANCEL_SESSION") && onCancel ? (
                <Button type="button" variant="danger" onClick={() => onCancel(session)}>
                  <XCircle size={17} aria-hidden="true" />
                  Hủy / xếp bù
                </Button>
              ) : null}
              {session.allowedActions.includes("CREATE_MAKEUP") && onCreateMakeup ? (
                <Button type="button" variant="secondary" onClick={() => onCreateMakeup(session)}>
                  <CalendarPlus size={17} aria-hidden="true" />
                  Tạo buổi bù
                </Button>
              ) : null}
              <Button type="button" onClick={() => onOpen(session)}>
                Mở chi tiết buổi
              </Button>
            </div>
          ) : (
            <Button type="button" onClick={() => onOpen(session)}>
              Mở chi tiết buổi
            </Button>
          )}
        </article>
      ))}
    </div>
  </Modal>
);
