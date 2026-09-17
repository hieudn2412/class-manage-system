import { createContext, useContext, type PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { authRepository } from "../../services/repositories/authRepository";
import { ApiError } from "../../shared/types/api";
import type { Tenant } from "../../shared/types/domain";
import { StatePanel } from "../../shared/ui/StatePanel";
import { Skeleton } from "../../shared/ui/Skeleton";

const TenantContext = createContext<Tenant | null>(null);

export const TenantProvider = ({ children }: PropsWithChildren) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const query = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: () => authRepository.getTenant(tenantSlug ?? ""),
    retry: false,
    enabled: Boolean(tenantSlug),
  });

  if (query.isPending) {
    return (
      <main className="auth-main min-h-screen">
        <div className="w-full max-w-xl" role="status" aria-label="Đang tải trung tâm">
          <Skeleton className="h-8 w-40 mb-8" />
          <Skeleton className="h-16 w-full mb-4" />
          <Skeleton className="h-12 w-full mb-3" />
          <Skeleton className="h-12 w-full" />
        </div>
      </main>
    );
  }

  if (query.isError || !query.data) {
    const isLocked = query.error instanceof ApiError && query.error.code === "TENANT_LOCKED";
    return (
      <main className="auth-main min-h-screen">
        <div className="w-full max-w-2xl">
          <StatePanel
            kind="forbidden"
            title={isLocked ? "Trung tâm đang bị khóa" : "Không tìm thấy trung tâm"}
            description={
              isLocked
                ? "Tài khoản của trung tâm đang tạm ngừng đăng nhập. Vui lòng liên hệ quản trị viên hệ thống."
                : "Đường dẫn trung tâm không hợp lệ hoặc trung tâm không còn hoạt động."
            }
            action={
              <div className="state-actions">
                <Link className="button button-secondary" to="/">
                  Chọn trung tâm khác
                </Link>
                <Link className="button" to="/platform/login">
                  Đăng nhập quản trị hệ thống
                </Link>
              </div>
            }
          />
        </div>
      </main>
    );
  }

  return <TenantContext.Provider value={query.data}>{children}</TenantContext.Provider>;
};

export const useTenant = (): Tenant => {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used inside TenantProvider");
  return context;
};
