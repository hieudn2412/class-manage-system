import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import {
  dashboardRepository,
  type PendingConfirmationParams,
} from "../../services/repositories/dashboardRepository";
import { formatDateTime } from "../../shared/lib/format";
import type { PendingConfirmationSort } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { FilterDisclosure } from "../../shared/ui/FilterDisclosure";
import { Input, Select } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Pagination } from "../../shared/ui/Pagination";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";

const readPositiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

interface SortHeaderProps {
  label: string;
  column: PendingConfirmationSort;
  activeColumn: PendingConfirmationSort;
  direction: "asc" | "desc";
  onSort: (column: PendingConfirmationSort) => void;
}

const SortHeader = ({ label, column, activeColumn, direction, onSort }: SortHeaderProps) => {
  const active = column === activeColumn;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      className={`table-sort-button${active ? " is-active" : ""}`}
      onClick={() => onSort(column)}
      aria-label={`${label}: ${active && direction === "asc" ? "đang tăng dần" : active ? "đang giảm dần" : "nhấn để sắp xếp"}`}
    >
      <span>{label}</span>
      <Icon size={15} aria-hidden="true" />
    </button>
  );
};

const ariaSort = (
  column: PendingConfirmationSort,
  activeColumn: PendingConfirmationSort,
  direction: "asc" | "desc",
): "ascending" | "descending" | "none" =>
  column === activeColumn ? (direction === "asc" ? "ascending" : "descending") : "none";

export const PendingConfirmationsPage = () => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params: PendingConfirmationParams = {
    search: searchParams.get("search") ?? "",
    mode: (searchParams.get("mode") as PendingConfirmationParams["mode"] | null) ?? "",
    from: searchParams.get("from") ?? "",
    to: searchParams.get("to") ?? "",
    sort:
      (searchParams.get("sort") as PendingConfirmationSort | null) ?? "startAt",
    direction: searchParams.get("direction") === "desc" ? "desc" : "asc",
    page: readPositiveInt(searchParams.get("page"), 1),
    pageSize: 15,
  };
  const [selectedId, setSelectedId] = useState("");

  const query = useQuery({
    queryKey: ["pending-confirmations", tenant.id, params],
    queryFn: () => dashboardRepository.getPendingConfirmations(tenant.slug, params),
    placeholderData: (previous) => previous,
  });

  const selectedItem = query.data?.items.find((item) => item.id === selectedId);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    next.set("page", "1");
    setSearchParams(next);
  };

  const sortBy = (column: PendingConfirmationSort) => {
    const direction = params.sort === column && params.direction === "asc" ? "desc" : "asc";
    updateParams({ sort: column, direction });
  };

  const resetFilters = () => {
    setSelectedId("");
    setSearchParams({ sort: "startAt", direction: "asc", page: "1" });
  };

  const openConfirmation = (sessionId: string) => {
    void navigate(`/t/${tenant.slug}/app/sessions/${sessionId}?action=verify`);
  };

  return (
    <section className="pending-confirmation-page">
      <Link className="back-link" to={`/t/${tenant.slug}/app/dashboard`}>
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại Tổng quan
      </Link>
      <PageHeader
        eyebrow="VIỆC CẦN XỬ LÝ"
        title="Buổi chờ xác nhận đã dạy"
        subtitle="Các buổi đã kết thúc nhưng chưa được giáo viên xác nhận. Chọn một buổi để kiểm tra và xử lý."
        actions={
          <Button
            disabled={!selectedItem}
            onClick={() => selectedItem && openConfirmation(selectedItem.id)}
          >
            <CheckCircle2 size={18} aria-hidden="true" />
            Xử lý buổi đã chọn
          </Button>
        }
      />

      <FilterDisclosure
        label="Bộ lọc"
        activeCount={[params.mode, params.from, params.to].filter(Boolean).length}
        primary={
          <Input
            label="Tìm kiếm"
            value={params.search}
            onChange={(event) => updateParams({ search: event.target.value })}
            placeholder="Tên lớp, mã lớp hoặc giáo viên"
          />
        }
      >
        <div className="filter-collapse-grid">
          <Select
            label="Hình thức"
            value={params.mode}
            onChange={(event) => updateParams({ mode: event.target.value })}
          >
            <option value="">Tất cả hình thức</option>
            <option value="IN_PERSON">Tại trung tâm</option>
            <option value="ONLINE">Trực tuyến</option>
          </Select>
          <Input
            label="Từ ngày"
            type="date"
            value={params.from}
            max={params.to || undefined}
            onChange={(event) => updateParams({ from: event.target.value })}
          />
          <Input
            label="Đến ngày"
            type="date"
            value={params.to}
            min={params.from || undefined}
            onChange={(event) => updateParams({ to: event.target.value })}
          />
          <div className="filter-collapse-actions">
            <Button variant="secondary" onClick={resetFilters}>
              <SlidersHorizontal size={17} aria-hidden="true" />
              Xóa bộ lọc
            </Button>
          </div>
        </div>
      </FilterDisclosure>

      {query.isPending ? (
        <div role="status" aria-label="Đang tải danh sách buổi chờ xác nhận">
          <Skeleton className="h-14 w-full mb-2" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-16 w-full mb-1" key={index} />
          ))}
        </div>
      ) : query.isError || !query.data ? (
        <StatePanel
          kind="error"
          title="Không thể tải các buổi chờ xác nhận"
          description="Bộ lọc hiện tại vẫn được giữ. Vui lòng kiểm tra kết nối và thử lại."
          actionLabel="Thử lại"
          onAction={() => void query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Không có buổi nào đang chờ xác nhận"
          description="Thử thay đổi bộ lọc hoặc quay lại trang Tổng quan."
          actionLabel="Xóa bộ lọc"
          onAction={resetFilters}
        />
      ) : (
        <>
          <div className="table-shell responsive-table-wrap pending-confirmation-table-wrap">
            <table className="data-table responsive-card-table pending-confirmation-table">
              <caption className="sr-only">Danh sách buổi chờ xác nhận đã dạy</caption>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Chọn buổi</span></th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("className", params.sort, params.direction)}
                  >
                    <SortHeader
                      label="Lớp học"
                      column="className"
                      activeColumn={params.sort}
                      direction={params.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("startAt", params.sort, params.direction)}
                  >
                    <SortHeader
                      label="Thời gian"
                      column="startAt"
                      activeColumn={params.sort}
                      direction={params.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("teacherName", params.sort, params.direction)}
                  >
                    <SortHeader
                      label="Giáo viên"
                      column="teacherName"
                      activeColumn={params.sort}
                      direction={params.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th
                    scope="col"
                    aria-sort={ariaSort("mode", params.sort, params.direction)}
                  >
                    <SortHeader
                      label="Hình thức"
                      column="mode"
                      activeColumn={params.sort}
                      direction={params.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr className={selectedId === item.id ? "is-selected" : ""} key={item.id}>
                    <td data-label="Chọn">
                      <input
                        type="radio"
                        name="pending-session"
                        checked={selectedId === item.id}
                        onChange={() => setSelectedId(item.id)}
                        aria-label={`Chọn ${item.className}, buổi ${item.ordinal}`}
                      />
                    </td>
                    <td data-label="Lớp học">
                      <span className="table-primary">{item.className}</span>
                      <span className="table-secondary">{item.classCode} · Buổi {item.ordinal}</span>
                    </td>
                    <td data-label="Thời gian">
                      <span className="table-primary">{formatDateTime(item.startAt)}</span>
                      <span className="table-secondary">Kết thúc {formatDateTime(item.endAt)}</span>
                    </td>
                    <td data-label="Giáo viên">{item.teacherName}</td>
                    <td data-label="Hình thức">
                      <span className="table-primary">
                        {item.mode === "ONLINE" ? "Trực tuyến" : "Tại trung tâm"}
                      </span>
                      <span className="table-secondary">
                        {item.mode === "ONLINE" ? "Đường dẫn học trực tuyến" : item.roomName ?? "Chưa có phòng"}
                      </span>
                    </td>
                    <td data-label="Trạng thái">
                      <Badge tone="warning">Chờ xác nhận</Badge>
                    </td>
                    <td data-label="Thao tác">
                      <Button variant="secondary" onClick={() => openConfirmation(item.id)}>
                        Xử lý xác nhận
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalItems={query.data.totalItems}
            itemLabel="buổi"
            onPageChange={(page) => {
              const next = new URLSearchParams(searchParams);
              next.set("page", String(page));
              setSearchParams(next);
            }}
          />
        </>
      )}
    </section>
  );
};
