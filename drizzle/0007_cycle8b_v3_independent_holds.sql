ALTER TABLE "research_package_items" ADD COLUMN "human_held" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "research_package_items" ADD COLUMN "qa_held" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "research_package_items" SET "human_held" = true WHERE "held" = true AND "hold_source" = 'human';--> statement-breakpoint
UPDATE "research_package_items" SET "qa_held" = true WHERE "held" = true AND "hold_source" = 'qa';--> statement-breakpoint
UPDATE "research_package_items" SET "human_held" = true WHERE "held" = true AND "human_held" = false AND "qa_held" = false;--> statement-breakpoint
ALTER TABLE "research_package_items" DROP COLUMN "hold_source";--> statement-breakpoint
ALTER TABLE "research_package_items" ADD CONSTRAINT "research_package_items_held_consistent" CHECK ("research_package_items"."held" = ("research_package_items"."human_held" OR "research_package_items"."qa_held"));
