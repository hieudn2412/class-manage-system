import { Link, useParams } from "react-router-dom";
import { StatePanel } from "../../shared/ui/StatePanel";

export const NotFoundPage = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  return (
    <main className="min-h-screen grid place-items-center p-5">
      <div className="w-full max-w-2xl">
        <StatePanel
          kind="empty"
          title="Không tìm thấy trang"
          description="Đường dẫn có thể đã thay đổi hoặc nội dung không tồn tại."
          action={
            <Link className="button" to={`/t/${tenantSlug ?? "anh-duong"}/app`}>
              Về trang chủ
            </Link>
          }
        />
      </div>
    </main>
  );
};
