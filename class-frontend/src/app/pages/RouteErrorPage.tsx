import { useRouteError } from "react-router-dom";
import { StatePanel } from "../../shared/ui/StatePanel";

export const RouteErrorPage = () => {
  const routeError = useRouteError();
  const message =
    routeError instanceof Error ? routeError.message : "Đã có lỗi không mong đợi xảy ra.";
  return (
    <main className="min-h-screen grid place-items-center p-5">
      <div className="w-full max-w-2xl">
        <StatePanel
          kind="error"
          title="Ứng dụng gặp sự cố"
          description={message}
          actionLabel="Tải lại trang"
          onAction={() => window.location.reload()}
        />
      </div>
    </main>
  );
};
