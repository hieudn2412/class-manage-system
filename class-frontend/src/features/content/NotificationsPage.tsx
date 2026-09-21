import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { useTenant } from "../../app/providers/TenantProvider";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { formatDateTime } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";

export const NotificationsPage = () => {
  const tenant = useTenant();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", tenant.slug],
    queryFn: () => learningContentRepository.notifications(tenant.slug, { page: 1, pageSize: 50 }),
  });
  const markAll = useMutation({
    mutationFn: () => learningContentRepository.markAllRead(tenant.slug),
    onSuccess: async () => client.invalidateQueries({ queryKey: ["notifications", tenant.slug] }),
  });
  return (
    <section className="content-page">
      <PageHeader
        eyebrow="THÔNG BÁO"
        title="Thông báo"
        subtitle="Xem các cập nhật về bài tập, tài liệu và nhận xét."
        actions={
          <Button variant="secondary" onClick={() => markAll.mutate()}>
            <CheckCheck size={16} /> Đánh dấu tất cả
          </Button>
        }
      />
      {query.isPending ? <PageSkeleton /> : null}
      {query.isError ? (
        <StatePanel
          kind="error"
          title="Không tải được thông báo"
          description="Vui lòng thử lại sau."
        />
      ) : null}
      {query.data?.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Chưa có thông báo"
          description="Các cập nhật học tập sẽ được ghi lại ở đây."
        />
      ) : (
        <div className="notification-history">
          {query.data?.items.map((item) => (
            <article key={item.id} className={item.readAt ? "" : "unread"}>
              <span>
                <strong>{item.title}</strong>
                <small>
                  {formatDateTime(item.createdAt)} · {item.eventType}
                </small>
              </span>
              <p>{item.body}</p>
              <Badge tone={item.readAt ? "neutral" : "info"}>
                {item.readAt ? "Đã đọc" : "Mới"}
              </Badge>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
