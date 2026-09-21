import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FilePlus2, Trash2 } from "lucide-react";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import type { Material, StoredFile } from "../../shared/types/domain";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input, Textarea } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";
import { fileHref, formatBytes } from "./contentUtils";
import { FileTokenPicker } from "./FileTokenPicker";

export const ClassMaterialsPanel = ({
  tenantSlug,
  classId,
  canManage,
}: {
  tenantSlug: string;
  classId: string;
  canManage: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["class-materials", tenantSlug, classId],
    queryFn: () =>
      learningContentRepository.materials(tenantSlug, classId, { page: 1, pageSize: 100 }),
  });
  const invalidate = async () =>
    client.invalidateQueries({ queryKey: ["class-materials", tenantSlug, classId] });
  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <StatePanel
        kind="error"
        title="Không tải được tài liệu"
        description="Vui lòng thử lại sau."
      />
    );
  }
  return (
    <section className="content-panel">
      <header className="content-section-head">
        <div>
          <p className="eyebrow">TÀI LIỆU HỌC TẬP</p>
          <h2>Tài liệu lớp</h2>
        </div>
        {canManage ? (
          <Button onClick={() => setOpen(true)}>
            <FilePlus2 size={17} /> Thêm tài liệu
          </Button>
        ) : null}
      </header>
      {!query.data?.items.length ? (
        <StatePanel
          kind="empty"
          title="Chưa có tài liệu"
          description="Tài liệu lớp và buổi sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="content-card-grid">
          {query.data.items.map((item) => (
            <article className="content-card" key={item.id}>
              <header>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.sessionOrdinal ? `Buổi ${item.sessionOrdinal}` : "Cấp lớp"}</small>
                </span>
                <Badge tone="success">Đang sử dụng</Badge>
              </header>
              <p>{item.description || "Không có mô tả."}</p>
              <a
                className="record-link"
                href={fileHref(item.file)}
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} /> {item.file.originalFilename} ·{" "}
                {formatBytes(item.file.sizeBytes)}
              </a>
              {canManage ? (
                <div className="row-actions">
                  <Button variant="secondary" onClick={() => setEditing(item)}>
                    Sửa
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setEditing({ ...item, status: "REMOVED" })}
                  >
                    <Trash2 size={15} /> Gỡ
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <MaterialModal
        tenantSlug={tenantSlug}
        classId={classId}
        open={open || Boolean(editing)}
        material={editing}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onDone={invalidate}
      />
    </section>
  );
};

const MaterialModal = ({
  tenantSlug,
  classId,
  open,
  material,
  onClose,
  onDone,
}: {
  tenantSlug: string;
  classId: string;
  open: boolean;
  material: Material | null;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) => {
  const [title, setTitle] = useState(material?.title ?? "");
  const [description, setDescription] = useState(material?.description ?? "");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => {
      if (material?.status === "REMOVED") {
        return learningContentRepository.removeMaterial(tenantSlug, material.id, material.version);
      }
      if (material) {
        return learningContentRepository.updateMaterial(tenantSlug, material.id, {
          title,
          description,
          fileToken: files[0]?.token ?? undefined,
          version: material.version,
        });
      }
      return learningContentRepository.createMaterial(tenantSlug, classId, {
        title,
        description,
        fileToken: files[0]?.token ?? "",
      });
    },
    onSuccess: async () => {
      await onDone();
      onClose();
      showToast("Tài liệu đã được cập nhật.");
    },
    onError: (error) =>
      showToast(error instanceof Error ? error.message : "Không thể lưu tài liệu."),
  });
  return (
    <Modal
      open={open}
      title={
        material?.status === "REMOVED" ? "Gỡ tài liệu" : material ? "Sửa tài liệu" : "Thêm tài liệu"
      }
      onClose={onClose}
      confirmLabel={material?.status === "REMOVED" ? "Gỡ" : "Lưu"}
      confirmDisabled={
        material?.status !== "REMOVED" && (!title.trim() || (!material && !files[0]?.token))
      }
      confirmLoading={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    >
      {material?.status === "REMOVED" ? (
        <p>File sẽ bị xóa vật lý sau khi gỡ, audit vẫn giữ metadata.</p>
      ) : (
        <div className="content-form">
          <Input label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Textarea
            label="Mô tả"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FileTokenPicker
            tenantSlug={tenantSlug}
            purpose="MATERIAL"
            files={files}
            onChange={setFiles}
            maxFiles={1}
          />
        </div>
      )}
    </Modal>
  );
};
