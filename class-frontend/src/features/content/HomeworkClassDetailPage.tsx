import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { formatDateTime } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { homeworkStatusLabel, homeworkStatusTone } from "./contentUtils";

export const HomeworkClassDetailPage = () => {
  const tenant = useTenant();
  const { classId = "" } = useParams<{ classId: string }>();
  const report = useQuery({
    queryKey: ["homework-report", tenant.slug],
    queryFn: () => learningContentRepository.report(tenant.slug, { page: 1, pageSize: 100 }),
  });
  const homeworks = useQuery({
    queryKey: ["workspace-homeworks", tenant.slug, classId],
    queryFn: () =>
      learningContentRepository.classHomeworks(tenant.slug, classId, {
        page: 1,
        pageSize: 100,
      }),
    enabled: Boolean(classId),
  });
  const selectedClass = report.data?.items.find((item) => item.classId === classId);
  const firstHomework = homeworks.data?.items[0];
  const className = selectedClass?.className ?? firstHomework?.className;
  const classCode = selectedClass?.classCode ?? firstHomework?.classCode;

  if (report.isPending || homeworks.isPending) return <PageSkeleton />;

  return (
    <section className="content-page">
      <Link className="back-link" to={`/t/${tenant.slug}/app/homeworks`}>
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại danh sách lớp
      </Link>

      {report.isError || homeworks.isError ? (
        <StatePanel
          kind="error"
          title="Không tải được bài tập của lớp"
          description="Vui lòng kiểm tra kết nối và thử lại."
          actionLabel="Thử lại"
          onAction={() => {
            void report.refetch();
            void homeworks.refetch();
          }}
        />
      ) : !className ? (
        <StatePanel
          kind="empty"
          title="Không tìm thấy lớp"
          description="Lớp có thể chưa có bài tập hoặc bạn không còn quyền xem."
        />
      ) : (
        <>
          <PageHeader
            eyebrow={classCode ?? "BÀI TẬP THEO LỚP"}
            title={`Bài tập của lớp ${className}`}
            subtitle={
              selectedClass?.teacherName
                ? `Giáo viên phụ trách: ${selectedClass.teacherName}`
                : "Danh sách bài tập giáo viên đã giao cho lớp."
            }
          />
          {homeworks.data?.items.length ? (
            <section className="content-panel" aria-labelledby="class-homeworks-title">
              <header className="content-section-head">
                <div>
                  <p className="eyebrow">BÀI ĐÃ GIAO</p>
                  <h2 id="class-homeworks-title">Danh sách bài tập</h2>
                </div>
                <span className="text-muted">{homeworks.data.totalItems} bài tập</span>
              </header>
              <div className="table-shell responsive-table-wrap">
                <table className="data-table content-table responsive-card-table homework-list-table">
                  <caption className="sr-only">Danh sách bài tập của lớp {className}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tên bài tập</th>
                      <th scope="col">Hạn nộp</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Lượt nộp</th>
                      <th scope="col">Nhận xét</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {homeworks.data.items.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Tên bài tập">
                          <span className="table-primary">{item.title}</span>
                          <span className="table-secondary">
                            {item.sessionOrdinal ? `Buổi ${item.sessionOrdinal}` : item.classCode}
                          </span>
                        </td>
                        <td data-label="Hạn nộp">
                          {item.deadlineAt ? formatDateTime(item.deadlineAt) : "Không đặt"}
                        </td>
                        <td data-label="Trạng thái">
                          <Badge tone={homeworkStatusTone[item.status]}>
                            {homeworkStatusLabel[item.status]}
                          </Badge>
                        </td>
                        <td data-label="Lượt nộp">
                          {item.submittedCount}/{item.recipientCount} học sinh
                        </td>
                        <td data-label="Nhận xét">
                          {item.submittedCount
                            ? `${item.reviewedCount}/${item.submittedCount} bài đã nộp`
                            : "Chưa có bài nộp"}
                        </td>
                        <td data-label="Thao tác">
                          <Link
                            className="record-link"
                            to={`/t/${tenant.slug}/app/homeworks/${item.id}`}
                            aria-label={`Xem chi tiết bài tập ${item.title}`}
                          >
                            Xem chi tiết
                            <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <StatePanel
              kind="empty"
              title="Lớp chưa có bài tập"
              description="Bài tập giáo viên giao sẽ xuất hiện tại đây."
            />
          )}
        </>
      )}
    </section>
  );
};
