import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCursorSkills,
  syncCursorSkills,
} from "@bedlam/adapter-cursor-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("cursor local skill sync", () => {
  const bedlamKey = "bedlam/bedlam/bedlam";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured Bedlam skills and installs them into the Cursor skills home", async () => {
    const home = await makeTempDir("bedlam-cursor-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        bedlamSkillSync: {
          desiredSkills: [bedlamKey],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(bedlamKey);
    expect(before.entries.find((entry) => entry.key === bedlamKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, [bedlamKey]);
    expect(after.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "bedlam"))).isSymbolicLink()).toBe(true);
  });

  it("recognizes company-library runtime skills supplied outside the bundled Bedlam directory", async () => {
    const home = await makeTempDir("bedlam-cursor-runtime-skills-home-");
    const runtimeSkills = await makeTempDir("bedlam-cursor-runtime-skills-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);

    const bedlamDir = await createSkillDir(runtimeSkills, "bedlam");
    const asciiHeartDir = await createSkillDir(runtimeSkills, "ascii-heart");

    const ctx = {
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        bedlamRuntimeSkills: [
          {
            key: "bedlam",
            runtimeName: "bedlam",
            source: bedlamDir,
            required: true,
            requiredReason: "Bundled Bedlam skills are always available for local adapters.",
          },
          {
            key: "ascii-heart",
            runtimeName: "ascii-heart",
            source: asciiHeartDir,
          },
        ],
        bedlamSkillSync: {
          desiredSkills: ["ascii-heart"],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.warnings).toEqual([]);
    expect(before.desiredSkills).toEqual(["bedlam", "ascii-heart"]);
    expect(before.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, ["ascii-heart"]);
    expect(after.warnings).toEqual([]);
    expect(after.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "ascii-heart"))).isSymbolicLink()).toBe(true);
  });

  it("keeps required bundled Bedlam skills installed even when the desired set is emptied", async () => {
    const home = await makeTempDir("bedlam-cursor-skill-prune-");
    cleanupDirs.add(home);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        bedlamSkillSync: {
          desiredSkills: [bedlamKey],
        },
      },
    } as const;

    await syncCursorSkills(configuredCtx, [bedlamKey]);

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

    const after = await syncCursorSkills(clearedCtx, []);
    expect(after.desiredSkills).toContain(bedlamKey);
    expect(after.entries.find((entry) => entry.key === bedlamKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "bedlam"))).isSymbolicLink()).toBe(true);
  });
});
