CREATE TYPE "public"."claim_subject_type" AS ENUM('entity', 'relationship', 'period');--> statement-breakpoint
CREATE TYPE "public"."claim_verification_status" AS ENUM('unverified', 'corroborated', 'verified', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."editorial_status" AS ENUM('draft', 'in_review', 'verified', 'disputed', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."entity_kind" AS ENUM('person', 'invention', 'event', 'theme', 'place', 'organisation', 'civilisation', 'concept', 'period');--> statement-breakpoint
CREATE TYPE "public"."media_rights_status" AS ENUM('unknown', 'cleared', 'restricted', 'public_domain', 'synthetic_fixture');--> statement-breakpoint
CREATE TYPE "public"."media_subject_type" AS ENUM('entity', 'period', 'yol_composition');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'audio', 'document', 'map', 'model_3d');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('enabled', 'influenced', 'contributed_to', 'accelerated', 'responded_to', 'opposed', 'replaced', 'spread_through', 'developed_by', 'improved_by', 'occurred_in', 'associated_with', 'part_of');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('book', 'article', 'website', 'primary_document', 'video', 'dataset', 'oral_history', 'other');--> statement-breakpoint
CREATE TYPE "public"."time_precision" AS ENUM('exact', 'approximate', 'range', 'decade', 'century', 'era', 'unknown');--> statement-breakpoint
CREATE TABLE "periods" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text,
	"label" text NOT NULL,
	"precision" time_precision DEFAULT 'unknown' NOT NULL,
	"start_year" integer,
	"end_year" integer,
	"is_start_uncertain" boolean DEFAULT false NOT NULL,
	"is_end_uncertain" boolean DEFAULT false NOT NULL,
	"display_year" integer,
	"confidence" integer DEFAULT 50 NOT NULL,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"editorial_status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periods_slug_unique" UNIQUE("slug"),
	CONSTRAINT "periods_confidence_range" CHECK ("periods"."confidence" >= 0 AND "periods"."confidence" <= 100),
	CONSTRAINT "periods_valid_range" CHECK ("periods"."start_year" IS NULL OR "periods"."end_year" IS NULL OR "periods"."start_year" <= "periods"."end_year")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" "entity_kind" NOT NULL,
	"label" text NOT NULL,
	"summary" text,
	"primary_period_id" text,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"editorial_status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "entities_slug_not_empty" CHECK (length("entities"."slug") > 0)
);
--> statement-breakpoint
CREATE TABLE "entity_civilisation_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"period_id" text,
	"region_label" text
);
--> statement-breakpoint
CREATE TABLE "entity_concept_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"domain" text
);
--> statement-breakpoint
CREATE TABLE "entity_event_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"period_id" text,
	"event_type" text
);
--> statement-breakpoint
CREATE TABLE "entity_invention_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"invention_year" integer,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "entity_organisation_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"founded_year" integer,
	"dissolved_year" integer
);
--> statement-breakpoint
CREATE TABLE "entity_period_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_person_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"birth_year" integer,
	"death_year" integer,
	"nationality_label" text
);
--> statement-breakpoint
CREATE TABLE "entity_place_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"modern_name" text,
	"latitude" real,
	"longitude" real
);
--> statement-breakpoint
CREATE TABLE "entity_theme_details" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"color_hex" text
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"source_entity_id" text NOT NULL,
	"target_entity_id" text NOT NULL,
	"type" "relationship_type" NOT NULL,
	"explanation" text,
	"strength" integer DEFAULT 50 NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"disputed" boolean DEFAULT false NOT NULL,
	"valid_period_id" text,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"editorial_status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationships_source_target_type_unique" UNIQUE("source_entity_id","target_entity_id","type"),
	CONSTRAINT "relationships_no_self_link" CHECK ("relationships"."source_entity_id" <> "relationships"."target_entity_id"),
	CONSTRAINT "relationships_strength_range" CHECK ("relationships"."strength" >= 0 AND "relationships"."strength" <= 100),
	CONSTRAINT "relationships_confidence_range" CHECK ("relationships"."confidence" >= 0 AND "relationships"."confidence" <= 100)
);
--> statement-breakpoint
CREATE TABLE "claim_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text NOT NULL,
	"source_id" text NOT NULL,
	"quotation" text,
	"locator" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claim_sources_unique" UNIQUE("claim_id","source_id","locator")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"subject_type" "claim_subject_type" NOT NULL,
	"subject_id" text NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"verification_status" "claim_verification_status" DEFAULT 'unverified' NOT NULL,
	"disputed" boolean DEFAULT false NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claims_confidence_range" CHECK ("claims"."confidence" >= 0 AND "claims"."confidence" <= 100),
	CONSTRAINT "claims_text_not_empty" CHECK (length("claims"."text") > 0)
);
--> statement-breakpoint
CREATE TABLE "relationship_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"relationship_id" text NOT NULL,
	"claim_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationship_claims_unique" UNIQUE("relationship_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" "source_type" NOT NULL,
	"publication_year" integer,
	"url" text,
	"identifier" text,
	"notes" text,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_title_not_empty" CHECK (length("sources"."title") > 0)
);
--> statement-breakpoint
CREATE TABLE "yol_compositions" (
	"id" text PRIMARY KEY NOT NULL,
	"period_id" text NOT NULL,
	"anchor_slug" text,
	"title" text NOT NULL,
	"thesis" text NOT NULL,
	"supporting_line" text,
	"atmosphere_preset" text NOT NULL,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"editorial_status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "yol_compositions_anchor_slug_unique" UNIQUE("anchor_slug"),
	CONSTRAINT "yol_title_not_empty" CHECK (length("yol_compositions"."title") > 0)
);
--> statement-breakpoint
CREATE TABLE "yol_featured_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"yol_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "yol_featured_entities_unique" UNIQUE("yol_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "yol_scene_hints" (
	"id" text PRIMARY KEY NOT NULL,
	"yol_id" text NOT NULL,
	"hint_key" text NOT NULL,
	"hint_value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yol_themes" (
	"id" text PRIMARY KEY NOT NULL,
	"yol_id" text NOT NULL,
	"theme_entity_id" text NOT NULL,
	"importance" integer DEFAULT 50 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "yol_themes_unique" UNIQUE("yol_id","theme_entity_id"),
	CONSTRAINT "yol_themes_importance_range" CHECK ("yol_themes"."importance" >= 0 AND "yol_themes"."importance" <= 100)
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"media_type" "media_type" NOT NULL,
	"creator" text,
	"source_organisation" text,
	"source_url" text,
	"licence" text,
	"is_public_domain" boolean DEFAULT false NOT NULL,
	"attribution_text" text,
	"rights_status" "media_rights_status" DEFAULT 'unknown' NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_title_not_empty" CHECK (length("media"."title") > 0)
);
--> statement-breakpoint
CREATE TABLE "media_associations" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text NOT NULL,
	"subject_type" "media_subject_type" NOT NULL,
	"subject_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_primary_period_id_periods_id_fk" FOREIGN KEY ("primary_period_id") REFERENCES "public"."periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_civilisation_details" ADD CONSTRAINT "entity_civilisation_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_civilisation_details" ADD CONSTRAINT "entity_civilisation_details_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_concept_details" ADD CONSTRAINT "entity_concept_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_event_details" ADD CONSTRAINT "entity_event_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_event_details" ADD CONSTRAINT "entity_event_details_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_invention_details" ADD CONSTRAINT "entity_invention_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_organisation_details" ADD CONSTRAINT "entity_organisation_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_period_details" ADD CONSTRAINT "entity_period_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_period_details" ADD CONSTRAINT "entity_period_details_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_person_details" ADD CONSTRAINT "entity_person_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_place_details" ADD CONSTRAINT "entity_place_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_theme_details" ADD CONSTRAINT "entity_theme_details_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_entity_id_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_entity_id_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_valid_period_id_periods_id_fk" FOREIGN KEY ("valid_period_id") REFERENCES "public"."periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_claims" ADD CONSTRAINT "relationship_claims_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_claims" ADD CONSTRAINT "relationship_claims_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_compositions" ADD CONSTRAINT "yol_compositions_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_featured_entities" ADD CONSTRAINT "yol_featured_entities_yol_id_yol_compositions_id_fk" FOREIGN KEY ("yol_id") REFERENCES "public"."yol_compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_featured_entities" ADD CONSTRAINT "yol_featured_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_scene_hints" ADD CONSTRAINT "yol_scene_hints_yol_id_yol_compositions_id_fk" FOREIGN KEY ("yol_id") REFERENCES "public"."yol_compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_themes" ADD CONSTRAINT "yol_themes_yol_id_yol_compositions_id_fk" FOREIGN KEY ("yol_id") REFERENCES "public"."yol_compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_themes" ADD CONSTRAINT "yol_themes_theme_entity_id_entities_id_fk" FOREIGN KEY ("theme_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_associations" ADD CONSTRAINT "media_associations_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "periods_start_year_idx" ON "periods" USING btree ("start_year");--> statement-breakpoint
CREATE INDEX "periods_end_year_idx" ON "periods" USING btree ("end_year");--> statement-breakpoint
CREATE INDEX "periods_display_year_idx" ON "periods" USING btree ("display_year");--> statement-breakpoint
CREATE INDEX "entities_kind_slug_idx" ON "entities" USING btree ("kind","slug");--> statement-breakpoint
CREATE INDEX "entities_label_idx" ON "entities" USING btree ("label");--> statement-breakpoint
CREATE INDEX "entities_primary_period_idx" ON "entities" USING btree ("primary_period_id");--> statement-breakpoint
CREATE INDEX "relationships_source_idx" ON "relationships" USING btree ("source_entity_id");--> statement-breakpoint
CREATE INDEX "relationships_target_idx" ON "relationships" USING btree ("target_entity_id");--> statement-breakpoint
CREATE INDEX "relationships_type_idx" ON "relationships" USING btree ("type");--> statement-breakpoint
CREATE INDEX "relationships_source_type_idx" ON "relationships" USING btree ("source_entity_id","type");--> statement-breakpoint
CREATE INDEX "relationships_target_type_idx" ON "relationships" USING btree ("target_entity_id","type");--> statement-breakpoint
CREATE INDEX "claim_sources_claim_idx" ON "claim_sources" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "claim_sources_source_idx" ON "claim_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "claims_subject_idx" ON "claims" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "relationship_claims_relationship_idx" ON "relationship_claims" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX "relationship_claims_claim_idx" ON "relationship_claims" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "sources_type_idx" ON "sources" USING btree ("type");--> statement-breakpoint
CREATE INDEX "yol_period_idx" ON "yol_compositions" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "yol_featured_entities_yol_idx" ON "yol_featured_entities" USING btree ("yol_id");--> statement-breakpoint
CREATE INDEX "yol_scene_hints_yol_idx" ON "yol_scene_hints" USING btree ("yol_id");--> statement-breakpoint
CREATE INDEX "yol_themes_yol_idx" ON "yol_themes" USING btree ("yol_id");--> statement-breakpoint
CREATE INDEX "media_type_idx" ON "media" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "media_associations_subject_idx" ON "media_associations" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "media_associations_media_idx" ON "media_associations" USING btree ("media_id");