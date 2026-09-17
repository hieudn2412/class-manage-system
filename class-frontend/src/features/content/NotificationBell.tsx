import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { formatDateTime } from "../../shared/lib/format";
import { Button } from "../../shared/ui/Button";

export const NotificationBell = ({ tenantSlug, base }: { tenantSlug: string; base: string }) => {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const count = useQuery({
    queryKey: ["notification-count", tenantSlug],
    queryFn: () => learningContentRepository.unreadCount(tenantSlug),
    refetchInterval: 60000,
  });
  const latest = useQuery({
    queryKey: ["notification-popover", tenantSlug],
    queryFn: () => learningContentRepository.notifications(tenantSlug, { unreadOnly: true, page: 1, pageSize: 5 }),
    enabled: open,
  });
  const markAll = useMutation({
    mutationFn: () => learningContentRepository.markAllRead(tenantSlug),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["notification-count", tenantSlug] });
      await client.invalidateQueries({ queryKey: ["notification-popover", tenantSlug] });
    },
  });
  const unread = count.data?.unread ?? 0;
  return (
    <div className="notification-wrap">
      <button
        className="icon-button notification-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Thông báo, ${unread} thông báo chưa đọc`}
      >
        <Bell size={18} aria-hidden="true" />
        {unread ? <span className="notification-count" aria-hidden="true">{unread}</span> : null}
      </button>
      {open ? (
        <section className="notification-popover" aria-label="Thông báo mới">
          <header>
            <strong>Thông báo</strong>
            <Button variant="ghost" onClick={() => markAll.mutate()}>Đánh dấu tất cả đã đọc</Button>
          </header>
          {!latest.data?.items.length ? <p>Không có thông báo mới.</p> : null}
          {latest.data?.items.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
              <small>{formatDateTime(item.createdAt)}</small>
            </article>
          ))}
          <Link className="record-link" to={`${base}/notifications`} onClick={() => setOpen(false)}>
            Xem tất cả
          </Link>
        </section>
      ) : null}
    </div>
  );
};
