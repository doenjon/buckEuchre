/**
 * @module services/bugs
 * @description Bug report service for handling bug submissions
 */

import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

interface BugReportData {
  description: string;
  logs: string;
  userAgent: string;
  url: string;
  timestamp: string;
  userId?: string;
  username?: string;
  email?: string;
}

/**
 * Save bug report to file
 */
function saveBugReportToFile(data: BugReportData): void {
  try {
    const bugReportsDir = path.join(process.cwd(), 'bug-reports');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(bugReportsDir)) {
      fs.mkdirSync(bugReportsDir, { recursive: true });
    }

    // Create filename with timestamp
    const date = new Date(data.timestamp);
    const filename = `bug-report-${date.toISOString().replace(/[:.]/g, '-')}.txt`;
    const filepath = path.join(bugReportsDir, filename);

    // Format the report content
    const reportContent = `
===== BUG REPORT =====

Timestamp: ${data.timestamp}

User Information:
- User ID: ${data.userId || 'Anonymous'}
- Username: ${data.username || 'N/A'}
- Email: ${data.email || 'N/A'}

Browser Information:
- User Agent: ${data.userAgent}
- URL: ${data.url}

Bug Description:
${data.description}

===== CONSOLE LOGS =====

${data.logs || 'No logs available'}

===== END OF REPORT =====
`;

    // Write to file
    fs.writeFileSync(filepath, reportContent, 'utf-8');
    console.log(`[BUG REPORT] Saved to file: ${filepath}`);
  } catch (error) {
    console.error('[BUG REPORT] Failed to save to file:', error);
    // Don't throw - email is still sent
  }
}

/**
 * Send a bug report email
 */
export async function submitBugReport(data: BugReportData): Promise<void> {
  const { description, logs, userAgent, url, timestamp, userId, username, email } = data;

  // Save to file first
  saveBugReportToFile(data);

  // Format the email content
  const emailBody = `
===== BUG REPORT =====

Timestamp: ${timestamp}

User Information:
- User ID: ${userId || 'Anonymous'}
- Username: ${username || 'N/A'}
- Email: ${email || 'N/A'}

Browser Information:
- User Agent: ${userAgent}
- URL: ${url}

Bug Description:
${description}

===== CONSOLE LOGS =====

${logs || 'No logs available'}

===== END OF REPORT =====
`;

  // Create a test account if no SMTP credentials are configured
  // In production, you should configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  let transporter: nodemailer.Transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Production SMTP configuration
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // For development/testing: use ethereal email (test email service)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[BUG REPORT] Using test email account (Ethereal)');
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Buck Euchre Bug Reports" <bugs@buckeuchre.com>',
      to: 'doenierjon@gmail.com',
      subject: `Bug Report - ${new Date(timestamp).toLocaleString()}`,
      text: emailBody,
    });

    console.log('[BUG REPORT] Email sent successfully:', info.messageId);

    // If using ethereal, log the preview URL
    if (!process.env.SMTP_HOST) {
      console.log('[BUG REPORT] Preview URL:', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('[BUG REPORT] Failed to send email:', error);
    throw new Error('Failed to send bug report email');
  }
}
