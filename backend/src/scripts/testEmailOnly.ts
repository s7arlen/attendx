import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const { sendAttendanceWarningEmail } = await import('../utils/mailer');

  console.log('Sending test attendance warning email...');
  console.log('SMTP Host:', process.env.SMTP_HOST);
  console.log('SMTP User:', process.env.SMTP_USER);

  const result = await sendAttendanceWarningEmail(
    'lenstar.monteiro@attendx.com',
    'Lenstar Monteiro',
    [
      { subjectName: 'Object Oriented Programming with Java (OOPS)', subjectCode: '1BCSIP302', present: 1, total: 4, percentage: 25 },
      { subjectName: 'Operating Systems (OS)', subjectCode: '1BCSPC304', present: 2, total: 5, percentage: 40 },
    ]
  );

  if (result) {
    console.log('\n✅ Email sent successfully!');
  } else {
    console.log('\n📧 Dev mode — email logged to console (no SMTP configured)');
  }
}

test().catch(console.error);
