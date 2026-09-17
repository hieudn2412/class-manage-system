import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LockKeyhole,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { managementRepository } from "../../services/repositories/managementRepository";
import { roleLabels } from "../../shared/lib/permissions";
import type { Account } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

const profileLabels = {
  STAFF: "Nhân sự",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
} as const;

type AccountSortColumn = "displayName" | "profileType" | "role" | "status";
type SortDirection = "asc" | "desc";

interface SortHeaderProps {
  label: string;
  column: AccountSortColumn;
  activeColumn: AccountSortColumn;
  direction: SortDirection;
  onSort: (column: AccountSortColumn) => void;
}

const SortHeader = ({ label, column, activeColumn, direction, onSort }: SortHeaderProps) => {
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
  column: AccountSortColumn,
  activeColumn: AccountSortColumn,
  direction: SortDirection,
): "ascending" | "descending" | "none" =>
  column === activeColumn ? (direction === "asc" ? "ascending" : "descending") : "none";

export const AccountListPage = () => {
  const { tenantSlug } = useParams();
  const base = `/t/${tenantSlug}/app/accounts`;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{
    column: AccountSortColumn;
    direction: SortDirection;
  }>({ column: "displayName", direction: "asc" });
  const [target, setTarget] = useState<{
    account: Account;
    kind: "status" | "reset";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const client = useQueryClient();
  const { showToast } = useToast();

  const queryString = new URLSearchParams({
    search,
    status,
    profileType: profile,
    page: String(page),
    pageSize: "20",
    sort: `${sort.column},${sort.direction}`,
  }).toString();
  const query = useQuery({
    queryKey: ["accounts", tenantSlug, queryString],
    queryFn: () => managementRepository.accounts(queryString),
    placeholderData: (previous) => previous,
  });

  const sortBy = (column: AccountSortColumn) => {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) return;
      if (target.kind === "status") {
        return managementRepository.accountStatus(
          target.account.id,
          target.account.status === "ACTIVE" ? "LOCKED" : "ACTIVE",
          reason,
          target.account.version,
        );
      }
      const result = await managementRepository.resetAccount(
        target.account.id,
        reason,
        target.account.version,
      );
      setPassword(result.temporaryPassword);
      return result;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["accounts"] });
      setTarget(null);
      setReason("");
      showToast("Tài khoản đã cập nhật; phiên cũ không còn hiệu lực.");
    },
  });

  if (query.isLoading) return <PageSkeleton />;

  return (
    <section className="management-page">
      <header className="management-header">
        <div>
          <p className="eyebrow">QUẢN LÝ TÀI KHOẢN</p>
          <h1>Người dùng trung tâm</h1>
          <p>Quản lý tài khoản, vai trò và hồ sơ giáo viên, học sinh của trung tâm.</p>
        </div>
        <Link className="button" to={`${base}/new`}>
          <Plus size={17} aria-hidden="true" />
          Tạo tài khoản
        </Link>
      </header>

      <div className="filter-bar">
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Tên, tên đăng nhập, email hoặc mã…"
          />
        </label>
        <select
          aria-label="Loại hồ sơ"
          value={profile}
          onChange={(event) => {
            setProfile(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi loại hồ sơ</option>
          <option value="STAFF">Nhân sự</option>
          <option value="TEACHER">Giáo viên</option>
          <option value="STUDENT">Học sinh</option>
        </select>
        <select
          aria-label="Trạng thái tài khoản"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Mọi trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="LOCKED">Đã khóa</option>
        </select>
      </div>

      {query.isError ? (
        <StatePanel
          kind="error"
          title="Không tải được tài khoản"
          description="Kiểm tra kết nối rồi thử lại."
          actionLabel="Thử lại"
          onAction={() => void query.refetch()}
        />
      ) : query.data?.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Không có tài khoản phù hợp"
          description="Thay đổi bộ lọc hoặc tạo tài khoản mới."
        />
      ) : (
        <>
          <div className="data-table-wrap responsive-table-wrap account-list-table-wrap">
            <table className="data-table responsive-card-table account-list-table">
              <caption className="sr-only">Danh sách người dùng của trung tâm</caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={ariaSort("displayName", sort.column, sort.direction)}>
                    <SortHeader
                      label="Tài khoản"
                      column="displayName"
                      activeColumn={sort.column}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th scope="col" aria-sort={ariaSort("profileType", sort.column, sort.direction)}>
                    <SortHeader
                      label="Hồ sơ"
                      column="profileType"
                      activeColumn={sort.column}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th scope="col" aria-sort={ariaSort("role", sort.column, sort.direction)}>
                    <SortHeader
                      label="Vai trò"
                      column="role"
                      activeColumn={sort.column}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th scope="col" aria-sort={ariaSort("status", sort.column, sort.direction)}>
                    <SortHeader
                      label="Trạng thái"
                      column="status"
                      activeColumn={sort.column}
                      direction={sort.direction}
                      onSort={sortBy}
                    />
                  </th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((account) => (
                  <tr key={account.id}>
                    <td data-label="Tài khoản">
                      <Link to={`${base}/${account.id}`}>
                        <strong>{account.displayName}</strong>
                      </Link>
                      <small>
                        @{account.username} {account.email && `· ${account.email}`}
                      </small>
                    </td>
                    <td data-label="Hồ sơ">
                      <strong>{account.code ?? profileLabels[account.profileType]}</strong>
                      <small>{profileLabels[account.profileType]}</small>
                    </td>
                    <td data-label="Vai trò">
                      <div className="badge-row">
                        {account.roles.map((role) => (
                          <Badge key={role}>{roleLabels[role]}</Badge>
                        ))}
                      </div>
                    </td>
                    <td data-label="Trạng thái">
                      <Badge tone={account.status === "ACTIVE" ? "success" : "danger"}>
                        {account.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                      </Badge>
                    </td>
                    <td data-label="Thao tác">
                      <div className="row-actions">
                        <Button
                          variant="secondary"
                          onClick={() => setTarget({ account, kind: "status" })}
                        >
                          <LockKeyhole size={15} aria-hidden="true" />
                          {account.status === "ACTIVE" ? "Khóa tài khoản" : "Mở lại tài khoản"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setTarget({ account, kind: "reset" })}
                        >
                          <RotateCcw size={15} aria-hidden="true" />
                          Đặt lại mật khẩu
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.data ? (
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              totalItems={query.data.totalItems}
              itemLabel="tài khoản"
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal
        open={Boolean(target)}
        title={target?.kind === "reset" ? "Đặt lại mật khẩu" : "Đổi trạng thái tài khoản"}
        onClose={() => setTarget(null)}
        confirmLabel="Xác nhận"
        confirmDisabled={!reason.trim()}
        confirmLoading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      >
        <p>
          Vui lòng nhập lý do. Thay đổi sẽ được lưu vào lịch sử và các phiên đăng nhập cũ sẽ tự kết
          thúc.
        </p>
        <Input label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Modal>

      <Modal open={Boolean(password)} title="Mật khẩu tạm mới" onClose={() => setPassword("")}>
        <div className="credential-box">
          <span>Mật khẩu</span>
          <strong>{password}</strong>
          <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(password)}>
            Sao chép
          </Button>
        </div>
      </Modal>
    </section>
  );
};
