ALTER TABLE "research_package_items" ADD COLUMN "agent_held" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "research_package_items" DROP CONSTRAINT "research_package_items_held_consistent";--> statement-breakpoint
ALTER TABLE "research_package_items" ADD CONSTRAINT "research_package_items_held_consistent" CHECK ("research_package_items"."held" = ("research_package_items"."human_held" OR "research_package_items"."qa_held" OR "research_package_items"."agent_held"));--> statement-breakpoint
ALTER TABLE "research_packages" ADD CONSTRAINT "research_packages_job_unique" UNIQUE("job_id");
