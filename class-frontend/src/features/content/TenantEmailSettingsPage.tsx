import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Mail, Plug, RefreshCw, Send, ShieldCheck, Unplug } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { tenantEmailRepository } from "../../services/repositories/tenantEmailRepository";
import { ApiError } from "../../shared/types/api";
import type { TenantEmailConnection } from "../../shared/types/domain";
import { formatDate } from "../../shared/lib/format";
import { Button } from "../../shared/ui/Button";
import { Input } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { StatePanel } from "../../shared/ui/StatePanel";
import { useToast } from "../../shared/ui/Toast";

const callbackMessages: Record<string, string> = {
  success: "Đã kết nối Gmail để gửi thông báo cho trung tâm.",
  GMAIL_SCOPE_MISSING: "Gmail chưa cấp quyền gửi email. Vui lòng kết nối lại và chấp nhận quyền gửi thư.",
  GMAIL_EMAIL_UNVERIFIED: "Địa chỉ Gmail này chưa được xác minh. Vui lòng chọn tài khoản khác.",
  GMAIL_OAUTH_STATE_EXPIRED: "Phiên kết nối đã hết hạn. Vui lòng bắt đầu lại.",
  GMAIL_OAUTH_STATE_USED: "Phiên kết nối này đã được dùng.",
  GMAIL_VERSION_CONFLICT: "Kết nối Gmail vừa được quản trị viên khác thay đổi. Trang đã được tải lại.",
  GMAIL_REAUTH_REQUIRED: "Kết nối Gmail chưa hoàn tất. Vui lòng kết nối lại.",
  GMAIL_SEND_FAILED: "Không thể hoàn tất kết nối với Google. Vui lòng kiểm tra cấu hình hoặc thử lại.",
  GMAIL_SEND_TIMEOUT: "Google chưa phản hồi kịp thời. Vui lòng thử lại sau.",
  GMAIL_RATE_LIMITED: "Google đang giới hạn tạm thời. Vui lòng thử lại sau.",
  FORBIDDEN: "Tài khoản của bạn không còn quyền quản lý Gmail của trung tâm.",
};

export const TenantEmailSettingsPage = () => {
  const { tenantSlug = "" } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { showToast } = useToast();
  const client = useQueryClient();
  const [testOpen, setTestOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  const query = useQuery({
    queryKey: ["tenant-email-connection", tenantSlug],
    queryFn: () => tenantEmailRepository.status(tenantSlug),
  });

  useEffect(() => {
    const result = params.get("gmailResult");
    if (!result) return;
    const code = params.get("code");
    showToast(result === "success" ? "Đã kết nối Gmail để gửi thông báo cho trung tâm." : callbackMessages[code ?? ""] ?? "Không thể hoàn tất kết nối Gmail. Vui lòng thử lại.");
    void client.invalidateQueries({ queryKey: ["tenant-email-connection", tenantSlug] });
    void navigate(`/t/${tenantSlug}/app/settings/email`, { replace: true });
  }, [client, navigate, params, showToast, tenantSlug]);

  const connectMutation = useMutation({
    mutationFn: () => tenantEmailRepository.authorize(tenantSlug),
    onSuccess: (response) => {
      window.location.assign(response.authorizationUrl);
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể tạo phiên kết nối Gmail."),
  });

  const testMutation = useMutation({
    mutationFn: () => tenantEmailRepository.test(tenantSlug, recipientEmail),
    onSuccess: async (response) => {
      setTestOpen(false);
      showToast(`Đã gửi email thử${response.gmailMessageId ? ` (${response.gmailMessageId})` : ""}.`);
      await client.invalidateQueries({ queryKey: ["tenant-email-connection", tenantSlug] });
    },
    onError: async (error) => {
      await client.invalidateQueries({ queryKey: ["tenant-email-connection", tenantSlug] });
      if (error instanceof ApiError && error.retryAfterSeconds) {
        showToast(`Vui lòng thử lại sau ${error.retryAfterSeconds} giây.`);
      } else {
        showToast(error instanceof Error ? error.message : "Không thể gửi email thử.");
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => tenantEmailRepository.disconnect(tenantSlug, query.data?.version ?? 0),
    onSuccess: async () => {
      setDisconnectOpen(false);
      showToast("Đã ngắt kết nối Gmail của trung tâm.");
      await client.invalidateQueries({ queryKey: ["tenant-email-connection", tenantSlug] });
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "Không thể ngắt kết nối Gmail."),
  });

  const connection = query.data;
  const statusTone = useMemo(() => statusMeta(connection), [connection]);

  if (query.isLoading) {
    return <StatePanel kind="empty" title="Đang tải Gmail thông báo" description="Đang kiểm tra trạng thái kết nối." />;
  }
  if (query.isError || !connection) {
    return (
      <StatePanel
        kind="error"
        title="Không tải được cấu hình Gmail"
        description="Kiểm tra kết nối rồi thử lại."
        actionLabel="Thử lại"
        onAction={() => void query.refetch()}
      />
    );
  }

  return (
    <section className="tenant-email-page">
      <header className="tenant-email-header">
        <div>
          <p className="eyebrow">CÀI ĐẶT THÔNG BÁO</p>
          <h1>Gmail thông báo</h1>
          <p>Kết nối Gmail của trung tâm để gửi bài tập, tài liệu và kết quả nhận xét qua email.</p>
        </div>
        <StatusPill connection={connection} />
      </header>

      {!connection.oauthConfigured ? (
        <StatePanel
          kind="error"
        title="Gmail chưa được thiết lập"
          description="Quản trị viên hệ thống cần hoàn tất cấu hình Google trước khi trung tâm có thể kết nối Gmail."
        />
      ) : (
        <div className="tenant-email-grid">
          <section className={`panel tenant-email-status ${statusTone.className}`}>
            <div className="tenant-email-card-head">
              <span className="tenant-email-icon">{statusTone.icon}</span>
              <div>
                <p className="eyebrow">{statusTone.eyebrow}</p>
                <h2>{statusTone.title}</h2>
                <p>{statusTone.description}</p>
              </div>
            </div>
            <dl className="tenant-email-facts">
              <div>
                <dt>Tài khoản gửi</dt>
                <dd>{connection.gmailAddressMasked ?? "Chưa có"}</dd>
              </div>
              <div>
                <dt>Người kết nối</dt>
                <dd>{connection.connectedBy ?? "Chưa có"}</dd>
              </div>
              <div>
                <dt>Lần gửi thành công</dt>
                <dd>{connection.lastSuccessfulSendAt ? formatDate(connection.lastSuccessfulSendAt) : "Chưa gửi"}</dd>
              </div>
              <div>
                <dt>Email đang chờ</dt>
                <dd>{connection.pendingEmailCount}</dd>
              </div>
            </dl>
            {connection.lastErrorMessage ? (
              <div className="tenant-email-alert">
                <AlertTriangle size={17} />
                <span>{connection.lastErrorMessage}</span>
              </div>
            ) : null}
            <div className="tenant-email-actions">
              <Button onClick={() => connectMutation.mutate()} loading={connectMutation.isPending}>
                {connection.status === "CONNECTED" ? <RefreshCw size={17} /> : <Plug size={17} />}
                {connection.status === "CONNECTED" ? "Đổi Gmail" : "Kết nối Gmail"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setTestOpen(true)}
                disabled={connection.status !== "CONNECTED"}
              >
                <Send size={17} />
                Gửi thử
              </Button>
              <Button
                variant="danger"
                onClick={() => setDisconnectOpen(true)}
                disabled={connection.status === "NOT_CONNECTED" || connection.status === "DISCONNECTED"}
              >
                <Unplug size={17} />
                Ngắt kết nối
              </Button>
            </div>
          </section>

          <section className="panel tenant-email-runbook">
            <h2>Ghi chú vận hành</h2>
            <ul>
              <li>
                <ShieldCheck size={18} />
                <span>Chỉ xin quyền gửi email, không đọc hộp thư.</span>
              </li>
              <li>
                <Mail size={18} />
                <span>Một tài khoản Gmail có thể được dùng cho nhiều trung tâm.</span>
              </li>
              <li>
                <Unplug size={18} />
                <span>Ngắt kết nối chỉ gỡ Gmail khỏi trung tâm hiện tại.</span>
              </li>
              <li>
                <Clock3 size={18} />
                <span>Email chưa gửi được sẽ được thử lại trong tối đa 72 giờ; thông báo trong ứng dụng vẫn xuất hiện ngay.</span>
              </li>
            </ul>
          </section>
        </div>
      )}

      <Modal
        open={testOpen}
        title="Gửi email thử"
        onClose={() => setTestOpen(false)}
        confirmLabel="Gửi thử"
        confirmDisabled={!recipientEmail.includes("@")}
        confirmLoading={testMutation.isPending}
        onConfirm={() => testMutation.mutate()}
      >
        <div className="modal-form">
          <Input
            label="Email nhận thử"
            type="email"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            hint="Nên dùng email của bạn hoặc một hộp thư nội bộ để kiểm tra."
          />
        </div>
      </Modal>

      <Modal
        open={disconnectOpen}
        title="Ngắt Gmail thông báo"
        onClose={() => setDisconnectOpen(false)}
        confirmLabel="Ngắt kết nối"
        confirmLoading={disconnectMutation.isPending}
        onConfirm={() => disconnectMutation.mutate()}
      >
        <p>
          Thao tác này chỉ ngắt Gmail khỏi trung tâm hiện tại. Các trung tâm khác đang dùng cùng tài khoản Gmail
          sẽ không bị ảnh hưởng.
        </p>
      </Modal>
    </section>
  );
};

const StatusPill = ({ connection }: { connection: TenantEmailConnection }) => (
  <span className={`tenant-email-pill ${connection.status.toLowerCase()}`}>
    {connection.status === "CONNECTED" ? <CheckCircle2 size={16} /> : <Mail size={16} />}
    {statusMeta(connection).label}
  </span>
);

const statusMeta = (connection?: TenantEmailConnection) => {
  if (!connection) {
    return {
      label: "Đang tải",
      eyebrow: "ĐANG TẢI",
      title: "Đang kiểm tra",
      description: "",
      className: "neutral",
      icon: <Mail size={22} />,
    };
  }
  if (connection.status === "CONNECTED") {
    return {
      label: "Đã kết nối",
      eyebrow: "SẴN SÀNG",
      title: "Email của trung tâm đã sẵn sàng",
      description: "Các email thông báo mới và email đang chờ sẽ được gửi qua Gmail này.",
      className: "ready",
      icon: <CheckCircle2 size={22} />,
    };
  }
  if (connection.status === "REAUTH_REQUIRED") {
    return {
      label: "Cần xác thực lại",
      eyebrow: "CẦN XỬ LÝ",
      title: "Google cần cấp quyền lại",
      description: "Email chưa gửi được sẽ tiếp tục chờ trong tối đa 72 giờ.",
      className: "warning",
      icon: <AlertTriangle size={22} />,
    };
  }
  return {
    label: "Chưa kết nối",
    eyebrow: "CHƯA KẾT NỐI",
    title: "Trung tâm chưa kết nối Gmail",
    description: "Kết nối một tài khoản Gmail để gửi thông báo qua email cho trung tâm.",
    className: "neutral",
    icon: <Mail size={22} />,
  };
};
