CREATE TABLE "company_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"category" text DEFAULT 'general' NOT NULL,
	"summary" text NOT NULL,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" text,
	"created_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"proposal_id" uuid,
	"outcome_status" text DEFAULT 'observing' NOT NULL,
	"summary" text NOT NULL,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_by_user_id" text,
	"recorded_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_learnings" ADD CONSTRAINT "company_learnings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_learnings" ADD CONSTRAINT "company_learnings_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_outcomes" ADD CONSTRAINT "proposal_outcomes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_outcomes" ADD CONSTRAINT "proposal_outcomes_proposal_id_company_loop_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."company_loop_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_outcomes" ADD CONSTRAINT "proposal_outcomes_recorded_by_agent_id_agents_id_fk" FOREIGN KEY ("recorded_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_learnings_company_created_idx" ON "company_learnings" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "company_learnings_company_category_idx" ON "company_learnings" USING btree ("company_id","category");--> statement-breakpoint
CREATE INDEX "company_learnings_company_source_idx" ON "company_learnings" USING btree ("company_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "proposal_outcomes_company_created_idx" ON "proposal_outcomes" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "proposal_outcomes_company_status_idx" ON "proposal_outcomes" USING btree ("company_id","outcome_status");--> statement-breakpoint
CREATE INDEX "proposal_outcomes_proposal_idx" ON "proposal_outcomes" USING btree ("proposal_id");