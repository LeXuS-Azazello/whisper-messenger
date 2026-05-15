import TdClient from './tdweb/index.js';

import AdmZip from 'adm-zip';
import { API_ID, API_HASH, DEVICE_MODEL, APP_VERSION, SYSTEM_VERSION, SECRET } from './config.js';
import net from 'net';
import path from 'path';
import fs from 'fs';

let isTdlibConfigured = false;

export function createClient(userId, options = {}) {
    const dbDir = path.join('/tmp/tdlib', String(userId || 'manager'));
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    const client = new TdClient({
        instanceName: String(userId || 'manager'),
        onUpdate: options.onUpdate
    });

    // Compatibility shim for code expecting tdl-like interface
    client.on = (event, callback) => {
        if (event === 'update') {
            client.options.onUpdate = callback;
        }
    };
    client.connect = async () => {
        // TDWeb handles connection during init in worker
        return true;
    };
    client.close = async () => {
        client.terminate();
    };

    return client;
}



export function packSession(userId) {
    const dbDir = path.join('/tmp/tdlib', String(userId));
    if (!fs.existsSync(dbDir)) {
        console.warn(`[utils] Cannot pack session for ${userId}: directory not found at ${dbDir}`);
        return null;
    }
    try {
        const zip = new AdmZip();
        zip.addLocalFolder(dbDir);
        return zip.toBuffer().toString('base64');
    } catch (e) {
        console.error(`[utils] Failed to pack session for ${userId}:`, e.message);
        return null;
    }
}

export function unpackSession(userId, base64) {
    if (!base64 || base64.length < 100) return null;
    const dbDir = path.join('/tmp/tdlib', String(userId));
    try {
        if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
        fs.mkdirSync(dbDir, { recursive: true });
        const zip = new AdmZip(Buffer.from(base64, 'base64'));
        zip.extractAllTo(dbDir, true);
        console.log(`[utils] Successfully unpacked session for ${userId} to ${dbDir}`);
        return dbDir;
    } catch (e) {
        console.error(`[utils] Failed to unpack session for ${userId}:`, e.message);
        return null;
    }
}

export function auth(req, res, next) {
  const base = `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.headers.host}`;
  const url = new URL(req.originalUrl || req.url, base);
  const pathname = url.pathname;
  // Allow public auth routes without secret
  if (pathname.startsWith('/auth')) {
    return next();
  }
  const s = (req.headers['x-manager-secret'] || req.headers['x-bridge-secret'] || req.query.secret || '').trim();
  const expected = (SECRET || 'changeme').trim();
  const isMatched = s === expected;
  
  if (!isMatched) {
    console.warn(`[manager-auth] 401 Unauthorized.
        Received: "${s ? s.slice(0, 3) + '...' + s.slice(-3) : 'NONE'}" (length: ${s.length})
        Expected match: "${expected ? expected.slice(0, 3) + '...' + expected.slice(-3) : 'NONE'}" (length: ${expected.length})
        Headers: ${JSON.stringify(req.headers)}
        Query: ${JSON.stringify(req.query)}
        Path: ${req.method} ${req.url}
        Remote IP: ${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function withTimeout(promise, ms, name = 'Operation') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export function checkConnect(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let finished = false;
        socket.setTimeout(2000);
        socket.on('connect', () => { if (!finished) { finished = true; socket.destroy(); resolve(true); } });
        socket.on('error', () => { if (!finished) { finished = true; socket.destroy(); resolve(false); } });
        socket.on('timeout', () => { if (!finished) { finished = true; socket.destroy(); resolve(false); } });
        socket.connect(port, host);
    });
}
