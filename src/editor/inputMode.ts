import type { StabilizerMode, StabilizerOptions } from "@/engine/stabilizer/springMassStabilizer";
import { DEFAULT_STABILIZER_OPTIONS } from "@/engine/stabilizer/springMassStabilizer";

export interface SketchInputSettings {
  stylusOnly: boolean;
  enablePressure?: boolean;
  stabilizerMode?: StabilizerMode;
  stabilizerOptions?: StabilizerOptions;
  predictiveTracking?: boolean;
  enableHoldToShape?: boolean;
  holdToShapeDelayMs?: number;
}

export function createDefaultInputSettings(): SketchInputSettings {
  return {
    stylusOnly: false,
    enablePressure: false,
    stabilizerMode: "smooth",
    stabilizerOptions: DEFAULT_STABILIZER_OPTIONS.smooth,
    predictiveTracking: true,
    enableHoldToShape: false,
    holdToShapeDelayMs: 750,
  };
}

export function normalizeInputSettings(input?: Partial<SketchInputSettings> | null): SketchInputSettings {
  const mode = input?.stabilizerMode ?? "smooth";
  return {
    ...createDefaultInputSettings(),
    ...input,
    stabilizerMode: mode,
    stabilizerOptions: input?.stabilizerOptions ?? DEFAULT_STABILIZER_OPTIONS[mode] ?? DEFAULT_STABILIZER_OPTIONS.smooth,
    predictiveTracking: input?.predictiveTracking ?? true,
    enableHoldToShape: input?.enableHoldToShape ?? false,
    holdToShapeDelayMs: input?.holdToShapeDelayMs ?? 750,
  };
}

export function shouldDrawFromPointer(event: Pick<PointerEvent, "pointerType">, settings: SketchInputSettings): boolean {
  if (!settings.stylusOnly) return true;
  return event.pointerType !== "touch";
}

