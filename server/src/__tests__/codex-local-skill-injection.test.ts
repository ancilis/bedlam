import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexSkillsInjected } from "@bedlam/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createBedlamRepoSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "server"), { recursive: true });
  await fs.mkdir(path.join(root, "packages", "adapter-utils"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", skillName), { recursive: true });
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  await fs.writeFile(path.join(root, "package.json"), '{"name":"bedlam"}\n', "utf8");
  await fs.writeFile(
    path.join(root, "skills", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

async function createCustomSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "custom", skillName), { recursive: true });
  await fs.writeFile(
    path.join(root, "custom", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

describe("codex local adapter skill injection", () => {
  const bedlamKey = "bedlam/bedlam/bedlam";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("repairs a Codex Bedlam skill symlink that still points at another live checkout", async () => {
    const currentRepo = await makeTempDir("bedlam-codex-current-");
    const oldRepo = await makeTempDir("bedlam-codex-old-");
    const skillsHome = await makeTempDir("bedlam-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createBedlamRepoSkill(currentRepo, "bedlam");
    await createBedlamRepoSkill(oldRepo, "bedlam");
    await fs.symlink(path.join(oldRepo, "skills", "bedlam"), path.join(skillsHome, "bedlam"));

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: bedlamKey,
          runtimeName: "bedlam",
          source: path.join(currentRepo, "skills", "bedlam"),
        }],
      },
    );

    expect(await fs.realpath(path.join(skillsHome, "bedlam"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "bedlam")),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Repaired Codex skill "bedlam"'),
      }),
    );
  });

  it("preserves a custom Codex skill symlink outside Bedlam repo checkouts", async () => {
    const currentRepo = await makeTempDir("bedlam-codex-current-");
    const customRoot = await makeTempDir("bedlam-codex-custom-");
    const skillsHome = await makeTempDir("bedlam-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(customRoot);
    cleanupDirs.add(skillsHome);

    await createBedlamRepoSkill(currentRepo, "bedlam");
    await createCustomSkill(customRoot, "bedlam");
    await fs.symlink(path.join(customRoot, "custom", "bedlam"), path.join(skillsHome, "bedlam"));

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: bedlamKey,
        runtimeName: "bedlam",
        source: path.join(currentRepo, "skills", "bedlam"),
      }],
    });

    expect(await fs.realpath(path.join(skillsHome, "bedlam"))).toBe(
      await fs.realpath(path.join(customRoot, "custom", "bedlam")),
    );
  });

  it("prunes broken symlinks for unavailable Bedlam repo skills before Codex starts", async () => {
    const currentRepo = await makeTempDir("bedlam-codex-current-");
    const oldRepo = await makeTempDir("bedlam-codex-old-");
    const skillsHome = await makeTempDir("bedlam-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createBedlamRepoSkill(currentRepo, "bedlam");
    await createBedlamRepoSkill(oldRepo, "agent-browser");
    const staleTarget = path.join(oldRepo, "skills", "agent-browser");
    await fs.symlink(staleTarget, path.join(skillsHome, "agent-browser"));
    await fs.rm(staleTarget, { recursive: true, force: true });

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: bedlamKey,
          runtimeName: "bedlam",
          source: path.join(currentRepo, "skills", "bedlam"),
        }],
      },
    );

    await expect(fs.lstat(path.join(skillsHome, "agent-browser"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Removed stale Codex skill "agent-browser"'),
      }),
    );
  });

  it("preserves other live Bedlam skill symlinks in the shared workspace skill directory", async () => {
    const currentRepo = await makeTempDir("bedlam-codex-current-");
    const skillsHome = await makeTempDir("bedlam-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(skillsHome);

    await createBedlamRepoSkill(currentRepo, "bedlam");
    await createBedlamRepoSkill(currentRepo, "agent-browser");
    await fs.symlink(
      path.join(currentRepo, "skills", "agent-browser"),
      path.join(skillsHome, "agent-browser"),
    );

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: bedlamKey,
        runtimeName: "bedlam",
        source: path.join(currentRepo, "skills", "bedlam"),
      }],
    });

    expect((await fs.lstat(path.join(skillsHome, "bedlam"))).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(path.join(skillsHome, "agent-browser"))).isSymbolicLink()).toBe(true);
    expect(await fs.realpath(path.join(skillsHome, "agent-browser"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "agent-browser")),
    );
  });
});
