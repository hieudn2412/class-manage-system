import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { Input } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";

export const HomeworkWorkspacePage = () => {
  const tenant = useTenant();
  const { session } = useAuth();
  const [searchValue, setSearchValue] = useState("");
  const isTeacherOnly = Boolean(
    session?.user.roles.includes("TEACHER") &&
    !session.user.roles.includes("ADMIN") &&
    !session.user.roles.includes("ACADEMIC_MANAGER"),
  );
  const report = useQuery({
    queryKey: ["homework-report", tenant.slug],
    queryFn: () => learningContentRepository.report(tenant.slug, { page: 1, pageSize: 100 }),
  });
  const classes = useMemo(() => {
    const keyword = searchValue.trim().toLocaleLowerCase("vi-VN");
    if (!keyword) return report.data?.items ?? [];
    return (report.data?.items ?? []).filter((item) =>
      [item.className, item.classCode, item.teacherName].some((value) =>
        value.toLocaleLowerCase("vi-VN").includes(keyword),
      ),
    );
  }, [report.data?.items, searchValue]);

  return (
    <section className="content-page">
      <PageHeader
        eyebrow="QUẢN LÝ BÀI TẬP"
        title="Bài tập về nhà theo lớp"
        subtitle="Chọn lớp để xem các bài tập giáo viên đã giao và bài làm của học sinh."
      />
      {isTeacherOnly ? (
        <section
          className="panel-flat homework-teacher-guide"
          aria-label="Hướng dẫn giao bài tập cho giáo viên"
        >
          <span className="section-title-icon">
            <ClipboardList size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>Giao bài tập từ từng buổi học</strong>
            <p>
              Để tạo bài mới, hãy chọn lớp rồi chọn buổi có nút <b>Giao bài tập</b>. Bài sẽ được gửi
              tới học sinh ngay sau khi tạo.
            </p>
          </div>
          <Link className="button" to={"/t/" + tenant.slug + "/app/my-classes?intent=homework"}>
            Đi tới giao bài tập
          </Link>
        </section>
      ) : null}

      <div className="content-toolbar" role="search">
        <Input
          label="Tìm lớp"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Nhập tên lớp, mã lớp hoặc giáo viên"
        />
      </div>

      {report.isPending ? <PageSkeleton /> : null}
      {report.isError ? (
        <StatePanel
          kind="error"
          title="Không tải được danh sách lớp"
          description="Vui lòng kiểm tra kết nối và thử lại."
          actionLabel="Thử lại"
          onAction={() => void report.refetch()}
        />
      ) : report.data && report.data.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Chưa có lớp nào có bài tập về nhà"
          description="Lớp sẽ xuất hiện tại đây sau khi giáo viên giao bài đầu tiên."
        />
      ) : classes.length ? (
        <section className="content-panel" aria-labelledby="homework-classes-title">
          <header className="content-section-head">
            <div>
              <p className="eyebrow">LỚP ĐÃ GIAO BÀI</p>
              <h2 id="homework-classes-title">Danh sách lớp</h2>
            </div>
            <span className="text-muted">{classes.length} lớp</span>
          </header>
          <div className="table-shell">
            <table className="data-table content-table homework-class-table">
              <caption className="sr-only">Danh sách lớp đã có bài tập về nhà</caption>
              <thead>
                <tr>
                  <th scope="col">Tên lớp</th>
                  <th scope="col">Giáo viên</th>
                  <th scope="col">Số lượng bài tập</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((row) => (
                  <tr key={row.classId}>
                    <td>
                      <span className="table-primary">{row.className}</span>
                      <span className="table-secondary">{row.classCode}</span>
                    </td>
                    <td>{row.teacherName}</td>
                    <td>
                      <strong>{row.homeworkCount}</strong>
                    </td>
                    <td>
                      <Link
                        className="record-link"
                        to={"/t/" + tenant.slug + "/app/homeworks/classes/" + row.classId}
                        aria-label={"Xem chi tiết lớp " + row.className}
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
      ) : report.isSuccess ? (
        <StatePanel
          kind="empty"
          title="Không tìm thấy lớp phù hợp"
          description="Thử tìm bằng tên lớp, mã lớp hoặc tên giáo viên khác."
          actionLabel="Xóa từ khóa"
          onAction={() => setSearchValue("")}
        />
      ) : null}
    </section>
  );
};
