import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useTenant } from "../../app/providers/TenantProvider";
import { authRepository } from "../../services/repositories/authRepository";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { AuthLayout } from "./AuthLayout";

const schema = z.object({
  username: z.string().trim().min(1, "Vui lòng nhập tên đăng nhập."),
});

type FormValues = z.infer<typeof schema>;

export const ForgotPasswordPage = () => {
  const tenant = useTenant();
  const [successMessage, setSuccessMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: "" } });

  const onSubmit = handleSubmit(async ({ username }) => {
    const response = await authRepository.forgotPassword(tenant.slug, username);
    setSuccessMessage(response.message);
  });

  return (
    <AuthLayout>
      <section className="auth-card" aria-labelledby="forgot-title">
        <header className="auth-card-header">
          <p className="eyebrow">Khôi phục quyền truy cập</p>
          <h1 id="forgot-title">Quên mật khẩu</h1>
          <p>Thông báo luôn giống nhau để không tiết lộ tài khoản có tồn tại hay không.</p>
        </header>
        {successMessage ? (
          <div className="auth-form">
            <div className="form-alert form-success" role="status">
              <CheckCircle2 size={20} aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
            <Link className="button" to={`/t/${tenant.slug}/login`}>
              <ArrowLeft size={18} aria-hidden="true" />
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={(event) => void onSubmit(event)} noValidate>
            <Input
              label="Tên đăng nhập"
              autoComplete="username"
              placeholder="Tên đăng nhập được trung tâm cấp"
              error={errors.username?.message}
              {...register("username")}
            />
            <Button type="submit" loading={isSubmitting}>
              Gửi hướng dẫn đặt lại
            </Button>
            <Link className="button button-secondary" to={`/t/${tenant.slug}/login`}>
              <ArrowLeft size={18} aria-hidden="true" />
              Quay lại đăng nhập
            </Link>
          </form>
        )}
      </section>
    </AuthLayout>
  );
};
