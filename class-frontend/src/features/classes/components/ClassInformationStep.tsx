import { useFormContext } from "react-hook-form";
import type { ClassSchedulingOptions } from "../../../shared/types/domain";
import { Input, Select, Textarea } from "../../../shared/ui/FormField";
import type { ClassFormValues } from "../classFormSchema";

interface ClassInformationStepProps {
  options: ClassSchedulingOptions;
}

export const ClassInformationStep = ({ options }: ClassInformationStepProps) => {
  const {
    register,
    formState: { errors },
  } = useFormContext<ClassFormValues>();

  return (
    <section aria-labelledby="class-information-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Bước 1 / 4</p>
          <h2 id="class-information-title">Thông tin lớp</h2>
        </div>
        <span className="status-note">Mã lớp được sinh tự động khi lưu nháp</span>
      </div>
      <div className="form-grid">
        <Input
          label="Tên lớp *"
          placeholder="Ví dụ: Toán tư duy 4A"
          error={errors.name?.message}
          {...register("name")}
        />
        <Select
          label="Giáo viên chính *"
          error={errors.primaryTeacherId?.message}
          {...register("primaryTeacherId")}
        >
          <option value="">Chọn giáo viên</option>
          {options.teachers.map((teacher) => (
            <option value={teacher.id} key={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </Select>
        <Input
          label="Ngày bắt đầu *"
          type="date"
          error={errors.startDate?.message}
          {...register("startDate")}
        />
        <Input
          label="Tổng số buổi *"
          type="number"
          min={1}
          inputMode="numeric"
          error={errors.totalSessions?.message}
          {...register("totalSessions", { valueAsNumber: true })}
        />
        <Input
          label="Học phí cố định *"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          hint="Áp dụng giống nhau cho mọi học sinh."
          error={errors.tuitionAmount?.message}
          {...register("tuitionAmount", { valueAsNumber: true })}
        />
        <Input
          label="Đơn giá dạy/giờ *"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          hint="Mức đầu tiên có hiệu lực từ ngày bắt đầu lớp."
          error={errors.hourlyRate?.message}
          {...register("hourlyRate", { valueAsNumber: true })}
        />
        <Input
          label="Sĩ số tối đa"
          type="number"
          min={1}
          inputMode="numeric"
          error={errors.capacity?.message}
          {...register("capacity", {
            setValueAs: (value: string) => (value === "" ? null : Number(value)),
          })}
        />
        <Select label="Hình thức mặc định *" {...register("defaultMode")}>
          <option value="IN_PERSON">Tại lớp</option>
          <option value="ONLINE">Trực tuyến</option>
        </Select>
        <div className="form-span-2">
          <Textarea
            label="Mô tả"
            rows={4}
            placeholder="Mục tiêu hoặc ghi chú vận hành của lớp"
            {...register("description")}
          />
        </div>
      </div>
    </section>
  );
};
