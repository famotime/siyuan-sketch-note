/**
 * 基于浏览器原生 CompressionStream / DecompressionStream 的 deflate-raw 压缩工具。
 * SiYuan 运行在 Electron (Chromium 80+) 上，该 API 可用，无需引入外部依赖。
 */

/** 将 Uint8Array 使用 deflate-raw 压缩 */
export async function compressData(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate-raw");
  const writer = cs.writable.getWriter();
  void writer.write(data);
  void writer.close();
  return await readStream(cs.readable);
}

/** 将 deflate-raw 压缩的 Uint8Array 解压 */
export async function decompressData(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  void writer.write(data);
  void writer.close();
  return await readStream(ds.readable);
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
