import { useState } from "react";
import type {
  DeliveryMode,
  RoomOption,
  SchedulePreviewSession,
  SessionScheduleOverride,
} from "../../../shared/types/domain";
import { Select } from "../../../shared/ui/FormField";
import { Modal } from "../../../shared/ui/Modal";

interface PreviewSessionOverrideModalProps {
  session: SchedulePreviewSession;
  rooms: RoomOption[];
  onClose: () => void;
  onApply: (override: SessionScheduleOverride) => void;
}

export const PreviewSessionOverrideModal = ({
  session,
  rooms,
  onClose,
  onApply,
}: PreviewSessionOverrideModalProps) => {
  const [mode, setMode] = useState<DeliveryMode>(session.mode);
  const [roomId, setRoomId] = useState(session.roomId ?? "");
  const [error, setError] = useState("");

  const apply = () => {
    if (mode === "IN_PERSON" && !roomId) {
      setError("Hãy chọn một phòng đang hoạt động.");
      return;
    }
    onApply({
      sessionKey: session.key,
      mode,
      roomId: mode === "IN_PERSON" ? roomId : null,
    });
  };

  return (
    <Modal
      open={Boolean(session)}
      title="Điều chỉnh riêng buổi học"
      onClose={onClose}
      confirmLabel="Áp dụng & xem trước lại"
      onConfirm={apply}
    >
      <p className="modal-description">
        Chỉ buổi được chọn thay đổi. Ngày, giờ và giáo viên vẫn được giữ nguyên.
      </p>
      <div className="modal-form">
        <Select
          label="Hình thức"
          value={mode}
          onChange={(event) => setMode(event.target.value as DeliveryMode)}
        >
          <option value="IN_PERSON">Tại lớp</option>
          <option value="ONLINE">Online</option>
        </Select>
        {mode === "IN_PERSON" ? (
          <Select
            label="Phòng"
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            error={error}
          >
            <option value="">Chọn phòng</option>
            {rooms.map((room) => (
              <option value={room.id} disabled={room.status === "INACTIVE"} key={room.id}>
                {room.code} · {room.capacity} chỗ
                {room.status === "INACTIVE" ? " · Ngừng hoạt động" : ""}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
    </Modal>
  );
};
