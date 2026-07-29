import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { teachingRepository } from "../../services/repositories/teachingRepository";
import { formatDate } from "../../shared/lib/format";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input, Select } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";

const statusLabels: Record<string, string> = {
  DRAFT: "Nháp",
  SCHEDULED: "Đã xếp lịch",
  ACTIVE: "Đang dạy",
  AWAITING_CLOSE: "Chờ kết thúc",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
};

export const MyClassesPage = () => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const role = params.get("role") ?? "";
  const page = Math.max(Number(params.get("page") ?? "1"), 1);
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  };
  const query = useQuery({
    queryKey: ["teacher-classes", tenant.id, search, status, role, page],
    queryFn: () =>
      teachingRepository.getClasses(tenant.slug, { search, status, role, page, pageSize: 12 }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader
        eyebrow="WF-19 · WF-26"
        title="Lớp của tôi"
        subtitle="Danh sách lớp bạn là giáo viên chính hoặc từng trực tiếp tham gia giảng dạy."
      />
      <section className="panel-flat teacher-class-filters" aria-label="Tìm và lọc lớp">
        <Input
          label="Tìm theo tên hoặc mã lớp"
          value={search}
          onChange={(event) => setFilter("search", event.target.value)}
          placeholder="Ví dụ: Toán tư duy"
        />
        <Select
          label="Trạng thái lớp"
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="SCHEDULED">Đã xếp lịch</option>
          <option value="ACTIVE">Đang dạy</option>
          <option value="AWAITING_CLOSE">Chờ kết thúc</option>
          <option value="CLOSED">Đã đóng</option>
          <option value="CANCELLED">Đã hủy</option>
        </Select>
        <Select
          label="Vai trò giảng dạy"
          value={role}
          onChange={(e) => setFilter("role", e.target.value)}
        >
          <option value="">Tất cả vai trò</option>
          <option value="PRIMARY">Giáo viên chính</option>
          <option value="ACTUAL">Đã trực tiếp dạy</option>
        </Select>
      </section>

      {query.isPending ? (
        <PageSkeleton />
      ) : query.isError || !query.data ? (
        <StatePanel
          kind="error"
          title="Không thể tải lớp của bạn"
          description="Bộ lọc hiện tại vẫn được giữ để bạn thử lại."
          actionLabel="Thử lại"
          onAction={() => void query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title={search || status || role ? "Không tìm thấy lớp phù hợp" : "Bạn chưa có lớp nào"}
          description={
            search || status || role
              ? "Hãy thay đổi từ khóa hoặc bộ lọc."
              : "Lớp sẽ xuất hiện khi quản lý phân công hoặc bạn trực tiếp dạy một buổi."
          }
          action={
            search || status || role ? (
              <Button
                variant="secondary"
                onClick={() => setParams(new URLSearchParams({ page: "1" }))}
              >
                Xóa bộ lọc
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="teacher-class-grid">
            {query.data.items.map((item) => (
              <article className="panel teacher-class-card" key={item.id}>
                <header>
                  <span>
                    <small className="class-code">{item.code}</small>
                    <h2>{item.name}</h2>
                  </span>
                  <Badge
                    tone={
                      item.status === "CANCELLED"
                        ? "danger"
                        : item.status === "CLOSED"
                          ? "neutral"
                          : "info"
                    }
                  >
                    {statusLabels[item.status] ?? item.status}
                  </Badge>
                </header>
                <dl className="teacher-class-facts">
                  <div>
                    <dt>Vai trò</dt>
                    <dd>
                      {item.teacherRole === "PRIMARY" ? "Giáo viên chính" : "Trực tiếp giảng dạy"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tiến độ</dt>
                    <dd>
                      {item.completedSessions}/{item.totalSessions} buổi
                    </dd>
                  </div>
                  <div>
                    <dt>Bắt đầu</dt>
                    <dd>{formatDate(item.startDate)}</dd>
                  </div>
                  <div>
                    <dt>Kết thúc dự kiến</dt>
                    <dd>
                      {item.expectedEndDate ? formatDate(item.expectedEndDate) : "Chưa xác định"}
                    </dd>
                  </div>
                </dl>
                <div
                  className="progress-track"
                  aria-label={`Tiến độ ${item.completedSessions}/${item.totalSessions}`}
                >
                  <div
                    className="progress-value"
                    style={{
                      width: `${Math.min((item.completedSessions / Math.max(item.totalSessions, 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void navigate(`/t/${tenant.slug}/app/my-classes/${item.id}`)}
                >
                  <BookOpen size={17} aria-hidden="true" />
                  Xem lịch sử buổi
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </article>
            ))}
          </div>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalItems={query.data.totalItems}
            onPageChange={(value) => setFilter("page", String(value))}
          />
        </>
      )}
    </>
  );
};
