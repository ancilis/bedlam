import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listGeminiSkills,
  syncGeminiSkills,
} from "@bedlam/adapter-gemini-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("gemini local skill sync", () => {
  const bedlamKey = "bedlam/bedlam/bedlam";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured Bedlam skills and installs them into the Gemini skills home", async () => {
    const home = await makeTempDir("bedlam-gemini-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "gemini_local",
      config: {
        env: {
          HOME: home,
        },
        bedlamSkillSync: {
          desiredSkills: [bedlamKey],
        },
      },
    } as const;

    const before = await listGeminiSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(bedlamKey);
    expect(before.entries.find((entry) => entry.key === bedlamKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("missing");

    const after = await syncGeminiSkills(ctx, [bedlamKey]);
    expect(after.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".gemini", "skills", "bedlam"))).isSymbolicLink()).toBe(true);
  });

  it("keeps required bundled Bedlam skills installed even when the desired set is emptied", async () => {
    const home = await makeTempDir("bedlam-gemini-skill-prune-");
    cleanupDirs.add(home);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "gemini_local",
      config: {
        env: {
          HOME: home,
        },
        bedlamSkillSync: {
          desiredSkills: [bedlamKey],
        },
      },
    } as const;

    await syncGeminiSkills(configuredCtx, [bedlamKey]);

    const clearedCtx = {
      ...configuredCtx,
      config: {
        env: {
          HOME: home,
        },
        bedlamSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncGeminiSkills(clearedCtx, []);
    expect(after.desiredSkills).toContain(bedlamKey);
    expect(after.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".gemini", "skills", "bedlam"))).isSymbolicLink()).toBe(true);
  });
});
