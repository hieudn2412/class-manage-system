import type { PropsWithChildren } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./providers/AuthProvider";
import { hasPermission, type Permission } from "../shared/lib/permissions";

export const RequireAuth = ({ children }: PropsWithChildren) => {
  const { session } = useAuth();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (!session) {
    return (
      <Navigate
        to={`/t/${tenantSlug ?? "anh-duong"}/login`}
        replace
        state={{ from: location.pathname }}
      />
    );
  }
  if (session.user.passwordState === "MUST_CHANGE") {
    return <Navigate to={`/t/${tenantSlug ?? "anh-duong"}/change-password`} replace />;
  }
  return children;
};

export const RequireTenantScope = ({ children }: PropsWithChildren) => {
  const { session } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (!session) return null;
  if (!session.tenant || session.tenant.slug !== tenantSlug) {
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
