import type { OcrLine } from "./ocrIndex";

export interface OcrProviderInput {
  imageBlob: Blob;
  canvasWidth: number;
  canvasHeight: number;
}

export type OcrProvider = (input: OcrProviderInput) => Promise<OcrLine[]>;

export function createNoopOcrProvider(): OcrProvider {
  return async () => {
    console.info("[Sketch Note] No OCR provider configured. Returning empty results.");
    return [];
  };
}
