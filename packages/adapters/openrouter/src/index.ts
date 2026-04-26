export const type = "openrouter";
export const label = "OpenRouter";

/**
 * Static model list covers popular routing targets.
 * The server adapter also calls listModels() to fetch the live
 * OpenRouter /models endpoint when an API key is configured.
 */
export const models = [
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
  { id: "anthropic/claude-haiku-3-5", label: "Claude Haiku 3.5" },
  { id: "openai/gpt-4.1", label: "GPT-4.1" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "openai/o3", label: "o3" },
  { id: "openai/o4-mini", label: "o4-mini" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
  { id: "deepseek/deepseek-r2", label: "DeepSeek R2" },
  { id: "mistralai/mistral-large", label: "Mistral Large" },
  { id: "x-ai/grok-3", label: "Grok 3" },
];

export const agentConfigurationDoc = `# openrouter agent configuration

Adapter: openrouter

Core fields:
- apiKey (string, required): OpenRouter API key (sk-or-...)
- model (string, optional): OpenRouter model id in provider/model format (e.g. "anthropic/claude-sonnet-4-5")
- systemPrompt (string, optional): system prompt override; defaults to agent instructions from AGENTS.md content
- instructionsFilePath (string, optional): absolute path to a markdown file injected as the system prompt
- maxTokens (number, optional): max completion tokens (default: 8192)
- temperature (number, optional): sampling temperature (default: 0.7)
- siteUrl (string, optional): HTTP-Referer header sent to OpenRouter for rankings (your site URL)
- siteName (string, optional): X-Title header sent to OpenRouter
- promptTemplate (string, optional): run prompt template; supports {{agent.id}}, {{agent.name}}, {{context.wakeReason}}
- timeoutSec (number, optional): request timeout in seconds (default: 120)

Notes:
- The adapter calls OpenRouter's OpenAI-compatible chat completions endpoint.
- Token usage and cost are captured from the response and attributed to the "openrouter" biller.
- Model can be any model available on openrouter.ai — the live model list is fetched when an API key is configured.
- If instructionsFilePath is set, that file's contents become the system prompt. Otherwise systemPrompt is used.
`;
