import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { homeworkStatusLabel, homeworkStatusTone, rate } from "./contentUtils";
import { HomeworkCreateModal } from "./HomeworkCreateModal";

export const ClassHomeworksPanel = ({
  tenantSlug,
  classId,
  canManage,
}: {
  tenantSlug: string;
  classId: string;
  canManage: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["class-homeworks", tenantSlug, classId],
    queryFn: () => learningContentRepository.classHomeworks(tenantSlug, classId, { page: 1, pageSize: 100 }),
  });
  const invalidate = async () =>
    client.invalidateQueries({ queryKey: ["class-homeworks", tenantSlug, classId] });
  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return <StatePanel kind="error" title="Không tải được bài tập về nhà" description="Vui lòng kiểm tra kết nối và thử lại." />;
  }
  return (
    <section className="content-panel">
      <header className="content-section-head">
        <div>
          <p className="eyebrow">BÀI TẬP VỀ NHÀ</p>
          <h2>Bài tập về nhà</h2>
        </div>
        {canManage ? (
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} /> Giao bài
          </Button>
        ) : null}
      </header>
      {!query.data?.items.length ? (
        <StatePanel kind="empty" title="Chưa có bài tập về nhà" description="Giáo viên hoặc quản lý học vụ có thể tạo bài mới từ đây." />
      ) : (
        <div className="table-shell responsive-table-wrap">
          <table className="data-table content-table responsive-card-table">
            <caption className="sr-only">Danh sách bài tập về nhà của lớp</caption>
            <thead>
              <tr>
                <th scope="col">Bài tập</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Lượt nộp</th>
                <th scope="col">Đã nhận xét</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Bài tập">
                    <span className="table-primary">{item.title}</span>
                    <span className="table-secondary">
                      {item.sessionOrdinal ? `Buổi ${item.sessionOrdinal}` : "Cấp lớp"}
                    </span>
                  </td>
                  <td data-label="Trạng thái"><Badge tone={homeworkStatusTone[item.status]}>{homeworkStatusLabel[item.status]}</Badge></td>
                  <td data-label="Lượt nộp">{rate(item.submittedCount, item.recipientCount)}</td>
                  <td data-label="Đã nhận xét">{rate(item.reviewedCount, item.recipientCount)}</td>
                  <td data-label="Thao tác">
                    <Link className="record-link" to={`/t/${tenantSlug}/app/homeworks/${item.id}`}>
                      Mở chi tiết
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <HomeworkCreateModal
        tenantSlug={tenantSlug}
        classId={classId}
        open={open}
        onClose={() => setOpen(false)}
        onCreated={invalidate}
      />
    </section>
  );
};
