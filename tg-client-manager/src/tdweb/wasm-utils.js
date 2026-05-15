// Same as tg-client/src/tdweb/wasm-utils.js
import fs from 'fs';
export async function instantiateStreaming(path, importObject) {
  const buffer = fs.readFileSync(path);
  let result = await WebAssembly.instantiate(buffer, importObject);
  return result.instance;
}
export async function instantiateAny(version, path, importObject) {
  try { return await instantiateStreaming(path, importObject); } catch (e) { throw e; }
}
