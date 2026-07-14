CREATE TYPE "public"."assertion_class" AS ENUM('recorded_fact', 'interpretation', 'inference', 'forecast');--> statement-breakpoint
CREATE TYPE "public"."entity_alias_type" AS ENUM('alias', 'historical_name', 'spelling', 'abbreviation', 'translation');--> statement-breakpoint
CREATE TYPE "public"."entity_graph_status" AS ENUM('frontier', 'draft_stub', 'candidate', 'canonical_incomplete', 'canonical_complete', 'stale', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."external_id_scheme" AS ENUM('wikipedia', 'wikidata', 'viaf', 'isni', 'doi', 'geonames', 'other');--> statement-breakpoint
CREATE TYPE "public"."human_package_decision" AS ENUM('approve', 'approve_with_holds', 'return', 'mark_duplicate', 'reject');--> statement-breakpoint
CREATE TYPE "public"."qa_flag_severity" AS ENUM('info', 'minor', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."qa_flag_state" AS ENUM('pass', 'hold', 'correction', 'duplicate', 'insufficient_evidence');--> statement-breakpoint
CREATE TYPE "public"."qa_recommendation" AS ENUM('pass', 'hold', 'correct', 'duplicate', 'insufficient_evidence');--> statement-breakpoint
CREATE TYPE "public"."relationship_directionality" AS ENUM('directed', 'symmetric');--> statement-breakpoint
CREATE TYPE "public"."research_item_decision" AS ENUM('pending', 'accepted', 'held', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."research_job_origin" AS ENUM('manual', 'returned_correction', 'frontier', 'random_discovery');--> statement-breakpoint
CREATE TYPE "public"."research_job_status" AS ENUM('queued', 'claimed', 'researching', 'submitted', 'completed', 'returned', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."research_package_section" AS ENUM('entity', 'time', 'relationship', 'claim', 'source', 'media', 'question', 'next_entity');--> statement-breakpoint
CREATE TYPE "public"."research_package_status" AS ENUM('draft', 'submitted', 'qa_pending', 'qa_complete', 'in_review', 'approved', 'approved_with_holds', 'returned', 'marked_duplicate', 'rejected', 'promoted');--> statement-breakpoint
CREATE TYPE "public"."research_run_status" AS ENUM('active', 'stopping', 'stopped', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."time_association_role" AS ENUM('existence', 'born', 'died', 'active', 'conceived', 'invented', 'patented', 'demonstrated', 'published', 'founded', 'dissolved', 'commercialised', 'adopted', 'declined', 'replaced', 'occurred', 'other');--> statement-breakpoint
ALTER TYPE "public"."claim_subject_type" ADD VALUE 'time_association';--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"alias" text NOT NULL,
	"normalized" text NOT NULL,
	"alias_type" "entity_alias_type" DEFAULT 'alias' NOT NULL,
	"lang" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_aliases_unique" UNIQUE("entity_id","normalized","alias_type"),
	CONSTRAINT "entity_aliases_alias_not_empty" CHECK (length("entity_aliases"."alias") > 0)
);
--> statement-breakpoint
CREATE TABLE "entity_classifications" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"classification" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_classifications_unique" UNIQUE("entity_id","classification")
);
--> statement-breakpoint
CREATE TABLE "entity_external_ids" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"scheme" "external_id_scheme" NOT NULL,
	"value" text NOT NULL,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_external_ids_scheme_value_unique" UNIQUE("scheme","value"),
	CONSTRAINT "entity_external_ids_value_not_empty" CHECK (length("entity_external_ids"."value") > 0)
);
--> statement-breakpoint
CREATE TABLE "entity_time_associations" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"period_id" text NOT NULL,
	"role" time_association_role DEFAULT 'existence' NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"note" text,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_time_assoc_unique" UNIQUE("entity_id","period_id","role"),
	CONSTRAINT "entity_time_assoc_confidence_range" CHECK ("entity_time_associations"."confidence" >= 0 AND "entity_time_associations"."confidence" <= 100)
);
--> statement-breakpoint
CREATE TABLE "relationship_type_registry" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"inverse_label" text NOT NULL,
	"directionality" "relationship_directionality" DEFAULT 'directed' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"is_acyclic" boolean DEFAULT false NOT NULL,
	"allowed_source_kinds" jsonb,
	"allowed_target_kinds" jsonb,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rel_type_registry_key_format" CHECK ("relationship_type_registry"."key" ~ '^[a-z][a-z0-9_]*$')
);
--> statement-breakpoint
CREATE TABLE "package_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"package_id" text NOT NULL,
	"decision" "human_package_decision" NOT NULL,
	"reviewer" text,
	"instructions" text,
	"reason" text,
	"merge_target_entity_id" text,
	"held_item_refs" jsonb,
	"decision_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"qa_result_id" text NOT NULL,
	"package_id" text NOT NULL,
	"target_section" "research_package_section",
	"target_ref" text,
	"severity" "qa_flag_severity" DEFAULT 'minor' NOT NULL,
	"category" text,
	"explanation" text NOT NULL,
	"corrective_source" text,
	"state" "qa_flag_state" DEFAULT 'hold' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_results" (
	"id" text PRIMARY KEY NOT NULL,
	"package_id" text NOT NULL,
	"recommendation" "qa_recommendation" NOT NULL,
	"summary" text,
	"tool_name" text,
	"model" text,
	"qa_run_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"central_title" text NOT NULL,
	"central_url" text,
	"focus_note" text,
	"origin" "research_job_origin" DEFAULT 'manual' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"sequence" integer NOT NULL,
	"status" "research_job_status" DEFAULT 'queued' NOT NULL,
	"claimed_by_run_id" text,
	"worker_lock" text,
	"lease_expires_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"match_status" text,
	"match_entity_id" text,
	"parent_entity_id" text,
	"parent_context" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_jobs_attempts_nonneg" CHECK ("research_jobs"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "research_package_items" (
	"id" text PRIMARY KEY NOT NULL,
	"package_id" text NOT NULL,
	"section" "research_package_section" NOT NULL,
	"local_ref" text NOT NULL,
	"payload" jsonb NOT NULL,
	"match_entity_id" text,
	"match_status" text,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"held" boolean DEFAULT false NOT NULL,
	"decision" "research_item_decision" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_package_items_ref_unique" UNIQUE("package_id","section","local_ref")
);
--> statement-breakpoint
CREATE TABLE "research_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"run_id" text,
	"central_label" text NOT NULL,
	"central_slug" text NOT NULL,
	"status" "research_package_status" DEFAULT 'submitted' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"envelope" jsonb NOT NULL,
	"submission_hash" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"promoted_entity_id" text,
	"promoted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_packages_job_hash_unique" UNIQUE("job_id","submission_hash"),
	CONSTRAINT "research_packages_slug_not_empty" CHECK (length("research_packages"."central_slug") > 0)
);
--> statement-breakpoint
CREATE TABLE "research_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_limit" integer NOT NULL,
	"status" "research_run_status" DEFAULT 'active' NOT NULL,
	"stop_requested" boolean DEFAULT false NOT NULL,
	"operator" text,
	"config_snapshot" jsonb,
	"claimed_count" integer DEFAULT 0 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"returned_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_runs_batch_limit_positive" CHECK ("research_runs"."batch_limit" >= 1),
	CONSTRAINT "research_runs_counts_nonneg" CHECK ("research_runs"."claimed_count" >= 0 AND "research_runs"."completed_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "relationships" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "graph_status" "entity_graph_status" DEFAULT 'canonical_incomplete' NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "freshness_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "superseded_by_id" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "merged_into_id" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "type_key" text;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "assertion_class" "assertion_class" DEFAULT 'recorded_fact' NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "context_place_id" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "assertion_class" "assertion_class" DEFAULT 'recorded_fact' NOT NULL;--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_classifications" ADD CONSTRAINT "entity_classifications_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_external_ids" ADD CONSTRAINT "entity_external_ids_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_time_associations" ADD CONSTRAINT "entity_time_associations_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_time_associations" ADD CONSTRAINT "entity_time_associations_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_decisions" ADD CONSTRAINT "package_decisions_package_id_research_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."research_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_decisions" ADD CONSTRAINT "package_decisions_merge_target_entity_id_entities_id_fk" FOREIGN KEY ("merge_target_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_flags" ADD CONSTRAINT "qa_flags_qa_result_id_qa_results_id_fk" FOREIGN KEY ("qa_result_id") REFERENCES "public"."qa_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_flags" ADD CONSTRAINT "qa_flags_package_id_research_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."research_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_results" ADD CONSTRAINT "qa_results_package_id_research_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."research_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_claimed_by_run_id_research_runs_id_fk" FOREIGN KEY ("claimed_by_run_id") REFERENCES "public"."research_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_match_entity_id_entities_id_fk" FOREIGN KEY ("match_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_parent_entity_id_entities_id_fk" FOREIGN KEY ("parent_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_package_items" ADD CONSTRAINT "research_package_items_package_id_research_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."research_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_package_items" ADD CONSTRAINT "research_package_items_match_entity_id_entities_id_fk" FOREIGN KEY ("match_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_packages" ADD CONSTRAINT "research_packages_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_packages" ADD CONSTRAINT "research_packages_run_id_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."research_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_packages" ADD CONSTRAINT "research_packages_promoted_entity_id_entities_id_fk" FOREIGN KEY ("promoted_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_aliases_entity_idx" ON "entity_aliases" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_aliases_normalized_idx" ON "entity_aliases" USING btree ("normalized");--> statement-breakpoint
CREATE INDEX "entity_classifications_entity_idx" ON "entity_classifications" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_classifications_value_idx" ON "entity_classifications" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "entity_external_ids_entity_idx" ON "entity_external_ids" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_time_assoc_entity_idx" ON "entity_time_associations" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_time_assoc_period_idx" ON "entity_time_associations" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "entity_time_assoc_role_idx" ON "entity_time_associations" USING btree ("role");--> statement-breakpoint
CREATE INDEX "rel_type_registry_category_idx" ON "relationship_type_registry" USING btree ("category");--> statement-breakpoint
CREATE INDEX "package_decisions_pkg_idx" ON "package_decisions" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "qa_flags_result_idx" ON "qa_flags" USING btree ("qa_result_id");--> statement-breakpoint
CREATE INDEX "qa_flags_pkg_idx" ON "qa_flags" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "qa_flags_target_idx" ON "qa_flags" USING btree ("package_id","target_section","target_ref");--> statement-breakpoint
CREATE INDEX "qa_results_pkg_idx" ON "qa_results" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "research_jobs_status_idx" ON "research_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "research_jobs_origin_idx" ON "research_jobs" USING btree ("origin");--> statement-breakpoint
CREATE INDEX "research_jobs_queue_order_idx" ON "research_jobs" USING btree ("status","priority","sequence");--> statement-breakpoint
CREATE INDEX "research_jobs_run_idx" ON "research_jobs" USING btree ("claimed_by_run_id");--> statement-breakpoint
CREATE INDEX "research_jobs_dedupe_idx" ON "research_jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "research_package_items_pkg_idx" ON "research_package_items" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "research_package_items_section_idx" ON "research_package_items" USING btree ("package_id","section");--> statement-breakpoint
CREATE INDEX "research_packages_job_idx" ON "research_packages" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "research_packages_status_idx" ON "research_packages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "research_runs_status_idx" ON "research_runs" USING btree ("status");--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_superseded_by_id_entities_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_merged_into_id_entities_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_type_key_relationship_type_registry_key_fk" FOREIGN KEY ("type_key") REFERENCES "public"."relationship_type_registry"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_context_place_id_entities_id_fk" FOREIGN KEY ("context_place_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_graph_status_idx" ON "entities" USING btree ("graph_status");--> statement-breakpoint
CREATE INDEX "relationships_type_key_idx" ON "relationships" USING btree ("type_key");--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_target_typekey_unique" UNIQUE("source_entity_id","target_entity_id","type_key");--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_revision_positive" CHECK ("entities"."revision" >= 1);
--> statement-breakpoint
-- Cycle 8A: seed the relationship-type registry with the 13 builtin types so
-- existing relationships.type values backfill into type_key against a real FK.
-- isAcyclic mirrors ACYCLIC_EXPECTED_RELATIONSHIP_TYPES (part_of, replaced).
INSERT INTO "relationship_type_registry"
  ("key","label","inverse_label","directionality","category","is_acyclic","is_builtin","is_active")
VALUES
  ('enabled','enabled','was enabled by','directed','causal',false,true,true),
  ('influenced','influenced','was influenced by','directed','causal',false,true,true),
  ('contributed_to','contributed to','was contributed to by','directed','causal',false,true,true),
  ('accelerated','accelerated','was accelerated by','directed','causal',false,true,true),
  ('responded_to','responded to','was responded to by','directed','causal',false,true,true),
  ('opposed','opposed','was opposed by','directed','conflict',false,true,true),
  ('replaced','replaced','was replaced by','directed','succession',true,true,true),
  ('spread_through','spread through','was a medium for','directed','diffusion',false,true,true),
  ('developed_by','was developed by','developed','directed','attribution',false,true,true),
  ('improved_by','was improved by','improved','directed','attribution',false,true,true),
  ('occurred_in','occurred in','was the setting for','directed','spatial',false,true,true),
  ('associated_with','associated with','associated with','symmetric','general',false,true,true),
  ('part_of','part of','contains','directed','structural',true,true,true)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- Backfill: every existing relationship gets a registry key matching its enum.
UPDATE "relationships" SET "type_key" = "type"::text WHERE "type_key" IS NULL AND "type" IS NOT NULL;
