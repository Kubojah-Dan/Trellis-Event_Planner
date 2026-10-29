import { env } from '../../config/env';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export class EmailService {
  private apiKey: string | null;
  private fromAddress: string;
  private appBaseUrl: string;

  constructor(apiKey?: string, fromAddress?: string, appBaseUrl?: string) {
    this.apiKey = apiKey ?? env.RESEND_API_KEY ?? null;
    this.fromAddress = fromAddress ?? env.NOTIFICATION_EMAIL_FROM;
    this.appBaseUrl = appBaseUrl ?? env.APP_BASE_URL;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim() !== '');
  }

  private wrapTemplate(title: string, subtitle: string, bodyContent: string, ctaText?: string, ctaUrl?: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FAF7F2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1F2923;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #FAF7F2;
      padding: 40px 16px;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border: 1px solid #E6E1D8;
      border-radius: 24px;
      padding: 40px 32px;
      box-shadow: 0 4px 20px rgba(31, 41, 35, 0.05);
    }
    .header {
      text-align: center;
      padding-bottom: 24px;
      border-bottom: 1px solid #F0ECE4;
    }
    .brand {
      font-family: Georgia, serif;
      font-size: 26px;
      font-weight: 600;
      color: #2D3B2D;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .tagline {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #C86D51;
      font-weight: 700;
      margin-top: 4px;
    }
    .content {
      padding: 32px 0;
    }
    h1 {
      font-family: Georgia, serif;
      font-size: 24px;
      font-weight: 500;
      color: #1F2923;
      margin: 0 0 12px 0;
      line-height: 1.3;
    }
    .subtitle {
      font-size: 15px;
      color: #5A695E;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }
    .info-box {
      background-color: #F8F5EF;
      border-left: 3px solid #2D3B2D;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 20px 0;
      font-size: 14px;
      line-height: 1.6;
      color: #2D3B2D;
    }
    .btn {
      display: inline-block;
      background-color: #2D3B2D;
      color: #FAF7F2 !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 14px 28px;
      border-radius: 30px;
      margin-top: 24px;
      text-align: center;
    }
    .footer {
      text-align: center;
      padding-top: 24px;
      border-top: 1px solid #F0ECE4;
      font-size: 12px;
      color: #8C9990;
      line-height: 1.6;
    }
    .footer a {
      color: #C86D51;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <p class="brand">TRELLIS</p>
        <p class="tagline">Intelligent Celebration Studio</p>
      </div>
      <div class="content">
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>
        ${bodyContent}
        ${ctaText && ctaUrl ? `<div style="text-align: center; margin-top: 28px;"><a href="${ctaUrl}" class="btn">${ctaText} &rarr;</a></div>` : ''}
      </div>
      <div class="footer">
        <p>Sent with care by your Trellis celebration companion.<br />
        You can customize or disable your email alerts at any time in your <a href="${this.appBaseUrl}">Trellis settings</a>.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<EmailSendResult> {
    if (!this.apiKey) {
      console.log(
        JSON.stringify({
          level: 'info',
          simulated: true,
          action: 'EMAIL_SEND_SIMULATED',
          to,
          subject,
          note: 'Set RESEND_API_KEY in your environment to send live emails.',
          timestamp: new Date().toISOString(),
        })
      );
      return { success: true, simulated: true };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        if (res.status === 403 && errBody.includes('testing emails')) {
          console.warn(
            `Resend sandbox notice: Recipient '${to}' is unverified. On the free tier without a custom domain, Resend only delivers to your registered account email. Note: ${errBody}`
          );
        } else {
          console.error('Resend API error:', res.status, errBody);
        }
        return { success: false, error: `Resend HTTP ${res.status}: ${errBody}` };
      }

      const data: any = await res.json();
      return { success: true, messageId: data.id };
    } catch (err: any) {
      console.error('Failed to send email via Resend:', err.message || err);
      return { success: false, error: err.message || 'Unknown network error' };
    }
  }

  async sendTestEmail(toEmail: string): Promise<EmailSendResult> {
    const title = "You're all set for celebration alerts";
    const subtitle = 'Your Trellis notification connection is active and ready to deliver calm, timely updates.';
    const body = `
      <div class="info-box">
        <strong>✨ Verified delivery channels:</strong><br />
        &bull; Event Day Arrival & Morning Briefings<br />
        &bull; Milestone & To-Do Completions<br />
        &bull; Operational Plan Creations & AI Revisions
      </div>
      <p style="font-size: 14px; color: #5A695E; line-height: 1.6;">
        Whenever your celebration approaches key milestones, Trellis will keep you centered and organized without the spam.
      </p>
    `;
    const html = this.wrapTemplate(title, subtitle, body, 'Open Trellis Studio', this.appBaseUrl);
    return this.sendEmail(toEmail, `🌿 Trellis Notification Test: You're all set!`, html);
  }

  async sendPlanCreatedEmail(
    toEmail: string,
    eventTitle: string,
    eventId: string,
    conceptTitle: string,
    budgetFormatted: string,
    eventDate?: string
  ): Promise<EmailSendResult> {
    const title = `Your celebration plan is crafted: ${eventTitle}`;
    const subtitle = `Trellis has calibrated a complete operational workspace linked to your selected concept "${conceptTitle}".`;
    const body = `
      <div class="info-box">
        <strong>Celebration Summary:</strong><br />
        &bull; <strong>Concept:</strong> ${conceptTitle}<br />
        &bull; <strong>Budget Target:</strong> ${budgetFormatted}<br />
        ${eventDate ? `&bull; <strong>Celebration Date:</strong> ${eventDate}<br />` : ''}
        &bull; <strong>Status:</strong> Tasks, budget lines, and vendors structured
      </div>
      <p style="font-size: 14px; color: #5A695E; line-height: 1.6;">
        Your interactive operational plan is waiting. You can adjust task priorities, lock committed decisions, or propose scoped changes with Trellis anytime.
      </p>
    `;
    const ctaUrl = `${this.appBaseUrl}/events/${eventId}`;
    const html = this.wrapTemplate(title, subtitle, body, 'View Celebration Workspace', ctaUrl);
    return this.sendEmail(toEmail, `✨ Your celebration plan is ready: ${eventTitle}`, html);
  }

  async sendTaskCompletedEmail(
    toEmail: string,
    eventTitle: string,
    eventId: string,
    taskTitle: string,
    completedCount: number,
    totalCount: number
  ): Promise<EmailSendResult> {
    const title = `Task completed: "${taskTitle}"`;
    const subtitle = `Great progress on ${eventTitle}! You have completed ${completedCount} of ${totalCount} celebration tasks.`;
    const percent = Math.round((completedCount / Math.max(totalCount, 1)) * 100);
    const body = `
      <div class="info-box">
        <strong>Progress Milestone: ${percent}% complete</strong><br />
        &bull; <strong>Finished task:</strong> ${taskTitle}<br />
        &bull; <strong>Remaining:</strong> ${Math.max(0, totalCount - completedCount)} items to bring your celebration to life
      </div>
      <p style="font-size: 14px; color: #5A695E; line-height: 1.6;">
        Every task checked off moves your gathering closer to a seamless, memorable experience.
      </p>
    `;
    const ctaUrl = `${this.appBaseUrl}/events/${eventId}/tasks`;
    const html = this.wrapTemplate(title, subtitle, body, 'Check Task Checklist', ctaUrl);
    return this.sendEmail(toEmail, `✅ Task completed: "${taskTitle}" (${completedCount}/${totalCount})`, html);
  }

  async sendEventDayAlertEmail(
    toEmail: string,
    eventTitle: string,
    eventId: string,
    location?: string
  ): Promise<EmailSendResult> {
    const title = `Today is the day! ${eventTitle}`;
    const subtitle = `The day of your celebration has arrived. Everything you planned has prepared you for this moment.`;
    const body = `
      <div class="info-box">
        <strong>Day-of Host Checklist:</strong><br />
        ${location ? `&bull; <strong>Location:</strong> ${location}<br />` : ''}
        &bull; Take a deep breath: all major vendor coordinates and timeline cues are saved in your workspace.<br />
        &bull; Focus on being present and enjoying the company of your guests.
      </div>
      <p style="font-size: 14px; color: #5A695E; line-height: 1.6;">
        Have a wonderful, heartfelt celebration!
      </p>
    `;
    const ctaUrl = `${this.appBaseUrl}/events/${eventId}/timeline`;
    const html = this.wrapTemplate(title, subtitle, body, 'Open Day-of Timeline', ctaUrl);
    return this.sendEmail(toEmail, `🎉 Today is the day! ${eventTitle}`, html);
  }

  async sendCountdownReminderEmail(
    toEmail: string,
    eventTitle: string,
    eventId: string,
    daysRemaining: number
  ): Promise<EmailSendResult> {
    const title = `${daysRemaining} days until ${eventTitle}`;
    const subtitle = `A calm checkpoint as your celebration date draws near.`;
    const body = `
      <div class="info-box">
        <strong>Countdown Notice:</strong><br />
        &bull; <strong>Days left:</strong> ${daysRemaining} days<br />
        &bull; <strong>Recommendation:</strong> Review any pending vendor confirmations and final headcount.
      </div>
    `;
    const ctaUrl = `${this.appBaseUrl}/events/${eventId}`;
    const html = this.wrapTemplate(title, subtitle, body, 'Review Celebration Plan', ctaUrl);
    return this.sendEmail(toEmail, `⏳ ${daysRemaining} days until ${eventTitle}`, html);
  }
}
