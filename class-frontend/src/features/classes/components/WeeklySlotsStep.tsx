import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import type { ClassSchedulingOptions } from "../../../shared/types/domain";
import { Button } from "../../../shared/ui/Button";
import { Input, Select } from "../../../shared/ui/FormField";
import { StatePanel } from "../../../shared/ui/StatePanel";
import type { ClassFormValues } from "../classFormSchema";

const weekdayOptions = [
  [1, "Thứ 2"],
  [2, "Thứ 3"],
  [3, "Thứ 4"],
  [4, "Thứ 5"],
  [5, "Thứ 6"],
  [6, "Thứ 7"],
  [7, "Chủ nhật"],
] as const;

const nextPatternId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pattern-${Date.now()}`;

interface WeeklySlotsStepProps {
  options: ClassSchedulingOptions;
}

export const WeeklySlotsStep = ({ options }: WeeklySlotsStepProps) => {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<ClassFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "patterns",
    keyName: "fieldKey",
  });
  const patterns = watch("patterns");
  const defaultMode = watch("defaultMode");

  const addPattern = () => {
    append({
      id: nextPatternId(),
      weekday: 1,
      startTime: "19:00",
      endTime: "21:00",
      mode: defaultMode,
      roomId:
        defaultMode === "IN_PERSON"
          ? (options.rooms.find((room) => room.status === "ACTIVE")?.id ?? null)
          : null,
    });
  };

  return (
    <section aria-labelledby="weekly-slots-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Bước 3 / 4</p>
          <h2 id="weekly-slots-title">Các ca lặp mỗi tuần</h2>
          <p>Hệ thống trộn các ca theo thứ tự thời gian và tiếp tục đến khi đủ tổng số buổi.</p>
        </div>
        <Button type="button" onClick={addPattern}>
          <Plus size={18} aria-hidden="true" />
          Thêm ca
        </Button>
      </div>
      {errors.patterns?.root?.message ? (
        <p className="field-error" role="alert">
          {errors.patterns.root.message}
        </p>
      ) : null}
      {fields.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Chưa có ca học"
          description="Thêm ít nhất một ca lặp để có thể xem trước và sinh lịch."
          actionLabel="Thêm ca đầu tiên"
          onAction={addPattern}
        />
      ) : (
        <div className="slot-list">
          {fields.map((field, index) => {
            const mode = patterns[index]?.mode ?? defaultMode;
            return (
              <article className="slot-card" key={field.fieldKey}>
                <div className="slot-card-head">
                  <div>
                    <span className="slot-index">{String(index + 1).padStart(2, "0")}</span>
                    <strong>Ca lặp</strong>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => remove(index)}
                    aria-label={`Xóa ca ${index + 1}`}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                    Xóa
                  </Button>
                </div>
                <input type="hidden" {...register(`patterns.${index}.id`)} />
                <div className="slot-grid">
                  <Select
                    label="Thứ *"
                    error={errors.patterns?.[index]?.weekday?.message}
                    {...register(`patterns.${index}.weekday`, { valueAsNumber: true })}
                  >
                    {weekdayOptions.map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Bắt đầu *"
                    type="time"
                    error={errors.patterns?.[index]?.startTime?.message}
                    {...register(`patterns.${index}.startTime`)}
                  />
                  <Input
                    label="Kết thúc *"
                    type="time"
                    error={errors.patterns?.[index]?.endTime?.message}
                    {...register(`patterns.${index}.endTime`)}
                  />
                  <Select
                    label="Hình thức *"
                    error={errors.patterns?.[index]?.mode?.message}
                    {...register(`patterns.${index}.mode`)}
                  >
                    <option value="IN_PERSON">Tại lớp</option>
                    <option value="ONLINE">Trực tuyến</option>
                  </Select>
                  {mode === "IN_PERSON" ? (
                    <Select
                      label="Phòng *"
                      error={errors.patterns?.[index]?.roomId?.message}
                      {...register(`patterns.${index}.roomId`)}
                    >
                      <option value="">Chọn phòng</option>
                      {options.rooms.map((room) => (
                        <option value={room.id} disabled={room.status === "INACTIVE"} key={room.id}>
                          {room.code} · {room.capacity} chỗ
                          {room.status === "INACTIVE" ? " · Ngừng hoạt động" : ""}
                        </option>
                      ))}
                    </Select>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
