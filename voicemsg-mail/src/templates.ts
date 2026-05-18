/**
 * Premium Responsive HTML Email Templates for Voice Messenger
 * Styled with a gorgeous dark violet aesthetic representing modern AI & agentic platforms.
 */

interface EmailTemplateData {
  name?: string;
  link?: string;
  code?: string;
  message?: string;
  title?: string;
  buttonText?: string;
  buttonUrl?: string;
  [key: string]: any;
}

// Universal Header
const getHeader = (): string => `
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 32px; text-align: center;">
    <tr>
      <td align="center">
        <!-- Logo / Icon -->
        <table cellpadding="0" cellspacing="0" border="0" style="display: inline-block;">
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); width: 48px; height: 48px; border-radius: 12px; text-align: center; vertical-align: middle; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);">
              <span style="font-size: 24px; line-height: 48px; color: #ffffff;">🎙️</span>
            </td>
          </tr>
        </table>
        <h1 style="color: #ffffff; font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 700; margin: 12px 0 0 0; letter-spacing: -0.5px;">Voice Messenger</h1>
        <p style="color: #a78bfa; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">AI Transcribing Hub</p>
      </td>
    </tr>
  </table>
`;

// Universal Footer
const getFooter = (domain: string): string => `
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 40px; border-top: 1px solid #231f42; padding-top: 24px; text-align: center;">
    <tr>
      <td style="color: #64748b; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6;">
        <p style="margin: 0 0 8px 0;">Sent with ❤️ by <strong>Voice Messenger</strong></p>
        <p style="margin: 0 0 16px 0; font-size: 11px;">The ultimate multi-platform voice-to-text bridge connected to Whisper Turbo.</p>
        <p style="margin: 0;">
          <a href="https://${domain}" style="color: #8b5cf6; text-decoration: none; font-weight: 600; margin: 0 10px;">Dashboard</a> &bull; 
          <a href="https://${domain}/docs" style="color: #8b5cf6; text-decoration: none; font-weight: 600; margin: 0 10px;">Documentation</a> &bull; 
          <a href="mailto:support@${domain}" style="color: #8b5cf6; text-decoration: none; font-weight: 600; margin: 0 10px;">Support</a>
        </p>
      </td>
    </tr>
  </table>
`;

// Universal Wrapper
const getLayout = (content: string, domain: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voice Messenger</title>
</head>
<body style="background-color: #080612; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #080612;">
    <tr>
      <td align="center">
        <!-- Outer card -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #120e2b; border: 1px solid #231f42; border-radius: 20px; padding: 40px 32px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);">
          <tr>
            <td>
              ${getHeader()}
              
              <!-- Content block -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="color: #e2e8f0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6;">
                    ${content}
                  </td>
                </tr>
              </table>
              
              ${getFooter(domain)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export function renderEmail(
  template: 'verification' | 'forgot_password' | 'welcome' | 'generic',
  data: EmailTemplateData,
  domain: string = 'voicemsg.net'
): { html: string; text: string } {
  let contentHtml = '';
  let contentText = '';
  const greeting = data.name ? `Hello ${data.name},` : 'Hello,';

  switch (template) {
    case 'verification': {
      const verifyLink = data.link || `https://${domain}/auth/email/verify?token=${data.code}`;
      contentHtml = `
        <h2 style="color: #ffffff; font-family: 'Outfit', 'Inter', -apple-system, sans-serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.5px; text-align: center;">Verify your email address</h2>
        <p style="margin: 0 0 16px 0;">${greeting}</p>
        <p style="margin: 0 0 24px 0;">Thank you for registering with Voice Messenger! To complete your activation and begin bridging voice messages to Whisper Turbo across your favorite platforms, please verify your email address.</p>
        
        <!-- CTA Button -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
          <tr>
            <td align="center">
              <a href="${verifyLink}" target="_blank" style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; display: inline-block; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                Verify Email Address
              </a>
            </td>
          </tr>
        </table>

        <!-- Backup Link -->
        <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">If the button doesn't work, copy and paste this link into your browser:</p>
        <div style="background-color: #1a163a; border: 1px solid #2d2659; border-radius: 10px; padding: 12px; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #a78bfa; word-break: break-all; margin-bottom: 24px;">
          <a href="${verifyLink}" style="color: #a78bfa; text-decoration: none;">${verifyLink}</a>
        </div>

        <p style="color: #94a3b8; font-size: 13px; margin: 0; border-left: 3px solid #8b5cf6; padding-left: 10px;">This link will expire in 15 minutes. If you did not create a Voice Messenger account, you can safely ignore this email.</p>
      `;
      contentText = `
Welcome to Voice Messenger!
${greeting}

To complete your sign-up, please verify your email address by copying this link into your browser:
${verifyLink}

This link will expire in 15 minutes.
      `.trim();
      break;
    }

    case 'forgot_password': {
      const resetLink = data.link || `https://${domain}/auth/reset-password?token=${data.code}`;
      contentHtml = `
        <h2 style="color: #ffffff; font-family: 'Outfit', 'Inter', -apple-system, sans-serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.5px; text-align: center;">Reset your password</h2>
        <p style="margin: 0 0 16px 0;">${greeting}</p>
        <p style="margin: 0 0 24px 0;">We received a request to reset the password for your Voice Messenger account. Click the button below to choose a new password.</p>
        
        <!-- CTA Button -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px;">
          <tr>
            <td align="center">
              <a href="${resetLink}" target="_blank" style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; display: inline-block; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                Reset Password
              </a>
            </td>
          </tr>
        </table>

        <!-- Backup Link -->
        <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px 0;">If the button doesn't work, copy and paste this link into your browser:</p>
        <div style="background-color: #1a163a; border: 1px solid #2d2659; border-radius: 10px; padding: 12px; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #a78bfa; word-break: break-all; margin-bottom: 24px;">
          <a href="${resetLink}" style="color: #a78bfa; text-decoration: none;">${resetLink}</a>
        </div>

        <p style="color: #94a3b8; font-size: 13px; margin: 0; border-left: 3px solid #ef4444; padding-left: 10px;">This link is valid for 15 minutes. If you did not request a password reset, please ignore this email; your account remains secure.</p>
      `;
      contentText = `
Voice Messenger Password Reset
${greeting}

A password reset request was made. You can set a new password by visiting this link:
${resetLink}

This link is valid for 15 minutes. If you didn't request this, ignore this email.
      `.trim();
      break;
    }

    case 'welcome': {
      const dashboardLink = `https://${domain}/dashboard`;
      contentHtml = `
        <h2 style="color: #ffffff; font-family: 'Outfit', 'Inter', -apple-system, sans-serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.5px; text-align: center;">Welcome to Voice Messenger! 🚀</h2>
        <p style="margin: 0 0 16px 0;">${greeting}</p>
        <p style="margin: 0 0 16px 0;">Your email address is now fully verified. Your account is active, and you are ready to unleash modern AI transcription on all your chats.</p>
        <p style="margin: 0 0 24px 0;">Let's get you set up in minutes. Log into your dashboard to configure the services:</p>

        <!-- Dynamic Feature Grid -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 28px; background-color: #1b163a; border: 1px solid #2d2659; border-radius: 12px; padding: 20px;">
          <tr>
            <td style="padding-bottom: 12px; font-weight: bold; color: #a78bfa;">1. Connect Telegram</td>
          </tr>
          <tr>
            <td style="padding-bottom: 16px; color: #cbd5e1; font-size: 14px;">Deploy a personal Telegram engine in one-click using a Phone number or QR code.</td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px; font-weight: bold; color: #a78bfa;">2. Link Facebook & Instagram</td>
          </tr>
          <tr>
            <td style="padding-bottom: 16px; color: #cbd5e1; font-size: 14px;">Connect pages and business accounts in real-time to intercept and transcribe direct voice messages.</td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px; font-weight: bold; color: #a78bfa;">3. Whisper Turbo Transcriptions</td>
          </tr>
          <tr>
            <td style="color: #cbd5e1; font-size: 14px;">Receive crystal clear transcribing outputs natively within your chats with no-latency processing.</td>
          </tr>
        </table>

        <!-- CTA Button -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;">
          <tr>
            <td align="center">
              <a href="${dashboardLink}" target="_blank" style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; display: inline-block; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                Go to Dashboard
              </a>
            </td>
          </tr>
        </table>
      `;
      contentText = `
Welcome to Voice Messenger!
${greeting}

Your account is verified and ready.
Log in to your dashboard to get started:
https://${domain}/dashboard

Steps:
1. Connect Telegram via QR or Phone.
2. Link Facebook & Instagram.
3. Enjoy fast Whisper Turbo Transcriptions.
      `.trim();
      break;
    }

    default: {
      const title = data.title || 'Voice Messenger Notification';
      const ctaBtn = data.buttonText && data.buttonUrl ? `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px; margin-bottom: 24px;">
          <tr>
            <td align="center">
              <a href="${data.buttonUrl}" target="_blank" style="background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; display: inline-block; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                ${data.buttonText}
              </a>
            </td>
          </tr>
        </table>
      ` : '';

      contentHtml = `
        <h2 style="color: #ffffff; font-family: 'Outfit', 'Inter', -apple-system, sans-serif; font-size: 24px; font-weight: 700; margin: 0 0 16px 0; letter-spacing: -0.5px; text-align: center;">${title}</h2>
        <p style="margin: 0 0 16px 0;">${greeting}</p>
        <div style="line-height: 1.7; color: #cbd5e1; margin-bottom: 24px;">
          ${data.message || ''}
        </div>
        ${ctaBtn}
      `;
      contentText = `
${title}
${greeting}

${data.message ? data.message.replace(/<[^>]*>/g, '') : ''}

${data.buttonText && data.buttonUrl ? `${data.buttonText}: ${data.buttonUrl}` : ''}
      `.trim();
      break;
    }
  }

  return {
    html: getLayout(contentHtml, domain),
    text: contentText
  };
}
