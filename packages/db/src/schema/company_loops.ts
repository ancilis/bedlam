import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";
import { companies } from "./companies.js";

export const companyLoops = pgTable(
  "company_loops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    cadenceKind: text("cadence_kind").notNull().default("manual"),
    intervalSec: integer("interval_sec"),
    riskTier: text("risk_tier").notNull().default("low"),
    ownerAgentId: uuid("owner_agent_id").references(() => agents.id, { onDelete: "set null" }),
    evaluatorAgentId: uuid("evaluator_agent_id").references(() => agents.id, { onDelete: "set null" }),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("company_loops_company_status_idx").on(table.companyId, table.status),
    companyKindIdx: index("company_loops_company_kind_idx").on(table.companyId, table.kind),
    companyUpdatedIdx: index("company_loops_company_updated_idx").on(table.companyId, table.updatedAt),
  }),
);

export const companyLoopRuns = pgTable(
  "company_loop_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    loopId: uuid("loop_id").notNull().references(() => companyLoops.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    inputSnapshotJson: jsonb("input_snapshot_json").$type<Record<string, unknown>>(),
    diagnosisJson: jsonb("diagnosis_json").$type<Record<string, unknown>>(),
    summary: text("summary"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyLoopCreatedIdx: index("company_loop_runs_company_loop_created_idx").on(
      table.companyId,
      table.loopId,
      table.createdAt,
    ),
    companyStatusIdx: index("company_loop_runs_company_status_idx").on(table.companyId, table.status),
    loopStatusIdx: index("company_loop_runs_loop_status_idx").on(table.loopId, table.status),
    companyUpdatedIdx: index("company_loop_runs_company_updated_idx").on(table.companyId, table.updatedAt),
  }),
);

export const companyLoopObservations = pgTable(
  "company_loop_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    loopRunId: uuid("loop_run_id").notNull().references(() => companyLoopRuns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    severity: text("severity").notNull().default("info"),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyRunIdx: index("company_loop_observations_company_run_idx").on(table.companyId, table.loopRunId),
    companyKindIdx: index("company_loop_observations_company_kind_idx").on(table.companyId, table.kind),
    runSeverityIdx: index("company_loop_observations_run_severity_idx").on(table.loopRunId, table.severity),
    companyCreatedIdx: index("company_loop_observations_company_created_idx").on(table.companyId, table.createdAt),
  }),
);

export const companyLoopProposals = pgTable(
  "company_loop_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    loopRunId: uuid("loop_run_id").notNull().references(() => companyLoopRuns.id, { onDelete: "cascade" }),
    proposalType: text("proposal_type").notNull(),
    status: text("status").notNull().default("proposed"),
    riskTier: text("risk_tier").notNull().default("low"),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    title: text("title").notNull(),
    rationale: text("rationale"),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
    approvalId: uuid("approval_id").references(() => approvals.id, { onDelete: "set null" }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    appliedByUserId: text("applied_by_user_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyRunIdx: index("company_loop_proposals_company_run_idx").on(table.companyId, table.loopRunId),
    runStatusIdx: index("company_loop_proposals_run_status_idx").on(table.loopRunId, table.status),
    companyStatusIdx: index("company_loop_proposals_company_status_idx").on(table.companyId, table.status),
    companyCreatedIdx: index("company_loop_proposals_company_created_idx").on(table.companyId, table.createdAt),
  }),
);

export const companyLoopEvaluations = pgTable(
  "company_loop_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    loopRunId: uuid("loop_run_id").notNull().references(() => companyLoopRuns.id, { onDelete: "cascade" }),
    score: integer("score"),
    passed: boolean("passed").notNull().default(false),
    checksJson: jsonb("checks_json").$type<Array<Record<string, unknown>>>().notNull().default([]),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyRunIdx: index("company_loop_evaluations_company_run_idx").on(table.companyId, table.loopRunId),
    runIdx: index("company_loop_evaluations_run_idx").on(table.loopRunId),
    companyCreatedIdx: index("company_loop_evaluations_company_created_idx").on(table.companyId, table.createdAt),
  }),
);
