import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, CheckCircle2, Clock3, FileCheck2, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { formatDateTime } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import type { StudentHomeworkSummary } from "../../shared/types/domain";

const personalStatusLabel = (item: StudentHomeworkSummary): string => {
  if (item.status === "CLOSED") return "Đã đóng";
  if (item.mySubmissionStatus === "REVIEWED") return "Đã nhận xét";
  if (item.mySubmissionStatus === "REVISION_REQUESTED") return "Cần sửa lại";
  if (item.latestSubmissionAt) return "Đã nộp";
  if (item.deadlineState === "OVERDUE") return "Quá hạn";
  return "Cần làm";
};

const personalStatusTone = (item: StudentHomeworkSummary) => {
  if (item.status === "CLOSED") return "neutral" as const;
  if (item.mySubmissionStatus === "REVIEWED") return "success" as const;
  if (item.mySubmissionStatus === "REVISION_REQUESTED" || item.deadlineState === "OVERDUE")
    return "warning" as const;
  if (item.latestSubmissionAt) return "info" as const;
  return "danger" as const;
};

const groupHomeworks = (items: StudentHomeworkSummary[]) => {
  const need = items
    .filter((item) => item.status === "PUBLISHED" && !item.latestSubmissionAt)
    .sort((left, right) => {
      if (left.deadlineState === "OVERDUE" && right.deadlineState !== "OVERDUE") return -1;
      if (right.deadlineState === "OVERDUE" && left.deadlineState !== "OVERDUE") return 1;
      return (
        new Date(left.deadlineAt ?? "9999-12-31").getTime() -
        new Date(right.deadlineAt ?? "9999-12-31").getTime()
      );
    });
  return [
    { key: "todo", title: "Cần làm", icon: Clock3, items: need },
    {
      key: "submitted",
      title: "Đã nộp",
      icon: FileCheck2,
      items: items.filter(
        (item) =>
          item.status === "PUBLISHED" &&
          item.latestSubmissionAt &&
          item.mySubmissionStatus !== "REVIEWED",
      ),
    },
    {
      key: "reviewed",
      title: "Đã nhận xét",
      icon: CheckCircle2,
      items: items.filter((item) => item.mySubmissionStatus === "REVIEWED"),
    },
    {
      key: "closed",
      title: "Đã đóng",
      icon: LockKeyhole,
      items: items.filter((item) => item.status === "CLOSED"),
    },
  ];
};

export const StudentHomeworksPage = () => {
  const tenant = useTenant();
  const query = useQuery({
    queryKey: ["student-homeworks", tenant.slug],
    queryFn: () =>
      learningContentRepository.studentHomeworks(tenant.slug, { page: 1, pageSize: 100 }),
  });
  return (
    <section className="content-page">
      <PageHeader
        eyebrow="DÀNH CHO HỌC SINH"
        title="Bài tập của tôi"
        subtitle="Nộp ảnh bài làm, xem nhận xét và gửi lại khi bài còn mở."
      />
      {query.isPending ? <PageSkeleton /> : null}
      {query.isError ? (
        <StatePanel
          kind="error"
          title="Không tải được bài tập"
          description="Vui lòng kiểm tra kết nối và thử lại."
        />
      ) : null}
      {query.data?.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Chưa có bài tập"
          description="Bài tập được giao sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="student-homework-board">
          {groupHomeworks(query.data?.items ?? []).map((group) => {
            const Icon = group.icon;
            return (
              <section className="student-homework-group" key={group.key}>
                <header>
                  <span>
                    <Icon size={20} aria-hidden="true" />
                    <strong>{group.title}</strong>
                  </span>
                  <Badge tone={group.items.length ? "info" : "neutral"}>{group.items.length}</Badge>
                </header>
                {!group.items.length ? (
                  <p className="text-muted">Không có bài trong nhóm này.</p>
                ) : (
                  <div className="student-homework-list">
                    {group.items.map((item) => (
                      <Link
                        className="student-homework-card"
                        to={`/t/${tenant.slug}/app/student-homeworks/${item.id}`}
                        key={item.id}
                      >
                        <span className="student-homework-ribbon">
                          <BookOpenCheck size={16} aria-hidden="true" />
                          Bài tập về nhà
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.className}
                            {item.sessionOrdinal ? ` · Buổi ${item.sessionOrdinal}` : ""}
                          </small>
                        </span>
                        <span className="student-homework-meta">
                          {item.deadlineAt
                            ? `Hạn nộp ${formatDateTime(item.deadlineAt)}`
                            : "Không có hạn nộp"}
                        </span>
                        {item.latestSubmissionAt ? (
                          <span className="student-homework-meta">
                            Nộp gần nhất {formatDateTime(item.latestSubmissionAt)}
                          </span>
                        ) : null}
                        <Badge tone={personalStatusTone(item)}>{personalStatusLabel(item)}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
};
