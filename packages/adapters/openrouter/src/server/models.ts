import type { AdapterModel } from "@bedlam/adapter-utils";
import { asString } from "@bedlam/adapter-utils/server-utils";
import { models as staticModels } from "../index.js";

interface OpenRouterModelEntry {
  id?: string;
  name?: string;
  description?: string;
}

/**
 * Fetch the live model list from OpenRouter.
 * Falls back to the static list if the key is absent or the request fails.
 */
export async function listOpenRouterModels(
  config: Record<string, unknown>,
): Promise<AdapterModel[]> {
  const apiKey = asString(config.apiKey, "").trim();
  if (!apiKey) return staticModels;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return staticModels;

    const data = (await response.json()) as { data?: OpenRouterModelEntry[] };
    const entries = data?.data;
    if (!Array.isArray(entries) || entries.length === 0) return staticModels;

    return entries
      .filter((m): m is OpenRouterModelEntry & { id: string } => typeof m.id === "string")
      .map((m) => ({
        id: m.id,
        label: typeof m.name === "string" && m.name.length > 0 ? m.name : m.id,
      }));
  } catch {
    return staticModels;
  }
}
