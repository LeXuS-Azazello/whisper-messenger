import TdClient from 'tdweb';

let tdClient = null;
let currentOnUpdate = null;

export function getTdClient(onUpdate) {
  if (tdClient) {
    if (onUpdate) currentOnUpdate = onUpdate;
    return tdClient;
  }

  currentOnUpdate = onUpdate || (() => {});

  tdClient = new TdClient({
    onUpdate: (update) => {
      if (currentOnUpdate) currentOnUpdate(update);
    },
    instanceName: 'voicemsg',
    jsLogVerbosityLevel: 'info',
    logVerbosityLevel: 2,
    useDatabase: false
  });

  return tdClient;
}

export async function startQrLogin(onUpdate) {
  const client = getTdClient(onUpdate);

  // setTdlibParameters must be called first
  await client.send({
    '@type': 'setTdlibParameters',
    database_directory: '/voicemsg',
    files_directory: '/voicemsg/files',
    use_file_database: false,
    use_chat_info_database: false,
    use_message_database: false,
    use_secret_chats: true,
    api_id: 2496,
    api_hash: '8da85b0d5bfe62527e5b244c209159c3',
    system_language_code: 'en',
    device_model: 'voicemsg-net client-server',
    application_version: '1.0',
    enable_storage_optimizer: true
  });

  return client;
}

export async function requestQR(client) {
  console.log('[tdlib] Requesting QR Code authentication...');
  return client.send({
    '@type': 'requestQrCodeAuthentication',
    other_user_ids: []
  });
}

export async function sendPhoneNumber(phone) {
  const client = getTdClient();
  return client.send({
    '@type': 'setAuthenticationPhoneNumber',
    phone_number: phone
  });
}

export async function sendCode(code) {
  const client = getTdClient();
  return client.send({ '@type': 'checkAuthenticationCode', code });
}

export async function checkPassword(password) {
  const client = getTdClient();
  return client.send({ '@type': 'checkAuthenticationPassword', password });
}

export function closeTdClient() {
  if (tdClient) {
    tdClient.close();
    tdClient = null;
  }
}

/**
 * Try to restore an existing session from IndexedDB (same instanceName).
 * If successful → authorizationStateReady is emitted automatically.
 * This is the "Login with existing logged-in device" feature.
 */
export async function tryRestoreSession(onUpdate) {
  const client = getTdClient(onUpdate);

  await client.send({
    '@type': 'setTdlibParameters',
    database_directory: '/voicemsg',
    files_directory: '/voicemsg/files',
    use_file_database: false,
    use_chat_info_database: false,
    use_message_database: false,
    use_secret_chats: true,
    api_id: 2496,
    api_hash: '8da85b0d5bfe62527e5b244c209159c3',
    system_language_code: 'en',
    device_model: 'voicemsg-net client-server',
    application_version: '1.0',
    enable_storage_optimizer: true
  });

  // No need to call requestQrCodeAuthentication or setPhoneNumber.
  // If a valid session exists, TDLib will emit authorizationStateReady.
  return client;
}
