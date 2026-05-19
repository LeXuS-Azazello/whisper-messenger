import net from 'net';
import { SECRET } from './config.js';

export function auth(req, res, next) {
  const base = `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.headers.host}`;
  const url = new URL(req.originalUrl || req.url, base);
  const pathname = url.pathname;
  
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
