CREATE TYPE "public"."package_edit_kind" AS ENUM('field_edit', 'relationship_type', 'relationship_endpoints', 'canonical_match', 'hold', 'unhold', 'reject_item');--> statement-breakpoint
CREATE TABLE "research_package_item_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"package_id" text NOT NULL,
	"edit_kind" "package_edit_kind" NOT NULL,
	"editor" text NOT NULL,
	"before_value" jsonb,
	"after_value" jsonb,
	"note" text,
	"invalidated_qa" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_packages" ADD COLUMN "last_edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "research_package_item_revisions" ADD CONSTRAINT "research_package_item_revisions_item_id_research_package_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."research_package_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_package_item_revisions" ADD CONSTRAINT "research_package_item_revisions_package_id_research_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."research_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_package_item_revisions_item_idx" ON "research_package_item_revisions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "research_package_item_revisions_pkg_idx" ON "research_package_item_revisions" USING btree ("package_id");