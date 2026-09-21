import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { useAuth } from "../../app/providers/AuthProvider";
import { classRepository, type ClassListParams } from "../../services/repositories/classRepository";
import { CLASS_STATUSES, type ClassListItem, type ClassStatus } from "../../shared/types/domain";
import { formatDate, formatMonth, getCurrentMonth } from "../../shared/lib/format";
import { hasPermission, PERMISSIONS } from "../../shared/lib/permissions";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { FilterDisclosure } from "../../shared/ui/FilterDisclosure";
import { Input, Select } from "../../shared/ui/FormField";
import { ListTable, type ListTableColumn } from "../../shared/ui/ListTable";
import { Modal } from "../../shared/ui/Modal";
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

type ClassSortColumn = "name" | "progress" | "expectedEndDate";
type SortDirection = "asc" | "desc";

const classSortColumns = new Set<ClassSortColumn>(["name", "progress", "expectedEndDate"]);

const readClassSort = (
  value: string | null,
): { column: ClassSortColumn; direction: SortDirection } => {
  const [rawColumn, rawDirection] = (value ?? "name,asc").split(",");
  const column = classSortColumns.has(rawColumn as ClassSortColumn)
    ? (rawColumn as ClassSortColumn)
    : "name";
  const direction = rawDirection === "desc" ? "desc" : "asc";
  return { column, direction };
};

const serializeClassSort = (column: ClassSortColumn, direction: SortDirection) =>
  `${column},${direction}`;

interface ClassSortHeaderProps {
  label: string;
  column: ClassSortColumn;
  activeColumn: ClassSortColumn;
  direction: SortDirection;
  onSort: (column: ClassSortColumn) => void;
}

const ClassSortHeader = ({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: ClassSortHeaderProps) => {
  const active = column === activeColumn;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      className={`table-sort-button${active ? " is-active" : ""}`}
      onClick={() => onSort(column)}
      aria-label={`${label}: ${
        active && direction === "asc"
          ? "đang tăng dần"
          : active
            ? "đang giảm dần"
            : "nhấn để sắp xếp"
      }`}
    >
      <span>{label}</span>
      <Icon size={15} aria-hidden="true" />
    </button>
  );
};

const ariaSort = (
  column: ClassSortColumn,
  activeColumn: ClassSortColumn,
  direction: SortDirection,
): "ascending" | "descending" | "none" =>
  column === activeColumn ? (direction === "asc" ? "ascending" : "descending") : "none";

export const ClassListPage = () => {
  const tenant = useTenant();
  const { session } = useAuth();
  const { showToast } = useToast();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClass, setSelectedClass] = useState<ClassListItem | null>(null);
  const sort = readClassSort(searchParams.get("sort"));
  const params: ClassListParams = {
    search: searchParams.get("search") ?? "",
    month: searchParams.get("month") ?? getCurrentMonth(),
    status: (searchParams.get("status") as ClassStatus | null) ?? "",
    teacherId: searchParams.get("teacherId") ?? "",
    page: readPositiveInt(searchParams.get("page"), 1),
    pageSize: 10,
    sort: serializeClassSort(sort.column, sort.direction),
  };
  const canManage = Boolean(
    session && hasPermission(session.user.roles, PERMISSIONS.MANAGE_CLASSES),
  );

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
    setSearchParams({ month: getCurrentMonth(), page: "1" });
  };

  const sortBy = (column: ClassSortColumn) => {
    const direction = sort.column === column && sort.direction === "asc" ? "desc" : "asc";
    updateParam("sort", serializeClassSort(column, direction));
  };

  const mobileColumns: ListTableColumn<ClassListItem>[] = [
    {
      id: "class",
      header: "Lớp",
      className: "class-mobile-name-column",
      cell: (item) => (
        <span className="class-mobile-name">
          <strong>{item.name}</strong>
        </span>
      ),
    },
    {
      id: "teacher",
      header: "Giáo viên",
      className: "class-mobile-teacher-column",
      cell: (item) => <span className="class-mobile-teacher">{item.teacher.name}</span>,
    },
    {
      id: "view",
      header: "Xem",
      className: "class-mobile-view-column",
      cell: (item) => (
        <Button
          variant="secondary"
          className="class-mobile-view-button"
          aria-label={`Xem chi tiết lớp ${item.name}`}
          onClick={() => setSelectedClass(item)}
        >
          <Eye size={16} aria-hidden="true" />
          <span>Chi tiết</span>
        </Button>
      ),
    },
  ];

  return (
    <section className="class-list-page">
      <PageHeader
        eyebrow="QUẢN LÝ LỚP"
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
      <FilterDisclosure
        label="Bộ lọc"
        activeCount={
          [
            params.status,
            params.month !== getCurrentMonth() ? params.month : "",
            params.teacherId,
          ].filter(Boolean).length
        }
        primary={
          <Input
            label="Tìm kiếm"
            value={params.search}
            onChange={(event) => updateParam("search", event.target.value)}
            placeholder="Tên lớp hoặc mã lớp"
          />
        }
      >
        <div className="filter-collapse-grid">
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
          <div className="filter-collapse-actions">
            <Button variant="secondary" onClick={resetFilters}>
              <SlidersHorizontal size={17} aria-hidden="true" />
              Xóa bộ lọc
            </Button>
          </div>
        </div>
      </FilterDisclosure>

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
          {isMobile ? (
            <ListTable
              caption={`Danh sách lớp của ${tenant.name}`}
              items={classesQuery.data.items}
              columns={mobileColumns}
              getRowKey={(item) => item.id}
              className="class-mobile-list"
              wrapperClassName="class-mobile-list-wrap"
            />
          ) : (
            <div className="table-shell responsive-table-wrap class-list-table">
              <table className="data-table">
                <caption className="sr-only">Danh sách lớp của {tenant.name}</caption>
                <colgroup>
                  <col className="class-list-name-col" />
                  <col className="class-list-teacher-col" />
                  <col className="class-list-schedule-col" />
                  <col className="class-list-progress-col" />
                  <col className="class-list-end-col" />
                  <col className="class-list-status-col" />
                  <col className="class-list-action-col" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" aria-sort={ariaSort("name", sort.column, sort.direction)}>
                      <ClassSortHeader
                        label="Tên lớp"
                        column="name"
                        activeColumn={sort.column}
                        direction={sort.direction}
                        onSort={sortBy}
                      />
                    </th>
                    <th scope="col">Giáo viên chính</th>
                    <th scope="col">Lịch định kỳ</th>
                    <th scope="col" aria-sort={ariaSort("progress", sort.column, sort.direction)}>
                      <ClassSortHeader
                        label="Tiến độ"
                        column="progress"
                        activeColumn={sort.column}
                        direction={sort.direction}
                        onSort={sortBy}
                      />
                    </th>
                    <th
                      scope="col"
                      aria-sort={ariaSort("expectedEndDate", sort.column, sort.direction)}
                    >
                      <ClassSortHeader
                        label="Kết thúc dự kiến"
                        column="expectedEndDate"
                        activeColumn={sort.column}
                        direction={sort.direction}
                        onSort={sortBy}
                      />
                    </th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {classesQuery.data.items.map((item) => {
                    const progress = Math.round(
                      (item.completedSessions / item.totalSessions) * 100,
                    );
                    return (
                      <tr key={item.id}>
                        <td data-label="Tên lớp" className="class-name-cell">
                          <span className="table-primary">{item.name}</span>
                        </td>
                        <td data-label="Giáo viên" className="class-teacher-cell">
                          {item.teacher.name}
                        </td>
                        <td data-label="Lịch học" className="class-schedule-cell">
                          <span className="class-schedule-lines">
                            {item.scheduleSummary.split(",").map((scheduleItem) => (
                              <span key={scheduleItem.trim()}>{scheduleItem.trim()}</span>
                            ))}
                          </span>
                        </td>
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
                            className="button button-secondary min-h-9 py-2 px-3 class-detail-button"
                            to={`/t/${tenant.slug}/app/classes/${item.id}`}
                            aria-label={`Xem chi tiết lớp ${item.name}`}
                          >
                            <Eye size={15} aria-hidden="true" />
                            <span>Chi tiết</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={classesQuery.data.page}
            totalPages={classesQuery.data.totalPages}
            totalItems={classesQuery.data.totalItems}
            onPageChange={(page) => updateParam("page", String(page))}
          />
        </>
      )}
      <Modal
        open={Boolean(selectedClass)}
        title="Thông tin lớp"
        closeLabel="Đóng"
        className="class-summary-modal"
        onClose={() => setSelectedClass(null)}
      >
        {selectedClass ? (
          <div className="class-summary-dialog">
            <table className="class-summary-table">
              <caption className="sr-only">Thông tin tóm tắt của lớp {selectedClass.name}</caption>
              <tbody>
                <tr>
                  <th scope="row">Tên lớp</th>
                  <td>{selectedClass.name}</td>
                </tr>
                <tr>
                  <th scope="row">Giáo viên chính</th>
                  <td>{selectedClass.teacher.name}</td>
                </tr>
                <tr>
                  <th scope="row">Lịch định kỳ</th>
                  <td>
                    <span className="class-summary-schedule">
                      {selectedClass.scheduleSummary.split(",").map((scheduleItem) => (
                        <span key={scheduleItem.trim()}>{scheduleItem.trim()}</span>
                      ))}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Tiến độ</th>
                  <td>
                    {selectedClass.completedSessions}/{selectedClass.totalSessions}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Kết thúc dự kiến</th>
                  <td>
                    {selectedClass.expectedEndDate
                      ? formatDate(selectedClass.expectedEndDate)
                      : "Đã đủ buổi"}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Trạng thái</th>
                  <td>
                    <Badge tone={classStatusTones[selectedClass.status]}>
                      {classStatusLabels[selectedClass.status]}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
            <Link
              className="button class-summary-detail-link"
              to={`/t/${tenant.slug}/app/classes/${selectedClass.id}`}
            >
              Xem chi tiết đầy đủ
            </Link>
          </div>
        ) : null}
      </Modal>
    </section>
  );
};
