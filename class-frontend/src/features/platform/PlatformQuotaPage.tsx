import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap } from "lucide-react";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import { formatBytes } from "../content/contentUtils";

export const PlatformQuotaPage = () => {
  const [tenantId, setTenantId] = useState("");
  const [quotaGb, setQuotaGb] = useState("50");
  const client = useQueryClient();
  const { showToast } = useToast();
  const query = useQuery({
    queryKey: ["platform-quota", tenantId],
    queryFn: () => learningContentRepository.platformUsage(tenantId),
    enabled: Boolean(tenantId),
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (!query.data) throw new Error("Chưa tải được hạn mức dung lượng của trung tâm.");
      return learningContentRepository.updatePlatformQuota(
        tenantId,
        Math.round(Number(quotaGb) * 1024 * 1024 * 1024),
        query.data.version,
      );
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["platform-quota", tenantId] });
      showToast("Đã cập nhật hạn mức dung lượng.");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể cập nhật hạn mức dung lượng."),
  });
  return (
    <section className="management-page">
      <PageHeader
        eyebrow="QUẢN LÝ DUNG LƯỢNG"
        title="Hạn mức dung lượng trung tâm"
        subtitle="Xem dung lượng đã dùng và điều chỉnh mức lưu trữ cho từng trung tâm."
      />
      <div className="filter-bar">
        <Input label="Mã trung tâm" value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
        <Input label="Hạn mức mới (GB)" type="number" min="1" value={quotaGb} onChange={(event) => setQuotaGb(event.target.value)} />
        <Button disabled={!query.data} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          <DatabaseZap size={16} /> Cập nhật
        </Button>
      </div>
      {query.isPending ? <PageSkeleton /> : null}
      {tenantId && query.isError ? <StatePanel kind="error" title="Không tải được hạn mức dung lượng" description="Vui lòng kiểm tra mã trung tâm hoặc quyền quản trị hệ thống." /> : null}
      {query.data ? (
        <section className="salary-metric-grid" aria-label="Dung lượng của trung tâm">
          <article><span>Hạn mức</span><strong>{formatBytes(query.data.quotaBytes)}</strong><small>Dung lượng tối đa</small></article>
          <article><span>Đã dùng</span><strong>{formatBytes(query.data.usedBytes)}</strong><small>Gồm cả tệp đang chờ xử lý</small></article>
          <article><span>Còn lại</span><strong>{formatBytes(query.data.remainingBytes)}</strong><small>Dung lượng có thể sử dụng</small></article>
          <article><span>Đang chờ xử lý</span><strong>{formatBytes(query.data.stagingBytes)}</strong><small>Tự hết hạn sau 24 giờ</small></article>
        </section>
      ) : null}
    </section>
  );
};
