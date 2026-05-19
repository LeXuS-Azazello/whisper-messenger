import * as tdl from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';

tdl.configure({ tdjson: getTdjson() });

console.log('--- TDL EXPORTS ---');
console.log(Object.keys(tdl));

const client = tdl.createClient({
  apiId: 12345,
  apiHash: 'abcdef',
  databaseDirectory: '/tmp/tdlib-inspect',
  filesDirectory: '/tmp/tdlib-inspect/files',
  tdlibParameters: {
    use_message_database: false,
    use_chat_info_database: false,
    use_file_database: false,
  }
});

console.log('\n--- CLIENT PROTOTYPE METHODS ---');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client)));

console.log('\n--- CLIENT INSTANCE PROPERTIES ---');
console.log(Object.getOwnPropertyNames(client));

try {
  await client.close();
} catch (e) {}
