// WOFF 1.0 → SFNT. opentype.js has its own inflater, but it rejects many of the
// CJK subset files; the browser's zlib (DecompressionStream) reads them all.

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function woffToSfnt(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const src = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  if (dv.getUint32(0) !== 0x774f4646) return buffer;            // not 'wOFF': already an SFNT
  const flavor = dv.getUint32(4), numTables = dv.getUint16(12), size = dv.getUint32(16);

  const out = new Uint8Array(size);
  const o = new DataView(out.buffer);
  let log = 0;
  while (1 << (log + 1) <= numTables) log++;
  o.setUint32(0, flavor);
  o.setUint16(4, numTables);
  o.setUint16(6, (1 << log) * 16);
  o.setUint16(8, log);
  o.setUint16(10, numTables * 16 - (1 << log) * 16);

  let at = 12 + 16 * numTables;
  for (let i = 0; i < numTables; i++) {
    const p = 44 + i * 20;
    const tag = dv.getUint32(p), offset = dv.getUint32(p + 4), compLength = dv.getUint32(p + 8);
    const origLength = dv.getUint32(p + 12), checksum = dv.getUint32(p + 16);
    const raw = src.subarray(offset, offset + compLength);
    out.set(compLength < origLength ? await inflate(raw) : raw, at);
    const r = 12 + i * 16;
    o.setUint32(r, tag);
    o.setUint32(r + 4, checksum);
    o.setUint32(r + 8, at);
    o.setUint32(r + 12, origLength);
    at += (origLength + 3) & ~3;
  }
  return out.buffer;
}
