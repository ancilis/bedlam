/**
 * InternalScheduler — in-process recurring tasks.
 *
 * Runs lightweight background jobs that need a periodic cadence and benefit
 * from running inside the Bedlam server process (so they share its filesystem
 * access, database connection, and lifecycle):
 *
 *   - daily_status_writer       every 30 min  spawns daily-status script
 *                                              that writes a human-readable
 *                                              markdown summary
 *   - blocker_reconciler        every 15 min  auto-unblocks issues whose
 *                                              `blockedByIssueIds` are all
 *                                              done/cancelled
 *   - stale_blocked_escalator   every 60 min  flags issues blocked >48h with
 *                                              `needsHumanAt` so they surface
 *                                              for human attention
 *
 * This avoids depending on external cron / launchd / systemd for these
 * specific tasks — useful because external schedulers vary by host platform
 * and have permissions / sandboxing concerns that don't apply to in-process
 * execution.
 *
 * Configuration:
 *   BEDLAM_INTERNAL_SCHEDULER_ENABLED=false   disable all jobs
 *   BEDLAM_DAILY_STATUS_SCRIPT=/path/to.py    path to daily-status script
 *                                              (if unset, daily_status_writer
 *                                              is skipped — schema reconciler
 *                                              and escalator still run)
 *
 * Failure isolation: each tick is independently try/catch'd. A failed run
 * logs and continues; it never crashes the server.
 */

import { spawn } from "child_process";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@bedlam/db";
import { issues, issueComments } from "@bedlam/db";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How often the scheduler ticks. Each job has its own cadence (multiples). */
const TICK_INTERVAL_MS = 60_000; // 1 minute

/** daily_status_writer: every 30 ticks (= 30 min). */
const DAILY_STATUS_TICKS = 30;

/** blocker_reconciler: every 15 ticks (= 15 min). */
const BLOCKER_RECONCILER_TICKS = 15;

/** stale_blocked_escalator: every 60 ticks (= 60 min). */
const STALE_ESCALATOR_TICKS = 60;

/** A blocked issue is "stale" if it hasn't moved in this many hours. */
const STALE_BLOCKED_THRESHOLD_HOURS = 48;

/** Hard timeout for the daily-status script subprocess. */
const DAILY_STATUS_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InternalSchedulerOptions {
  db: Db;
  /** Path to daily-status script. If undefined, daily_status_writer skipped. */
  dailyStatusScript?: string;
  /** Disable individual jobs by name. Useful for tests / debugging. */
  disabled?: Set<string>;
}

export interface InternalScheduler {
  start(): void;
  stop(): void;
  /** Force-run a job immediately (returns when job completes). For testing. */
  runJob(name: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Job: daily_status_writer
// ---------------------------------------------------------------------------

async function runDailyStatusWriter(scriptPath: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const child = spawn("python3", [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, DAILY_STATUS_TIMEOUT_MS);

    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        logger.info(
          { stdoutPreview: stdout.slice(0, 200) },
          "daily_status_writer succeeded",
        );
      } else {
        logger.warn(
          { code, stderrPreview: stderr.slice(0, 500) },
          "daily_status_writer non-zero exit",
        );
      }
      resolve();
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      logger.error({ err, scriptPath }, "daily_status_writer spawn error");
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Job: blocker_reconciler
// ---------------------------------------------------------------------------

/**
 * Scan all blocked issues. For each:
 *  - Read structured `blockedByIssueIds` field
 *  - If all referenced issues are done/cancelled → transition to todo,
 *    post comment, clear blockedByIssueIds and blockedReason
 *
 * Conservative: only acts on STRUCTURED data. Does NOT parse free-text
 * comments. Free-text "do not start until X" patterns are explicitly out
 * of scope — agents must use structured fields per the autonomy contract.
 */
async function runBlockerReconciler(db: Db): Promise<void> {
  const blocked = await db
    .select({
      id: issues.id,
      companyId: issues.companyId,
      identifier: issues.identifier,
      title: issues.title,
      blockedByIssueIds: issues.blockedByIssueIds,
      assigneeAgentId: issues.assigneeAgentId,
    })
    .from(issues)
    .where(
      and(
        eq(issues.status, "blocked"),
        sql`${issues.blockedByIssueIds} IS NOT NULL`,
        sql`array_length(${issues.blockedByIssueIds}, 1) > 0`,
      ),
    );

  if (blocked.length === 0) {
    logger.debug("blocker_reconciler: no structured-blocked issues found");
    return;
  }

  // Collect all referenced blocker issue IDs
  const allBlockerIds = new Set<string>();
  for (const issue of blocked) {
    for (const id of issue.blockedByIssueIds ?? []) {
      allBlockerIds.add(id);
    }
  }

  // Fetch their statuses in one query
  const blockerStatuses = await db
    .select({ id: issues.id, status: issues.status })
    .from(issues)
    .where(inArray(issues.id, Array.from(allBlockerIds)));
  const statusById = new Map(blockerStatuses.map((b) => [b.id, b.status]));

  let unblockedCount = 0;
  for (const issue of blocked) {
    const blockerIds = issue.blockedByIssueIds ?? [];
    if (blockerIds.length === 0) continue;

    const allResolved = blockerIds.every((id) => {
      const s = statusById.get(id);
      return s === "done" || s === "cancelled";
    });

    if (!allResolved) continue;

    try {
      await db
        .update(issues)
        .set({
          status: "todo",
          blockedByIssueIds: null,
          blockedReason: null,
          updatedAt: new Date(),
        })
        .where(eq(issues.id, issue.id));

      await db.insert(issueComments).values({
        companyId: issue.companyId,
        issueId: issue.id,
        body:
          `## Auto-unblock (blocker_reconciler)\n\n` +
          `All structured dependencies are resolved (\`done\` or \`cancelled\`). ` +
          `Transitioning to \`todo\`.\n\n` +
          `If still genuinely blocked, please re-block with structured ` +
          `\`blockedByIssueIds\` or \`blockedReason\`.`,
        authorAgentId: null,
      });

      logger.info(
        { id: issue.id, identifier: issue.identifier, title: issue.title },
        "blocker_reconciler unblocked issue",
      );
      unblockedCount++;
    } catch (err) {
      logger.error(
        { err, id: issue.id, identifier: issue.identifier },
        "blocker_reconciler failed to unblock issue",
      );
    }
  }

  if (unblockedCount > 0) {
    logger.info(
      { unblocked: unblockedCount, scanned: blocked.length },
      "blocker_reconciler tick complete",
    );
  }
}

// ---------------------------------------------------------------------------
// Job: stale_blocked_escalator
// ---------------------------------------------------------------------------

/**
 * Scan all blocked issues. Any that have been blocked >STALE_THRESHOLD hours
 * AND are not already flagged needs_human get flagged.
 *
 * The flag (`needsHumanAt` + `needsHumanReason`) surfaces them in the daily
 * status doc and any future PM-agent / external sync.
 */
async function runStaleBlockedEscalator(db: Db): Promise<void> {
  const cutoff = new Date(
    Date.now() - STALE_BLOCKED_THRESHOLD_HOURS * 60 * 60 * 1000,
  );

  const stale = await db
    .select({
      id: issues.id,
      identifier: issues.identifier,
      title: issues.title,
      updatedAt: issues.updatedAt,
    })
    .from(issues)
    .where(
      and(
        eq(issues.status, "blocked"),
        lt(issues.updatedAt, cutoff),
        isNull(issues.needsHumanAt),
      ),
    );

  if (stale.length === 0) {
    logger.debug("stale_blocked_escalator: nothing to flag");
    return;
  }

  let flaggedCount = 0;
  const now = new Date();
  for (const issue of stale) {
    try {
      const ageHours = Math.floor(
        (now.getTime() - new Date(issue.updatedAt!).getTime()) / (60 * 60 * 1000),
      );

      await db
        .update(issues)
        .set({
          needsHumanAt: now,
          needsHumanReason:
            `Blocked for ${ageHours}h with no movement. ` +
            `No structured blocker resolution in sight. Auto-escalated by ` +
            `stale_blocked_escalator.`,
          updatedAt: now,
        })
        .where(eq(issues.id, issue.id));

      logger.info(
        {
          id: issue.id,
          identifier: issue.identifier,
          ageHours,
        },
        "stale_blocked_escalator flagged issue",
      );
      flaggedCount++;
    } catch (err) {
      logger.error(
        { err, id: issue.id, identifier: issue.identifier },
        "stale_blocked_escalator failed to flag issue",
      );
    }
  }

  if (flaggedCount > 0) {
    logger.info(
      { flagged: flaggedCount, scanned: stale.length },
      "stale_blocked_escalator tick complete",
    );
  }
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export function createInternalScheduler(
  options: InternalSchedulerOptions,
): InternalScheduler {
  const { db, dailyStatusScript, disabled = new Set() } = options;
  let timer: ReturnType<typeof setInterval> | null = null;
  let tickCounter = 0;

  // Skip daily_status_writer if no script path configured
  const dailyStatusEnabled = Boolean(dailyStatusScript);
  if (!dailyStatusEnabled) {
    disabled.add("daily_status_writer");
  }

  const jobs: Array<{
    name: string;
    cadence: number;
    fn: () => Promise<void>;
  }> = [
    {
      name: "daily_status_writer",
      cadence: DAILY_STATUS_TICKS,
      fn: () => runDailyStatusWriter(dailyStatusScript!),
    },
    {
      name: "blocker_reconciler",
      cadence: BLOCKER_RECONCILER_TICKS,
      fn: () => runBlockerReconciler(db),
    },
    {
      name: "stale_blocked_escalator",
      cadence: STALE_ESCALATOR_TICKS,
      fn: () => runStaleBlockedEscalator(db),
    },
  ];

  async function tick(): Promise<void> {
    tickCounter++;
    for (const job of jobs) {
      if (disabled.has(job.name)) continue;
      if (tickCounter % job.cadence !== 0) continue;
      try {
        await job.fn();
      } catch (err) {
        logger.error(
          { err, jobName: job.name, tickCounter },
          "internal scheduler job error",
        );
      }
    }
  }

  function start(): void {
    if (timer !== null) return;
    logger.info(
      {
        tickIntervalMs: TICK_INTERVAL_MS,
        jobs: jobs.filter((j) => !disabled.has(j.name)).map((j) => j.name),
        dailyStatusEnabled,
      },
      "InternalScheduler starting",
    );
    timer = setInterval(() => {
      void tick();
    }, TICK_INTERVAL_MS);

    // Run daily_status once at startup so output reflects fresh state.
    if (dailyStatusEnabled && !disabled.has("daily_status_writer")) {
      void runDailyStatusWriter(dailyStatusScript!);
    }
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
      logger.info("InternalScheduler stopped");
    }
  }

  async function runJob(name: string): Promise<void> {
    const job = jobs.find((j) => j.name === name);
    if (!job) throw new Error(`Unknown job: ${name}`);
    await job.fn();
  }

  return { start, stop, runJob };
}
