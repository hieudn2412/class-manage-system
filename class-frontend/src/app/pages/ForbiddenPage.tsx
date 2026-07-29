import { Link, useParams } from "react-router-dom";
import { StatePanel } from "../../shared/ui/StatePanel";

export const ForbiddenPage = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  return (
    <main className="min-h-[70vh] grid place-items-center p-5">
      <div className="w-full max-w-2xl">
        <StatePanel
          kind="forbidden"
          title="Bạn không có quyền truy cập"
          description="Trang này thuộc một vai trò khác hoặc nằm ngoài phạm vi tenant của phiên hiện tại."
          action={
            <Link className="button" to={`/t/${tenantSlug ?? "anh-duong"}/app`}>
              Về trang phù hợp với vai trò
            </Link>
          }
        />
      </div>
    </main>
  );
};
