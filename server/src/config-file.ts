import fs from "node:fs";
import { bedlamConfigSchema, type BedlamConfig } from "@bedlam/shared";
import { resolveBedlamConfigPath } from "./paths.js";

export function readConfigFile(): BedlamConfig | null {
  const configPath = resolveBedlamConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return bedlamConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
