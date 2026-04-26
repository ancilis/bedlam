import type { AdapterConfigFieldsProps } from "../types";
import { Field, DraftInput, help } from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

const apiKeyHint =
  "OpenRouter API key (sk-or-...). Get one at openrouter.ai/keys. Stored in adapter config — use a Bedlam secret for production.";
const modelHint =
  "OpenRouter model id in provider/model format, e.g. anthropic/claude-sonnet-4-5. Leave blank to use the default. Full list at openrouter.ai/models.";
const systemPromptHint =
  "System prompt for this agent. If blank, a default is generated from the agent name. Use instructionsFilePath to load from a file instead.";
const instructionsFileHint =
  "Absolute path to a markdown file (e.g. AGENTS.md) used as the system prompt. Takes precedence over the system prompt field above.";
const maxTokensHint = "Maximum completion tokens (default: 8192).";
const temperatureHint = "Sampling temperature 0–1 (default: 0.7). Lower = more deterministic.";
const siteUrlHint = "Your site URL sent as HTTP-Referer to OpenRouter for usage rankings (optional).";

export function OpenRouterConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="API key" hint={apiKeyHint}>
        <DraftInput
          value={isCreate ? values!.apiKey ?? "" : eff("adapterConfig", "apiKey", String(config.apiKey ?? ""))}
          onCommit={(v) => isCreate ? set!({ apiKey: v }) : mark("adapterConfig", "apiKey", v || undefined)}
          immediate
          className={inputClass}
          placeholder="sk-or-..."
          type="password"
        />
      </Field>
      <Field label="Model" hint={modelHint}>
        <DraftInput
          value={isCreate ? values!.model ?? "" : eff("adapterConfig", "model", String(config.model ?? ""))}
          onCommit={(v) => isCreate ? set!({ model: v }) : mark("adapterConfig", "model", v || undefined)}
          immediate
          className={inputClass}
          placeholder="anthropic/claude-sonnet-4-5"
        />
      </Field>
      <Field label="System prompt" hint={systemPromptHint}>
        <DraftInput
          value={isCreate ? values!.systemPrompt ?? "" : eff("adapterConfig", "systemPrompt", String(config.systemPrompt ?? ""))}
          onCommit={(v) => isCreate ? set!({ systemPrompt: v }) : mark("adapterConfig", "systemPrompt", v || undefined)}
          immediate
          className={inputClass}
          placeholder="You are a helpful agent..."
        />
      </Field>
      <Field label="Instructions file path" hint={instructionsFileHint}>
        <DraftInput
          value={isCreate ? values!.instructionsFilePath ?? "" : eff("adapterConfig", "instructionsFilePath", String(config.instructionsFilePath ?? ""))}
          onCommit={(v) => isCreate ? set!({ instructionsFilePath: v }) : mark("adapterConfig", "instructionsFilePath", v || undefined)}
          immediate
          className={inputClass}
          placeholder="/absolute/path/to/AGENTS.md"
        />
      </Field>
      <Field label="Max tokens" hint={maxTokensHint}>
        <DraftInput
          value={isCreate ? values!.maxTokens ?? "" : eff("adapterConfig", "maxTokens", String(config.maxTokens ?? ""))}
          onCommit={(v) => isCreate ? set!({ maxTokens: v ? Number(v) : undefined }) : mark("adapterConfig", "maxTokens", v ? Number(v) : undefined)}
          immediate
          className={inputClass}
          placeholder="8192"
        />
      </Field>
      <Field label="Temperature" hint={temperatureHint}>
        <DraftInput
          value={isCreate ? values!.temperature ?? "" : eff("adapterConfig", "temperature", String(config.temperature ?? ""))}
          onCommit={(v) => isCreate ? set!({ temperature: v ? Number(v) : undefined }) : mark("adapterConfig", "temperature", v ? Number(v) : undefined)}
          immediate
          className={inputClass}
          placeholder="0.7"
        />
      </Field>
      <Field label="Site URL (optional)" hint={siteUrlHint}>
        <DraftInput
          value={isCreate ? values!.siteUrl ?? "" : eff("adapterConfig", "siteUrl", String(config.siteUrl ?? ""))}
          onCommit={(v) => isCreate ? set!({ siteUrl: v }) : mark("adapterConfig", "siteUrl", v || undefined)}
          immediate
          className={inputClass}
          placeholder="https://yoursite.com"
        />
      </Field>
    </>
  );
}
