import { useEffect, useRef, useState } from "react";
import { Paperclip, UploadCloud, X } from "lucide-react";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import type { FilePurpose, StoredFile } from "../../shared/types/domain";
import { Button } from "../../shared/ui/Button";
import { useToast } from "../../shared/ui/Toast";
import { formatBytes, isPreviewableImageFile } from "./contentUtils";
import { PrivateFileImage } from "./PrivateFileImage";

interface FileTokenPickerProps {
  tenantSlug: string;
  purpose: FilePurpose;
  files: StoredFile[];
  onChange: (files: StoredFile[]) => void;
  maxFiles?: number;
}

export const FileTokenPicker = ({
  tenantSlug,
  purpose,
  files,
  onChange,
  maxFiles,
}: FileTokenPickerProps) => {
  const [uploading, setUploading] = useState(false);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const localPreviewsRef = useRef<Record<string, string>>({});
  const { showToast } = useToast();

  useEffect(() => {
    localPreviewsRef.current = localPreviews;
  }, [localPreviews]);

  useEffect(
    () => () => {
      Object.values(localPreviewsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const pick = async (selected: FileList | null) => {
    if (!selected?.length) return;
    if (maxFiles && files.length + selected.length > maxFiles) {
      showToast(`Tối đa ${maxFiles} file.`);
      return;
    }
    setUploading(true);
    try {
      const uploaded: StoredFile[] = [];
      const previews: Record<string, string> = {};
      for (const file of Array.from(selected)) {
        const stored = await learningContentRepository.upload(tenantSlug, file, purpose);
        uploaded.push(stored);
        if (isPreviewableImageFile(stored)) previews[stored.id] = URL.createObjectURL(file);
      }
      onChange([...files, ...uploaded]);
      if (Object.keys(previews).length) {
        setLocalPreviews((current) => ({ ...current, ...previews }));
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Không thể tải tệp lên. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (file: StoredFile) => {
    const preview = localPreviews[file.id];
    if (preview) URL.revokeObjectURL(preview);
    setLocalPreviews((current) => {
      const next = { ...current };
      delete next[file.id];
      return next;
    });
    onChange(files.filter((item) => item.id !== file.id));
  };

  const imageFiles = files.filter(isPreviewableImageFile);

  return (
    <div className="file-token-picker">
      <label className="upload-drop">
        <UploadCloud size={20} aria-hidden="true" />
        <span>{uploading ? "Đang tải lên..." : "Chọn tệp"}</span>
        <input
          type="file"
          multiple
          disabled={uploading}
          onChange={(event) => {
            void pick(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {imageFiles.length ? (
        <div className="file-image-preview-grid" aria-label="Xem trước ảnh đã chọn">
          {imageFiles.map((file) => (
            <figure className="file-image-preview-card" key={file.id}>
              <PrivateFileImage
                file={file}
                tenantSlug={tenantSlug}
                localSrc={localPreviews[file.id]}
                alt={`Xem trước ${file.originalFilename}`}
              />
              <figcaption>
                <span>{file.originalFilename}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeFile(file)}
                  aria-label={`Bỏ ${file.originalFilename}`}
                >
                  <X size={15} aria-hidden="true" />
                </Button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {files.length ? (
        <ul className="file-chip-list">
          {files.map((file) => (
            <li key={file.id}>
              <Paperclip size={15} aria-hidden="true" />
              <span>
                <strong>{file.originalFilename}</strong>
                <small>{formatBytes(file.sizeBytes)}</small>
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeFile(file)}
                aria-label={`Bỏ ${file.originalFilename}`}
              >
                <X size={15} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
