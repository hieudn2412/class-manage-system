import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { ApiError } from "../../shared/types/api";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({
  username: z.string().trim().min(1, "Vui lòng nhập tên đăng nhập."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
  remember: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export const LoginPage = () => {
  const tenant = useTenant();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      password: "",
      remember: false,
    },
  });

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await login(
        {
          tenantSlug: tenant.slug,
          username: values.username,
          password: values.password,
        },
        values.remember,
      );
      if (session.user.passwordState === "MUST_CHANGE") {
        void navigate(`/t/${tenant.slug}/change-password`, { replace: true });
        return;
      }
      void navigate(from ?? `/t/${tenant.slug}/app`, { replace: true });
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : "Không thể đăng nhập. Vui lòng kiểm tra kết nối và thử lại.";
      setError("root", { message });
    }
  });

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="login-title">
        <div className="tenant-label">
          <Building2 size={15} aria-hidden="true" />
          Tenant: {tenant.name}
        </div>
        <header className="auth-card-header">
          <p className="eyebrow">WF-01 · Truy cập hệ thống</p>
          <h1 id="login-title">Đăng nhập an toàn</h1>
          <p>Dùng tài khoản được trung tâm cấp để tiếp tục công việc.</p>
        </header>
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)} noValidate>
          {errors.root?.message ? (
            <div className="form-alert" role="alert">
              <AlertTriangle size={19} aria-hidden="true" />
              <span>{errors.root.message}</span>
            </div>
          ) : null}
          <Input
            label="Tên đăng nhập"
            autoComplete="username"
            placeholder="Ví dụ: admin.anhduong"
            error={errors.username?.message}
            {...register("username")}
          />
          <Input
            label="Mật khẩu"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <label className="checkbox-row">
            <input type="checkbox" {...register("remember")} />
            <span>Ghi nhớ trên thiết bị này</span>
          </label>
          <Button type="submit" loading={isSubmitting}>
            Đăng nhập
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
          <Link className="button button-secondary" to={`/t/${tenant.slug}/forgot-password`}>
            Quên mật khẩu?
          </Link>
        </form>
        <div className="auth-scope-switch">
          <span>Bạn là quản trị viên nền tảng?</span>
          <Link to="/platform/login">
            <ShieldCheck size={16} aria-hidden="true" />
            Đăng nhập Super Admin
          </Link>
        </div>
        <footer className="auth-footer">
          <span>Phiên bản trình diễn frontend</span>
          <span>FR-IAM-003–005 · FL-04</span>
        </footer>
      </section>
    </AuthLayout>
  );
};
