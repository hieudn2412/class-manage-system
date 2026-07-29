import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { dashboardRepository } from "../../services/repositories/dashboardRepository";
import { formatDate } from "../../shared/lib/format";
import { Button } from "../../shared/ui/Button";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

export const DashboardPage = () => {
  const tenant = useTenant();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const query = useQuery({
    queryKey: ["management-dashboard", tenant.id],
    queryFn: () => dashboardRepository.getManagementDashboard(tenant.slug),
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <StatePanel
        kind="error"
        title="Không thể tải dashboard"
        description="Dữ liệu vận hành chưa thể tải. Vui lòng kiểm tra kết nối rồi thử lại."
        actionLabel="Thử lại"
        onAction={() => void query.refetch()}
      />
    );
  }

  const dashboard = query.data;
  return (
    <>
      <PageHeader
        eyebrow={`${formatDate(dashboard.date)} · ${tenant.name}`}
        title={`Chào buổi sáng, ${dashboard.greetingName}`}
        subtitle="Bản đồ vận hành hôm nay: việc cần xử lý trước, số liệu sau."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => showToast("Xuất báo cáo nằm ngoài vertical slice đầu tiên.")}
            >
              <FileText size={18} aria-hidden="true" />
              In báo cáo
            </Button>
            <Button onClick={() => void navigate(`/t/${tenant.slug}/app/classes/new`)}>
              <Plus size={18} aria-hidden="true" />
              Tạo lớp mới
            </Button>
          </>
        }
      />

      {dashboard.kpis.length ? (
        <section className="metrics-grid" aria-label="Chỉ số vận hành">
          {dashboard.kpis.map((kpi) => (
            <article className="panel metric-card" key={kpi.id}>
              <div className="metric-card-head">
                <p className="metric-label">{kpi.label}</p>
                {kpi.delta ? <span className="badge badge-neutral">{kpi.delta}</span> : null}
              </div>
              <p className="metric-value">{kpi.value}</p>
              <p className="metric-detail">{kpi.detail}</p>
            </article>
          ))}
        </section>
      ) : (
        <StatePanel
          kind="empty"
          title="Chưa có số liệu hôm nay"
          description="KPI sẽ xuất hiện khi trung tâm có lớp hoặc buổi học trong ngày."
        />
      )}

      <div className="dashboard-lower">
        <section className="panel-flat section-panel" aria-labelledby="attention-title">
          <h2 className="section-title" id="attention-title">
            Việc cần xử lý
          </h2>
          {dashboard.attentionItems.length ? (
            <ul className="attention-list">
              {dashboard.attentionItems.map((item) => (
                <li className="attention-item" key={item.id}>
                  <span
                    className={`severity-mark ${item.severity}`}
                    aria-label={`Mức độ ${item.severity}`}
                    role="img"
                  />
                  <span className="attention-copy">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (item.targetSessionId) {
                        void navigate(`/t/${tenant.slug}/app/sessions/${item.targetSessionId}`);
                        return;
                      }
                      showToast(`${item.actionLabel}: chưa có đối tượng chi tiết để mở.`);
                    }}
                  >
                    {item.actionLabel}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <StatePanel
              kind="empty"
              title="Không có việc tồn đọng"
              description="Các hồ sơ cần theo dõi sẽ xuất hiện tại đây."
            />
          )}
        </section>
        <section className="panel-flat section-panel" aria-labelledby="class-state-title">
          <h2 className="section-title" id="class-state-title">
            Trạng thái lớp
          </h2>
          {dashboard.classStates.map((metric) => {
            const max = Math.max(...dashboard.classStates.map((item) => item.count), 1);
            return (
              <div className="state-metric" key={metric.status}>
                <div className="state-metric-head">
                  <span>{metric.label}</span>
                  <strong>{metric.count}</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`${metric.label}: ${metric.count} lớp`}
                  aria-valuenow={metric.count}
                  aria-valuemin={0}
                  aria-valuemax={max}
                >
                  <div
                    className="progress-value"
                    style={{ width: `${(metric.count / max) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
};
