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
      if (!query.data) throw new Error("Chưa tải quota tenant.");
      return learningContentRepository.updatePlatformQuota(
        tenantId,
        Math.round(Number(quotaGb) * 1024 * 1024 * 1024),
        query.data.version,
      );
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["platform-quota", tenantId] });
      showToast("Quota tenant đã cập nhật.");
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể cập nhật quota."),
  });
  return (
    <section className="management-page">
      <PageHeader
        eyebrow="PLATFORM / STORAGE"
        title="Quota lưu trữ tenant"
        subtitle="Điều chỉnh giới hạn dung lượng cho file private, staging và preview."
      />
      <div className="filter-bar">
        <Input label="Tenant ID" value={tenantId} onChange={(event) => setTenantId(event.target.value)} />
        <Input label="Quota mới (GB)" type="number" min="1" value={quotaGb} onChange={(event) => setQuotaGb(event.target.value)} />
        <Button disabled={!query.data} loading={mutation.isPending} onClick={() => mutation.mutate()}>
          <DatabaseZap size={16} /> Cập nhật
        </Button>
      </div>
      {query.isPending ? <PageSkeleton /> : null}
      {tenantId && query.isError ? <StatePanel kind="error" title="Không tải được quota" description="Kiểm tra Tenant ID hoặc quyền Super Admin." /> : null}
      {query.data ? (
        <section className="salary-metric-grid" aria-label="Dung lượng tenant">
          <article><span>Quota</span><strong>{formatBytes(query.data.quotaBytes)}</strong><small>Giới hạn hiện tại</small></article>
          <article><span>Đã dùng</span><strong>{formatBytes(query.data.usedBytes)}</strong><small>Bao gồm staging</small></article>
          <article><span>Còn lại</span><strong>{formatBytes(query.data.remainingBytes)}</strong><small>Có thể upload</small></article>
          <article><span>Staging</span><strong>{formatBytes(query.data.stagingBytes)}</strong><small>Token 24 giờ</small></article>
        </section>
      ) : null}
    </section>
  );
};
