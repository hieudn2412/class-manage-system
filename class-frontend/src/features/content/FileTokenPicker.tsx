import { useState } from "react";
import { Paperclip, UploadCloud, X } from "lucide-react";
import { learningContentRepository } from "../../services/repositories/learningContentRepository";
import type { FilePurpose, StoredFile } from "../../shared/types/domain";
import { Button } from "../../shared/ui/Button";
import { useToast } from "../../shared/ui/Toast";
import { formatBytes } from "./contentUtils";

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
  const { showToast } = useToast();
  const pick = async (selected: FileList | null) => {
    if (!selected?.length) return;
    if (maxFiles && files.length + selected.length > maxFiles) {
      showToast(`Tối đa ${maxFiles} file.`);
      return;
    }
    setUploading(true);
    try {
      const uploaded: StoredFile[] = [];
      for (const file of Array.from(selected)) {
        uploaded.push(await learningContentRepository.upload(tenantSlug, file, purpose));
      }
      onChange([...files, ...uploaded]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Upload không thành công.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="file-token-picker">
      <label className="upload-drop">
        <UploadCloud size={20} aria-hidden="true" />
        <span>{uploading ? "Đang upload..." : "Chọn file"}</span>
        <input
          type="file"
          multiple
          disabled={uploading}
          onChange={(event) => void pick(event.target.files)}
        />
      </label>
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
                onClick={() => onChange(files.filter((item) => item.id !== file.id))}
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
