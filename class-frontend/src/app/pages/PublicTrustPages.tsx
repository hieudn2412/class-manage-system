import { Link } from "react-router-dom";
import type { ReactNode } from "react";

const updatedAt = "12 August 2026";

const PublicShell = ({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <main className="public-trust-page">
    <nav className="public-trust-nav" aria-label="Public navigation">
      <Link className="public-trust-brand" to="/about">
        <span className="public-trust-logo">▦</span>
        <span>
          <strong>EDU OPS</strong>
          <small>Education operations platform</small>
        </span>
      </Link>
      <div>
        <Link to="/about">Home</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </div>
    </nav>

    <section className="public-trust-hero">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>

    <article className="public-trust-card">{children}</article>
  </main>
);

export const PublicAboutPage = () => (
  <PublicShell
    eyebrow="EDU OPS / SaaS for learning centers"
    title="A private operations workspace for education centers"
    description="EDU OPS helps learning centers manage classes, schedules, homework, documents, notifications and internal operations in one tenant-isolated system."
  >
    <section>
      <h2>What EDU OPS does</h2>
      <p>
        EDU OPS is a SaaS management system for education centers. Each center works inside its own tenant
        workspace to manage classes, students, teachers, homework, learning materials, salary operations and
        notifications.
      </p>
    </section>
    <section>
      <h2>Google Gmail connection</h2>
      <p>
        Tenant administrators may connect a Gmail account so EDU OPS can send notification emails for their
        own center. The app requests only the permissions needed to identify the selected Google account and
        send emails. EDU OPS does not read, search, modify or delete Gmail mailbox content.
      </p>
    </section>
    <section>
      <h2>Contact</h2>
      <p>
        For questions about consent, data processing or account access, contact{" "}
        <a href="mailto:hieudnhe186375@fpt.edu.vn">hieudnhe186375@fpt.edu.vn</a>.
      </p>
    </section>
  </PublicShell>
);

export const PrivacyPolicyPage = () => (
  <PublicShell
    eyebrow="Privacy Policy"
    title="EDU OPS Privacy Policy"
    description="This page explains what data EDU OPS processes and how Google OAuth data is used for tenant email notifications."
  >
    <p className="public-trust-updated">Last updated: {updatedAt}</p>

    <section>
      <h2>1. Information we process</h2>
      <p>
        EDU OPS processes account, tenant, class, student, teacher, schedule, homework, material, notification
        and operational data provided by users of each learning center. The system is designed as a multi-tenant
        SaaS application, so each tenant's data is logically separated.
      </p>
    </section>

    <section>
      <h2>2. Google OAuth data</h2>
      <p>
        When a tenant administrator connects Gmail, EDU OPS requests the following Google OAuth scopes:
      </p>
      <ul>
        <li><code>openid</code> — to identify the Google account subject.</li>
        <li><code>email</code> — to display and verify the connected Gmail address.</li>
        <li><code>https://www.googleapis.com/auth/gmail.send</code> — to send notification emails on behalf of the connected Gmail account.</li>
      </ul>
      <p>
        EDU OPS uses Gmail access only to send tenant notification emails such as homework assignments,
        document updates, review results and operational messages. EDU OPS does not request permission to read,
        search, download, modify or delete Gmail messages.
      </p>
    </section>

    <section>
      <h2>3. Token storage and security</h2>
      <p>
        EDU OPS stores only the Google refresh token required for background email delivery. The refresh token
        is encrypted before storage. Access tokens are used in memory and are not intentionally stored. Tokens
        are not exposed in API responses, audit timelines, logs or user interface screens.
      </p>
    </section>

    <section>
      <h2>4. How data is used</h2>
      <p>
        Data is used to provide the EDU OPS service: authentication, authorization, tenant operations, class
        management, homework, materials, notifications, file handling, reporting and audit trails. Google OAuth
        data is used only for the Gmail notification sender chosen by the tenant administrator.
      </p>
    </section>

    <section>
      <h2>5. Sharing and disclosure</h2>
      <p>
        EDU OPS does not sell Google user data. Tenant data is not shared with other tenants. Data may be
        processed by infrastructure providers solely to operate, secure and maintain the service, or disclosed
        when required by law.
      </p>
    </section>

    <section>
      <h2>6. Data retention and revocation</h2>
      <p>
        Tenant administrators can disconnect Gmail inside EDU OPS. Disconnecting removes the locally stored
        encrypted token for that tenant. The Gmail account owner can also revoke access from Google Account
        permissions at any time.
      </p>
    </section>

    <section>
      <h2>7. Contact</h2>
      <p>
        For privacy questions, contact{" "}
        <a href="mailto:hieudnhe186375@fpt.edu.vn">hieudnhe186375@fpt.edu.vn</a>.
      </p>
    </section>
  </PublicShell>
);

export const TermsOfServicePage = () => (
  <PublicShell
    eyebrow="Terms of Service"
    title="EDU OPS Terms of Service"
    description="These terms describe acceptable use of EDU OPS and the tenant Gmail notification connection."
  >
    <p className="public-trust-updated">Last updated: {updatedAt}</p>

    <section>
      <h2>1. Service overview</h2>
      <p>
        EDU OPS provides software for learning centers to manage classes, schedules, users, homework,
        documents, notifications, reporting and internal operations. Access to the service is provided to
        authorized users of each tenant.
      </p>
    </section>

    <section>
      <h2>2. Tenant administrator responsibilities</h2>
      <p>
        Tenant administrators are responsible for managing their users, permissions, connected Gmail account,
        center data and lawful use of the service. Administrators should connect only Gmail accounts they are
        authorized to use for center notifications.
      </p>
    </section>

    <section>
      <h2>3. Gmail notification sender</h2>
      <p>
        When a tenant connects Gmail, EDU OPS may send notification emails using that Gmail account. The
        connected Gmail account may be disconnected from the tenant at any time. Disconnecting in EDU OPS does
        not revoke access for other tenants that may use the same Gmail account; the Gmail owner can revoke all
        app access from Google Account permissions.
      </p>
    </section>

    <section>
      <h2>4. Acceptable use</h2>
      <p>
        Users must not use EDU OPS to send unlawful, misleading, abusive, spam or unauthorized email. Users must
        not attempt to bypass tenant isolation, access data from another tenant, interfere with service security,
        or upload malicious files.
      </p>
    </section>

    <section>
      <h2>5. Availability and changes</h2>
      <p>
        EDU OPS may change, improve or temporarily suspend features for maintenance, security, reliability or
        legal reasons. The service is provided as a management tool and does not replace a tenant's own legal,
        accounting or compliance obligations.
      </p>
    </section>

    <section>
      <h2>6. Contact</h2>
      <p>
        For questions about these terms, contact{" "}
        <a href="mailto:hieudnhe186375@fpt.edu.vn">hieudnhe186375@fpt.edu.vn</a>.
      </p>
    </section>
  </PublicShell>
);
