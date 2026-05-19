const MANAGER_SECRET = '2x9c4v7b1n5m8a3d6f0g2h9i4j7k1l5m3n0o8p6q2r9s4t1u7v3w5x0y8z2a6b9c3d1e4f7g0h';
const POD_NAME = 'whisper-service-xxxxxxxxx-xxxxx';

async function getLogs() {
    try {
        const url = `http://tg-client-manager:3000/internal/logs/${POD_NAME}?secret=${MANAGER_SECRET}`;
        console.log('Fetching logs from:', url);
        const res = await fetch(url, {
            headers: { 'x-manager-secret': MANAGER_SECRET }
        });
        const text = await res.text();
        console.log('--- LOGS START ---');
        console.log(text);
        console.log('--- LOGS END ---');
    } catch (e) {
        console.error('Failed to fetch logs:', e.message);
    }
}

getLogs();
