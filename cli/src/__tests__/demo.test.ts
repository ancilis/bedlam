import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  companies,
  companyLearnings,
  companyLoops,
  createDb,
  proposalOutcomes,
} from "@bedlam/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "@bedlam/db";
import type { BedlamConfig } from "../config/schema.js";
import { demoAiEngineeringCommand } from "../commands/demo.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres CLI demo tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("demo command", () => {
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let root = "";
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("bedlam-cli-demo-");
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    if (root) fs.rmSync(root, { recursive: true, force: true });
    root = "";
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  function writeConfig() {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "bedlam-cli-demo-"));
    const runtimeRoot = path.join(root, "runtime");
    const configPath = path.join(root, ".bedlam", "config.json");
    const config: BedlamConfig = {
      $meta: {
        version: 1,
        updatedAt: "2026-06-29T00:00:00.000Z",
        source: "onboard",
      },
      database: {
        mode: "postgres",
        connectionString: tempDb!.connectionString,
        embeddedPostgresDataDir: path.join(runtimeRoot, "db"),
        embeddedPostgresPort: 54329,
        backup: {
          enabled: true,
          intervalMinutes: 60,
          retentionDays: 30,
          dir: path.join(runtimeRoot, "backups"),
        },
      },
      logging: {
        mode: "file",
        logDir: path.join(runtimeRoot, "logs"),
      },
      server: {
        deploymentMode: "local_trusted",
        exposure: "private",
        host: "127.0.0.1",
        port: 3100,
        allowedHostnames: [],
        serveUi: true,
      },
      auth: {
        baseUrlMode: "auto",
        disableSignUp: false,
      },
      storage: {
        provider: "local_disk",
        localDisk: { baseDir: path.join(runtimeRoot, "storage") },
        s3: {
          bucket: "bedlam",
          region: "us-east-1",
          prefix: "",
          forcePathStyle: false,
        },
      },
      secrets: {
        provider: "local_encrypted",
        strictMode: false,
        localEncrypted: {
          keyFilePath: path.join(runtimeRoot, "secrets", "master.key"),
        },
      },
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    return configPath;
  }

  it("installs the AI Engineering Company demo without a server or external calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("external calls are forbidden"));
    const configPath = writeConfig();

    await demoAiEngineeringCommand({ config: configPath, yes: true });
    await demoAiEngineeringCommand({ config: configPath, yes: true });

    expect(fetchSpy).not.toHaveBeenCalled();

    const db = createDb(tempDb!.connectionString);
    const companyRows = await db.select().from(companies).where(eq(companies.issuePrefix, "AEC"));
    expect(companyRows).toHaveLength(1);
    const companyId = companyRows[0].id;
    expect(companyRows[0].name).toBe("Bedlam AI Engineering Company");

    const loops = await db.select().from(companyLoops).where(eq(companyLoops.companyId, companyId));
    const learnings = await db.select().from(companyLearnings).where(eq(companyLearnings.companyId, companyId));
    const outcomes = await db.select().from(proposalOutcomes).where(eq(proposalOutcomes.companyId, companyId));
    expect(loops).toHaveLength(1);
    expect(learnings).toHaveLength(1);
    expect(outcomes).toHaveLength(1);

    fetchSpy.mockRestore();
  });

  it("creates a quickstart config when --yes is used on a fresh data dir", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("external calls are forbidden"));
    root = fs.mkdtempSync(path.join(os.tmpdir(), "bedlam-cli-demo-fresh-"));
    const configPath = path.join(root, ".bedlam", "config.json");
    process.env.BEDLAM_HOME = path.join(root, "home");
    process.env.DATABASE_URL = tempDb!.connectionString;

    await demoAiEngineeringCommand({ config: configPath, yes: true });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(configPath)).toBe(true);
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as BedlamConfig;
    expect(config.$meta.source).toBe("onboard");
    expect(config.database.mode).toBe("postgres");
    expect(fs.existsSync(path.join(root, ".bedlam", ".env"))).toBe(true);
    expect(fs.existsSync(path.join(root, "home", "instances", "default", "secrets", "master.key"))).toBe(true);
  });
});
