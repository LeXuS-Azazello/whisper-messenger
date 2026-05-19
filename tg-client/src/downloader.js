import { redis } from './config.js';
import fs from 'fs';
import path from 'path';

const filePromises = new Map();

export async function downloadTelegramFile(client, fileId, mimeType = 'audio/ogg') {
    const fileIdNum = Number(fileId);

    if (filePromises.has(fileIdNum)) {
        return filePromises.get(fileIdNum).promise;
    }

    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    const pollInterval = setInterval(async () => {
        try {
            const currentFile = await client.invoke({
                '_': 'getFile',
                file_id: fileIdNum
            });
            if (currentFile && currentFile.local.is_downloading_completed) {
                cleanup(currentFile);
            }
        } catch (pollErr) {}
    }, 500);

    const timeout = setTimeout(() => {
        cleanup(new Error(`File download timed out for file ${fileId}`));
    }, 30000);

    function cleanup(result) {
        clearInterval(pollInterval);
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
        const fileInfo = await client.invoke({
            '_': 'getFile',
            file_id: fileIdNum
        });

        if (fileInfo.local.is_downloading_completed) {
            cleanup(fileInfo);
            return promise;
        }

        await client.invoke({
            '_': 'downloadFile',
            file_id: fileIdNum,
            priority: 1,
            offset: 0,
            limit: 0
        });

        const file = await client.invoke({
            '_': 'getFile',
            file_id: fileIdNum
        });

        if (file.local.is_downloading_completed) {
            cleanup(file);
        }
    } catch (err) {
        cleanup(err);
    }

    const result = await promise;
    return result;
}
