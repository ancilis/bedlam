import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { companyLoopProposals } from "./company_loops.js";

export const proposalOutcomes = pgTable(
  "proposal_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id").references(() => companyLoopProposals.id, { onDelete: "set null" }),
    outcomeStatus: text("outcome_status").notNull().default("observing"),
    summary: text("summary").notNull(),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    recordedByUserId: text("recorded_by_user_id"),
    recordedByAgentId: uuid("recorded_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("proposal_outcomes_company_created_idx").on(table.companyId, table.createdAt),
    companyStatusIdx: index("proposal_outcomes_company_status_idx").on(table.companyId, table.outcomeStatus),
    proposalIdx: index("proposal_outcomes_proposal_idx").on(table.proposalId),
  }),
);
