import * as k8s from '@kubernetes/client-node';
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
console.log('Signature:', k8sApi.readNamespacedConfigMap.toString().slice(0, 200));
