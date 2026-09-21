import { ClipboardList, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { SessionHomeworkBadge } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { StatePanel } from "../../shared/ui/StatePanel";
import { homeworkStatusLabel, homeworkStatusTone, rate } from "./contentUtils";

interface SessionHomeworksPanelProps {
  tenantSlug: string;
  canCreate: boolean;
  homework: SessionHomeworkBadge | null;
  onCreate: () => void;
}

export const SessionHomeworksPanel = ({
  tenantSlug,
  canCreate,
  homework,
  onCreate,
}: SessionHomeworksPanelProps) => {
  return (
    <section
      className="panel-flat section-panel session-homework-panel"
      aria-labelledby="session-homework-title"
    >
      <div className="section-heading-row">
        <span className="section-title-block">
          <span className="section-title-icon">
            <ClipboardList size={20} aria-hidden="true" />
          </span>
          <span>
            <h2 className="section-title" id="session-homework-title">
              Bài tập của buổi học
            </h2>
            <p>Chỉ hiển thị bài tập được gắn với buổi học hiện tại.</p>
          </span>
        </span>
        <div className="session-homework-actions">
          {canCreate ? (
            <Button type="button" onClick={onCreate}>
              <Plus size={17} aria-hidden="true" />
              Giao bài tập
            </Button>
          ) : null}
        </div>
      </div>

      {!homework ? (
        <StatePanel
          kind="empty"
          title="Buổi này chưa có bài tập"
          description={
            canCreate
              ? "Bạn có thể giao bài ngay cho buổi này, sau đó mở chi tiết để xem, sửa hoặc đóng bài."
              : "Bài tập được giao cho buổi này sẽ xuất hiện tại đây."
          }
          action={
            canCreate ? (
              <Button type="button" onClick={onCreate}>
                <Plus size={17} aria-hidden="true" />
                Giao bài tập
              </Button>
            ) : undefined
          }
        />
      ) : (
        <article className="session-homework-card">
          <span className="session-homework-ribbon">
            <ClipboardList size={18} aria-hidden="true" />
            Bài tập về nhà
          </span>
          <div>
            <h3>{homework.title}</h3>
            <p>
              {homework.deadlineAt
                ? `Hạn nộp ${new Date(homework.deadlineAt).toLocaleString("vi-VN")}`
                : "Không có hạn nộp"}
            </p>
          </div>
          <dl>
            <div>
              <dt>Nộp</dt>
              <dd>{rate(homework.submittedCount, homework.recipientCount)}</dd>
            </div>
            <div>
              <dt>Người nhận</dt>
              <dd>{homework.recipientCount}</dd>
            </div>
          </dl>
          <Badge tone={homeworkStatusTone[homework.status]}>
            {homeworkStatusLabel[homework.status]}
          </Badge>
          <Link className="button" to={`/t/${tenantSlug}/app/homeworks/${homework.id}`}>
            Xem và sửa bài tập
          </Link>
        </article>
      )}
    </section>
  );
};
