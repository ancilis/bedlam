import type { UIAdapterModule } from "../types";
import { parseOpenRouterStdoutLine, buildOpenRouterConfig } from "@bedlam/adapter-openrouter/ui";
import { OpenRouterConfigFields } from "./config-fields";

export const openRouterUIAdapter: UIAdapterModule = {
  type: "openrouter",
  label: "OpenRouter",
  parseStdoutLine: (line: string, ts: string) => {
    const parsed = parseOpenRouterStdoutLine(line);
    if (!parsed) return [];
    if (parsed.type === "output") return [{ kind: "assistant", ts, text: parsed.text }];
    if (parsed.type === "error") return [{ kind: "stderr", ts, text: parsed.text }];
    return [{ kind: "system", ts, text: parsed.text }];
  },
  ConfigFields: OpenRouterConfigFields,
  buildAdapterConfig: buildOpenRouterConfig,
};
