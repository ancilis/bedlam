ALTER TABLE "issues" ADD COLUMN "blocked_by_issue_ids" uuid[];--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "needs_human_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "needs_human_reason" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "self_fix_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "issues_company_needs_human_idx" ON "issues" USING btree ("company_id","needs_human_at");