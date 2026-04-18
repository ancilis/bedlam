import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath } from "./home-paths.js";

const BEDLAM_CONFIG_BASENAME = "config.json";
const BEDLAM_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    const candidate = path.resolve(currentDir, ".bedlam", BEDLAM_CONFIG_BASENAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveBedlamConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.BEDLAM_CONFIG) return path.resolve(process.env.BEDLAM_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolveBedlamEnvPath(overrideConfigPath?: string): string {
  return path.resolve(path.dirname(resolveBedlamConfigPath(overrideConfigPath)), BEDLAM_ENV_FILENAME);
}
