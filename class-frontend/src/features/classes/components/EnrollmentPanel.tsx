import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Search, UserMinus, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useTenant } from "../../../app/providers/TenantProvider";
import { lifecycleRepository } from "../../../services/repositories/lifecycleRepository";
import { formatCurrency, formatDate } from "../../../shared/lib/format";
import { ApiError } from "../../../shared/types/api";
import type { EnrollmentItem, LifecycleWarning } from "../../../shared/types/domain";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Modal } from "../../../shared/ui/Modal";
import { Pagination } from "../../../shared/ui/Pagination";
import { PageSkeleton } from "../../../shared/ui/Skeleton";
import { StatePanel } from "../../../shared/ui/StatePanel";
import { useToast } from "../../../shared/ui/Toast";

interface EnrollmentPanelProps {
  classId: string;
  classVersion: number;
  canManage: boolean;
}

const warningList = (error: ApiError): LifecycleWarning[] => {
  const value = error.details?.warnings;
  return Array.isArray(value) ? (value as LifecycleWarning[]) : [];
};

export const EnrollmentPanel = ({ classId, classVersion, canManage }: EnrollmentPanelProps) => {
  const tenant = useTenant();
  const client = useQueryClient();
  const { showToast } = useToast();
  const [scope, setScope] = useState<"Active" | "History">("Active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<LifecycleWarning[]>([]);
  const [ending, setEnding] = useState<EnrollmentItem | null>(null);
  const [endStatus, setEndStatus] = useState<"Left" | "Transferred">("Left");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const roster = useQuery({
    queryKey: ["class-enrollments", tenant.id, classId, scope, search, page],
    queryFn: () => lifecycleRepository.enrollments(tenant.slug, classId, scope, search, page, 20),
  });
  const candidates = useQuery({
    queryKey: ["enrollment-candidates", tenant.id, classId, candidateSearch],
    queryFn: () => lifecycleRepository.candidates(tenant.slug, classId, candidateSearch),
    enabled: addOpen,
  });

  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["class-detail", tenant.id, classId] }),
      client.invalidateQueries({ queryKey: ["class-enrollments", tenant.id, classId] }),
      client.invalidateQueries({ queryKey: ["enrollment-candidates", tenant.id, classId] }),
      client.invalidateQueries({ queryKey: ["classes"] }),
      client.invalidateQueries({ queryKey: ["management-schedule"] }),
      client.invalidateQueries({ queryKey: ["teacher-schedule"] }),
      client.invalidateQueries({ queryKey: ["teacher-classes"] }),
      client.invalidateQueries({ queryKey: ["student-classes"] }),
    ]);
  };

  const addMutation = useMutation({
    mutationFn: () =>
      lifecycleRepository.addEnrollments(
        tenant.slug,
        classId,
        selectedIds,
        classVersion,
        warnings.map((warning) => warning.id),
      ),
    onSuccess: async () => {
      await invalidate();
      setAddOpen(false);
      setSelectedIds([]);
      setWarnings([]);
      setError("");
      showToast("Đã thêm học sinh vào lớp và ghi nhận học phí ban đầu.");
    },
    onError: (caught) => {
      if (caught instanceof ApiError) {
        const nextWarnings = warningList(caught);
        if (nextWarnings.length) {
          setWarnings(nextWarnings);
          setError("Kiểm tra cảnh báo rồi xác nhận thêm một lần nữa.");
          return;
        }
        setError(caught.message);
      } else {
        setError("Không thể thêm học sinh.");
      }
    },
  });

  const endMutation = useMutation({
    mutationFn: () => {
      if (!ending) throw new Error("Missing enrollment");
      return lifecycleRepository.endEnrollment(
        tenant.slug,
        classId,
        ending.id,
        endStatus,
        reason,
        classVersion,
        ending.version,
      );
    },
    onSuccess: async () => {
      await invalidate();
      setEnding(null);
      setReason("");
      setError("");
      showToast(endStatus === "Left" ? "Đã ghi nhận rời lớp." : "Đã ghi nhận chuyển lớp.");
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : "Không thể kết thúc lượt ghi danh."),
  });

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const closeAdd = () => {
    if (addMutation.isPending) return;
    setAddOpen(false);
    setSelectedIds([]);
    setWarnings([]);
    setError("");
  };

  return (
    <section aria-labelledby="enrollment-heading">
      <div className="enrollment-toolbar">
        <div>
          <h2 className="section-title" id="enrollment-heading">
            Danh sách học sinh
          </h2>
          <p className="text-muted">Mỗi lần học sinh tham gia lại sẽ tạo một lượt ghi danh và khoản học phí ban đầu mới.</p>
        </div>
        {canManage ? (
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus size={18} aria-hidden="true" />
            Thêm học sinh
          </Button>
        ) : (
          <Badge>Kế toán · chỉ đọc</Badge>
        )}
      </div>
      <div className="enrollment-filters">
        <div className="tabs compact-tabs" role="tablist" aria-label="Phạm vi danh sách học sinh">
          {(["Active", "History"] as const).map((value) => (
            <button
              type="button"
              className={`tab ${scope === value ? "active" : ""}`}
              role="tab"
              aria-selected={scope === value}
              key={value}
              onClick={() => {
                setScope(value);
                setPage(1);
              }}
            >
              {value === "Active" ? "Hiện tại" : "Lịch sử"}
            </button>
          ))}
        </div>
        <label className="student-search enrollment-search">
          <span className="sr-only">Tìm học sinh</span>
          <input
            className="control"
            value={search}
            placeholder="Tên hoặc mã học sinh"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Search size={18} aria-hidden="true" />
        </label>
      </div>

      {roster.isPending ? <PageSkeleton /> : null}
      {roster.isError ? (
        <StatePanel
          kind="error"
          title="Không tải được danh sách học sinh"
          description="Vui lòng kiểm tra kết nối và thử lại."
        />
      ) : null}
      {roster.data && roster.data.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title={scope === "Active" ? "Chưa có học sinh hiện tại" : "Chưa có lịch sử rời lớp"}
          description="Đổi bộ lọc hoặc thêm học sinh để cập nhật danh sách lớp."
        />
      ) : null}
      {roster.data?.items.length ? (
        <>
          <div className="table-shell responsive-table-wrap">
            <table className="data-table responsive-card-table enrollment-table">
              <caption className="sr-only">Danh sách ghi danh của lớp</caption>
              <thead>
                <tr>
                  <th scope="col">Học sinh</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thời gian</th>
                  <th scope="col">Học phí gốc</th>
                  <th scope="col">Lý do</th>
                  {canManage && scope === "Active" ? <th scope="col">Thao tác</th> : null}
                </tr>
              </thead>
              <tbody>
                {roster.data.items.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Học sinh">
                      <strong>{item.student.name}</strong>
                      <small className="table-subline">{item.student.code}</small>
                    </td>
                    <td data-label="Trạng thái">
                      <Badge tone={item.status === "Active" ? "success" : "neutral"}>
                        {item.status === "Active"
                          ? "Đang học"
                          : item.status === "Left"
                            ? "Rời lớp"
                            : "Chuyển lớp"}
                      </Badge>
                    </td>
                    <td data-label="Thời gian">
                      {formatDate(item.effectiveFrom)}
                      {item.effectiveTo ? ` → ${formatDate(item.effectiveTo)}` : " → nay"}
                    </td>
                    <td data-label="Học phí gốc">
                      {item.originalTuitionAmount === null
                        ? "—"
                        : formatCurrency(item.originalTuitionAmount)}
                      <small className="table-subline">{item.tuitionStatus ?? "—"}</small>
                    </td>
                    <td data-label="Lý do">{item.endReason || "—"}</td>
                    {canManage && scope === "Active" ? (
                      <td data-label="Thao tác">
                        <Button variant="secondary" onClick={() => setEnding(item)}>
                          <UserMinus size={16} aria-hidden="true" />
                          Kết thúc
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={roster.data.page}
            totalPages={roster.data.totalPages}
            totalItems={roster.data.totalItems}
            itemLabel="lượt ghi danh"
            onPageChange={setPage}
          />
        </>
      ) : null}

      <Modal
        open={addOpen}
        title="Thêm học sinh vào lớp"
        onClose={closeAdd}
        confirmLabel={warnings.length ? "Xác nhận cảnh báo và thêm" : "Kiểm tra và thêm"}
        onConfirm={() => addMutation.mutate()}
        confirmDisabled={selectedIds.length === 0}
        confirmLoading={addMutation.isPending}
      >
        <p className="modal-description">
          Tất cả học sinh sẽ được thêm cùng lúc. Nếu có một trường hợp chưa hợp lệ, hệ thống sẽ
          không thay đổi danh sách lớp hoặc học phí.
        </p>
        <label className="student-search">
          <span className="field-label">Tìm ứng viên</span>
          <input
            className="control"
            value={candidateSearch}
            onChange={(event) => setCandidateSearch(event.target.value)}
            placeholder="Tên hoặc mã học sinh"
          />
          <Search size={18} aria-hidden="true" />
        </label>
        {warnings.length ? (
          <div className="warning-stack" role="alert">
            {warnings.map((warning) => (
              <div className="form-alert" key={warning.id}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        ) : null}
        {error ? (
          <p className="form-alert" role="alert">
            {error}
          </p>
        ) : null}
        <div className="student-option-list enrollment-candidate-list">
          {candidates.isPending ? <p className="text-muted">Đang tải ứng viên…</p> : null}
          {candidates.data?.items.map((candidate) => (
            <label
              className={`student-option ${selected.has(candidate.id) ? "selected" : ""}`}
              key={candidate.id}
            >
              <span className="student-avatar" aria-hidden="true">
                {candidate.name.slice(0, 2)}
              </span>
              <span>
                <strong>{candidate.name}</strong>
                <small>{candidate.code}</small>
              </span>
              <input
                type="checkbox"
                checked={selected.has(candidate.id)}
                onChange={(event) => {
                  setWarnings([]);
                  setError("");
                  setSelectedIds((current) =>
                    event.target.checked
                      ? [...current, candidate.id]
                      : current.filter((id) => id !== candidate.id),
                  );
                }}
              />
            </label>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(ending)}
        title="Kết thúc lượt ghi danh"
        onClose={() => {
          if (endMutation.isPending) return;
          setEnding(null);
          setReason("");
          setError("");
        }}
        confirmLabel="Xác nhận"
        onConfirm={() => endMutation.mutate()}
        confirmDisabled={!reason.trim()}
        confirmLoading={endMutation.isPending}
      >
        <div className="modal-form">
          <p className="modal-description">
            {ending?.student.name} sẽ mất quyền truy cập lớp từ hôm nay. Lịch sử tham gia và học phí
            trước đó vẫn được giữ nguyên.
          </p>
          <label className="field">
            <span className="field-label">Kết quả</span>
            <select
              className="control"
              value={endStatus}
              onChange={(event) => setEndStatus(event.target.value as "Left" | "Transferred")}
            >
              <option value="Left">Rời lớp</option>
              <option value="Transferred">Chuyển lớp</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Lý do *</span>
            <textarea
              className="control"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </label>
          {error ? (
            <p className="form-alert" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </section>
  );
};
