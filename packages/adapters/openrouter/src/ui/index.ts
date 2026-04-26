/**
 * Parse OpenRouter stdout lines into transcript entries for the run viewer.
 * OpenRouter returns plain text completions, so lines are treated as agent
 * output unless they carry the [openrouter] diagnostic prefix.
 */
export function parseOpenRouterStdoutLine(line: string): {
  type: "output" | "meta" | "error";
  text: string;
} | null {
  if (!line.trim()) return null;
  if (line.startsWith("[openrouter] ")) {
    return { type: "meta", text: line.slice("[openrouter] ".length) };
  }
  return { type: "output", text: line };
}

/**
 * Build adapter config JSON from create-agent form values.
 */
export function buildOpenRouterConfig(values: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (values.apiKey) config.apiKey = values.apiKey;
  if (values.model) config.model = values.model;
  if (values.systemPrompt) config.systemPrompt = values.systemPrompt;
  if (values.instructionsFilePath) config.instructionsFilePath = values.instructionsFilePath;
  if (values.maxTokens) config.maxTokens = Number(values.maxTokens);
  if (values.temperature !== undefined && values.temperature !== "") {
    config.temperature = Number(values.temperature);
  }
  if (values.siteUrl) config.siteUrl = values.siteUrl;
  if (values.siteName) config.siteName = values.siteName;
  return config;
}
