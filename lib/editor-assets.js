// Binary images stay in IndexedDB, separate from the small, synchronous text draft.
let database;
function db() {
  return (database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("yoshino-editor-images", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("images", { keyPath: "path" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
export async function imageStore(method, value) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(
      "images",
      method === "getAll" ? "readonly" : "readwrite",
    );
    const request = tx.objectStore("images")[method](value);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error("Image storage interrupted"));
  });
}

// A standards-compliant, uncompressed ZIP. Images are already compressed;
// UTF-8 text and binary files share a single downloadable publication package.
export function zipFiles(files) {
  const encode = new TextEncoder(),
    parts = [],
    directory = [];
  let offset = 0;
  const header = (length) => {
    const bytes = new Uint8Array(length),
      view = new DataView(bytes.buffer);
    return {
      bytes,
      u16: (p, v) => view.setUint16(p, v, true),
      u32: (p, v) => view.setUint32(p, v, true),
    };
  };
  for (const [name, value] of Object.entries(files)) {
    const path = encode.encode(name),
      data = typeof value === "string" ? encode.encode(value) : value;
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = header(30);
    local.u32(0, 0x04034b50);
    local.u16(4, 20);
    local.u16(6, 0x800);
    local.u16(12, 33);
    local.u32(14, crc);
    local.u32(18, data.length);
    local.u32(22, data.length);
    local.u16(26, path.length);
    parts.push(local.bytes, path, data);
    const central = header(46);
    central.u32(0, 0x02014b50);
    central.u16(4, 20);
    central.u16(6, 20);
    central.u16(8, 0x800);
    central.u16(14, 33);
    central.u32(16, crc);
    central.u32(20, data.length);
    central.u32(24, data.length);
    central.u16(28, path.length);
    central.u32(42, offset);
    directory.push(central.bytes, path);
    offset += 30 + path.length + data.length;
  }
  const directorySize = directory.reduce((n, x) => n + x.length, 0),
    end = header(22);
  end.u32(0, 0x06054b50);
  end.u16(8, Object.keys(files).length);
  end.u16(10, Object.keys(files).length);
  end.u32(12, directorySize);
  end.u32(16, offset);
  return new Blob([...parts, ...directory, end.bytes], {
    type: "application/zip",
  });
}
