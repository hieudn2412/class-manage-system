import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../../app/providers/AuthProvider";
import { profileRepository } from "../../services/repositories/profileRepository";
import { formatDate, formatDateTime } from "../../shared/lib/format";
import { roleLabels } from "../../shared/lib/permissions";
import type { SelfProfile } from "../../shared/types/domain";
import { ApiError } from "../../shared/types/api";
import { Badge } from "../../shared/ui/Badge";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { PageSkeleton } from "../../shared/ui/Skeleton";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    newPassword: z.string().min(8, "Mật khẩu mới phải có ít nhất 8 ký tự."),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu mới."),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "Mật khẩu mới cần khác mật khẩu hiện tại.",
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu nhập lại không khớp.",
  });

type PasswordForm = z.infer<typeof passwordSchema>;

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Email chưa đúng định dạng.",
    }),
});

type EmailForm = z.infer<typeof emailSchema>;

const profileTypeLabels = {
  STAFF: "Nhân sự trung tâm",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
} as const;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const InfoItem = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="profile-info-item">
    <dt>{label}</dt>
    <dd>{value?.trim() || "Chưa cập nhật"}</dd>
  </div>
);

const ProfileDetails = ({ profile }: { profile: SelfProfile }) => (
  <section className="profile-card" aria-labelledby="profile-details-title">
    <div className="profile-identity">
      <span className="profile-avatar" aria-hidden="true">
        {initials(profile.displayName)}
      </span>
      <div>
        <h2 id="profile-details-title">{profile.displayName}</h2>
        <p>@{profile.username}</p>
        <div className="profile-role-list" aria-label="Vai trò">
          {profile.roles.map((role) => (
            <Badge tone="info" key={role}>
              {roleLabels[role]}
            </Badge>
          ))}
        </div>
      </div>
    </div>

    <div className="profile-section-heading">
      <UserRound size={19} aria-hidden="true" />
      <div>
        <h3>Thông tin tài khoản</h3>
        <p>Thông tin do quản trị viên cung cấp và quản lý.</p>
      </div>
    </div>
    <dl className="profile-info-grid">
      <InfoItem label="Họ và tên" value={profile.displayName} />
      <InfoItem label="Tên đăng nhập" value={profile.username} />
      {profile.tenant ? <InfoItem label="Trung tâm" value={profile.tenant.name} /> : null}
      <InfoItem label="Email" value={profile.email} />
      {profile.profileType ? (
        <InfoItem label="Loại tài khoản" value={profileTypeLabels[profile.profileType]} />
      ) : null}
      {profile.profileType === "TEACHER" ? (
        <InfoItem label="Mã giáo viên" value={profile.code} />
      ) : null}
      {profile.profileType === "STUDENT" ? (
        <InfoItem label="Mã học sinh" value={profile.code} />
      ) : null}
      <InfoItem
        label="Trạng thái"
        value={profile.status === "ACTIVE" ? "Đang hoạt động" : "Đang khóa"}
      />
      <InfoItem label="Ngày tạo tài khoản" value={formatDate(profile.createdAt)} />
      <InfoItem
        label="Lần đăng nhập gần nhất"
        value={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : null}
      />
    </dl>

    {profile.profileType === "STUDENT" ? (
      <div className="profile-family-section">
        <div className="profile-section-heading">
          <UserRound size={19} aria-hidden="true" />
          <div>
            <h3>Thông tin phụ huynh</h3>
            <p>Thông tin liên hệ đang được lưu trong hồ sơ học sinh.</p>
          </div>
        </div>
        <dl className="profile-info-grid">
          <InfoItem label="Họ tên phụ huynh" value={profile.parentName} />
          <InfoItem label="Số điện thoại" value={profile.parentPhone} />
        </dl>
      </div>
    ) : null}
  </section>
);

export const ProfilePage = () => {
  const { setChangedPasswordSession } = useAuth();
  const { showToast } = useToast();
  const client = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["self-profile"], queryFn: profileRepository.me });
  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    reset: resetEmail,
    setError: setEmailError,
    formState: { errors: emailErrors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const {
    register,
    handleSubmit,
    reset: resetPassword,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (profileQuery.data) resetEmail({ email: profileQuery.data.email ?? "" });
  }, [profileQuery.data, resetEmail]);

  const emailMutation = useMutation({
    mutationFn: (input: EmailForm) => profileRepository.updateEmail(input),
    onSuccess: (updatedProfile) => {
      client.setQueryData(["self-profile"], updatedProfile);
      resetEmail({ email: updatedProfile.email ?? "" });
      showToast("Đã cập nhật email liên hệ.");
    },
    onError: (caught) => {
      if (caught instanceof ApiError) {
        if (caught.fieldErrors?.email) {
          setEmailError("email", { message: caught.fieldErrors.email });
        } else {
          setEmailError("root", { message: caught.message });
        }
        return;
      }
      setEmailError("root", { message: "Không thể cập nhật email. Vui lòng thử lại." });
    },
  });

  const onEmailSubmit = handleEmailSubmit(({ email }) => {
    emailMutation.mutate({ email });
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      const nextSession = await profileRepository.changePassword({ currentPassword, newPassword });
      setChangedPasswordSession(nextSession);
      resetPassword();
      showToast("Đã đổi mật khẩu. Các phiên đăng nhập cũ đã được đăng xuất.");
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.fieldErrors?.currentPassword) {
          setError("currentPassword", { message: caught.fieldErrors.currentPassword });
        }
        if (caught.fieldErrors?.newPassword) {
          setError("newPassword", { message: caught.fieldErrors.newPassword });
        }
        if (!caught.fieldErrors?.currentPassword && !caught.fieldErrors?.newPassword) {
          setError("root", { message: caught.message });
        }
        return;
      }
      setError("root", { message: "Không thể đổi mật khẩu. Vui lòng thử lại." });
    }
  });

  if (profileQuery.isPending) return <PageSkeleton />;
  if (profileQuery.isError) {
    return (
      <StatePanel
        kind="error"
        title="Chưa thể tải hồ sơ"
        description="Vui lòng kiểm tra kết nối và thử tải lại trang."
        actionLabel="Tải lại hồ sơ"
        onAction={() => void profileQuery.refetch()}
      />
    );
  }

  return (
    <div className="profile-page">
      <PageHeader
        eyebrow={
          profileQuery.data.scope === "PLATFORM" ? "Tài khoản hệ thống" : "Tài khoản của bạn"
        }
        title="Hồ sơ cá nhân"
        subtitle="Xem thông tin tài khoản và bảo vệ tài khoản bằng mật khẩu riêng của bạn."
      />
      <div className="profile-layout">
        <ProfileDetails profile={profileQuery.data} />
        <div className="profile-side-stack">
          <section className="profile-card profile-contact-card" aria-labelledby="profile-email-title">
            <div className="profile-section-heading">
              <span className="profile-security-icon" aria-hidden="true">
                <Mail size={22} />
              </span>
              <div>
                <h2 id="profile-email-title">Email liên hệ</h2>
                <p>Email dùng để nhận thông báo và hỗ trợ khôi phục tài khoản.</p>
              </div>
            </div>
            <form
              className="profile-password-form"
              onSubmit={(event) => void onEmailSubmit(event)}
              noValidate
            >
              {emailErrors.root?.message ? (
                <div className="form-alert" role="alert">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>{emailErrors.root.message}</span>
                </div>
              ) : null}
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="ten@example.com"
                hint="Để trống nếu bạn chưa muốn lưu email."
                error={emailErrors.email?.message}
                {...registerEmail("email")}
              />
              <Button
                type="submit"
                loading={emailMutation.isPending}
                className="profile-submit-button"
              >
                Lưu email
              </Button>
            </form>
          </section>
          <section
            className="profile-card profile-security-card"
            aria-labelledby="profile-password-title"
          >
            <div className="profile-section-heading">
              <span className="profile-security-icon" aria-hidden="true">
                <ShieldCheck size={22} />
              </span>
              <div>
                <h2 id="profile-password-title">Đổi mật khẩu</h2>
                <p>Dùng mật khẩu chỉ bạn biết để bảo vệ tài khoản.</p>
              </div>
            </div>
            <form
              className="profile-password-form"
              onSubmit={(event) => void onSubmit(event)}
              noValidate
            >
              <div className="profile-security-note">
                <KeyRound size={18} aria-hidden="true" />
                <p>Sau khi đổi mật khẩu, các phiên đăng nhập cũ sẽ tự động hết hiệu lực.</p>
              </div>
              {errors.root?.message ? (
                <div className="form-alert" role="alert">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>{errors.root.message}</span>
                </div>
              ) : null}
              <Input
                label="Mật khẩu hiện tại"
                type="password"
                autoComplete="current-password"
                error={errors.currentPassword?.message}
                {...register("currentPassword")}
              />
              <Input
                label="Mật khẩu mới"
                type="password"
                autoComplete="new-password"
                hint="Tối thiểu 8 ký tự và khác mật khẩu hiện tại."
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
              <Button type="submit" loading={isSubmitting} className="profile-submit-button">
                Đổi mật khẩu
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
