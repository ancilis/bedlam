import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const companyLearnings = pgTable(
  "company_learnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    category: text("category").notNull().default("general"),
    summary: text("summary").notNull(),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: text("created_by_user_id"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("company_learnings_company_created_idx").on(table.companyId, table.createdAt),
    companyCategoryIdx: index("company_learnings_company_category_idx").on(table.companyId, table.category),
    companySourceIdx: index("company_learnings_company_source_idx").on(table.companyId, table.sourceType, table.sourceId),
  }),
);
