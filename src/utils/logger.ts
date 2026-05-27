let debugLogEnabled = false;

export function setDebugLogEnabled(enabled: boolean): void {
  debugLogEnabled = enabled;
}

export function isDebugLogEnabled(): boolean {
  return debugLogEnabled;
}

function prefix(scope?: string | string[]): string {
  if (!scope) return "[Sketch Note]";
  const scopes = Array.isArray(scope) ? scope : [scope];
  return `[Sketch Note]${scopes.map(item => `[${item}]`).join("")}`;
}

export function createLogger(scope?: string | string[]) {
  const messagePrefix = prefix(scope);

  return {
    info(...args: unknown[]) {
      if (debugLogEnabled) {
        console.info(messagePrefix, ...args);
      }
    },
    warn(...args: unknown[]) {
      if (debugLogEnabled) {
        console.warn(messagePrefix, ...args);
      }
    },
    error(...args: unknown[]) {
      console.error(messagePrefix, ...args);
    },
  };
}
