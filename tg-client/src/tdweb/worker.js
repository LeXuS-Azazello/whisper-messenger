// Derived from https://github.com/tdlib/td/blob/master/example/web/tdweb/src/worker.js
// Adapted for Node.js worker_threads

import { parentPort, workerData } from 'worker_threads';
import { instantiateAny } from './wasm-utils.js';
import path from 'path';
import fs from 'fs';

// Node.js doesn't have indexedDB/localforage by default.
// For the transcription bot, we use the local filesystem or memory as requested.
// The spec says session data is in Redis/MongoDB, but TDLib needs a local database_directory.

class TdWorker {
    constructor() {
        this.client_id = 0;
        this.td_functions = {};
    }

    async init(options) {
        const wasmPath = options.wasmPath || path.resolve('node_modules/tdweb/dist/3dee0f934ca1a5946a253599e3e442c6.wasm');
        const jsGluePath = options.jsGluePath || path.resolve('node_modules/tdweb/dist/tdweb.js');

        // We need the Emscripten glue. 
        // Note: tdweb.js in dist is a bundled UMD/ESM. 
        // For Node.js, we might need a specific build or to mock the environment.
        
        // Mocking browser globals for TDWeb glue
        global.self = global;
        global.window = global;
        global.navigator = { userAgent: 'Node.js' };
        
        const tdwebModule = await import(jsGluePath);
        const createTdwebModule = tdwebModule.default || tdwebModule;
        
        this.module = await createTdwebModule({
            instantiateWasm: (imports, successCallback) => {
                instantiateAny(1, wasmPath, imports).then(instance => {
                    successCallback(instance);
                });
                return {};
            }
        });

        this.td_functions = {
            td_create: this.module.cwrap('td_emscripten_create_client_id', 'number', []),
            td_send: this.module.cwrap('td_emscripten_send', null, ['number', 'string']),
            td_receive: this.module.cwrap('td_emscripten_receive', 'string', []),
            td_execute: this.module.cwrap('td_emscripten_execute', 'string', ['string']),
        };

        this.client_id = this.td_functions.td_create();
        
        parentPort.postMessage({ '@type': 'inited' });
        this.loop();
    }

    send(query) {
        this.td_functions.td_send(this.client_id, JSON.stringify(query));
    }

    receive() {
        const res = this.td_functions.td_receive();
        if (res) {
            parentPort.postMessage(JSON.parse(res));
        }
    }

    loop() {
        setInterval(() => this.receive(), 100);
    }
}

const worker = new TdWorker();

parentPort.on('message', (msg) => {
    if (msg['@type'] === 'init') {
        worker.init(msg.options);
    } else {
        worker.send(msg);
    }
});
