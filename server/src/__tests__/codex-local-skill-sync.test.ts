import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCodexSkills,
  syncCodexSkills,
} from "@bedlam/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("codex local skill sync", () => {
  const bedlamKey = "bedlam/bedlam/bedlam";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured Bedlam skills for workspace injection on the next run", async () => {
    const codexHome = await makeTempDir("bedlam-codex-skill-sync-");
    cleanupDirs.add(codexHome);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        bedlamSkillSync: {
          desiredSkills: [bedlamKey],
        },
      },
    } as const;

    const before = await listCodexSkills(ctx);
    expect(before.mode).toBe("ephemeral");
    expect(before.desiredSkills).toContain(bedlamKey);
    expect(before.entries.find((entry) => entry.key === bedlamKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("configured");
    expect(before.entries.find((entry) => entry.key === bedlamKey)?.detail).toContain("CODEX_HOME/skills/");
  });

  it("does not persist Bedlam skills into CODEX_HOME during sync", async () => {
    const codexHome = await makeTempDir("bedlam-codex-skill-prune-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        bedlamSkillSync: {
          desiredSkills: [bedlamKey],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, [bedlamKey]);
    expect(after.mode).toBe("ephemeral");
    expect(after.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("configured");
    await expect(fs.lstat(path.join(codexHome, "skills", "bedlam"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps required bundled Bedlam skills configured even when the desired set is emptied", async () => {
    const codexHome = await makeTempDir("bedlam-codex-skill-required-");
    cleanupDirs.add(codexHome);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        bedlamSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncCodexSkills(configuredCtx, []);
    expect(after.desiredSkills).toContain(bedlamKey);
    expect(after.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("configured");
  });

  it("normalizes legacy flat Bedlam skill refs before reporting configured state", async () => {
    const codexHome = await makeTempDir("bedlam-codex-legacy-skill-sync-");
    cleanupDirs.add(codexHome);

    const snapshot = await listCodexSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "codex_local",
      config: {
        env: {
          CODEX_HOME: codexHome,
        },
        bedlamSkillSync: {
          desiredSkills: ["bedlam"],
        },
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(bedlamKey);
    expect(snapshot.desiredSkills).not.toContain("bedlam");
    expect(snapshot.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === "bedlam")).toBeUndefined();
  });
});
