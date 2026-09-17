import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { formatDateTime } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { Input } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { homeworkStatusLabel, homeworkStatusTone, rate } from "./contentUtils";

export const HomeworkWorkspacePage = () => {
  const tenant = useTenant();
  const { session } = useAuth();
  const [classId, setClassId] = useState("");
  const isTeacherOnly = Boolean(
    session?.user.roles.includes("TEACHER") &&
    !session.user.roles.includes("ADMIN") &&
    !session.user.roles.includes("ACADEMIC_MANAGER"),
  );
  const report = useQuery({
    queryKey: ["homework-report", tenant.slug],
    queryFn: () => learningContentRepository.report(tenant.slug, { page: 1, pageSize: 50 }),
  });
  const list = useQuery({
    queryKey: ["workspace-homeworks", tenant.slug, classId],
    queryFn: () => learningContentRepository.classHomeworks(tenant.slug, classId, { page: 1, pageSize: 100 }),
    enabled: Boolean(classId),
  });
  return (
    <section className="content-page">
      <PageHeader
        eyebrow="QUẢN LÝ BÀI TẬP"
        title="Bài tập về nhà và bài đang chờ nhận xét"
        subtitle="Theo dõi tỷ lệ nộp, tỷ lệ chữa và mở nhanh từng bài trong lớp."
      />
      {isTeacherOnly ? (
        <section className="panel-flat homework-teacher-guide" aria-label="Hướng dẫn giao bài tập cho giáo viên">
          <span className="section-title-icon">
            <ClipboardList size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>Giao bài tập từ từng buổi học</strong>
            <p>
              Để tạo bài mới, hãy chọn lớp rồi chọn buổi có nút <b>Giao bài tập</b>. Bài sẽ được gửi tới học sinh ngay sau khi tạo.
            </p>
          </div>
          <Link className="button" to={`/t/${tenant.slug}/app/my-classes?intent=homework`}>
            Đi tới giao bài tập
          </Link>
        </section>
      ) : null}
      <div className="content-toolbar">
        <Input
          label="Mã lớp cần xem bài tập"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
          placeholder="Dán UUID lớp"
        />
      </div>
      {report.isPending ? <PageSkeleton /> : null}
      {report.isError ? (
        <StatePanel kind="error" title="Không tải được báo cáo" description="Vui lòng thử lại." />
      ) : (
        <div className="content-card-grid">
          {report.data?.items.map((row) => (
            <article className="content-card" key={row.classId}>
              <header>
                <span>
                  <strong>{row.className}</strong>
                  <small>{row.classCode} · {row.teacherName}</small>
                </span>
                <ClipboardList size={20} aria-hidden="true" />
              </header>
              <dl className="content-stats">
                <div><dt>Bài tập</dt><dd>{row.homeworkCount}</dd></div>
                <div><dt>Nộp</dt><dd>{rate(row.submittedCount, row.recipientCount)}</dd></div>
                <div><dt>Đã nhận xét</dt><dd>{rate(row.reviewedCount, row.recipientCount)}</dd></div>
              </dl>
              <button className="button button-secondary" onClick={() => setClassId(row.classId)}>
                <Search size={15} /> Xem bài
              </button>
            </article>
          ))}
        </div>
      )}
      {classId ? (
        <section className="content-panel">
          <header className="content-section-head">
            <div>
              <p className="eyebrow">CLASS / {classId}</p>
              <h2>Danh sách bài tập về nhà</h2>
            </div>
          </header>
          {list.isPending ? <PageSkeleton /> : null}
          {list.isError ? <StatePanel kind="error" title="Không tải được danh sách" description="Kiểm tra quyền hoặc class ID." /> : null}
          {list.data?.items.length ? (
            <div className="table-shell">
              <table className="data-table content-table">
                <thead><tr><th>Bài tập</th><th>Hạn nộp</th><th>Trạng thái</th><th>Đã nộp</th><th>Đã nhận xét</th><th /></tr></thead>
                <tbody>
                  {list.data.items.map((item) => (
                    <tr key={item.id}>
                      <td><span className="table-primary">{item.title}</span><span className="table-secondary">{item.className}</span></td>
                      <td>{item.deadlineAt ? formatDateTime(item.deadlineAt) : "Không đặt"}</td>
                      <td><Badge tone={homeworkStatusTone[item.status]}>{homeworkStatusLabel[item.status]}</Badge></td>
                      <td>{item.submittedCount}/{item.recipientCount}</td>
                      <td>{item.reviewedCount}/{item.recipientCount}</td>
                      <td><Link className="record-link" to={`/t/${tenant.slug}/app/homeworks/${item.id}`}>Xem bài tập</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
};
