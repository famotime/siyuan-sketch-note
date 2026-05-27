import type { OcrLine } from "./ocrIndex";
import { createLogger } from "@/utils/logger";

export interface OcrProviderInput {
  imageBlob: Blob;
  canvasWidth: number;
  canvasHeight: number;
}

export type OcrProvider = (input: OcrProviderInput) => Promise<OcrLine[]>;

export function createNoopOcrProvider(): OcrProvider {
  return async () => {
    createLogger().info("No OCR provider configured. Returning empty results.");
    return [];
  };
}
