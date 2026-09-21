import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  LockKeyhole,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { managementRepository } from "../../services/repositories/managementRepository";
import { formatDate, formatDateTime } from "../../shared/lib/format";
import { roleLabels } from "../../shared/lib/permissions";
import type { Account } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { FilterDisclosure } from "../../shared/ui/FilterDisclosure";
import { Input } from "../../shared/ui/FormField";
import { ListTable, type ListTableColumn } from "../../shared/ui/ListTable";
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

const accountRoleLabel = (account: Account): string =>
  account.roles.length > 0
    ? account.roles.map((role) => roleLabels[role]).join(", ")
    : profileLabels[account.profileType];

type AccountSortColumn = "displayName" | "profileType" | "createdAt";
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
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
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

  const accountColumns: ListTableColumn<Account>[] = [
    {
      id: "name",
      header: (
        <SortHeader
          label="Tên"
          column="displayName"
          activeColumn={sort.column}
          direction={sort.direction}
          onSort={sortBy}
        />
      ),
      ariaSort: ariaSort("displayName", sort.column, sort.direction),
      className: "account-list-name-cell",
      cell: (account) => (
        <div className="account-list-name">
          <strong>{account.displayName}</strong>
          <small>@{account.username}</small>
        </div>
      ),
    },
    {
      id: "role",
      header: (
        <SortHeader
          label="Chức vụ"
          column="profileType"
          activeColumn={sort.column}
          direction={sort.direction}
          onSort={sortBy}
        />
      ),
      ariaSort: ariaSort("profileType", sort.column, sort.direction),
      className: "account-list-role-cell",
      cell: (account) => <span className="account-list-role">{accountRoleLabel(account)}</span>,
    },
    {
      id: "createdAt",
      header: (
        <SortHeader
          label="Ngày tạo"
          column="createdAt"
          activeColumn={sort.column}
          direction={sort.direction}
          onSort={sortBy}
        />
      ),
      ariaSort: ariaSort("createdAt", sort.column, sort.direction),
      className: "account-list-created-cell",
      cell: (account) => (
        <span className="account-list-created">{formatDate(account.createdAt)}</span>
      ),
    },
    {
      id: "view",
      header: "Xem",
      className: "account-list-view-cell",
      cell: (account) => (
        <Button
          variant="secondary"
          className="account-list-view-button"
          aria-label={`Xem chi tiết ${account.displayName}`}
          onClick={() => setSelectedAccount(account)}
        >
          <Eye size={17} aria-hidden="true" />
          <span>Xem chi tiết</span>
        </Button>
      ),
    },
  ];

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

  const openAction = (account: Account, kind: "status" | "reset") => {
    setSelectedAccount(null);
    setTarget({ account, kind });
  };

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

      <FilterDisclosure
        label="Bộ lọc"
        activeCount={[profile, status].filter(Boolean).length}
        primary={
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
        }
      >
        <div className="filter-collapse-grid">
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
      </FilterDisclosure>

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
          <ListTable
            caption="Danh sách người dùng của trung tâm"
            items={query.data?.items ?? []}
            columns={accountColumns}
            getRowKey={(account) => account.id}
            className="account-user-list"
          />
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
        open={Boolean(selectedAccount)}
        title="Thông tin người dùng"
        closeLabel="Đóng"
        className="account-detail-modal"
        onClose={() => setSelectedAccount(null)}
      >
        {selectedAccount ? (
          <div className="account-detail">
            <div className="account-detail-hero">
              <span className="account-detail-avatar" aria-hidden="true">
                {selectedAccount.displayName
                  .trim()
                  .split(/\s+/)
                  .slice(-2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div>
                <h3>{selectedAccount.displayName}</h3>
                <p>@{selectedAccount.username}</p>
              </div>
              <Badge tone={selectedAccount.status === "ACTIVE" ? "success" : "danger"}>
                {selectedAccount.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
              </Badge>
            </div>
            <dl className="account-detail-grid">
              <div>
                <dt>Email</dt>
                <dd>{selectedAccount.email || "Chưa cập nhật"}</dd>
              </div>
              <div>
                <dt>Hồ sơ</dt>
                <dd>
                  {selectedAccount.code
                    ? `${selectedAccount.code} · ${profileLabels[selectedAccount.profileType]}`
                    : profileLabels[selectedAccount.profileType]}
                </dd>
              </div>
              <div>
                <dt>Vai trò</dt>
                <dd className="badge-row">
                  {selectedAccount.roles.map((role) => (
                    <Badge key={role}>{roleLabels[role]}</Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Trạng thái mật khẩu</dt>
                <dd>
                  {selectedAccount.passwordState === "MUST_CHANGE"
                    ? "Cần đổi mật khẩu"
                    : "Đang sử dụng"}
                </dd>
              </div>
              {selectedAccount.profileType === "STUDENT" ? (
                <>
                  <div>
                    <dt>Phụ huynh</dt>
                    <dd>{selectedAccount.parentName || "Chưa cập nhật"}</dd>
                  </div>
                  <div>
                    <dt>Số điện thoại phụ huynh</dt>
                    <dd>{selectedAccount.parentPhone || "Chưa cập nhật"}</dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Lần đăng nhập gần nhất</dt>
                <dd>
                  {selectedAccount.lastLoginAt
                    ? formatDateTime(selectedAccount.lastLoginAt)
                    : "Chưa ghi nhận"}
                </dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>{formatDate(selectedAccount.createdAt)}</dd>
              </div>
            </dl>
            <div className="account-detail-actions">
              <Link className="button button-secondary" to={`${base}/${selectedAccount.id}`}>
                Chỉnh sửa
              </Link>
              <Button variant="secondary" onClick={() => openAction(selectedAccount, "status")}>
                <LockKeyhole size={15} aria-hidden="true" />
                {selectedAccount.status === "ACTIVE" ? "Khóa tài khoản" : "Mở lại tài khoản"}
              </Button>
              <Button variant="ghost" onClick={() => openAction(selectedAccount, "reset")}>
                <RotateCcw size={15} aria-hidden="true" />
                Đặt lại mật khẩu
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

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
