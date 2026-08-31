import * as k8s from '@kubernetes/client-node';
import fs from 'fs';
import { MODE, redis } from './config.js';
import { withTimeout } from './utils.js';
import User from './object-models/User.js';
import MessengerSession from './object-models/MessengerSession.js';

let k8sApi = null;
let k8sBatchApi = null;

export function resolveNamespace() {
    if (process.env.POD_NAMESPACE) return process.env.POD_NAMESPACE;
    try {
        const ns = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace', 'utf8').trim();
        return ns || 'default';
    } catch {
        return 'default';
    }
}

export function initK8s() {
    if (MODE !== 'MANAGER') return null;
    try {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        const cluster = kc.getCurrentCluster();
        const customServer = process.env.MANAGER_API_SERVER || process.env.BRIDGE_API_SERVER;
        if (customServer && cluster) {
            cluster.server = customServer;
            cluster.skipTLSVerify = true;
            cluster.insecureSkipTlsVerify = true;
        }
        k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
    } catch (err) {
        console.error(`[manager] Failed to initialize K8s client:`, err);
    }
    return k8sApi;
}

export function getK8sApi() {
    return k8sApi;
}

function getNamespace() {
    return resolveNamespace();
}

export async function spawnPod(userId, session, username = '', fbId = '', fbLogin = '') {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const sanitizedId = safeUserId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const cleanUsername = (username || safeUserId).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 10);
    const cleanLogin = fbLogin ? fbLogin.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 15) : 'unknown';
    const cleanFbId = fbId ? String(fbId).replace(/[^0-9]/g, '').slice(0, 10) : '0';

    const short = Date.now().toString().slice(-6);

    // Format: facebook-{username}-{fb-login}-{fb_id}-{short}
    let podName = `facebook-${cleanUsername}-${cleanLogin}-${cleanFbId}-${short}`;
    podName = podName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 63);

    const ns = getNamespace();

    try {
        if (k8sBatchApi) {
            const existingJobs = await withTimeout(k8sBatchApi.listNamespacedJob({ namespace: ns }), 10000).catch(() => null);
            const allJobs = existingJobs?.body?.items || existingJobs?.items || [];
            const userJobs = allJobs.filter(j => j.metadata.labels?.userId === safeUserId && j.metadata.labels?.app === 'facebook-fca-client');
            for (const j of userJobs) {
                await k8sBatchApi.deleteNamespacedJob({ name: j.metadata.name, namespace: ns, propagationPolicy: 'Foreground' }).catch(() => { });
            }
        }
        const existing = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 10000).catch(() => null);
        const allPods = existing?.body?.items || existing?.items || [];
        const items = allPods.filter(p => p.metadata.labels?.userId === safeUserId && p.metadata.labels?.app === 'facebook-fca-client');
        for (const p of items) {
            await k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace: ns }).catch(() => { });
        }
    } catch (e) { }

    let sessionData = session;
    if (!sessionData || sessionData.length < 100) {
        sessionData = await redis.get(`fb_session_${safeUserId}`);
        if (!sessionData) {
            const sessionDoc = await MessengerSession.findOne({ userId: safeUserId, platform: 'facebook' });
            if (sessionDoc?.sessionData) sessionData = sessionDoc.sessionData;
        }
    }

    if (!sessionData) {
        throw new Error(`No Facebook AppState session found for user ${safeUserId}`);
    }

    let podManifest;
    try {
        const cm = await k8sApi.readNamespacedConfigMap({ name: 'fca-pod-template', namespace: ns });
        const dataContainer = cm.body?.data || cm.data || {};
        const templateJson = dataContainer['pod-template.json'];
        if (!templateJson) throw new Error('Key "pod-template.json" not found in ConfigMap');
        podManifest = JSON.parse(templateJson);
    } catch (err) {
        throw new Error(`Pod template missing or invalid: ${err.message}`);
    }

    podManifest.metadata.name = podName;
    podManifest.metadata.labels = { ...podManifest.metadata.labels, app: 'facebook-fca-client', userId: safeUserId };

    const container = podManifest.spec.containers[0];
    const envMap = new Map();
    (container.env || []).forEach(e => envMap.set(e.name, e));
    envMap.set('TARGET_USER_ID', { name: 'TARGET_USER_ID', value: safeUserId });
    envMap.set('FB_SESSION', { name: 'FB_SESSION', value: sessionData });
    envMap.set('MANAGER_URL', { name: 'MANAGER_URL', value: `http://facebook-fca-manager:3003` });

    container.env = Array.from(envMap.values());

    try {
        const provider = await redis.get('config_local_funasr_url') || process.env.FUNASR_URL || 'http://funasr:50001/v1/transcribe-base64';
        const samesameUrl = await redis.get('config_samesame_url') || process.env.SAMESAME_URL || 'http://samesame:8002';
        const samesameSecret = await redis.get('config_samesame_secret') || process.env.SAMESAME_SECRET || '';

        container.env.push({ name: 'FUNASR_URL', value: provider });
        container.env.push({ name: 'SAMESAME_URL', value: samesameUrl });
        container.env.push({ name: 'SAMESAME_SECRET', value: samesameSecret });
    } catch (e) {
        console.warn(`[/spawn] Failed to fetch dynamic config from Redis:`, e.message);
    }

    if (process.env.FCA_CLIENT_IMAGE) container.image = process.env.FCA_CLIENT_IMAGE;

    const jobManifest = {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
            name: podName,
            namespace: ns,
            labels: {
                app: 'facebook-fca-client',
                userId: safeUserId
            }
        },
        spec: {
            ttlSecondsAfterFinished: 86400,
            backoffLimit: 0,
            template: {
                metadata: {
                    labels: {
                        app: 'facebook-fca-client',
                        userId: safeUserId
                    }
                },
                spec: {
                    ...podManifest.spec,
                    restartPolicy: 'Never'
                }
            }
        }
    };

    await withTimeout(k8sBatchApi.createNamespacedJob({ namespace: ns, body: jobManifest }), 30000);
    return podName;
}

export async function deletePods(userId) {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const ns = getNamespace();
    if (k8sBatchApi) {
        try {
            const existingJobs = await withTimeout(k8sBatchApi.listNamespacedJob({ namespace: ns }), 5000).catch(() => null);
            const allJobs = existingJobs?.body?.items || existingJobs?.items || [];
            const userJobs = allJobs.filter(j => j.metadata.labels?.userId === safeUserId && j.metadata.labels?.app === 'facebook-fca-client');
            for (const j of userJobs) {
                await k8sBatchApi.deleteNamespacedJob({ name: j.metadata.name, namespace: ns, propagationPolicy: 'Foreground' }).catch(() => { });
            }
        } catch (e) { }
    }
    const existing = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 5000).catch(() => null);
    const items = (existing?.body?.items || existing?.items || []).filter(p => p.metadata.labels?.userId === safeUserId && p.metadata.labels?.app === 'facebook-fca-client');
    for (const p of items) {
        await k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace: ns }).catch(() => { });
    }
}

export async function listPods() {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const ns = getNamespace();
    const pods = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 10000).catch(() => null);
    const items = pods?.body?.items || pods?.items || [];
    return items
        .filter(p => p?.metadata?.labels?.app === 'facebook-fca-client')
        .map(p => ({
            userId: p?.metadata?.labels?.userId,
            status: p?.status?.phase,
            startTime: p?.status?.startTime,
            podName: p?.metadata?.name,
            podIP: p?.status?.podIP
        }));
}

export async function runReconciliation() {
    if (MODE !== 'MANAGER') return;
    try {
        const activeSessions = await MessengerSession.find({ platform: 'facebook', isActive: true }).catch(() => []);
        const runningPods = await listPods().catch(() => []);
        const runningUserIds = new Set(runningPods.map(p => String(p.userId)));

        for (const sess of activeSessions) {
            if (sess?.userId) {
                const uid = String(sess.userId);
                if (!runningUserIds.has(uid)) {
                    let session = await redis.get(`fb_session_${uid}`);
                    if (!session) session = sess.sessionData;
                    if (session) {
                        console.log(`[manager-fca] Reconciling: Spawning FCA Client pod for user ${uid}`);
                        await spawnPod(uid, session).catch(err => {
                            console.error(`[manager-fca] Failed to reconcile/spawn pod for user ${uid}:`, err.message);
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error(`[manager] Reconciliation error:`, e.message);
    }
}
