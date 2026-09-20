import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, LockKeyhole, Plus, RotateCcw, Search } from "lucide-react";
import { managementRepository } from "../../services/repositories/managementRepository";
import type { PlatformTenant } from "../../shared/types/domain";
import { ApiError } from "../../shared/types/api";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { FilterDisclosure } from "../../shared/ui/FilterDisclosure";
import { Input } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

type Action = { kind: "tenant" | "admin" | "reset"; tenant: PlatformTenant } | null;

export const PlatformTenantListPage = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(
    null,
  );
  const client = useQueryClient();
  const { showToast } = useToast();
  const query = new URLSearchParams({
    search,
    status,
    page: String(page),
    pageSize: "20",
    sort: "createdAt,desc",
  });
  const tenants = useQuery({
    queryKey: ["platform-tenants", query.toString()],
    queryFn: () => managementRepository.tenants(query.toString()),
  });
  const invalidate = async () => client.invalidateQueries({ queryKey: ["platform-tenants"] });
  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!action) return;
      const { tenant, kind } = action;
      if (kind === "tenant") {
        return managementRepository.tenantStatus(
          tenant.id,
          tenant.status === "ACTIVE" ? "LOCKED" : "ACTIVE",
          reason,
          tenant.version,
        );
      }
      if (!tenant.initialAdmin) throw new Error("Không tìm thấy quản trị viên ban đầu.");
      if (kind === "admin") {
        return managementRepository.initialAdminStatus(
          tenant.id,
          tenant.initialAdmin.status === "ACTIVE" ? "LOCKED" : "ACTIVE",
          reason,
          tenant.initialAdmin.version,
        );
      }
      const result = await managementRepository.resetInitialAdmin(
        tenant.id,
        reason,
        tenant.initialAdmin.version,
      );
      setCredential({
        username: tenant.initialAdmin.username,
        password: result.temporaryPassword,
      });
      return result;
    },
    onSuccess: async () => {
      await invalidate();
      setAction(null);
      setReason("");
      showToast("Đã cập nhật. Các phiên đăng nhập cũ của tài khoản sẽ tự kết thúc.");
    },
  });

  if (tenants.isLoading) return <PageSkeleton />;

  return (
    <section className="management-page">
      <header className="management-header">
        <div>
          <p className="eyebrow">QUẢN LÝ TRUNG TÂM</p>
          <h1>Trung tâm trên hệ thống</h1>
          <p>Tạo trung tâm mới và quản lý tài khoản quản trị ban đầu.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={17} aria-hidden="true" />
          Tạo trung tâm
        </Button>
      </header>
      <FilterDisclosure
        label="Bộ lọc"
        activeCount={status ? 1 : 0}
        primary={
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tên hoặc mã đường dẫn…"
            />
          </label>
        }
      >
        <div className="filter-collapse-grid">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Lọc theo trạng thái trung tâm"
          >
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </select>
        </div>
      </FilterDisclosure>
      {tenants.isError ? (
        <StatePanel
          kind="error"
          title="Không tải được danh sách"
          description="Kiểm tra kết nối rồi thử lại."
          actionLabel="Thử lại"
          onAction={() => void tenants.refetch()}
        />
      ) : tenants.data?.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Chưa có trung tâm"
          description="Tạo trung tâm đầu tiên để bắt đầu."
        />
      ) : (
        <>
          <div className="data-table-wrap responsive-table-wrap">
            <table className="data-table responsive-card-table">
              <caption className="sr-only">Danh sách trung tâm trên hệ thống</caption>
              <thead>
                <tr>
                  <th scope="col">Trung tâm</th>
                  <th scope="col">Quản trị viên ban đầu</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Ngày tạo</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {tenants.data?.items.map((tenant) => (
                  <tr key={tenant.id}>
                    <td data-label="Trung tâm">
                      <strong>{tenant.name}</strong>
                      <small>/{tenant.slug}</small>
                    </td>
                    <td data-label="Quản trị viên ban đầu">
                      {tenant.initialAdmin ? (
                        <>
                          <strong>{tenant.initialAdmin.displayName}</strong>
                          <small>
                            @{tenant.initialAdmin.username} ·{" "}
                            {tenant.initialAdmin.status === "ACTIVE"
                              ? "Đang hoạt động"
                              : "Đã khóa"}
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td data-label="Trạng thái">
                      <Badge tone={tenant.status === "ACTIVE" ? "success" : "danger"}>
                        {tenant.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                      </Badge>
                    </td>
                    <td data-label="Ngày tạo">
                      {new Date(tenant.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td data-label="Thao tác">
                      <div className="row-actions">
                        <Button
                          variant="secondary"
                          onClick={() => setAction({ kind: "tenant", tenant })}
                        >
                          <LockKeyhole size={15} aria-hidden="true" />
                          {tenant.status === "ACTIVE" ? "Khóa trung tâm" : "Mở lại trung tâm"}
                        </Button>
                        {tenant.initialAdmin ? (
                          <>
                            <Button
                              variant="ghost"
                              onClick={() => setAction({ kind: "admin", tenant })}
                            >
                              Đổi trạng thái quản trị viên
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setAction({ kind: "reset", tenant })}
                            >
                              <RotateCcw size={15} aria-hidden="true" />
                              Đặt lại mật khẩu
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tenants.data ? (
            <Pagination
              page={tenants.data.page}
              totalPages={tenants.data.totalPages}
              totalItems={tenants.data.totalItems}
              itemLabel="trung tâm"
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (username, password) => {
          setCreateOpen(false);
          setCredential({ username, password });
          await invalidate();
        }}
      />
      <Modal
        open={Boolean(action)}
        title={
          action?.kind === "reset"
            ? "Đặt lại mật khẩu quản trị viên"
            : "Xác nhận thay đổi trạng thái"
        }
        onClose={() => setAction(null)}
        confirmLabel="Xác nhận"
        confirmDisabled={!reason.trim()}
        confirmLoading={actionMutation.isPending}
        onConfirm={() => actionMutation.mutate()}
      >
        <p>Thay đổi sẽ có hiệu lực ngay và được lưu trong lịch sử.</p>
        <Input
          label="Lý do"
          hint="Vui lòng cho biết lý do thực hiện thay đổi này."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
      <Modal
        open={Boolean(credential)}
        title="Thông tin đăng nhập đã sẵn sàng"
        onClose={() => setCredential(null)}
      >
        <div className="credential-box">
          <span>Tên đăng nhập</span>
          <strong>{credential?.username}</strong>
          <span>Mật khẩu tạm</span>
          <strong>{credential?.password}</strong>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(
                `${credential?.username}\n${credential?.password}`,
              );
              showToast("Đã sao chép thông tin đăng nhập.");
            }}
          >
            <Copy size={16} aria-hidden="true" />
            Sao chép
          </Button>
        </div>
      </Modal>
    </section>
  );
};

const CreateTenantModal = ({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (username: string, password: string) => Promise<void>;
}) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      managementRepository.createTenant({
        name,
        slug,
        initialAdmin: { username, displayName, email: email || undefined },
      }),
    onSuccess: (result) =>
      onCreated(result.tenant.initialAdmin?.username ?? username, result.temporaryPassword),
    onError: (cause) =>
      setError(cause instanceof ApiError ? cause.message : "Không thể tạo trung tâm."),
  });
  return (
    <Modal
      open={open}
      title="Tạo trung tâm và quản trị viên ban đầu"
      onClose={onClose}
      confirmLabel="Tạo trung tâm"
      confirmDisabled={!name || !slug || !username || !displayName}
      confirmLoading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    >
      <div className="form-grid">
        {error ? <div className="form-alert full">{error}</div> : null}
        <Input label="Tên trung tâm" value={name} onChange={(event) => setName(event.target.value)} />
        <Input
          label="Mã đường dẫn"
          hint="Mã này được dùng trong địa chỉ đăng nhập và không thể đổi sau khi tạo."
          value={slug}
          onChange={(event) => setSlug(event.target.value.toLowerCase())}
        />
        <Input
          label="Tên đăng nhập của quản trị viên"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <Input
          label="Tên hiển thị của quản trị viên"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <Input
          label="Email (không bắt buộc)"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
    </Modal>
  );
};
