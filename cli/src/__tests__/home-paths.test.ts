import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveBedlamHomeDir,
  resolveBedlamInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.bedlam and default instance", () => {
    delete process.env.BEDLAM_HOME;
    delete process.env.BEDLAM_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".bedlam"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".bedlam", "instances", "default", "config.json"));
  });

  it("supports BEDLAM_HOME and explicit instance ids", () => {
    process.env.BEDLAM_HOME = "~/bedlam-home";

    const home = resolveBedlamHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "bedlam-home"));
    expect(resolveBedlamInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveBedlamInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
