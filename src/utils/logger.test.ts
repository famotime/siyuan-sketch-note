import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger, setDebugLogEnabled } from "./logger";

describe("logger", () => {
  afterEach(() => {
    setDebugLogEnabled(false);
    vi.restoreAllMocks();
  });

  it("does not print debug logs by default", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger("Test");

    logger.info("hidden");

    expect(info).not.toHaveBeenCalled();
  });

  it("prints debug logs after debug logging is enabled", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger("Test");

    setDebugLogEnabled(true);
    logger.info("visible");

    expect(info).toHaveBeenCalledWith("[Sketch Note][Test]", "visible");
  });

  it("always prints errors", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("Test");

    logger.error("failure");

    expect(error).toHaveBeenCalledWith("[Sketch Note][Test]", "failure");
  });
});
