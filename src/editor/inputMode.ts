export interface SketchInputSettings {
  stylusOnly: boolean;
  enablePressure?: boolean;
}

export function createDefaultInputSettings(): SketchInputSettings {
  return {
    stylusOnly: false,
    enablePressure: false,
  };
}

export function normalizeInputSettings(input?: Partial<SketchInputSettings> | null): SketchInputSettings {
  return {
    ...createDefaultInputSettings(),
    ...input,
  };
}

export function shouldDrawFromPointer(event: Pick<PointerEvent, "pointerType">, settings: SketchInputSettings): boolean {
  if (!settings.stylusOnly) return true;
  return event.pointerType !== "touch";
}
