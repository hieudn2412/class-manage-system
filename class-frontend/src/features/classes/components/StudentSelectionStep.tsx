import { useQuery } from "@tanstack/react-query";
import { Check, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTenant } from "../../../app/providers/TenantProvider";
import { classRepository } from "../../../services/repositories/classRepository";
import { Button } from "../../../shared/ui/Button";
import { Input } from "../../../shared/ui/FormField";
import { Pagination } from "../../../shared/ui/Pagination";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { StatePanel } from "../../../shared/ui/StatePanel";
import type { ClassFormValues } from "../classFormSchema";

export const StudentSelectionStep = () => {
  const tenant = useTenant();
  const { watch, setValue } = useFormContext<ClassFormValues>();
  const selectedIds = watch("studentIds");
  const capacity = watch("capacity");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ["students", tenant.id, debouncedSearch, page],
    queryFn: () => classRepository.listStudents(tenant.slug, debouncedSearch, page, 8),
    placeholderData: (previous) => previous,
  });

  const toggleStudent = (studentId: string) => {
    const next = selectedIds.includes(studentId)
      ? selectedIds.filter((id) => id !== studentId)
      : [...selectedIds, studentId];
    setValue("studentIds", next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <section aria-labelledby="student-selection-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Bước 2 / 4</p>
          <h2 id="student-selection-title">Chọn học sinh tham gia</h2>
          <p>Chỉ chọn tài khoản đã tồn tại. Chưa phát sinh học phí khi lớp còn là bản nháp.</p>
        </div>
        <div className="selection-count" aria-live="polite">
          <Users size={18} aria-hidden="true" />
          <strong>{selectedIds.length}</strong>
          <span>{capacity ? `/ ${capacity}` : ""} học sinh đã chọn</span>
        </div>
      </div>
      <div className="student-search">
        <Input
          label="Tìm theo tên hoặc mã học sinh"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ví dụ: Nguyễn Minh Anh hoặc HS-0142"
        />
        <Search size={19} aria-hidden="true" />
      </div>
      {query.isPending ? (
        <div aria-label="Đang tải học sinh" role="status">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-14 w-full mb-2" key={index} />
          ))}
        </div>
      ) : query.isError || !query.data ? (
        <StatePanel
          kind="error"
          title="Không thể tải danh sách học sinh"
          description="Các lựa chọn hiện có vẫn được giữ. Hãy thử tải lại danh sách."
          actionLabel="Thử lại"
          onAction={() => void query.refetch()}
        />
      ) : query.data.items.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Không có học sinh phù hợp"
          description="Thử đổi tên hoặc mã học sinh. Không thể tạo tài khoản mới từ màn này."
        />
      ) : (
        <>
          <div className="student-option-list" role="list" aria-label="Học sinh có thể chọn">
            {query.data.items.map((student) => {
              const selected = selectedIds.includes(student.id);
              return (
                <div
                  className={selected ? "student-option selected" : "student-option"}
                  key={student.id}
                >
                  <span className="student-avatar" aria-hidden="true">
                    {student.name
                      .split(" ")
                      .slice(-2)
                      .map((part) => part[0])
                      .join("")}
                  </span>
                  <span>
                    <strong>{student.name}</strong>
                    <small>{student.code}</small>
                  </span>
                  <Button
                    type="button"
                    variant={selected ? "primary" : "secondary"}
                    onClick={() => toggleStudent(student.id)}
                    aria-pressed={selected}
                  >
                    {selected ? <Check size={17} aria-hidden="true" /> : null}
                    {selected ? "Đã chọn" : "Chọn"}
                  </Button>
                </div>
              );
            })}
          </div>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            totalItems={query.data.totalItems}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
};
