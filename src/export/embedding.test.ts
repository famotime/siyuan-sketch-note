import { describe, expect, it } from "vitest";
import type { SketchData } from "@/types/sketch";
import {
  serializeSketchData,
  deserializeSketchData,
  embedInPng,
  extractFromPng,
  embedInPdf,
  extractFromPdf,
  importSketchFromFile,
} from "./embedding";

// ─── Minimal valid PNG builder ────────────────────────────────────

function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeU32(v: number): Uint8Array {
  return new Uint8Array([(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF]);
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const crc = crc32(crcInput);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  chunk.set(writeU32(data.length), 0);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  chunk.set(writeU32(crc), 8 + data.length);
  return chunk;
}

function createMinimalPng(): Blob {
  const signature = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  // IHDR: width=1, height=1, bitDepth=8, colorType=2 (RGB), compression=0, filter=0, interlace=0
  const ihdrData = new Uint8Array([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const ihdr = makeChunk("IHDR", ihdrData);
  const iend = makeChunk("IEND", new Uint8Array(0));
  // Single pixel IDAT (compressed with zlib: filter byte 0 + RGB 0,0,0)
  const idatData = new Uint8Array([0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]);
  const idat = makeChunk("IDAT", idatData);
  const buf = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  let off = 0;
  for (const part of [signature, ihdr, idat, iend]) {
    buf.set(part, off);
    off += part.length;
  }
  return new Blob([buf], { type: "image/png" });
}

function createMinimalPdf(): Blob {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000108 00000 n
trailer<</Size 4/Root 1 0 R>>
startxref
173
%%EOF`;
  return new Blob([content], { type: "application/pdf" });
}

const sampleData: SketchData = {
  version: 1,
  template: "grid",
  canvasWidth: 800,
  canvasHeight: 1200,
  strokes: [
    {
      id: "s1",
      points: [
        { x: 10, y: 20, pressure: 0.5, timestamp: 1000 },
        { x: 30, y: 40, pressure: 0.7, timestamp: 1016 },
      ],
      color: "#333333",
      width: 2,
      tool: "pen",
    },
  ],
};

describe("serialize / deserialize round-trip", () => {
  it("preserves SketchData through compress and decompress", async () => {
    const serialized = await serializeSketchData(sampleData);
    expect(serialized[0]).toBe(0x53); // 'S'
    expect(serialized[1]).toBe(0x4E); // 'N'
    expect(serialized[2]).toBe(0x42); // 'B'
    expect(serialized[3]).toBe(0x31); // '1'
    const restored = await deserializeSketchData(serialized);
    expect(restored.version).toBe(1);
    expect(restored.template).toBe("grid");
    expect(restored.strokes).toHaveLength(1);
    expect(restored.strokes[0].points).toHaveLength(2);
    expect(restored.strokes[0].color).toBe("#333333");
  });

  it("rejects data with invalid header", async () => {
    const bad = new Uint8Array([0, 0, 0, 0, 1, 2, 3]);
    await expect(deserializeSketchData(bad)).rejects.toThrow("Invalid sketch data header");
  });

  it("rejects data that is too short", async () => {
    const bad = new Uint8Array([0x53, 0x4E]);
    await expect(deserializeSketchData(bad)).rejects.toThrow("Data too short");
  });
});

describe("PNG embed / extract", () => {
  it("embeds and extracts sketch data from a PNG file", async () => {
    const pngBlob = createMinimalPng();
    const embedded = await embedInPng(pngBlob, sampleData);
    // Embedded PNG should be larger
    expect(embedded.size).toBeGreaterThan(pngBlob.size);
    // Should still be valid PNG (starts with signature)
    const header = new Uint8Array(await embedded.slice(0, 8).arrayBuffer());
    expect(header[0]).toBe(0x89);
    expect(header[1]).toBe(0x50); // 'P'
    // Extract
    const file = new File([embedded], "test.png", { type: "image/png" });
    const extracted = await extractFromPng(file);
    expect(extracted).not.toBeNull();
    expect(extracted!.template).toBe("grid");
    expect(extracted!.strokes).toHaveLength(1);
    expect(extracted!.strokes[0].id).toBe("s1");
  });

  it("returns null for PNG without embedded data", async () => {
    const pngBlob = createMinimalPng();
    const file = new File([pngBlob], "plain.png", { type: "image/png" });
    const result = await extractFromPng(file);
    expect(result).toBeNull();
  });

  it("returns null for non-PNG file", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "test.png", { type: "image/png" });
    const result = await extractFromPng(file);
    expect(result).toBeNull();
  });
});

describe("PDF embed / extract", () => {
  it("embeds and extracts sketch data from a PDF file", async () => {
    const pdfBlob = createMinimalPdf();
    const embedded = await embedInPdf(pdfBlob, sampleData);
    expect(embedded.size).toBeGreaterThan(pdfBlob.size);
    const file = new File([embedded], "test.pdf", { type: "application/pdf" });
    const extracted = await extractFromPdf(file);
    expect(extracted).not.toBeNull();
    expect(extracted!.template).toBe("grid");
    expect(extracted!.strokes).toHaveLength(1);
    expect(extracted!.strokes[0].color).toBe("#333333");
  });

  it("returns null for PDF without embedded data", async () => {
    const pdfBlob = createMinimalPdf();
    const file = new File([pdfBlob], "plain.pdf", { type: "application/pdf" });
    const result = await extractFromPdf(file);
    expect(result).toBeNull();
  });
});

describe("importSketchFromFile", () => {
  it("delegates to PNG extractor for .png files", async () => {
    const pngBlob = createMinimalPng();
    const embedded = await embedInPng(pngBlob, sampleData);
    const file = new File([embedded], "note.png", { type: "image/png" });
    const result = await importSketchFromFile(file);
    expect(result).not.toBeNull();
    expect(result!.strokes).toHaveLength(1);
  });

  it("delegates to PDF extractor for .pdf files", async () => {
    const pdfBlob = createMinimalPdf();
    const embedded = await embedInPdf(pdfBlob, sampleData);
    const file = new File([embedded], "note.pdf", { type: "application/pdf" });
    const result = await importSketchFromFile(file);
    expect(result).not.toBeNull();
    expect(result!.strokes).toHaveLength(1);
  });

  it("returns null for unsupported file types", async () => {
    const file = new File(["hello"], "note.txt", { type: "text/plain" });
    const result = await importSketchFromFile(file);
    expect(result).toBeNull();
  });
});
