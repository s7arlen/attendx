import nodemailer from 'nodemailer';

// Create transporter — configure via .env
// Supports Gmail (SMTP), SendGrid, Mailtrap, or any SMTP provider
const createTransporter = () => {
  const host    = process.env.SMTP_HOST;
  const port    = parseInt(process.env.SMTP_PORT || '587');
  const user    = process.env.SMTP_USER;
  const pass    = process.env.SMTP_PASS;
  const from    = process.env.SMTP_FROM || 'AttendX <noreply@attendx.com>';

  if (!host || !user || !pass) return null;

  return { transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }), from };
};

export const sendPasswordResetEmail = async (
  toEmail: string,
  userName: string,
  resetCode: string
): Promise<boolean> => {
  const smtp = createTransporter();

  // Dev fallback — log to console if SMTP not configured
  if (!smtp) {
    console.log(`\n📧 [DEV — no SMTP configured]`);
    console.log(`   To: ${toEmail}`);
    console.log(`   Reset code: ${resetCode}\n`);
    return false; // indicates email was NOT sent
  }

  await smtp.transporter.sendMail({
    from: smtp.from,
    to:   toEmail,
    subject: 'AttendX — Password Reset Code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#4F46E5;margin-bottom:8px">AttendX</h2>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>You requested a password reset. Use the code below — it expires in <strong>15 minutes</strong>.</p>
        <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <p style="margin:0;font-size:13px;color:#6b7280;letter-spacing:1px;text-transform:uppercase">Reset Code</p>
          <p style="margin:8px 0 0;font-size:40px;font-weight:bold;letter-spacing:12px;color:#1f2937;font-family:monospace">${resetCode}</p>
        </div>
        <p style="color:#6b7280;font-size:13px">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
        <p style="color:#6b7280;font-size:12px;margin-top:32px">— The AttendX Team</p>
      </div>
    `,
  });

  return true; // email was sent
};
