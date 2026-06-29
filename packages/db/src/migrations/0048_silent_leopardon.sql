CREATE TABLE "company_loop_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"loop_run_id" uuid NOT NULL,
	"score" integer,
	"passed" boolean DEFAULT false NOT NULL,
	"checks_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_loop_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"loop_run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_loop_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"loop_run_id" uuid NOT NULL,
	"proposal_type" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"risk_tier" text DEFAULT 'low' NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"title" text NOT NULL,
	"rationale" text,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"approval_id" uuid,
	"applied_at" timestamp with time zone,
	"applied_by_user_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_loop_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"loop_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"input_snapshot_json" jsonb,
	"diagnosis_json" jsonb,
	"summary" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_loops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"cadence_kind" text DEFAULT 'manual' NOT NULL,
	"interval_sec" integer,
	"risk_tier" text DEFAULT 'low' NOT NULL,
	"owner_agent_id" uuid,
	"evaluator_agent_id" uuid,
	"config_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_loop_evaluations" ADD CONSTRAINT "company_loop_evaluations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loop_evaluations" ADD CONSTRAINT "company_loop_evaluations_loop_run_id_company_loop_runs_id_fk" FOREIGN KEY ("loop_run_id") REFERENCES "public"."company_loop_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loop_observations" ADD CONSTRAINT "company_loop_observations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loop_observations" ADD CONSTRAINT "company_loop_observations_loop_run_id_company_loop_runs_id_fk" FOREIGN KEY ("loop_run_id") REFERENCES "public"."company_loop_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loop_proposals" ADD CONSTRAINT "company_loop_proposals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loop_proposals" ADD CONSTRAINT "company_loop_proposals_loop_run_id_company_loop_runs_id_fk" FOREIGN KEY ("loop_run_id") REFERENCES "public"."company_loop_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loop_proposals" ADD CONSTRAINT "company_loop_proposals_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loop_runs" ADD CONSTRAINT "company_loop_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loop_runs" ADD CONSTRAINT "company_loop_runs_loop_id_company_loops_id_fk" FOREIGN KEY ("loop_id") REFERENCES "public"."company_loops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loops" ADD CONSTRAINT "company_loops_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loops" ADD CONSTRAINT "company_loops_owner_agent_id_agents_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loops" ADD CONSTRAINT "company_loops_evaluator_agent_id_agents_id_fk" FOREIGN KEY ("evaluator_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_loops" ADD CONSTRAINT "company_loops_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_loop_evaluations_company_run_idx" ON "company_loop_evaluations" USING btree ("company_id","loop_run_id");--> statement-breakpoint
CREATE INDEX "company_loop_evaluations_run_idx" ON "company_loop_evaluations" USING btree ("loop_run_id");--> statement-breakpoint
CREATE INDEX "company_loop_evaluations_company_created_idx" ON "company_loop_evaluations" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "company_loop_observations_company_run_idx" ON "company_loop_observations" USING btree ("company_id","loop_run_id");--> statement-breakpoint
CREATE INDEX "company_loop_observations_company_kind_idx" ON "company_loop_observations" USING btree ("company_id","kind");--> statement-breakpoint
CREATE INDEX "company_loop_observations_run_severity_idx" ON "company_loop_observations" USING btree ("loop_run_id","severity");--> statement-breakpoint
CREATE INDEX "company_loop_observations_company_created_idx" ON "company_loop_observations" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "company_loop_proposals_company_run_idx" ON "company_loop_proposals" USING btree ("company_id","loop_run_id");--> statement-breakpoint
CREATE INDEX "company_loop_proposals_run_status_idx" ON "company_loop_proposals" USING btree ("loop_run_id","status");--> statement-breakpoint
CREATE INDEX "company_loop_proposals_company_status_idx" ON "company_loop_proposals" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "company_loop_proposals_company_created_idx" ON "company_loop_proposals" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "company_loop_runs_company_loop_created_idx" ON "company_loop_runs" USING btree ("company_id","loop_id","created_at");--> statement-breakpoint
CREATE INDEX "company_loop_runs_company_status_idx" ON "company_loop_runs" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "company_loop_runs_loop_status_idx" ON "company_loop_runs" USING btree ("loop_id","status");--> statement-breakpoint
CREATE INDEX "company_loop_runs_company_updated_idx" ON "company_loop_runs" USING btree ("company_id","updated_at");--> statement-breakpoint
CREATE INDEX "company_loops_company_status_idx" ON "company_loops" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "company_loops_company_kind_idx" ON "company_loops" USING btree ("company_id","kind");--> statement-breakpoint
CREATE INDEX "company_loops_company_updated_idx" ON "company_loops" USING btree ("company_id","updated_at");