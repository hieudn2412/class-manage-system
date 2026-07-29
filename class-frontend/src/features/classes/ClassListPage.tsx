import { useQuery } from "@tanstack/react-query";
import { Download, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { classRepository, type ClassListParams } from "../../services/repositories/classRepository";
import { CLASS_STATUSES, type ClassStatus } from "../../shared/types/domain";
import { formatDate, formatMonth, getCurrentMonth } from "../../shared/lib/format";
import { hasPermission, PERMISSIONS } from "../../shared/lib/permissions";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input, Select } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Pagination } from "../../shared/ui/Pagination";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import { classStatusLabels, classStatusTones } from "./classPresentation";

const readPositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const ClassListPage = () => {
  const tenant = useTenant();
  const { session } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const params: ClassListParams = {
    search: searchParams.get("search") ?? "",
    month: searchParams.get("month") ?? getCurrentMonth(),
    status: (searchParams.get("status") as ClassStatus | null) ?? "",
    teacherId: searchParams.get("teacherId") ?? "",
    page: readPositiveInt(searchParams.get("page"), 1),
    pageSize: 10,
    sort: (searchParams.get("sort") as ClassListParams["sort"] | null) ?? "name",
  };
  const [searchValue, setSearchValue] = useState(params.search);
  const canManage = Boolean(
    session && hasPermission(session.user.roles, PERMISSIONS.MANAGE_CLASSES),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchValue === params.search) return;
      const next = new URLSearchParams(searchParams);
      if (searchValue) next.set("search", searchValue);
      else next.delete("search");
      next.set("page", "1");
      setSearchParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [params.search, searchParams, searchValue, setSearchParams]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    setSearchParams(next);
  };

  const classesQuery = useQuery({
    queryKey: ["classes", tenant.id, params],
    queryFn: () => classRepository.listClasses(tenant.slug, params),
    placeholderData: (previous) => previous,
  });
  const teachersQuery = useQuery({
    queryKey: ["class-teachers", tenant.id],
    queryFn: () => classRepository.listTeachers(tenant.slug),
  });

  const resetFilters = () => {
    setSearchValue("");
    setSearchParams({ month: getCurrentMonth(), page: "1" });
  };

  return (
    <>
      <PageHeader
        eyebrow="WF-04 · Quản lý lớp"
        title={`Các lớp có buổi trong ${formatMonth(params.month).toLowerCase()}`}
        subtitle="Mặc định theo buổi phát sinh trong tháng; dùng bộ lọc để thu hẹp kết quả."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                showToast("Xuất Excel sẽ được nối với backend ở vertical slice báo cáo.")
              }
            >
              <Download size={18} aria-hidden="true" />
              Xuất Excel
            </Button>
            {canManage ? (
              <Link className="button" to={`/t/${tenant.slug}/app/classes/new`}>
                <Plus size={18} aria-hidden="true" />
                Tạo lớp
              </Link>
            ) : null}
          </>
        }
      />
      <section className="filter-panel" aria-label="Bộ lọc lớp học">
        <Input
          label="Tìm kiếm"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Tên lớp hoặc mã lớp"
        />
        <Select
          label="Trạng thái"
          value={params.status}
          onChange={(event) => updateParam("status", event.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {CLASS_STATUSES.map((status) => (
            <option value={status} key={status}>
              {classStatusLabels[status]}
            </option>
          ))}
        </Select>
        <Input
          label="Tháng có buổi"
          type="month"
          value={params.month}
          onChange={(event) => updateParam("month", event.target.value)}
        />
        <Select
          label="Giáo viên"
          value={params.teacherId}
          onChange={(event) => updateParam("teacherId", event.target.value)}
          disabled={teachersQuery.isPending}
        >
          <option value="">Tất cả giáo viên</option>
          {teachersQuery.data?.map((teacher) => (
            <option value={teacher.id} key={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </Select>
        <Select
          label="Sắp xếp"
          value={params.sort}
          onChange={(event) => updateParam("sort", event.target.value)}
        >
          <option value="name">Tên lớp A–Z</option>
          <option value="progress">Tiến độ cao nhất</option>
          <option value="expectedEndDate">Kết thúc sớm nhất</option>
        </Select>
        <div className="filter-actions">
          <Button variant="secondary" onClick={resetFilters}>
            <SlidersHorizontal size={17} aria-hidden="true" />
            Xóa bộ lọc
          </Button>
        </div>
      </section>

      {classesQuery.isPending ? (
        <div role="status" aria-label="Đang tải danh sách lớp">
          <Skeleton className="h-14 w-full mb-2" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-16 w-full mb-1" key={index} />
          ))}
        </div>
      ) : classesQuery.isError || !classesQuery.data ? (
        <StatePanel
          kind="error"
          title="Không thể tải danh sách lớp"
          description="Dữ liệu lớp chưa thể tải. Bộ lọc hiện tại vẫn được giữ lại."
          actionLabel="Thử lại"
          onAction={() => void classesQuery.refetch()}
        />
      ) : classesQuery.data.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Không có lớp phù hợp"
          description="Thử đổi từ khóa, tháng, giáo viên hoặc trạng thái."
          actionLabel="Xóa bộ lọc"
          onAction={resetFilters}
        />
      ) : (
        <>
          <div className="table-shell class-list-table">
            <table className="data-table">
              <caption className="sr-only">Danh sách lớp của {tenant.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Mã / lớp</th>
                  <th scope="col">Giáo viên chính</th>
                  <th scope="col">Lịch định kỳ</th>
                  <th scope="col">Tiến độ</th>
                  <th scope="col">Kết thúc dự kiến</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {classesQuery.data.items.map((item) => {
                  const progress = Math.round((item.completedSessions / item.totalSessions) * 100);
                  return (
                    <tr key={item.id}>
                      <td data-label="Mã / lớp">
                        <span className="table-primary">{item.code}</span>
                        <span className="table-secondary">{item.name}</span>
                      </td>
                      <td data-label="Giáo viên">{item.teacher.name}</td>
                      <td data-label="Lịch học">{item.scheduleSummary}</td>
                      <td data-label="Tiến độ">
                        <span className="table-primary">
                          {item.completedSessions}/{item.totalSessions}
                        </span>
                        <div
                          className="progress-track mt-2 max-w-28"
                          role="progressbar"
                          aria-label={`Tiến độ ${progress}%`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progress}
                        >
                          <div className="progress-value" style={{ width: `${progress}%` }} />
                        </div>
                      </td>
                      <td data-label="Kết thúc">
                        {item.expectedEndDate ? formatDate(item.expectedEndDate) : "Đã đủ buổi"}
                      </td>
                      <td data-label="Trạng thái">
                        <Badge tone={classStatusTones[item.status]}>
                          {classStatusLabels[item.status]}
                        </Badge>
                      </td>
                      <td data-label="Thao tác">
                        <Link
                          className="button button-secondary min-h-9 py-2 px-3"
                          to={`/t/${tenant.slug}/app/classes/${item.id}`}
                          aria-label={`Xem chi tiết lớp ${item.name}`}
                        >
                          <Search size={15} aria-hidden="true" />
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={classesQuery.data.page}
            totalPages={classesQuery.data.totalPages}
            totalItems={classesQuery.data.totalItems}
            onPageChange={(page) => updateParam("page", String(page))}
          />
        </>
      )}
    </>
  );
};
