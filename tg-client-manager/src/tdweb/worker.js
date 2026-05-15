// Same as tg-client/src/tdweb/worker.js
import { parentPort } from 'worker_threads';
import { instantiateAny } from './wasm-utils.js';
import path from 'path';
import fs from 'fs';
class TdWorker {
    async init(options) {
        const wasmPath = options.wasmPath || path.resolve('node_modules/tdweb/dist/3dee0f934ca1a5946a253599e3e442c6.wasm');
        const jsGluePath = options.jsGluePath || path.resolve('node_modules/tdweb/dist/tdweb.js');
        global.self = global; global.window = global; global.navigator = { userAgent: 'Node.js' };
        const { default: createTdwebModule } = await import(jsGluePath);
        this.module = await createTdwebModule({
            instantiateWasm: (imports, successCallback) => {
                instantiateAny(1, wasmPath, imports).then(instance => successCallback(instance));
                return {};
            }
        });
        this.td_functions = {
            td_create: this.module.cwrap('td_emscripten_create_client_id', 'number', []),
            td_send: this.module.cwrap('td_emscripten_send', null, ['number', 'string']),
            td_receive: this.module.cwrap('td_emscripten_receive', 'string', []),
        };
        this.client_id = this.td_functions.td_create();
        parentPort.postMessage({ '@type': 'inited' });
        setInterval(() => {
            const res = this.td_functions.td_receive();
            if (res) parentPort.postMessage(JSON.parse(res));
        }, 100);
    }
}
const worker = new TdWorker();
parentPort.on('message', (msg) => {
    if (msg['@type'] === 'init') worker.init(msg.options);
    else worker.td_functions.td_send(worker.client_id, JSON.stringify(msg));
});
