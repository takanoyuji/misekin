import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "みせ勤 <noreply@misekin.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * メール認証メールを送信する
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const url = `${APP_URL}/verify-email?token=${token}&email=${encodeURIComponent(to)}`;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "【みせ勤】メールアドレスの確認",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">みせ勤</h1>
          <p>${name} さん、ご登録ありがとうございます。</p>
          <p>以下のリンクをクリックしてメールアドレスを確認してください。</p>
          <p>（リンクの有効期限は24時間です）</p>
          <a href="${url}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
            メールアドレスを確認する
          </a>
          <p>リンクが機能しない場合は、以下のURLをブラウザに貼り付けてください：</p>
          <p style="word-break: break-all; color: #4f46e5;">${url}</p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #71717a; font-size: 12px;">このメールに心当たりがない場合は、無視してください。</p>
        </div>
      `,
    });
  } catch (error) {
    // メール送信失敗はログに記録するが、ユーザーにはエラーを返さない
    console.error("Failed to send verification email:", error);
  }
}

/**
 * パスワードリセットメールを送信する
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const url = `${APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "【みせ勤】パスワードの再設定",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">みせ勤</h1>
          <p>${name} さん</p>
          <p>パスワードの再設定リクエストを受け付けました。</p>
          <p>以下のリンクをクリックして新しいパスワードを設定してください。</p>
          <p>（リンクの有効期限は1時間です）</p>
          <a href="${url}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
            パスワードを再設定する
          </a>
          <p>リンクが機能しない場合は、以下のURLをブラウザに貼り付けてください：</p>
          <p style="word-break: break-all; color: #4f46e5;">${url}</p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #71717a; font-size: 12px;">このメールに心当たりがない場合は、無視してください。アカウントへの不正アクセスが疑われる場合はお問い合わせください。</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }
}

/**
 * スタッフ招待メールを送信する
 */
export async function sendStaffInvitationEmail(params: {
  to: string;
  staffName: string;
  organizationName: string;
  storeName: string;
  inviterName: string;
  invitationUrl: string;
}): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `【みせ勤】${params.organizationName}からスタッフとして招待されました`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">みせ勤</h1>
          <p>${params.staffName} さん</p>
          <p><strong>${params.organizationName}</strong>（${params.storeName}）から、スタッフとして招待されました。</p>
          <p>招待者: ${params.inviterName}</p>
          <p>以下のリンクからアカウントを有効化してください。</p>
          <a href="${params.invitationUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
            アカウントを有効化する
          </a>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #71717a; font-size: 12px;">このメールに心当たりがない場合は、無視してください。</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send staff invitation email:", error);
  }
}

/**
 * 管理者招待メールを送信する
 */
export async function sendAdminInvitationEmail(params: {
  to: string;
  inviteeName: string;
  organizationName: string;
  inviterName: string;
  invitationUrl: string;
}): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `【みせ勤】${params.organizationName}の管理者として招待されました`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">みせ勤</h1>
          <p>${params.inviteeName} さん</p>
          <p><strong>${params.organizationName}</strong>の管理者として招待されました。</p>
          <p>招待者: ${params.inviterName}</p>
          <a href="${params.invitationUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
            招待を承諾する
          </a>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="color: #71717a; font-size: 12px;">このメールに心当たりがない場合は、無視してください。</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send admin invitation email:", error);
  }
}

/**
 * 修正申請通知メールを送信する
 */
export async function sendCorrectionRequestNotification(params: {
  to: string;
  adminName: string;
  staffName: string;
  storeName: string;
  businessDate: string;
  requestUrl: string;
}): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `【みせ勤】勤怠修正申請が提出されました`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">みせ勤</h1>
          <p>${params.adminName} さん</p>
          <p><strong>${params.staffName}</strong>（${params.storeName}）から、${params.businessDate}の勤怠について修正申請が提出されました。</p>
          <a href="${params.requestUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
            申請を確認する
          </a>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send correction request notification:", error);
  }
}
