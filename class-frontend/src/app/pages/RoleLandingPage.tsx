import { ArrowRight, Construction } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { hasPermission, PERMISSIONS, roleLabels } from "../../shared/lib/permissions";
import { StatePanel } from "../../shared/ui/StatePanel";

export const RoleLandingPage = () => {
  const { session } = useAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  if (!session) return null;
  const base = `/t/${tenantSlug ?? "anh-duong"}/app`;
  if (hasPermission(session.user.roles, PERMISSIONS.VIEW_MANAGEMENT_DASHBOARD)) {
    return <Navigate to={`${base}/dashboard`} replace />;
  }
  if (hasPermission(session.user.roles, PERMISSIONS.VIEW_CLASSES)) {
    return <Navigate to={`${base}/classes`} replace />;
  }
  if (hasPermission(session.user.roles, PERMISSIONS.VIEW_OWN_TEACHING)) {
    return <Navigate to={`${base}/teacher-dashboard`} replace />;
  }
  if (hasPermission(session.user.roles, PERMISSIONS.VIEW_OWN_LEARNING)) {
    return <Navigate to={`${base}/learning-classes`} replace />;
  }
  const firstRole = session.user.roles[0];
  return (
    <StatePanel
      kind="empty"
      title={`Xin chào, ${session.user.displayName}`}
      description={`Bạn đang đăng nhập với vai trò ${
        firstRole ? roleLabels[firstRole] : "chưa xác định"
      }. Các module nghiệp vụ của vai trò này nằm ngoài vertical slice đầu tiên.`}
      action={
        <Link className="button button-secondary" to={`/t/${tenantSlug ?? "anh-duong"}/login`}>
          <Construction size={18} aria-hidden="true" />
          Quay lại đăng nhập
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      }
    />
  );
};
