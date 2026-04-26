import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@bedlam/adapter-utils";
import { asString } from "@bedlam/adapter-utils/server-utils";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const apiKey = asString((ctx.config as Record<string, unknown>).apiKey, "").trim();

  if (!apiKey) {
    return {
      adapterType: "openrouter",
      status: "fail",
      testedAt: new Date().toISOString(),
      checks: [
        {
          code: "missing_api_key",
          level: "error",
          message: "OpenRouter API key not configured",
          hint: "Set apiKey in adapter config. Get a key at https://openrouter.ai/keys",
        },
      ],
    };
  }

  // Validate key by calling /auth/key
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/auth/key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 401) {
      return {
        adapterType: "openrouter",
        status: "fail",
        testedAt: new Date().toISOString(),
        checks: [
          {
            code: "invalid_api_key",
            level: "error",
            message: "OpenRouter API key is invalid or expired",
            hint: "Check your key at https://openrouter.ai/keys",
          },
        ],
      };
    }

    if (!response.ok) {
      return {
        adapterType: "openrouter",
        status: "warn",
        testedAt: new Date().toISOString(),
        checks: [
          {
            code: "key_check_failed",
            level: "warn",
            message: `OpenRouter key check returned HTTP ${response.status}`,
            hint: "Key may still be valid — check openrouter.ai if agents fail to run",
          },
        ],
      };
    }

    return {
      adapterType: "openrouter",
      status: "pass",
      testedAt: new Date().toISOString(),
      checks: [
        {
          code: "api_key_valid",
          level: "info",
          message: "OpenRouter API key validated successfully",
        },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      adapterType: "openrouter",
      status: "warn",
      testedAt: new Date().toISOString(),
      checks: [
        {
          code: "network_error",
          level: "warn",
          message: `Could not reach OpenRouter to validate key: ${msg}`,
          hint: "Check network connectivity to openrouter.ai",
        },
      ],
    };
  }
}
