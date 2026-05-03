import * as k8s from '@kubernetes/client-node';
import https from 'https';
import { MODE, API_ID, API_HASH, SECRET, WORKER_URL, DEVICE_MODEL, APP_VERSION, SYSTEM_VERSION } from './config.js';
import { withTimeout } from './utils.js';

let k8sApi = null;

export function initK8s() {
    if (MODE !== 'MANAGER') return null;
    try {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        
        let cluster = kc.getCurrentCluster();
        console.log(`[bridge] K8s context: ${kc.getCurrentContext()}, Cluster: ${cluster?.name}, Original Server: ${cluster?.server}`);
        
        const customServer = process.env.BRIDGE_API_SERVER;
        if (customServer) {
            console.log(`[bridge] Overriding K8s server ${cluster?.server} -> ${customServer} (BRIDGE_API_SERVER)`);
            cluster.server = customServer;
            cluster.skipTLSVerify = false; 
        } else {
            console.log(`[bridge] Using default K8s server`);
        }
        
        const httpsAgent = new https.Agent({
            keepAlive: true,
            keepAliveMsecs: 10000,
            maxSockets: 10,
            maxFreeSockets: 5,
            timeout: 60000, 
        });
        
        k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        if (k8sApi && k8sApi.defaultClient) {
            k8sApi.defaultClient.timeout = 60000;
        }
        console.log(`[bridge] K8s initialized. Server: ${cluster?.server}, Namespace: ${process.env.POD_NAMESPACE || 'unknown'}`);
    } catch (err) {
        console.error(`[bridge] Failed to initialize K8s client:`, err);
    }
    return k8sApi;
}

export function getK8sApi() {
    return k8sApi;
}

export async function spawnPod(userId, session) {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const sanitizedId = safeUserId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const namespace = process.env.POD_NAMESPACE || 'debugging-echovoice';

    console.log(`[/spawn] Spawning pod for user ${safeUserId}`);

    try {
        console.log(`[/spawn] Listing pods for ${safeUserId}...`);
        const existing = await withTimeout(k8sApi.listNamespacedPod({
            namespace,
            labelSelector: `userId=${safeUserId}`
        }), 10000);
        
        const items = existing?.body?.items || existing?.items || [];
        if (items.length > 0) {
            console.log(`[/spawn] Found ${items.length} existing pods/stale sessions for ${safeUserId}, cleaning up...`);
            for (const p of items) {
                if (!p?.metadata?.name) continue;
                console.log(`[/spawn] Deleting stale pod ${p.metadata.name}...`);
                await withTimeout(k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace }), 10000)
                    .catch(e => console.error(`[/spawn] Partial delete failure for ${p.metadata.name}:`, e.message));
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (listErr) {
        console.warn(`[/spawn] Could not list/delete existing pods for ${safeUserId} (skipping cleanup):`, listErr.message);
    }

    const podName = `tg-user-${sanitizedId}-${Date.now().toString().slice(-6)}`;
    const podManifest = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: podName, labels: { app: 'tg-user-bridge', userId: safeUserId } },
        spec: {
            containers: [{
                name: 'bridge',
                image: process.env.BRIDGE_IMAGE || 'azazellosaraksh/debugging-mtproto-bridge:latest',
                env: [
                    { name: 'MODE', value: 'USER' },
                    { name: 'TARGET_USER_ID', value: safeUserId },
                    { name: 'TG_SESSION', value: session },
                    { name: 'TG_API_ID', value: String(API_ID) },
                    { name: 'TG_API_HASH', value: API_HASH },
                    { name: 'BRIDGE_SECRET', value: SECRET },
                    { name: 'WORKER_URL', value: WORKER_URL },
                    { name: 'WHISPER_SERVER_URL', value: process.env.WHISPER_SERVER_URL || '' },
                    { name: 'WHISPER_SECRET', value: process.env.WHISPER_SECRET || '' },
                    { name: 'DEVICE_MODEL', value: process.env.DEVICE_MODEL || DEVICE_MODEL },
                    { name: 'APP_VERSION', value: process.env.APP_VERSION || APP_VERSION },
                    { name: 'SYSTEM_VERSION', value: process.env.SYSTEM_VERSION || SYSTEM_VERSION }
                ],
                resources: { requests: { memory: '128Mi' }, limits: { memory: '256Mi' } }
            }]
        }
    };

    console.log(`[/spawn] Creating new pod ${podName}...`);
    await withTimeout(k8sApi.createNamespacedPod({ namespace, body: podManifest }), 20000); 

    console.log(`[/spawn] Successfully spawned ${podName}`);
    return podName;
}

export async function deletePods(userId) {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const safeUserId = String(userId);
    const namespace = process.env.POD_NAMESPACE || 'debugging-echovoice';
    
    console.log(`[/delete] Deleting pods for user ${safeUserId}`);
    const existing = await withTimeout(k8sApi.listNamespacedPod({
        namespace,
        labelSelector: `userId=${safeUserId}`
    }), 5000);
    
    const items = existing?.body?.items || existing?.items || [];
    if (items.length > 0) {
        for (const p of items) {
            if (!p?.metadata?.name) continue;
            console.log(`[/delete] Deleting pod ${p.metadata.name}...`);
            await withTimeout(k8sApi.deleteNamespacedPod({ name: p.metadata.name, namespace }), 5000).catch((err) => {
                console.error(`[/delete] Failed to delete pod ${p.metadata.name}:`, err.message);
            });
        }
    }
}

export async function listPods() {
    if (!k8sApi) throw new Error('K8s API not initialized');
    const namespace = process.env.POD_NAMESPACE || 'debugging-echovoice';
    console.log(`[/pods] Fetching pods in namespace ${namespace}`);
    const pods = await withTimeout(k8sApi.listNamespacedPod({
        namespace,
        labelSelector: 'app=tg-user-bridge'
    }), 10000);
    
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
        console.log(`[bridge] Starting reconciliation cycle...`);
      const res = await fetch(`${process.env.WORKER_URL}/internal/active-users?secret=${process.env.BRIDGE_SECRET}`);
      if (res.ok) {
        const users = await res.json();
        // Handle case where response is not an array
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
                    console.log(`[bridge] User ${uid} should be running but no pod found. Spawning...`);
                    try {
                        await spawnPod(uid, user.session);
                    } catch (e) {
                        console.error(`[bridge] Auto-spawn error for ${uid}:`, e.message);
                    }
                }
            }
            console.log(`[bridge] Reconciliation cycle complete`);
        } else {
            console.error(`[bridge] Failed to fetch active users: ${res.status}`);
        }
    } catch (e) {
        console.error(`[bridge] Reconciliation error:`, e.message);
    }
}
