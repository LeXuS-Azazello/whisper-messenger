import { qrStart } from './src/auth.js';
const req = {};
const res = { json: (data) => console.log('res.json', data), status: (code) => ({ json: (data) => console.log('res.status', code, data) }) };
qrStart(req, res).catch(console.error);
