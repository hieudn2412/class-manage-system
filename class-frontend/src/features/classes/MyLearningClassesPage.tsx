import { useQuery } from "@tanstack/react-query";
import { BookOpen, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "../../app/providers/TenantProvider";
import { lifecycleRepository } from "../../services/repositories/lifecycleRepository";
import { formatDate } from "../../shared/lib/format";
import type { StudentClassItem } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Pagination } from "../../shared/ui/Pagination";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { classStatusLabels, classStatusTones } from "./classPresentation";

const LearningCard = ({ item, tenantSlug }: { item: StudentClassItem; tenantSlug: string }) => {
  const content = (
    <article className={`learning-class-card ${item.access === "Locked" ? "is-locked" : ""}`}>
      <div className="learning-card-heading">
        <span className="learning-card-icon" aria-hidden="true">
          {item.access === "Locked" ? <LockKeyhole size={20} /> : <BookOpen size={20} />}
        </span>
        <span>
          <small>{item.code}</small>
          <h3>{item.name}</h3>
        </span>
        <Badge tone={classStatusTones[item.status]}>{classStatusLabels[item.status]}</Badge>
      </div>
      <dl className="learning-card-meta">
        <div>
          <dt>Giáo viên</dt>
          <dd>{item.teacherName}</dd>
        </div>
        <div>
          <dt>Lịch học</dt>
          <dd>{item.scheduleSummary || "Chưa có lịch cố định"}</dd>
        </div>
        <div>
          <dt>Tiến độ</dt>
          <dd>
            {item.completedSessions}/{item.totalSessions} buổi
          </dd>
        </div>
        <div>
          <dt>Tham gia từ</dt>
          <dd>{formatDate(item.effectiveFrom)}</dd>
        </div>
      </dl>
      {item.access === "Locked" ? (
        <p className="locked-note">
          Nội dung lớp không còn khả dụng. Thẻ này chỉ giữ thông tin lịch sử.
        </p>
      ) : (
        <span className="learning-card-link">Mở nội dung lớp →</span>
      )}
    </article>
  );
  return item.access === "Accessible" ? (
    <Link
      className="learning-card-anchor"
      to={`/t/${tenantSlug}/app/learning-classes/${item.id}`}
      aria-label={`Mở lớp ${item.name}`}
    >
      {content}
    </Link>
  ) : (
    content
  );
};

export const MyLearningClassesPage = () => {
  const tenant = useTenant();
  const [filter, setFilter] = useState<"All" | "Accessible" | "Locked">("All");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["student-classes", tenant.id, filter, page],
    queryFn: () => lifecycleRepository.studentClasses(tenant.slug, filter, page, 12),
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <StatePanel
        kind="error"
        title="Không tải được lớp của tôi"
        description="Vui lòng thử lại sau."
      />
    );
  }
  const accessible = query.data.items.filter((item) => item.access === "Accessible");
  const locked = query.data.items.filter((item) => item.access === "Locked");

  return (
    <>
      <PageHeader
        eyebrow="KHÔNG GIAN HỌC SINH"
        title="Lớp của tôi"
        subtitle="Theo dõi buổi học, nội dung thực dạy, điểm danh và nhận xét của riêng bạn."
      />
      <div className="student-access-filter" role="group" aria-label="Lọc quyền truy cập lớp">
        {(["All", "Accessible", "Locked"] as const).map((value) => (
          <button
            type="button"
            className={filter === value ? "active" : ""}
            key={value}
            onClick={() => {
              setFilter(value);
              setPage(1);
            }}
          >
            {value === "All" ? "Tất cả" : value === "Accessible" ? "Đang truy cập" : "Đã khóa"}
          </button>
        ))}
      </div>
      {!query.data.items.length ? (
        <StatePanel
          kind="empty"
          title="Chưa có lớp trong phạm vi này"
          description="Lớp được công bố và enrollment của bạn sẽ xuất hiện tại đây."
        />
      ) : null}
      {accessible.length ? (
        <section className="learning-section" aria-labelledby="accessible-classes">
          <div className="learning-section-heading">
            <div>
              <span className="eyebrow">CÒN QUYỀN</span>
              <h2 id="accessible-classes">Nội dung đang mở</h2>
            </div>
            <Badge tone="success">{accessible.length} lớp</Badge>
          </div>
          <div className="learning-class-grid">
            {accessible.map((item) => (
              <LearningCard item={item} tenantSlug={tenant.slug} key={item.id} />
            ))}
          </div>
        </section>
      ) : null}
      {locked.length ? (
        <section className="learning-section" aria-labelledby="locked-classes">
          <div className="learning-section-heading">
            <div>
              <span className="eyebrow">LỊCH SỬ</span>
              <h2 id="locked-classes">Lớp đã khóa</h2>
            </div>
            <Badge>{locked.length} lớp</Badge>
          </div>
          <div className="learning-class-grid">
            {locked.map((item) => (
              <LearningCard item={item} tenantSlug={tenant.slug} key={item.id} />
            ))}
          </div>
        </section>
      ) : null}
      {query.data.totalPages > 1 ? (
        <Pagination
          page={query.data.page}
          totalPages={query.data.totalPages}
          totalItems={query.data.totalItems}
          itemLabel="lớp"
          onPageChange={setPage}
        />
      ) : null}
    </>
  );
};
