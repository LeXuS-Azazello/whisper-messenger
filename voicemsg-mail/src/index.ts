import { Hono } from 'hono';
import { renderEmail } from './templates';

export interface Env {
  SEND_EMAIL: {
    send(message: {
      to: { email: string }[];
      from: { email: string; name?: string };
      subject: string;
      text?: string;
      html?: string;
    }): Promise<void>;
  };
  MAIL_API_TOKEN: string; // Authentication token for making requests to this worker
  EMAIL_FROM?: string;    // E.g., no-reply@voicemsg.net
  EMAIL_FROM_NAME?: string; // E.g., Voice Messenger
  DOMAIN?: string;        // E.g., voicemsg.net
}

const app = new Hono<{ Bindings: Env }>();

// Simple CORS middleware
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
});

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'active',
    service: 'voicemsg-mail',
    version: '1.0.0',
    description: 'Cloudflare Email Worker for Voice Messenger'
  });
});

// Email sending endpoint
app.post('/send', async (c) => {
  try {
    // 1. Auth check
    const authHeader = c.req.header('Authorization');
    const token = envToken(c.env);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid Authorization header format' }, 401);
    }
    
    const requestToken = authHeader.substring(7);
    if (requestToken !== token) {
      return c.json({ error: 'Unauthorized: Invalid API token' }, 401);
    }

    // 2. Parse body
    const body = await c.req.json().catch(() => null);
    if (!body) {
      return c.json({ error: 'Invalid payload: JSON body is required' }, 400);
    }

    const { to, subject, template, data } = body;

    // Validate inputs
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return c.json({ error: 'Validation failed: "to" must be a valid email address string' }, 400);
    }

    if (!subject || typeof subject !== 'string') {
      return c.json({ error: 'Validation failed: "subject" is required' }, 400);
    }

    if (!template || !['verification', 'forgot_password', 'welcome', 'generic'].includes(template)) {
      return c.json({ error: 'Validation failed: "template" must be "verification", "forgot_password", "welcome", or "generic"' }, 400);
    }

    const templateData = data || {};
    const domain = c.env.DOMAIN || 'voicemsg.net';

    // 3. Render email HTML & text
    const { html, text } = renderEmail(template, templateData, domain);

    // 4. Send via MailChannels API (allows sending to ANY email address)
    const fromEmail = (c.env.EMAIL_FROM || `no-reply@${domain}`).trim();
    let fromName = c.env.EMAIL_FROM_NAME || 'Voice Messenger';
    if (typeof fromName !== 'string') {
      fromName = String(fromName || '');
    }
    fromName = fromName.trim();
    if (!fromName) {
      fromName = 'Voice Messenger';
    }

    console.log(`[Mail Worker] Sending email via MailChannels to: ${to}, Template: ${template}, Subject: ${subject}`);

    const mailChannelsPayload = {
      personalizations: [
        {
          to: [
            {
              email: to.trim(),
              name: to.trim().split('@')[0] || 'Recipient'
            }
          ]
        }
      ],
      from: {
        email: fromEmail,
        name: fromName
      },
      subject: subject,
      content: [
        {
          type: 'text/plain',
          value: text
        },
        {
          type: 'text/html',
          value: html
        }
      ]
    };

    const mailChannelsResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Optional but recommended for production:
        // 'X-MailChannels-Authorization': 'Bearer your-token-if-needed'
      },
      body: JSON.stringify(mailChannelsPayload)
    });

    if (!mailChannelsResponse.ok) {
      const errorText = await mailChannelsResponse.text();
      console.error('[Mail Worker] MailChannels error:', mailChannelsResponse.status, errorText);
      return c.json({
        error: 'Failed to send email via MailChannels',
        details: `Status ${mailChannelsResponse.status}: ${errorText}`
      }, 500);
    }

    console.log(`[Mail Worker] Email sent successfully via MailChannels to: ${to}`);

    return c.json({
      success: true,
      message: 'Email processed and sent successfully',
      recipient: to,
      template: template
    });

  } catch (error: any) {
    console.error('[Mail Worker] Send error:', error);
    return c.json({
      error: 'Failed to send email',
      details: error.message || String(error)
    }, 500);
  }
});

// Helper to resolve MAIL_API_TOKEN with a safe fallback
function envToken(env: Env): string {
  if (env.MAIL_API_TOKEN && env.MAIL_API_TOKEN.trim() !== '') {
    return env.MAIL_API_TOKEN;
  }
  // Safe default for testing (should be changed via wrangler secret in prod)
  return 'voicemsg-mail-secret-default-token';
}

export default app;
