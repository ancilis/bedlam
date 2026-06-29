import { describe, expect, it } from "vitest";
import { openRouterUIAdapter } from "./index";

describe("openRouterUIAdapter", () => {
  it("parses OpenRouter output lines into transcript entry arrays", () => {
    expect(openRouterUIAdapter.parseStdoutLine("hello from openrouter", "2026-06-29T00:00:00.000Z")).toEqual([
      {
        kind: "assistant",
        ts: "2026-06-29T00:00:00.000Z",
        text: "hello from openrouter",
      },
    ]);
  });

  it("parses OpenRouter diagnostic lines as system transcript entries", () => {
    expect(openRouterUIAdapter.parseStdoutLine("[openrouter] using model", "2026-06-29T00:00:00.000Z")).toEqual([
      {
        kind: "system",
        ts: "2026-06-29T00:00:00.000Z",
        text: "using model",
      },
    ]);
  });

  it("ignores blank OpenRouter output lines", () => {
    expect(openRouterUIAdapter.parseStdoutLine("   ", "2026-06-29T00:00:00.000Z")).toEqual([]);
  });
});
