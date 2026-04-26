---
title: OpenRouter Adapter
summary: Run any model through the OpenRouter API
---

The `openrouter` adapter calls any model available on [OpenRouter](https://openrouter.ai) — Anthropic Claude, OpenAI GPT, Google Gemini, Meta Llama, DeepSeek, Mistral, and hundreds more — through a single unified API.

## When to Use

- You want to route different agents to different model providers without managing separate API keys for each
- You want access to models not available through direct provider adapters (Llama, Mistral, Grok, etc.)
- You want OpenRouter's automatic fallback routing between providers
- You want a single billing account covering all model spend

## When Not to Use

- If the agent needs to execute code or run tools in a local environment (use `claude_local`, `codex_local`, etc.)
- If you need real-time stdout streaming and live run viewing (OpenRouter returns completions, not streamed tool calls)

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string | Yes | OpenRouter API key (`sk-or-...`). Get one at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `model` | string | No | Model id in `provider/model` format (default: `anthropic/claude-sonnet-4-5`) |
| `systemPrompt` | string | No | System prompt override. Defaults to a generated prompt using agent name/id |
| `instructionsFilePath` | string | No | Absolute path to a markdown file used as the system prompt (takes precedence over `systemPrompt`) |
| `maxTokens` | number | No | Max completion tokens (default: 8192) |
| `temperature` | number | No | Sampling temperature 0–1 (default: 0.7) |
| `promptTemplate` | string | No | Run prompt template. Supports `{{agent.id}}`, `{{agent.name}}`, `{{context.wakeReason}}`, `{{context.taskId}}` |
| `siteUrl` | string | No | Your site URL sent as `HTTP-Referer` for OpenRouter usage rankings |
| `siteName` | string | No | Your site name sent as `X-Title` (default: `Bedlam`) |
| `timeoutSec` | number | No | Request timeout in seconds (default: 120) |

## Model Selection

Specify any model available on OpenRouter in `provider/model` format:

```
anthropic/claude-sonnet-4-5
openai/gpt-4.1
google/gemini-2.5-pro
meta-llama/llama-4-maverick
deepseek/deepseek-r2
mistralai/mistral-large
x-ai/grok-3
```

Full model list at [openrouter.ai/models](https://openrouter.ai/models).

## How It Works

1. Bedlam renders the prompt template with agent and context variables
2. If `instructionsFilePath` is set, that file's contents become the system prompt
3. A `POST /chat/completions` request is sent to `openrouter.ai/api/v1` in OpenAI-compatible format
4. The completion is captured and logged as the run output
5. Token usage is recorded and attributed to the `openrouter` biller for cost tracking

## Example Adapter Config

```json
{
  "apiKey": "sk-or-...",
  "model": "anthropic/claude-sonnet-4-5",
  "instructionsFilePath": "/absolute/path/to/AGENTS.md",
  "maxTokens": 4096,
  "temperature": 0.5,
  "siteUrl": "https://yoursite.com"
}
```

## Choosing an OpenRouter Model

Use the three-tier routing philosophy:

| Tier | Examples | Use For |
|------|---------|---------|
| Design | `anthropic/claude-opus-4`, `openai/o3` | Architecture, strategy, complex reasoning |
| Execution | `anthropic/claude-sonnet-4-5`, `openai/gpt-4.1` | Standard task execution, analysis |
| Mechanical | `anthropic/claude-haiku-3-5`, `openai/gpt-4.1-mini` | Formatting, classification, repetitive tasks |
