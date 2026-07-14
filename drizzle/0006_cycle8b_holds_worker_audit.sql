ALTER TABLE "research_jobs" ADD COLUMN "claimed_by_worker" text;--> statement-breakpoint
ALTER TABLE "research_package_items" ADD COLUMN "hold_source" text;--> statement-breakpoint
ALTER TABLE "research_package_item_revisions" ADD CONSTRAINT "research_package_item_revisions_editor_not_empty" CHECK (length("research_package_item_revisions"."editor") > 0);