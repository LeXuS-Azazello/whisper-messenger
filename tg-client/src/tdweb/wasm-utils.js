// Derived from https://github.com/tdlib/td/blob/master/example/web/tdweb/src/wasm-utils.js
// Adapted for Node.js environment

import fs from 'fs';

export async function instantiateStreaming(path, importObject) {
  const buffer = fs.readFileSync(path);
  let result = await WebAssembly.instantiate(buffer, importObject);
  return result.instance;
}

export async function instantiateAny(version, path, importObject) {
  console.log("instantiate wasm from", path);
  try {
    return await instantiateStreaming(path, importObject);
  } catch (e) {
    console.error("instantiateStreaming failed", e);
    throw e;
  }
}
