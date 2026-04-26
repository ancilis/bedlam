import fs from "node:fs/promises";
import {
  type AdapterExecutionContext,
  type AdapterExecutionResult,
} from "@bedlam/adapter-utils";
import {
  asString,
  asNumber,
  asBoolean,
  parseObject,
  renderTemplate,
  joinPromptSections,
} from "@bedlam/adapter-utils/server-utils";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4-5";
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_SEC = 120;

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenRouterChoice {
  message?: { content?: string | null };
  finish_reason?: string;
}

interface OpenRouterResponse {
  id?: string;
  model?: string;
  choices?: OpenRouterChoice[];
  usage?: OpenRouterUsage;
  error?: { message?: string; code?: number };
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;

  // Config extraction
  const apiKey = asString(config.apiKey, "").trim();
  const model = asString(config.model, DEFAULT_MODEL);
  const maxTokens = asNumber(config.maxTokens, DEFAULT_MAX_TOKENS);
  const temperature = asNumber(config.temperature, DEFAULT_TEMPERATURE);
  const timeoutSec = asNumber(config.timeoutSec, DEFAULT_TIMEOUT_SEC);
  const siteUrl = asString(config.siteUrl, "");
  const siteName = asString(config.siteName, "Bedlam");
  const instructionsFilePath = asString(config.instructionsFilePath, "").trim();
  const configuredSystemPrompt = asString(config.systemPrompt, "").trim();
  const promptTemplate = asString(
    config.promptTemplate,
    "You are agent {{agent.name}} (id: {{agent.id}}). Continue your Bedlam work.\n\nWake reason: {{context.wakeReason}}\nTask: {{context.taskId}}",
  );

  if (!apiKey) {
    await onLog("stderr", "[openrouter] No API key configured. Set apiKey in adapter config.\n");
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "OpenRouter API key not configured",
      errorCode: "missing_api_key",
    };
  }

  // Build system prompt
  let systemPrompt = configuredSystemPrompt;
  if (!systemPrompt && instructionsFilePath) {
    try {
      systemPrompt = (await fs.readFile(instructionsFilePath, "utf8")).trim();
      await onLog("stdout", `[openrouter] Loaded system prompt from ${instructionsFilePath}\n`);
    } catch (err) {
      await onLog(
        "stderr",
        `[openrouter] Failed to read instructionsFilePath "${instructionsFilePath}": ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
  if (!systemPrompt) {
    systemPrompt = `You are ${agent.name} (agent id: ${agent.id}), an AI agent operating within a Bedlam agent company. Complete your assigned work thoughtfully and report your results clearly.`;
  }

  // Build user prompt from template + context
  const wakeReason = asString(context.wakeReason, "");
  const taskId =
    asString(context.taskId, "") || asString(context.issueId, "");
  const commentBody = asString(context.commentBody, "");

  const templateData = {
    agent: { id: agent.id, name: agent.name },
    context: { wakeReason, taskId, commentBody },
    runId,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const userPrompt = joinPromptSections([
    renderedPrompt,
    commentBody ? `Latest comment:\n${commentBody}` : null,
  ]);

  await onLog("stdout", `[openrouter] model=${model} maxTokens=${maxTokens}\n`);

  await onMeta?.({
    adapterType: "openrouter",
    command: "https://openrouter.ai/api/v1/chat/completions",
    prompt: userPrompt.slice(0, 500),
    context: { model, wakeReason, taskId },
  });

  // Build request
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Title": siteName || "Bedlam",
  };
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;

  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  });

  // Execute with timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  let timedOut = false;
  let responseText = "";

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    responseText = await response.text();

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errBody = JSON.parse(responseText) as OpenRouterResponse;
        if (errBody.error?.message) errorMsg = errBody.error.message;
      } catch {
        // use status text
      }
      await onLog("stderr", `[openrouter] Request failed: ${errorMsg}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: errorMsg,
        errorCode: `http_${response.status}`,
        biller: "openrouter",
        model,
      };
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      timedOut = true;
      await onLog("stderr", `[openrouter] Request timed out after ${timeoutSec}s\n`);
      return { exitCode: null, signal: null, timedOut: true, biller: "openrouter", model };
    }
    const msg = err instanceof Error ? err.message : String(err);
    await onLog("stderr", `[openrouter] Request error: ${msg}\n`);
    return { exitCode: 1, signal: null, timedOut: false, errorMessage: msg, biller: "openrouter", model };
  } finally {
    clearTimeout(timer);
  }

  // Parse response
  let parsed: OpenRouterResponse;
  try {
    parsed = JSON.parse(responseText) as OpenRouterResponse;
  } catch {
    await onLog("stderr", "[openrouter] Failed to parse response JSON\n");
    return { exitCode: 1, signal: null, timedOut: false, errorMessage: "Invalid JSON response", biller: "openrouter", model };
  }

  const content = parsed.choices?.[0]?.message?.content ?? "";
  const finishReason = parsed.choices?.[0]?.finish_reason ?? "unknown";
  const resolvedModel = parsed.model ?? model;
  const usage = parsed.usage;

  if (content) {
    await onLog("stdout", `${content}\n`);
  }

  await onLog(
    "stdout",
    `[openrouter] finish_reason=${finishReason} model=${resolvedModel} in=${usage?.prompt_tokens ?? 0} out=${usage?.completion_tokens ?? 0}\n`,
  );

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    summary: content.slice(0, 1000) || undefined,
    biller: "openrouter",
    provider: "openrouter",
    model: resolvedModel,
    billingType: "api",
    usage: usage
      ? {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
        }
      : undefined,
  };
}
