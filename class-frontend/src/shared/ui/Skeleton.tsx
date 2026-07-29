export const Skeleton = ({ className }: { className: string }) => (
  <div className={`skeleton ${className}`} aria-hidden="true" />
);

export const PageSkeleton = () => (
  <div aria-label="Đang tải dữ liệu" role="status">
    <Skeleton className="h-5 w-28 mb-4" />
    <Skeleton className="h-16 w-3/5 mb-8" />
    <div className="metrics-grid">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton className="h-40" key={index} />
      ))}
    </div>
    <Skeleton className="h-72 w-full mt-6" />
  </div>
);
