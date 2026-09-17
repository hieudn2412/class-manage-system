import { useEffect, useState } from "react";
import { loadSession } from "../../shared/lib/sessionStorage";
import type { StoredFile } from "../../shared/types/domain";
import { filePreviewHref } from "./contentUtils";

interface PrivateFileImageProps {
  file: StoredFile;
  tenantSlug: string;
  alt: string;
  localSrc?: string | null;
  className?: string;
}

export const PrivateFileImage = ({
  file,
  tenantSlug,
  alt,
  localSrc,
  className,
}: PrivateFileImageProps) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const token = localSrc ? null : (loadSession()?.token ?? null);

  useEffect(() => {
    if (localSrc) return undefined;
    if (!token) return undefined;

    const controller = new AbortController();
    let nextObjectUrl: string | null = null;
    const headers = new Headers({
      Accept: file.contentType,
      Authorization: `Bearer ${token}`,
      "X-Tenant-Slug": tenantSlug,
    });

    void fetch(filePreviewHref(file), { headers, signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("IMAGE_PREVIEW_FAILED");
        return response.blob();
      })
      .then((blob) => {
        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });

    return () => {
      controller.abort();
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [file, localSrc, tenantSlug, token]);

  const src = localSrc || objectUrl;
  if (src) return <img className={className} src={src} alt={alt} loading="lazy" />;

  return (
    <span className="private-image-placeholder" role="img" aria-label={alt}>
      {failed || !token ? "Không xem trước được ảnh" : "Đang tải ảnh..."}
    </span>
  );
};
