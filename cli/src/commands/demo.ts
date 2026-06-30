import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createServer } from "node:net";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  applyPendingMigrations,
  createDb,
  createEmbeddedPostgresLogBuffer,
  ensurePostgresDatabase,
  formatEmbeddedPostgresError,
} from "@bedlam/db";
import { seedAiEngineeringCompanyDemo } from "@bedlam/server";
import { ensureAgentJwtSecret, loadBedlamEnvFile, resolveAgentJwtEnvFile } from "../config/env.js";
import type { BedlamConfig } from "../config/schema.js";
import { ensureLocalSecretsKeyFile } from "../config/secrets-key.js";
import { configExists, readConfig, resolveConfigPath, writeConfig } from "../config/store.js";
import { resolveRuntimeLikePath } from "../utils/path-resolver.js";
import { quickstartDefaultsFromEnv } from "./onboard.js";

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

type EmbeddedPostgresHandle = {
  port: number;
  startedByThisProcess: boolean;
  stop: () => Promise<void>;
};

export type DemoAiEngineeringOptions = {
  config?: string;
  yes?: boolean;
};

function readPidFilePort(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const port = Number(readFileSync(postmasterPidFile, "utf8").split("\n")[3]?.trim());
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

function readRunningPostmasterPid(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const pid = Number(readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim());
    if (!Number.isInteger(pid) || pid <= 0) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(preferredPort: number): Promise<number> {
  let port = Math.max(1, Math.trunc(preferredPort));
  while (!(await isPortAvailable(port))) {
    port += 1;
  }
  return port;
}

async function ensureEmbeddedPostgres(dataDir: string, preferredPort: number): Promise<EmbeddedPostgresHandle> {
  let EmbeddedPostgres: EmbeddedPostgresCtor;
  try {
    const mod = await import("embedded-postgres");
    EmbeddedPostgres = mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "Embedded PostgreSQL support requires dependency `embedded-postgres`. Reinstall dependencies and try again.",
    );
  }

  const postmasterPidFile = path.resolve(dataDir, "postmaster.pid");
  const runningPid = readRunningPostmasterPid(postmasterPidFile);
  if (runningPid) {
    return {
      port: readPidFilePort(postmasterPidFile) ?? preferredPort,
      startedByThisProcess: false,
      stop: async () => {},
    };
  }

  const port = await findAvailablePort(preferredPort);
  const logBuffer = createEmbeddedPostgresLogBuffer();
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "bedlam",
    password: "bedlam",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: logBuffer.append,
    onError: logBuffer.append,
  });

  if (!existsSync(path.resolve(dataDir, "PG_VERSION"))) {
    try {
      await instance.initialise();
    } catch (error) {
      throw formatEmbeddedPostgresError(error, {
        fallbackMessage: `Failed to initialize embedded PostgreSQL cluster in ${dataDir} on port ${port}`,
        recentLogs: logBuffer.getRecentLogs(),
      });
    }
  }

  if (existsSync(postmasterPidFile)) {
    rmSync(postmasterPidFile, { force: true });
  }

  try {
    await instance.start();
  } catch (error) {
    throw formatEmbeddedPostgresError(error, {
      fallbackMessage: `Failed to start embedded PostgreSQL on port ${port}`,
      recentLogs: logBuffer.getRecentLogs(),
    });
  }

  return {
    port,
    startedByThisProcess: true,
    stop: async () => {
      await instance.stop();
    },
  };
}

async function resolveDemoDb(configPath: string) {
  const config = readConfig(configPath);
  if (!config) {
    throw new Error(`No config found at ${configPath}. Run ${pc.cyan("bedlam onboard")} first.`);
  }

  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) {
    return { dbUrl: envUrl, stop: async () => {} };
  }

  if (config.database.mode === "postgres") {
    const dbUrl = config.database.connectionString?.trim();
    if (!dbUrl) {
      throw new Error("Config uses postgres mode but has no database connection string.");
    }
    return { dbUrl, stop: async () => {} };
  }

  const dataDir = resolveRuntimeLikePath(config.database.embeddedPostgresDataDir, configPath);
  const preferredPort = config.database.embeddedPostgresPort ?? 54329;
  const handle = await ensureEmbeddedPostgres(dataDir, preferredPort);
  const adminUrl = `postgres://bedlam:bedlam@127.0.0.1:${handle.port}/postgres`;
  await ensurePostgresDatabase(adminUrl, "bedlam");
  return {
    dbUrl: `postgres://bedlam:bedlam@127.0.0.1:${handle.port}/bedlam`,
    stop: async () => {
      if (handle.startedByThisProcess) await handle.stop();
    },
  };
}

async function ensureDemoConfig(configPath: string, opts: DemoAiEngineeringOptions): Promise<boolean> {
  if (configExists(configPath)) return false;

  let shouldCreate = opts.yes === true;
  if (!shouldCreate && process.stdin.isTTY && process.stdout.isTTY) {
    const answer = await p.confirm({
      message: "No Bedlam config exists. Create a local quickstart config for the demo?",
      initialValue: true,
    });
    if (p.isCancel(answer)) {
      p.cancel("Demo setup cancelled.");
      process.exit(0);
    }
    shouldCreate = answer === true;
  }

  if (!shouldCreate) {
    throw new Error(`No config found at ${configPath}. Run ${pc.cyan("bedlam onboard")} first or pass ${pc.cyan("--yes")}.`);
  }

  const { defaults, usedEnvKeys, ignoredEnvKeys } = quickstartDefaultsFromEnv();
  const config: BedlamConfig = {
    $meta: {
      version: 1,
      updatedAt: new Date().toISOString(),
      source: "onboard",
    },
    ...defaults,
  };

  const jwtSecret = ensureAgentJwtSecret(configPath);
  const envFilePath = resolveAgentJwtEnvFile(configPath);
  const keyResult = ensureLocalSecretsKeyFile(config, configPath);
  writeConfig(config, configPath);

  p.log.success(`Created quickstart config at ${pc.dim(configPath)}`);
  if (jwtSecret.created) {
    p.log.success(`Created ${pc.cyan("BEDLAM_AGENT_JWT_SECRET")} in ${pc.dim(envFilePath)}`);
  }
  if (keyResult.status === "created") {
    p.log.success(`Created local secrets key file at ${pc.dim(keyResult.path)}`);
  }
  if (usedEnvKeys.length > 0) {
    p.log.message(pc.dim(`Environment-aware defaults active (${usedEnvKeys.length} env var(s) detected).`));
  }
  for (const ignored of ignoredEnvKeys) {
    p.log.message(pc.dim(`Ignored ${ignored.key}: ${ignored.reason}`));
  }

  return true;
}

export async function demoAiEngineeringCommand(opts: DemoAiEngineeringOptions = {}) {
  const configPath = resolveConfigPath(opts.config);
  p.intro(pc.bgCyan(pc.black(" bedlam demo ai-engineering ")));
  const createdConfig = await ensureDemoConfig(configPath, opts);
  loadBedlamEnvFile(configPath);

  p.log.message(pc.dim(`Config: ${configPath}`));

  const connection = await resolveDemoDb(configPath);
  const db = createDb(connection.dbUrl);
  const closableDb = db as typeof db & {
    $client?: {
      end?: (options?: { timeout?: number }) => Promise<void>;
    };
  };

  try {
    await applyPendingMigrations(connection.dbUrl);
    const result = await seedAiEngineeringCompanyDemo(db, {
      actor: { actorType: "system", actorId: "demo-command" },
    });

    p.log.success(result.created ? "Installed AI Engineering Company demo." : "AI Engineering Company demo is already installed.");
    p.note(
      [
        `Company ID: ${result.companyId}`,
        `Project ID: ${result.projectId}`,
        `Loop ID: ${result.loopId}`,
        "",
        createdConfig ? "A local quickstart config was created for this demo." : "Existing Bedlam config reused.",
        `Run Bedlam: ${pc.cyan("bedlam run")}`,
        "Open the dashboard, select Bedlam AI Engineering Company, then run Throughput Optimizer.",
      ].join("\n"),
      "Next steps",
    );
    p.outro("Demo company ready.");
  } finally {
    await closableDb.$client?.end?.({ timeout: 5 }).catch(() => undefined);
    await connection.stop();
  }
}
