import type { UIAdapterModule } from "../types";
import { parseOpenRouterStdoutLine, buildOpenRouterConfig } from "@bedlam/adapter-openrouter/ui";
import { OpenRouterConfigFields } from "./config-fields";

export const openRouterUIAdapter: UIAdapterModule = {
  type: "openrouter",
  label: "OpenRouter",
  parseStdoutLine: (line: string) => {
    const parsed = parseOpenRouterStdoutLine(line);
    if (!parsed) return null;
    return parsed.type === "output" ? { type: "message", text: parsed.text } : null;
  },
  ConfigFields: OpenRouterConfigFields,
  buildAdapterConfig: buildOpenRouterConfig,
};
