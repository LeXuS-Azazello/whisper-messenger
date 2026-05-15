// Same as tg-client/src/tdweb/index.js
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default class TdClient {
    constructor(options = {}) {
        this.options = options;
        this.worker = new Worker(path.resolve(__dirname, 'worker.js'));
        this.worker.on('message', (msg) => {
            if (this.options.onUpdate) this.options.onUpdate(msg);
        });
        this.worker.postMessage({ '@type': 'init', options });
    }
    send(query) { this.worker.postMessage(query); }
    invoke(query) {
        return new Promise((resolve, reject) => {
            const extra = Math.random().toString(36).substring(7);
            const queryWithExtra = { ...query, '@extra': extra };
            const handler = (msg) => {
                if (msg['@extra'] === extra) {
                    this.worker.off('message', handler);
                    if (msg['@type'] === 'error') reject(new Error(msg.message || 'TDLib error'));
                    else resolve(msg);
                }
            };
            this.worker.on('message', handler);
            this.send(queryWithExtra);
        });
    }
    terminate() { this.worker.terminate(); }
}
