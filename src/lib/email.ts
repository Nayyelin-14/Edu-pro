import nodemailer from "nodemailer";
import { Resend } from "resend";

type Sender = (options: {
  to: string;
  subject: string;
  html: string;
}) => Promise<void>;

function getSmtp(): Sender | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = (process.env.SMTP_SECURE || "true") === "true";
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  const from = process.env.SMTP_FROM || `"E-Learning" <${user}>`;
  return async (options) => {
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  };
}

function getResend(): Sender | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const resend = new Resend(key);
  const from = process.env.EMAIL_FROM || "E-Learning <onboarding@resend.dev>";
  return async (options) => {
    const { error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    if (error) throw new Error(`Failed to send email: ${error.message}`);
  };
}

async function send(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const sender = getSmtp() ?? getResend();
  if (!sender) {
    console.log(`[mail:dev] to=${options.to} subject="${options.subject}"`);
    return;
  }
  await sender(options);
}

function baseUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

function wrapHtml(title: string, body: string): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#6b7280">EduPro E-Learning Platform</p>
  </div>`;
}

export async function sendVerificationEmail(
  to: string,
  code: string,
): Promise<void> {
  const verifyUrl = `${baseUrl()}/verify-email?code=${code}`;
  await send({
    to,
    subject: "Verify your email",
    html: wrapHtml(
      "Verify your email",
      `<p>Click the link below to verify your email address:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">Verify Email</a></p>
      <p style="margin-top:16px;font-size:14px;color:#6b7280">Or enter this code manually: <strong style="letter-spacing:4px">${code}</strong></p>
      <p style="font-size:14px;color:#6b7280">The link expires in 10 minutes. If you did not register, you can ignore this email.</p>`,
    ),
  });
}

export async function sendLoginOtpEmail(
  to: string,
  code: string,
): Promise<void> {
  await send({
    to,
    subject: "Your login code",
    html: wrapHtml(
      "Sign-in code",
      `<p>Use this code to complete your sign-in:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in 10 minutes.</p>`,
    ),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  await send({
    to,
    subject: "Reset your password",
    html: wrapHtml(
      "Reset your password",
      `<p>Click the link below to choose a new password. The link expires in 1 hour.</p><p><a href="${resetUrl}" style="display:inline-block;background:#166534;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset password</a></p><p>If the button does not work, copy this link: ${resetUrl}</p>`,
    ),
  });
}

export async function sendCourseApprovedEmail(
  to: string,
  courseTitle: string,
  courseUrl: string,
): Promise<void> {
  await send({
    to,
    subject: `Your course "${courseTitle}" is now live`,
    html: wrapHtml(
      "Course approved",
      `<p>Great news — your course <strong>${courseTitle}</strong> has been approved and is now published.</p><p><a href="${courseUrl}" style="display:inline-block;background:#166534;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">View course</a></p>`,
    ),
  });
}

export async function sendCourseRejectedEmail(
  to: string,
  courseTitle: string,
  courseUrl: string,
): Promise<void> {
  await send({
    to,
    subject: `Your course "${courseTitle}" was not approved`,
    html: wrapHtml(
      "Course rejected",
      `<p>Your course <strong>${courseTitle}</strong> was not approved. You can review it, address the feedback, and resubmit it for review.</p><p><a href="${courseUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Review course</a></p>`,
    ),
  });
}

export async function sendCertificateEmail(
  to: string,
  courseTitle: string,
  certificateNumber: string,
  verifyUrl: string,
): Promise<void> {
  await send({
    to,
    subject: `Your certificate for "${courseTitle}" is ready`,
    html: wrapHtml(
      "Certificate issued",
      `<p>Congratulations! You earned a certificate for completing <strong>${courseTitle}</strong>.</p><p><strong>Certificate No.</strong> ${certificateNumber}</p><p><a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Verify certificate</a></p>`,
    ),
  });
}

export async function sendPurchaseReceiptEmail(
  to: string,
  courseTitle: string,
  amountBaht: number,
  courseUrl: string,
): Promise<void> {
  await send({
    to,
    subject: `Your purchase of "${courseTitle}" is complete`,
    html: wrapHtml(
      "Payment confirmed",
      `<p>Thank you for your purchase. You now have access to <strong>${courseTitle}</strong>.</p><p><strong>Amount paid:</strong> ฿${amountBaht.toLocaleString("en-US")}</p><p><a href="${courseUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Start learning</a></p>`,
    ),
  });
}

export function appUrl(): string {
  return baseUrl();
}
