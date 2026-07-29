import { ArrowLeftRight, CalendarClock, MapPin, UserRound, Video } from "lucide-react";
import { formatDateTime } from "../../../shared/lib/format";
import type { CalendarSession } from "../../../shared/types/domain";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Modal } from "../../../shared/ui/Modal";

interface SessionDetailsModalProps {
  sessions: CalendarSession[];
  canManage: boolean;
  onClose: () => void;
  onEdit: (session: CalendarSession) => void;
  onOpen: (session: CalendarSession) => void;
}

export const SessionDetailsModal = ({
  sessions,
  canManage,
  onClose,
  onEdit,
  onOpen,
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
              </strong>
            </span>
            {session.isSubstitution ? <Badge tone="info">Dạy thay</Badge> : null}
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
          {canManage ? (
            <div className="session-detail-actions">
              <Button type="button" variant="secondary" onClick={() => onEdit(session)}>
                <ArrowLeftRight size={17} aria-hidden="true" />
                Điều chỉnh hình thức / phòng
              </Button>
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
