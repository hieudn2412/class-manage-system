import type { PropsWithChildren } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./providers/AuthProvider";
import { hasPermission, type Permission } from "../shared/lib/permissions";

export const RequireAuth = ({ children }: PropsWithChildren) => {
  const { session } = useAuth();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (!session) {
    if (location.pathname.startsWith("/platform")) {
      return <Navigate to="/platform/login" replace state={{ from: location.pathname }} />;
    }
    return (
      <Navigate
        to={`/t/${tenantSlug ?? "anh-duong"}/login`}
        replace
        state={{ from: location.pathname }}
      />
    );
  }
  if (session.user.passwordState === "MUST_CHANGE") {
    const target =
      session.scope === "PLATFORM"
        ? "/platform/change-password"
        : `/t/${session.tenant?.slug ?? tenantSlug ?? "anh-duong"}/change-password`;
    return <Navigate to={target} replace />;
  }
  return children;
};

export const RequirePlatformScope = ({ children }: PropsWithChildren) => {
  const { session } = useAuth();
  if (!session) return <Navigate to="/platform/login" replace />;
  if (session.scope !== "PLATFORM") return <Navigate to="/platform/403" replace />;
  return children;
};

export const RequireTenantScope = ({ children }: PropsWithChildren) => {
  const { session } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (!session) return null;
  if (session.scope !== "TENANT" || !session.tenant || session.tenant.slug !== tenantSlug) {
    return <Navigate to={`/t/${tenantSlug ?? "anh-duong"}/403`} replace />;
  }
  return children;
};

export const RequirePermission = ({
  permission,
  children,
}: PropsWithChildren<{ permission: Permission }>) => {
  const { session } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (!session || !hasPermission(session.user.roles, permission)) {
    return <Navigate to={`/t/${tenantSlug ?? "anh-duong"}/403`} replace />;
  }
  return children;
};

export const RequireAnyPermission = ({
  permissions,
  children,
}: PropsWithChildren<{ permissions: Permission[] }>) => {
  const { session } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (
    !session ||
    !permissions.some((permission) => hasPermission(session.user.roles, permission))
  ) {
    return <Navigate to={`/t/${tenantSlug ?? "anh-duong"}/403`} replace />;
  }
  return children;
};
