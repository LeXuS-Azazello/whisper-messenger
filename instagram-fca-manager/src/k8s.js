import * as k8s from '@kubernetes/client-node';
import fs from 'fs';
import { MODE, redis } from './config.js';
import { withTimeout } from './utils.js';
import User from './models/User.js';
import MessengerSession from './models/MessengerSession.js';

let k8sApi = null;

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

export async function spawnPod(userId, igSession) {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const sanitizedId = safeUserId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const ns = getNamespace();

    try {
        const existing = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 10000).catch(() => null);
        const allPods = existing?.body?.items || existing?.items || [];
        const items = allPods.filter(p => p.metadata.labels?.userId === safeUserId && p.metadata.labels?.app === 'instagram-fca-client');
        for (const p of items) {
            await k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace: ns }).catch(() => { });
        }
    } catch (e) { }

    let sessionData = igSession;
    if (!sessionData) {
        sessionData = await redis.get(`insta_session_${safeUserId}`);
        if (!sessionData) {
            const sessionDoc = await MessengerSession.findOne({ userId: safeUserId, platform: 'instagram' });
            if (sessionDoc?.sessionData) sessionData = sessionDoc.sessionData;
        }
    }

    if (!sessionData) {
        throw new Error(`No Instagram session found for user ${safeUserId}`);
    }

    let podManifest;
    try {
        const cm = await k8sApi.readNamespacedConfigMap({ name: 'insta-fca-pod-template', namespace: ns });
        const dataContainer = cm.body?.data || cm.data || {};
        const templateJson = dataContainer['pod-template.json'];
        if (!templateJson) throw new Error('Key "pod-template.json" not found in ConfigMap');
        podManifest = JSON.parse(templateJson);
    } catch (err) {
        throw new Error(`Pod template missing or invalid: ${err.message}`);
    }

    const podName = `insta-user-${sanitizedId}-${Date.now().toString().slice(-6)}`;
    podManifest.metadata.name = podName;
    podManifest.metadata.labels = { ...podManifest.metadata.labels, app: 'instagram-fca-client', userId: safeUserId };

    const container = podManifest.spec.containers[0];
    const envMap = new Map();
    (container.env || []).forEach(e => envMap.set(e.name, e));
    envMap.set('TARGET_USER_ID', { name: 'TARGET_USER_ID', value: safeUserId });
    envMap.set('IG_SESSION', { name: 'IG_SESSION', value: sessionData });
    envMap.set('MANAGER_URL', { name: 'MANAGER_URL', value: `http://instagram-fca-manager:3005` });
    
    container.env = Array.from(envMap.values());
    if (process.env.FCA_CLIENT_IMAGE) container.image = process.env.FCA_CLIENT_IMAGE;

    await withTimeout(k8sApi.createNamespacedPod({ namespace: ns, body: podManifest }), 30000);
    return podName;
}

export async function deletePods(userId) {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const ns = getNamespace();
    const existing = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 5000).catch(() => null);
    const items = (existing?.body?.items || existing?.items || []).filter(p => p.metadata.labels?.userId === safeUserId && p.metadata.labels?.app === 'instagram-fca-client');
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
        .filter(p => p?.metadata?.labels?.app === 'instagram-fca-client')
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
        const activeSessions = await MessengerSession.find({ platform: 'instagram', isActive: true }).catch(() => []);
        const runningPods = await listPods().catch(() => []);
        const runningUserIds = new Set(runningPods.map(p => String(p.userId)));
        
        for (const sess of activeSessions) {
            if (sess?.userId) {
                const uid = String(sess.userId);
                if (!runningUserIds.has(uid)) {
                    let session = await redis.get(`insta_session_${uid}`);
                    if (!session) session = sess.sessionData;
                    if (session) {
                        console.log(`[manager-insta] Reconciling: Spawning Instagram FCA Client pod for user ${uid}`);
                        await spawnPod(uid, session).catch(err => {
                            console.error(`[manager-insta] Failed to reconcile/spawn pod for user ${uid}:`, err.message);
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error(`[manager] Reconciliation error:`, e.message);
    }
}