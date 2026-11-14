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
        <h2 style="color:#2563EB;margin-bottom:8px">AttendX</h2>
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

export const sendVisitorRequestEmail = async (
  toEmail: string,
  visitorName: string,
  hostName: string,
  department: string,
  visitDate: string,
  purpose: string,
): Promise<boolean> => {
  const smtp = createTransporter();
  if (!smtp) {
    console.log(`[DEV] Visitor request submitted by ${visitorName} to visit ${hostName}`);
    return false;
  }
  await smtp.transporter.sendMail({
    from: smtp.from,
    to: toEmail,
    subject: 'AttendX — Visit Request Submitted',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
        <h2 style="color:#2563EB;margin-bottom:4px">AttendX Campus Pass</h2>
        <p style="color:#6b7280;font-size:13px;margin-bottom:24px">Visit Request Received</p>
        <p>Hi <strong>${visitorName}</strong>,</p>
        <p>Your visit request has been submitted and is <strong>pending approval</strong> from <strong>${hostName}</strong>.</p>
        <div style="background:#f8f7ff;border:1px solid #e0d9ff;border-radius:12px;padding:20px;margin:20px 0">
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="padding:4px 0;color:#6b7280;width:120px">Host</td><td style="color:#1f2937;font-weight:600">${hostName}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Department</td><td style="color:#1f2937;font-weight:600">${department}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Visit Date</td><td style="color:#1f2937;font-weight:600">${visitDate}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">Purpose</td><td style="color:#1f2937;font-weight:600">${purpose}</td></tr>
          </table>
        </div>
        <p style="color:#6b7280;font-size:13px">You will receive another email with your QR pass once the host approves your request.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:32px">— The AttendX Team</p>
      </div>
    `,
  });
  return true;
};

export const sendVisitorApprovedEmail = async (
  toEmail: string,
  visitorName: string,
  hostName: string,
  visitDate: string,
  passCode: string,
  qrCodeData: string,
): Promise<boolean> => {
  const smtp = createTransporter();
  if (!smtp) {
    console.log(`[DEV] Visit approved for ${visitorName} — pass code: ${passCode}`);
    return false;
  }

  // Convert base64 data URL to Buffer for CID inline email attachment (required by Gmail/Outlook)
  const base64Data = qrCodeData.replace(/^data:image\/png;base64,/, '');
  const qrBuffer = Buffer.from(base64Data, 'base64');

  await smtp.transporter.sendMail({
    from: smtp.from,
    to: toEmail,
    subject: 'AttendX — Your Visit is Approved! Here is your QR Pass',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
        <h2 style="color:#4f46e5;margin-bottom:4px;font-size:22px">AttendX Campus Pass</h2>
        <p style="color:#64748b;font-size:13px;margin-bottom:20px">Visit Approved</p>
        <p style="color:#1e293b;font-size:15px">Hi <strong>${visitorName}</strong>,</p>
        <p style="color:#334155;font-size:14px;line-height:1.5">Your visit request has been <strong style="color:#16a34a">approved</strong> by <strong>${hostName}</strong>.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
          <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600">Your Pass Code</p>
          <p style="margin:0;font-size:30px;font-weight:800;letter-spacing:5px;color:#0f172a;font-family:monospace">${passCode}</p>
          <p style="margin:8px 0 0;font-size:13px;color:#475569">Valid for: <strong>${visitDate}</strong></p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <img src="cid:visitor-qr-code" alt="Visitor QR Pass" style="width:200px;height:200px;border-radius:12px;border:1px solid #e2e8f0;display:inline-block" />
          <p style="font-size:12px;color:#64748b;margin-top:10px">Show this QR code or your pass code at the security gate for entry</p>
        </div>
        <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0" />
        <p style="color:#94a3b8;font-size:12px;margin:0">— The AttendX Team · Smart Campus Platform</p>
      </div>
    `,
    attachments: [
      {
        filename: 'visitor-qr.png',
        content: qrBuffer,
        cid: 'visitor-qr-code',
      },
    ],
  });
  return true;
};

export const sendVisitorRejectedEmail = async (
  toEmail: string,
  visitorName: string,
  hostName: string,
  reason?: string,
): Promise<boolean> => {
  const smtp = createTransporter();
  if (!smtp) {
    console.log(`[DEV] Visit rejected for ${visitorName}`);
    return false;
  }
  await smtp.transporter.sendMail({
    from: smtp.from,
    to: toEmail,
    subject: 'AttendX — Visit Request Update',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
        <h2 style="color:#2563EB;margin-bottom:4px">AttendX Campus Pass</h2>
        <p>Hi <strong>${visitorName}</strong>,</p>
        <p>Unfortunately, your visit request to meet <strong>${hostName}</strong> could not be approved at this time.</p>
        ${reason ? `<p style="color:#6b7280;font-size:13px">Reason: ${reason}</p>` : ''}
        <p style="color:#6b7280;font-size:13px">If you believe this is an error, please contact the department directly.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:32px">— The AttendX Team</p>
      </div>
    `,
  });
  return true;
};
