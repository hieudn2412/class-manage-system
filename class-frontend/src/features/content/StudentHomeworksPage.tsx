import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { formatDateTime } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { homeworkStatusLabel, homeworkStatusTone, rate } from "./contentUtils";

export const StudentHomeworksPage = () => {
  const tenant = useTenant();
  const query = useQuery({
    queryKey: ["student-homeworks", tenant.slug],
    queryFn: () => learningContentRepository.studentHomeworks(tenant.slug, { page: 1, pageSize: 100 }),
  });
  return (
    <section className="content-page">
      <PageHeader
        eyebrow="FL-10 / HỌC SINH"
        title="BTVN của tôi"
        subtitle="Nộp ảnh bài làm, xem lịch sử chữa và gửi lại khi bài còn mở."
      />
      {query.isPending ? <PageSkeleton /> : null}
      {query.isError ? <StatePanel kind="error" title="Không tải được BTVN" description="Vui lòng thử lại sau." /> : null}
      {query.data?.items.length === 0 ? (
        <StatePanel kind="empty" title="Chưa có BTVN" description="Bài được giao sẽ xuất hiện tại đây." />
      ) : (
        <div className="content-card-grid">
          {query.data?.items.map((item) => (
            <Link className="content-card homework-card-link" to={`/t/${tenant.slug}/app/student-homeworks/${item.id}`} key={item.id}>
              <header>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.className}</small>
                </span>
                <Badge tone={homeworkStatusTone[item.status]}>{homeworkStatusLabel[item.status]}</Badge>
              </header>
              <p>{item.deadlineAt ? `Deadline: ${formatDateTime(item.deadlineAt)}` : "Không đặt deadline"}</p>
              <dl className="content-stats">
                <div><dt>Nộp</dt><dd>{rate(item.submittedCount, item.recipientCount)}</dd></div>
                <div><dt>Chữa</dt><dd>{rate(item.reviewedCount, item.recipientCount)}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};
