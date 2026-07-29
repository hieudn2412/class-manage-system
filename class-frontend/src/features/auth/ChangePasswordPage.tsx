import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, KeyRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../../app/providers/AuthProvider";
import { useTenant } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { ApiError } from "../../shared/types/api";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { AuthLayout } from "./AuthLayout";

const schema = z
  .object({
    newPassword: z.string().min(8, "Mật khẩu mới phải có ít nhất 8 ký tự."),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu mới."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp.",
  });

type FormValues = z.infer<typeof schema>;

export const ChangePasswordPage = () => {
  const tenant = useTenant();
  const { session, setChangedPasswordSession } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  if (!session) return <Navigate to={`/t/${tenant.slug}/login`} replace />;
  if (session.user.passwordState !== "MUST_CHANGE") {
    return <Navigate to={`/t/${tenant.slug}/app`} replace />;
  }

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    try {
      const nextSession = await authRepository.changePassword({
        tenantSlug: tenant.slug,
        newPassword,
      });
      setChangedPasswordSession(nextSession);
      void navigate(`/t/${tenant.slug}/app`, { replace: true });
    } catch (caught) {
      setError("root", {
        message:
          caught instanceof ApiError ? caught.message : "Không thể đổi mật khẩu. Vui lòng thử lại.",
      });
    }
  });

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="change-title">
        <header className="auth-card-header">
          <p className="eyebrow">Lần đăng nhập đầu tiên</p>
          <h1 id="change-title">Tạo mật khẩu của bạn</h1>
          <p>Mật khẩu tạm phải được thay trước khi truy cập bất kỳ dữ liệu nghiệp vụ nào.</p>
        </header>
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)} noValidate>
          <div className="form-alert form-success">
            <KeyRound size={19} aria-hidden="true" />
            <span>Phiên hiện tại chỉ có quyền đổi mật khẩu.</span>
          </div>
          {errors.root?.message ? (
            <div className="form-alert" role="alert">
              <AlertTriangle size={19} aria-hidden="true" />
              <span>{errors.root.message}</span>
            </div>
          ) : null}
          <Input
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            hint="Tối thiểu 8 ký tự."
            error={errors.newPassword?.message}
            {...register("newPassword")}
          />
          <Input
            label="Nhập lại mật khẩu mới"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <Button type="submit" loading={isSubmitting}>
            Đổi mật khẩu và tiếp tục
          </Button>
        </form>
      </section>
    </AuthLayout>
  );
};
