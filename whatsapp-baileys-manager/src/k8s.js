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

async function ensureUserPVC(sanitizedId, ns) {
    const pvcName = `wa-baileys-pvc-${sanitizedId}`;
    try {
        await k8sApi.readNamespacedPersistentVolumeClaim({ name: pvcName, namespace: ns });
    } catch (err) {
        const statusCode = err.response?.statusCode || err.statusCode || err.status || 0;
        if (statusCode === 404 || err.message?.includes('not found')) {
            const pvcManifest = {
                apiVersion: 'v1',
                kind: 'PersistentVolumeClaim',
                metadata: {
                    name: pvcName,
                    labels: { app: 'wa-baileys-client', userId: sanitizedId }
                },
                spec: {
                    accessModes: ['ReadWriteOnce'],
                    storageClassName: 'local-path',
                    resources: { requests: { storage: '100Mi' } }
                }
            };
            await k8sApi.createNamespacedPersistentVolumeClaim({ namespace: ns, body: pvcManifest });
        } else {
            throw err;
        }
    }
}

export async function spawnPod(userId, session, username = '') {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const sanitizedId = safeUserId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const base = (username && username.length >= 2)
        ? username.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
        : safeUserId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

    const short = Date.now().toString().slice(-6);
    const podName = `${base}-whatsapp-${short}`;

    const ns = getNamespace();

    await ensureUserPVC(sanitizedId, ns);

    try {
        const existing = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 10000).catch(() => null);
        const allPods = existing?.body?.items || existing?.items || [];
        const items = allPods.filter(p => p.metadata.labels?.userId === safeUserId);
        for (const p of items) {
            await k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace: ns }).catch(() => { });
        }
    } catch (e) { }

    let sessionData = session;
    if (!sessionData || sessionData.length < 100) {
        sessionData = await redis.get(`wa_session_${safeUserId}`);
        if (!sessionData) {
            const sessionDoc = await MessengerSession.findOne({ userId: safeUserId, platform: 'whatsapp' });
            if (sessionDoc?.sessionData) sessionData = sessionDoc.sessionData;
        }
    }

    let podManifest;
    try {
        const cm = await k8sApi.readNamespacedConfigMap({ name: 'wa-baileys-pod-template', namespace: ns });
        const dataContainer = cm.body?.data || cm.data || {};
        const templateJson = dataContainer['pod-template.json'];
        if (!templateJson) throw new Error('Key "pod-template.json" not found in ConfigMap');
        podManifest = JSON.parse(templateJson);
    } catch (err) {
        throw new Error(`Pod template missing or invalid: ${err.message}`);
    }

    podManifest.metadata.name = podName;
    podManifest.metadata.labels = { ...podManifest.metadata.labels, app: 'wa-baileys-client', userId: safeUserId };

    const pvcName = `wa-baileys-pvc-${sanitizedId}`;
    if (!podManifest.spec.volumes) podManifest.spec.volumes = [];
    podManifest.spec.volumes = podManifest.spec.volumes.filter(v => v.name !== 'baileys-storage');
    podManifest.spec.volumes.push({ name: 'baileys-storage', persistentVolumeClaim: { claimName: pvcName } });

    const container = podManifest.spec.containers[0];
    if (!container.volumeMounts) container.volumeMounts = [];
    container.volumeMounts = container.volumeMounts.filter(vm => vm.name !== 'baileys-storage');
    container.volumeMounts.push({ name: 'baileys-storage', mountPath: '/app/sessions' });

    const envMap = new Map();
    (container.env || []).forEach(e => envMap.set(e.name, e));
    envMap.set('TARGET_USER_ID', { name: 'TARGET_USER_ID', value: safeUserId });
    const sessVal = (sessionData && sessionData.length < 200000) ? sessionData : '';
    envMap.set('WA_SESSION', { name: 'WA_SESSION', value: sessVal });
    
    container.env = Array.from(envMap.values());
    
    try {
        const provider = await redis.get('config_whisper_provider') || process.env.WHISPER_PROVIDER || 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';
        const samesameUrl = await redis.get('config_samesame_url') || process.env.SAMESAME_URL || 'http://samesame.debugging-testcrash-pub.svc.cluster.local:8002';
        const samesameSecret = await redis.get('config_samesame_secret') || process.env.SAMESAME_SECRET || '';
        
        container.env.push({ name: 'WHISPER_PROVIDER', value: provider });
        container.env.push({ name: 'SAMESAME_URL', value: samesameUrl });
        container.env.push({ name: 'SAMESAME_SECRET', value: samesameSecret });
    } catch (e) {
        console.warn(`[/spawn] Failed to fetch dynamic config from Redis:`, e.message);
    }

    if (process.env.WA_BAILEYS_IMAGE) container.image = process.env.WA_BAILEYS_IMAGE;

    await withTimeout(k8sApi.createNamespacedPod({ namespace: ns, body: podManifest }), 30000);
    return podName;
}

export async function deletePods(userId) {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const sanitizedId = safeUserId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const ns = getNamespace();
    const existing = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 5000).catch(() => null);
    const items = (existing?.body?.items || existing?.items || []).filter(p => p.metadata.labels?.userId === safeUserId);
    for (const p of items) {
        await k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace: ns }).catch(() => { });
    }
    const pvcName = `wa-baileys-pvc-${sanitizedId}`;
    await k8sApi.deleteNamespacedPersistentVolumeClaim({ name: pvcName, namespace: ns }).catch(() => { });
}

export async function listPods() {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const ns = getNamespace();
    const pods = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 10000).catch(() => null);
    const items = pods?.body?.items || pods?.items || [];
    return items.map(p => ({
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
        const activeSessions = await MessengerSession.find({ platform: 'whatsapp', isActive: true }).catch(() => []);
        const oldUsers = await User.find({ waSession: { $exists: true, $ne: null }, isActive: true }).catch(() => []);
        const unifiedActiveUsers = new Map();
        for (const sess of activeSessions) if (sess?.userId) unifiedActiveUsers.set(String(sess.userId), { userId: String(sess.userId), session: sess.sessionData });
        for (const user of oldUsers) {
            const uid = String(user.userId);
            if (!unifiedActiveUsers.has(uid)) unifiedActiveUsers.set(uid, { userId: uid, session: user.waSession });
        }
        const runningPods = await listPods().catch(() => []);
        const runningUserIds = new Set(runningPods.map(p => String(p.userId)));
        for (const [uid, userObj] of unifiedActiveUsers.entries()) {
            if (!runningUserIds.has(uid)) {
                let session = await redis.get(`wa_session_${uid}`);
                if (!session) session = userObj.session;
                if (session) await spawnPod(uid, session);
            }
        }
    } catch (e) {
        console.error(`[manager] Reconciliation error:`, e.message);
    }
}
