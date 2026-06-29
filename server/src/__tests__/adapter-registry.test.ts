import { describe, expect, it } from "vitest";
import { getServerAdapter } from "../adapters/registry.ts";

describe("server adapter registry", () => {
  it("throws for unknown adapter types instead of falling back to process", () => {
    expect(() => getServerAdapter("missing_adapter_type")).toThrow(/Unknown adapter type: missing_adapter_type/);
  });
});
