const fs = require('fs');

const fileBuffer = fs.readFileSync('src/index.ts', 'utf-8');
const lines = fileBuffer.split('\n');

function getLines(start, end) {
  // start and end are 1-based, inclusive
  return lines.slice(start - 1, end).join('\n');
}

// 1. auth.ts (118-419 + 518-534)
let authContent = `import { Env, UserSession } from "../types";
import { renderAuthPage } from "../auth_ui";
import { logError } from "../logger";

` + getLines(118, 419) + '\n\n' + getLines(518, 534) + '\n';
// need to export functions
authContent = authContent.replace('async function handlePublicAuth', 'export async function handlePublicAuth');
authContent = authContent.replace('async function registerNewUser', 'export async function registerNewUser');
authContent = authContent.replace('async function sendEmail', 'export async function sendEmail');
fs.writeFileSync('src/routes/auth.ts', authContent);

// 2. dashboard.ts (421-504 + 506-516)
let dashboardContent = `import { Env, UserSession } from "../types";
import { renderDashboard } from "../dashboard_ui";
import { logError } from "../logger";

` + getLines(421, 504) + '\n\n' + getLines(506, 516) + '\n';
dashboardContent = dashboardContent.replace('async function handleUserDashboard', 'export async function handleUserDashboard');
dashboardContent = dashboardContent.replace('async function incrementUserStats', 'export async function incrementUserStats');
fs.writeFileSync('src/routes/dashboard.ts', dashboardContent);

// 3. admin.ts (536-736)
let adminContent = `import { Env, UserSession, HealthChecks } from "../types";
import { ErrorLog, getErrors, logError } from "../logger";
import { renderAdminDashboard, renderAdminLogin } from "../admin_ui";

` + getLines(536, 736) + '\n';
adminContent = adminContent.replace('async function handleAdmin', 'export async function handleAdmin');
fs.writeFileSync('src/routes/admin.ts', adminContent);

// 4. webhooks.ts (738 to end - roughly 803)
let webhooksContent = `import { Env, MetaWebhookBody, WhatsAppWebhookBody } from "../types";
import { TelegramWebhookUpdate, sendTelegramTypingOn, sendTelegramMessage, getTelegramFileUrl } from "../telegram";
import { sendTypingOn, sendMessageSafe } from "../meta";

` + getLines(738, lines.length) + '\n';
webhooksContent = webhooksContent.replace('async function handleTelegram', 'export async function handleTelegram');
webhooksContent = webhooksContent.replace('async function handleMetaMessaging', 'export async function handleMetaMessaging');
webhooksContent = webhooksContent.replace('async function handleWhatsApp', 'export async function handleWhatsApp');
fs.writeFileSync('src/routes/webhooks.ts', webhooksContent);

// 5. Override index.ts (1-116)
const indexTop = `import { Env, MessageBatch } from "./types";
import { verifyWebhook } from "./verify";
import queue from "./queue";

import { handlePublicAuth } from "./routes/auth";
import { handleAdmin } from "./routes/admin";
import { handleUserDashboard, incrementUserStats } from "./routes/dashboard";
import { handleTelegram, handleMetaMessaging, handleWhatsApp } from "./routes/webhooks";
import { renderHome } from "./home_ui";

` + getLines(14, 116) + '\n';
fs.writeFileSync('src/index.ts', indexTop);

console.log("Files split successfully!");
