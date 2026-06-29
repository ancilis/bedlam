import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Bedlam positioning and lineage", () => {
  it("leads README and package metadata with Bedlam-first positioning", () => {
    const readme = read("README.md");
    const intro = readme.split("\n").slice(0, 12).join("\n");
    const rootPackage = JSON.parse(read("package.json")) as { description?: string };

    expect(intro).toContain("local-first company AI control plane");
    expect(intro).not.toMatch(/modified fork of Paperclip/i);
    expect(rootPackage.description).toContain("local-first company AI control plane");
  });

  it("preserves Paperclip lineage and license attribution outside the intro", () => {
    const readme = read("README.md");
    const lineage = read("docs/lineage.md");
    const license = read("LICENSE");
    const notice = read("NOTICE");

    expect(readme).toContain("## Lineage / Attribution");
    expect(readme).toContain("Bedlam began as a fork of [Paperclip]");
    expect(lineage).toContain("Bedlam began as a fork of [Paperclip]");
    expect(lineage).toContain("upstream Paperclip remain under the original MIT License");
    expect(license).toContain("MIT License");
    expect(notice).toContain("Paperclip");
  });

  it("does not leave Bedlam workspace packages declaring only MIT", () => {
    const packagePaths = [
      "packages/adapter-utils/package.json",
      "packages/adapters/claude-local/package.json",
      "packages/adapters/codex-local/package.json",
      "packages/adapters/cursor-local/package.json",
      "packages/adapters/gemini-local/package.json",
      "packages/adapters/openclaw-gateway/package.json",
      "packages/adapters/opencode-local/package.json",
      "packages/adapters/pi-local/package.json",
      "packages/db/package.json",
      "packages/plugins/create-bedlam-plugin/package.json",
      "packages/plugins/sdk/package.json",
      "packages/shared/package.json",
      "server/package.json",
      "ui/package.json",
    ];

    for (const packagePath of packagePaths) {
      const pkg = JSON.parse(read(packagePath)) as { name: string; license?: string };
      expect(pkg.license, `${pkg.name} license`).not.toBe("MIT");
    }
  });
});
