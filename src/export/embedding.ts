import type { SketchData } from "@/types/sketch";
import { migrateSketchData } from "@/storage/migrations";
import { normalizeToolPresets } from "@/tools/presets";
import { compressData, decompressData } from "@/utils/compress";

// ─── Magic header ─────────────────────────────────────────────────
const MAGIC = new Uint8Array([0x53, 0x4E, 0x42, 0x31]); // "SNB1"

// ─── Serialize / Deserialize ──────────────────────────────────────

export async function serializeSketchData(data: SketchData): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(data));
  const compressed = await compressData(json);
  const result = new Uint8Array(MAGIC.length + compressed.length);
  result.set(MAGIC, 0);
  result.set(compressed, MAGIC.length);
  return result;
}

export async function deserializeSketchData(bytes: Uint8Array): Promise<SketchData> {
  if (bytes.length < MAGIC.length) throw new Error("Data too short");
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error("Invalid sketch data header");
  }
  const compressed = bytes.slice(MAGIC.length);
  const jsonBytes = await decompressData(compressed);
  const json = new TextDecoder().decode(jsonBytes);
  const raw = JSON.parse(json);
  const data = migrateSketchData(raw);
  return { ...data, toolPresets: normalizeToolPresets(data.toolPresets) };
}

// ─── CRC32 ────────────────────────────────────────────────────────

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG helpers ──────────────────────────────────────────────────

function writeUint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (value >>> 24) & 0xFF;
  buf[1] = (value >>> 16) & 0xFF;
  buf[2] = (value >>> 8) & 0xFF;
  buf[3] = value & 0xFF;
  return buf;
}

function readUint32BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const TEXT_KEYWORD = "sketch-note-data";

function buildPngTextChunk(keyword: string, text: string): Uint8Array {
  const keywordBytes = new TextEncoder().encode(keyword);
  const textBytes = new TextEncoder().encode(text);
  const dataLength = keywordBytes.length + 1 + textBytes.length; // keyword + null separator + text
  const typeBytes = new TextEncoder().encode("tEXt");
  const chunkData = new Uint8Array(dataLength);
  chunkData.set(keywordBytes, 0);
  chunkData[keywordBytes.length] = 0; // null separator
  chunkData.set(textBytes, keywordBytes.length + 1);
  // CRC over type + data
  const crcInput = new Uint8Array(4 + dataLength);
  crcInput.set(typeBytes, 0);
  crcInput.set(chunkData, 4);
  const crc = crc32(crcInput);
  // Assemble: length(4) + type(4) + data + crc(4)
  const chunk = new Uint8Array(4 + 4 + dataLength + 4);
  chunk.set(writeUint32BE(dataLength), 0);
  chunk.set(typeBytes, 4);
  chunk.set(chunkData, 8);
  chunk.set(writeUint32BE(crc), 8 + dataLength);
  return chunk;
}

// ─── Base64 ───────────────────────────────────────────────────────

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── PNG embed / extract ──────────────────────────────────────────

export async function embedInPng(pngBlob: Blob, sketchData: SketchData): Promise<Blob> {
  const serialized = await serializeSketchData(sketchData);
  const b64 = uint8ArrayToBase64(serialized);

  const pngBuf = new Uint8Array(await pngBlob.arrayBuffer());
  // Validate PNG signature
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (pngBuf[i] !== PNG_SIGNATURE[i]) throw new Error("Invalid PNG file");
  }

  const textChunk = buildPngTextChunk(TEXT_KEYWORD, b64);
  // Insert text chunk right after IHDR (offset 8 signature + 4 length + 4 type + 13 data + 4 crc = 33)
  const ihdrEnd = 8 + 4 + 4 + 13 + 4; // 33
  const result = new Uint8Array(pngBuf.length + textChunk.length);
  result.set(pngBuf.slice(0, ihdrEnd), 0);
  result.set(textChunk, ihdrEnd);
  result.set(pngBuf.slice(ihdrEnd), ihdrEnd + textChunk.length);
  return new Blob([result], { type: "image/png" });
}

export async function extractFromPng(file: File): Promise<SketchData | null> {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    // Validate signature
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
      if (buf[i] !== PNG_SIGNATURE[i]) return null;
    }
    // Scan chunks for tEXt with our keyword
    let offset = 8; // skip signature
    while (offset + 8 <= buf.length) {
      const length = readUint32BE(buf, offset);
      const type = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);
      if (type === "IEND") break;
      if (length < 0 || offset + 8 + length + 4 > buf.length) break; // corrupted chunk
      if (type === "tEXt" && length > TEXT_KEYWORD.length + 1) {
        const dataStart = offset + 8;
        // Read keyword (null-terminated)
        let nullIdx = dataStart;
        while (nullIdx < dataStart + length && buf[nullIdx] !== 0) nullIdx++;
        const keyword = String.fromCharCode(...buf.slice(dataStart, nullIdx));
        if (keyword === TEXT_KEYWORD) {
          const textBytes = buf.slice(nullIdx + 1, dataStart + length);
          const b64 = new TextDecoder().decode(textBytes);
          try {
            const serialized = base64ToUint8Array(b64);
            return await deserializeSketchData(serialized);
          } catch {
            return null;
          }
        }
      }
      offset += 4 + 4 + length + 4; // length + type + data + crc
    }
    return null;
  } catch {
    return null;
  }
}

// ─── PDF embed / extract ──────────────────────────────────────────

const PDF_MARKER = "\n%%SKETCHNOTE%%";

export async function embedInPdf(pdfBlob: Blob, sketchData: SketchData): Promise<Blob> {
  const serialized = await serializeSketchData(sketchData);
  // Write marker + 4-byte little-endian length + data
  const lengthBuf = new Uint8Array(4);
  lengthBuf[0] = serialized.length & 0xFF;
  lengthBuf[1] = (serialized.length >>> 8) & 0xFF;
  lengthBuf[2] = (serialized.length >>> 16) & 0xFF;
  lengthBuf[3] = (serialized.length >>> 24) & 0xFF;
  const markerBytes = new TextEncoder().encode(PDF_MARKER);
  return new Blob([pdfBlob, markerBytes, lengthBuf, serialized], { type: "application/pdf" });
}

export async function extractFromPdf(file: File): Promise<SketchData | null> {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    // Search for marker from the end of the file
    const markerBytes = new TextEncoder().encode(PDF_MARKER);
    let markerOffset = -1;
    // Scan backwards for the marker
    for (let i = buf.length - markerBytes.length; i >= 0; i--) {
      let match = true;
      for (let j = 0; j < markerBytes.length; j++) {
        if (buf[i + j] !== markerBytes[j]) { match = false; break; }
      }
      if (match) { markerOffset = i; break; }
    }
    if (markerOffset < 0) return null;
    const dataStart = markerOffset + markerBytes.length;
    if (dataStart + 4 > buf.length) return null;
    const dataLength = buf[dataStart] | (buf[dataStart + 1] << 8) | (buf[dataStart + 2] << 16) | (buf[dataStart + 3] << 24);
    if (dataLength <= 0 || dataStart + 4 + dataLength > buf.length) return null;
    const serialized = buf.slice(dataStart + 4, dataStart + 4 + dataLength);
    return await deserializeSketchData(serialized);
  } catch {
    return null;
  }
}

// ─── Unified import ───────────────────────────────────────────────

export async function importSketchFromFile(file: File): Promise<SketchData | null> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) {
    return extractFromPng(file);
  }
  if (name.endsWith(".pdf")) {
    return extractFromPdf(file);
  }
  return null;
}
