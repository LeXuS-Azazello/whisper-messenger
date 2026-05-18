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
    return c.text('OK', 204);
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

    // 4. Send via Cloudflare SEND_EMAIL binding
    if (!c.env.SEND_EMAIL || typeof c.env.SEND_EMAIL.send !== 'function') {
      console.error('[Mail Worker] SEND_EMAIL binding is missing or not configured.');
      return c.json({ error: 'Internal Server Error: Cloudflare SEND_EMAIL binding is not configured' }, 500);
    }

    const fromEmail = (c.env.EMAIL_FROM || `no-reply@${domain}`).trim();
    let fromName = c.env.EMAIL_FROM_NAME || 'Voice Messenger';
    if (typeof fromName !== 'string') {
      fromName = String(fromName || '');
    }
    fromName = fromName.trim();

    console.log(`[Mail Worker] Sending email to: ${to}, Template: ${template}, Subject: ${subject}`);

    const recipient: { email: string; name?: string } = { email: to.trim() };
    const sender: { email: string; name?: string } = { email: fromEmail };
    if (fromName) {
      sender.name = fromName;
    }

    await c.env.SEND_EMAIL.send({
      to: [recipient],
      from: sender,
      subject: subject,
      html: html,
      text: text
    });

    console.log(`[Mail Worker] Email sent successfully to: ${to}`);

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
