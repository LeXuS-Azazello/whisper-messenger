import * as k8s from '@kubernetes/client-node';
import https from 'https';
import fs from 'fs';
import { MODE, API_ID, API_HASH, SECRET, WORKER_URL, DEVICE_MODEL, APP_VERSION, SYSTEM_VERSION } from './config.js';
import { withTimeout } from './utils.js';

let k8sApi = null;

/**
 * Resolve the namespace in which the manager pod runs.
 * Prefer POD_NAMESPACE env var, fall back to the service account namespace file.
 */
function resolveNamespace() {
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
        console.log(`[bridge] K8s context: ${kc.getCurrentContext()}, Cluster: ${cluster?.name}, Server: ${cluster?.server}`);

        const customServer = process.env.BRIDGE_API_SERVER;
        if (customServer) {
            console.log(`[bridge] Overriding K8s server ${cluster?.server} -> ${customServer} (BRIDGE_API_SERVER)`);
            cluster.server = customServer;
        }

        k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        console.log(`[bridge] K8s initialized. Namespace: ${resolveNamespace()}`);
    } catch (err) {
        console.error(`[bridge] Failed to initialize K8s client:`, err);
    }
    return k8sApi;
}

export function getK8sApi() {
    return k8sApi;
}

/** Helper to get namespace with fallback */
function getNamespace() {
    return resolveNamespace();
}

export async function spawnPod(userId, session) {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const sanitizedId = safeUserId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const ns = getNamespace();
    
    console.log(`[/spawn] Spawning tg-client pod for user ${safeUserId} in namespace ${ns}`);

    try {
        const existing = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 10000).catch(() => null);
        const allPods = existing?.body?.items || existing?.items || [];
        const items = allPods.filter(p => p.metadata.labels?.userId === safeUserId);

        if (items.length > 0) {
            for (const p of items) {
                if (!p?.metadata?.name) continue;
                console.log(`[/spawn] Deleting stale pod ${p.metadata.name}...`);
                await k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace: ns }).catch(() => {});
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (e) {}

    // Load template from ConfigMap
    let podManifest;
    try {
        const cm = await k8sApi.readNamespacedConfigMap({ name: 'tg-client-pod-template', namespace: ns });
        const templateJson = cm.body.data['pod-template.json'];

        podManifest = JSON.parse(templateJson);
    } catch (err) {
        console.error(`[/spawn] Failed to read pod template from ConfigMap:`, err.message);
        throw new Error('Pod template missing in cluster');
    }

    const podName = `tg-user-${sanitizedId}-${Date.now().toString().slice(-6)}`;
    
    // Customize the manifest
    podManifest.metadata.name = podName;
    podManifest.metadata.labels = {
        ...podManifest.metadata.labels,
        app: 'tg-user-bridge',
        userId: safeUserId
    };

    const container = podManifest.spec.containers[0];
    
    // Ensure essential env vars are set/overridden
    const envMap = new Map();
    (container.env || []).forEach(e => envMap.set(e.name, e));

    envMap.set('TARGET_USER_ID', { name: 'TARGET_USER_ID', value: safeUserId });
    const sessVal = session || '';
    envMap.set('TG_SESSION', { name: 'TG_SESSION', value: sessVal });
    
    container.env = Array.from(envMap.values());
    
    // Use image from manager's env if provided, otherwise stick to template
    if (process.env.TG_CLIENT_IMAGE) {
        container.image = process.env.TG_CLIENT_IMAGE;
    }

    console.log(`[/spawn] Creating pod ${podName} from template (Session length: ${sessVal.length})...`);
    await withTimeout(k8sApi.createNamespacedPod({ namespace: ns, body: podManifest }), 30000);


    console.log(`[/spawn] Successfully spawned ${podName}`);
    return podName;
}

export async function deletePods(userId) {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);

    console.log(`[/delete] Deleting tg-client pods for user ${safeUserId}`);
    const ns = getNamespace();
    const existing = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 5000).catch(() => null);
    const allItems = existing?.body?.items || existing?.items || [];
    const items = allItems.filter(p => p.metadata.labels?.userId === safeUserId);

    if (items.length > 0) {
        for (const p of items) {
            if (!p?.metadata?.name) continue;
            console.log(`[/delete] Deleting pod ${p.metadata.name}...`);
            await withTimeout(k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace: ns }), 5000).catch(err => {

                console.error(`[/delete] Failed to delete pod ${p.metadata.name}:`, err.message);
            });
        }
    }
}

export async function listPods() {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const ns = getNamespace();
    console.log(`[/pods] Fetching tg-client pods in namespace ${ns}`);
    const pods = await withTimeout(k8sApi.listNamespacedPod({ namespace: ns }), 10000).catch(() => null);


    const items = pods?.body?.items || pods?.items || [];
    return items.map(p => {
        const labels = p?.metadata?.labels || {};
        return {
            userId: labels.userId,
            status: p?.status?.phase,
            startTime: p?.status?.startTime,
            podName: p?.metadata?.name
        };
    });
}

export async function runReconciliation() {
    if (!process.env.WORKER_URL || MODE !== 'MANAGER') return;
    try {
        console.log(`[bridge] Starting tg-client reconciliation cycle...`);
        const res = await fetch(`${process.env.WORKER_URL}/internal/active-users?secret=${process.env.BRIDGE_SECRET}`);
        if (res.ok) {
            const users = await res.json();
            if (!Array.isArray(users)) {
                console.error(`[bridge] Invalid response from active-users: expected array, got ${typeof users}`);
                return;
            }
            console.log(`[bridge] Found ${users.length} active users to check`);

            const runningPods = await listPods().catch(() => []);
            const runningUserIds = new Set(runningPods.map(p => String(p.userId)));

            for (const user of users) {
                const uid = String(user.userId);
                if (!runningUserIds.has(uid)) {
                    console.log(`[bridge] User ${uid} should be running but no tg-client pod found. Spawning...`);
                    try {
                        await spawnPod(uid, user.session);
                    } catch (e) {
                        console.error(`[bridge] Auto-spawn error for ${uid}:`, e.message);
                    }
                }
            }
            console.log(`[bridge] tg-client reconciliation cycle complete`);
        } else {
            console.error(`[bridge] Failed to fetch active users: ${res.status}`);
        }
    } catch (e) {
        console.error(`[bridge] Reconciliation error:`, e.message);
    }
}

