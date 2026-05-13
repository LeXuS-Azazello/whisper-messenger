#!/usr/bin/env node

/**
 * Cloudflare Origin CA Certificate Generator for Kubernetes
 * Генерирует/обновляет Origin CA сертификат через Cloudflare API
 * и создает/обновляет Kubernetes TLS Secret для nginx ingress
 *
 * Использование:
 *   npm run cert:generate
 *
 * Требует environment variables:
 *   CLOUDFLARE_CERT_TOKEN - API token с правами Origin CA
 *   CLOUDFLARE_ZONE_ID   - Zone ID для домена voicemsg.net
 */
import 'dotenv/config';
import https from 'https';
import { execSync } from 'child_process';
import * as fs from 'fs';

// Конфигурация
const CONFIG = {
  domains: [
    'voicemsg.net',
    'bridge.voicemsg.net',
    'asr.voicemsg.net',
    'grafana.voicemsg.net',
  ],
  certificateName: 'voicemsg-origin-cert',
  kubernetes: {
    namespace: 'debugging-testcrash-pub',
    secretName: 'voicemsg-tls-cert',
    issuerName: 'letsencrypt-dns01', // не используется, но оставляем для совместимости
  },
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_CERT_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    apiBase: 'api.cloudflare.com',
    certificateValidityYears: 15, // Origin CA max
  },
  paths: {
    certPem: '/tmp/voicemsg-cert.pem',
    keyPem: '/tmp/voicemsg-key.pem',
  },
};

// Проверка env variables
if (!CONFIG.cloudflare.apiToken) {
  console.error('❌ Ошибка: CLOUDFLARE_CERT_TOKEN не установлен');
  process.exit(1);
}
if (!CONFIG.cloudflare.zoneId) {
  console.error('❌ Ошибка: CLOUDFLARE_ZONE_ID не установлен');
  process.exit(1);
}

// Cloudflare API request helper
function cfRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.cloudflare.apiBase,
      path: `/client/v4${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${CONFIG.cloudflare.apiToken}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success) {
            resolve(json);
          } else {
            reject(new Error(`CF API Error: ${JSON.stringify(json.errors)}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 1. Ищем существующий сертификат
async function findExistingCertificate() {
  try {
    const result = await cfRequest('GET', `/zones/${CONFIG.cloudflare.zoneId}/origin_ca_certificates`);
    const cert = result.result.find(c => c.name === CONFIG.certificateName);
    return cert;
  } catch (err) {
    console.error('⚠️  Не удалось получить список сертификатов:', err.message);
    return null;
  }
}

// 2. Создаем новый сертификат
async function createCertificate() {
  const body = {
    name: CONFIG.certificateName,
    hostnames: CONFIG.domains,
    request_type: 'origin-rsa',
    requested_validity: CONFIG.cloudflare.certificateValidityYears * 365, // дни
    validation_method: 'txt',
  };

  console.log('📝 Создаю Origin CA сертификат...');
  const result = await cfRequest('POST', `/zones/${CONFIG.cloudflare.zoneId}/origin_ca_certificates`, body);
  return result.result;
}

// 3. Скачиваем сертификат и приватный ключ
async function downloadCertificate(certId) {
  console.log('⬇️  Скачиваю сертификат и приватный ключ...');

  // Получаем полную информацию о сертификате (включая pem и private_key)
  const info = await cfRequest('GET', `/zones/${CONFIG.cloudflare.zoneId}/origin_ca_certificates/${certId}`);

  const certPem = info.result.certificate;
  const privateKey = info.result.private_key;
  // Формируем fullchain: сертификат + промежуточные CA
  const certificateAuthorities = info.result.certificate_authorities || [];
  const fullchain = [certPem, ...certificateAuthorities.map(ca => ca.certificate)].join('\n');

  // Сохраняем сертификат (fullchain) и приватный ключ
  fs.writeFileSync(CONFIG.paths.certPem, fullchain);
  fs.writeFileSync(CONFIG.paths.keyPem, privateKey);
  console.log('✅ Файлы сохранены:', CONFIG.paths.certPem, CONFIG.paths.keyPem);
}

// 4. Создаем/обновляем Kubernetes TLS Secret
function createK8sSecret() {
  console.log('🔐 Создаю/обновляю Kubernetes Secret...');

  // Проверяем существует ли secret
  try {
    execSync(
      `kubectl get secret ${CONFIG.kubernetes.secretName} -n ${CONFIG.kubernetes.namespace}`,
      { stdio: 'pipe' }
    );
    console.log('🔄 Secret уже существует, удаляю для пересоздания...');
    execSync(
      `kubectl delete secret ${CONFIG.kubernetes.secretName} -n ${CONFIG.kubernetes.namespace}`,
      { stdio: 'pipe' }
    );
  } catch (e) {
    // Secret не существует - создадим новый
  }

  // Создаем secret из файлов
  execSync(
    `kubectl create secret tls ${CONFIG.kubernetes.secretName} ` +
    `--cert=${CONFIG.paths.certPem} ` +
    `--key=${CONFIG.paths.keyPem} ` +
    `-n ${CONFIG.kubernetes.namespace}`,
    { stdio: 'pipe' }
  );
  console.log(`✅ Secret "${CONFIG.kubernetes.secretName}" создан в namespace "${CONFIG.kubernetes.namespace}"`);
}

// 5. Обновляем Ingress для использования TLS
function updateIngress() {
  console.log('🔧 Обновляю Ingress для TLS...');

  const ingressYaml = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: voicemsg-ingress
  namespace: ${CONFIG.kubernetes.namespace}
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "http"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - voicemsg.net
    - bridge.voicemsg.net
    - asr.voicemsg.net
    - grafana.voicemsg.net
    secretName: ${CONFIG.kubernetes.secretName}
  rules:
    - host: voicemsg.net
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: echo-frontend
                port:
                  number: 80
    - host: bridge.voicemsg.net
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mtproto-bridge-manager
                port:
                  number: 3000
    - host: asr.voicemsg.net
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: qwen3-asr
                port:
                  number: 11434
    - host: grafana.voicemsg.net
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: grafana
                port:
                  number: 3000
`;

  const ingressFile = '/tmp/voicemsg-ingress.yaml';
  fs.writeFileSync(ingressFile, ingressYaml);

  try {
    // Сначала удаляем существующий ingress (kubectl patch недоступен по RBAC)
    try {
      execSync(
        `kubectl delete ingress voicemsg-ingress -n ${CONFIG.kubernetes.namespace}`,
        { stdio: 'pipe' }
      );
      console.log('  🗑  Старый ingress удален');
    } catch (e) {
      // Ingress может не существовать — это нормально
    }

    // Создаем ingress из манифеста
    execSync(
      `kubectl create -f ${ingressFile} -n ${CONFIG.kubernetes.namespace}`,
      { stdio: 'pipe' }
    );
    console.log('✅ Ingress создан/обновлен с TLS секцией');
  } catch (err) {
    const errMsg = err.stderr ? err.stderr.toString().trim() : err.message;
    console.error('❌ Ошибка обновления Ingress:', errMsg);
    console.log('💡 Возможно, Ingress еще не существует. Запустите сначала инфраструктуру.');
  }
}

// Main flow
(async () => {
  console.log('🚀 Начинаю генерацию Cloudflare Origin CA сертификата\n');

  try {
    // Шаг 1: Ищем существующий
    const existing = await findExistingCertificate();
    let certId;

    if (existing) {
      console.log(`✓ Найден существующий сертификат: ${existing.name} (ID: ${existing.id})`);
      certId = existing.id;
    } else {
      // Шаг 2: Создаем новый
      const newCert = await createCertificate();
      certId = newCert.id;
      console.log(`✓ Сертификат создан: ${newCert.name} (ID: ${certId})`);
    }

    // Шаг 3: Скачиваем
    await downloadCertificate(certId);

    // Шаг 4: Создаем K8s Secret
    createK8sSecret();

    // Шаг 5: Обновляем Ingress
    updateIngress();

    console.log('\n✨ Все готово! Сертификат будет работать через nginx ingress.');
    console.log('💡 Проверьте статус:');
    console.log(`   kubectl get secret ${CONFIG.kubernetes.secretName} -n ${CONFIG.kubernetes.namespace}`);
    console.log(`   kubectl describe ingress voicemsg-ingress -n ${CONFIG.kubernetes.namespace}`);

  } catch (err) {
    console.error('\n❌ Критическая ошибка:', err.message);
    process.exit(1);
  }
})();