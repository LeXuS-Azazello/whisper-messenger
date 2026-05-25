import { redis } from './config.js';
import fs from 'fs';
import path from 'path';

const filePromises = new Map();

async function waitForFileVisible(p, maxWait = 8000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        try {
            const st = fs.statSync(p);
            if (st.isFile() && st.size > 0) {
                return true;
            }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 100));
    }
    return false;
}

export async function downloadTelegramFile(client, fileId, mimeType = 'audio/ogg') {
    const fileIdNum = Number(fileId);

    console.log(`[downloader] downloadTelegramFile called for fileId=${fileIdNum}`);

    if (filePromises.has(fileIdNum)) {
        const cached = filePromises.get(fileIdNum);
        try {
            const result = await cached.promise;
            if (result && result.local && result.local.path && fs.existsSync(result.local.path)) {
                console.log(`[downloader] Returning cached file for ${fileIdNum}: ${result.local.path}`);
                return result;
            }
        } catch (e) {
            filePromises.delete(fileIdNum);
        }
    }

    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    const timeout = setTimeout(() => {
        cleanup(new Error(`File download timed out for file ${fileId}`));
    }, 30000);

    function cleanup(result) {
        clearTimeout(timeout);
        if (filePromises.has(fileIdNum)) {
            filePromises.delete(fileIdNum);
        }
        if (result instanceof Error) {
            rejectPromise(result);
        } else {
            resolvePromise(result);
        }
    }

    filePromises.set(fileIdNum, {
        promise,
        resolve: (f) => cleanup(f),
        reject: (err) => cleanup(err)
    });

    try {
        let fileInfo = await client.invoke({
            '_': 'getFile',
            file_id: fileIdNum
        });

        if (fileInfo.local.is_downloading_completed && fileInfo.local.path) {
            if (await waitForFileVisible(fileInfo.local.path, 500)) {
                console.log(`[downloader] File downloaded for ${fileIdNum}: ${fileInfo.local.path}`);
                cleanup(fileInfo);
                return promise;
            }
            console.warn(`[downloader] File missing from disk, but TDLib thinks it's completed. Triggering deleteFile to reset state.`);
            try { await client.invoke({ '_': 'deleteFile', file_id: fileIdNum }); } catch (_) {}
        }

        await client.invoke({
            '_': 'downloadFile',
            file_id: fileIdNum,
            priority: 1,
            offset: 0,
            limit: 0
        });

        fileInfo = await client.invoke({
            '_': 'getFile',
            file_id: fileIdNum
        });

        if (fileInfo.local.is_downloading_completed && fileInfo.local.path) {
            if (await waitForFileVisible(fileInfo.local.path, 8000)) {
                console.log(`[downloader] File downloaded for ${fileIdNum}: ${fileInfo.local.path}`);
                cleanup(fileInfo);
                return promise;
            }
            throw new Error(`File still not visible after 8000ms: ${fileInfo.local.path}`);
        }
        
        // Do NOT fail here. TDLib is downloading in the background.
        // The handleFileUpdate function will resolve the promise when completed.

    } catch (err) {
        cleanup(err);
    }

    const result = await promise;
    return result;
}

export async function handleFileUpdate(update) {
    if (!update || update['_'] !== 'updateFile') return;
    const file = update.file;
    if (file && file.local && file.local.is_downloading_completed && file.local.path) {
        if (filePromises.has(file.id)) {
            const cached = filePromises.get(file.id);
            if (await waitForFileVisible(file.local.path)) {
                console.log(`[downloader] File downloaded via update for ${file.id}: ${file.local.path}`);
                cached.resolve(file);
            } else {
                cached.reject(new Error(`File still not visible after 8000ms: ${file.local.path}`));
            }
        }
    }
}
