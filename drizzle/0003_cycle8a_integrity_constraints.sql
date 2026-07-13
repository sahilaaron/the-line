ALTER TABLE "package_decisions" ALTER COLUMN "decision" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."human_package_decision";--> statement-breakpoint
CREATE TYPE "public"."human_package_decision" AS ENUM('approve', 'approve_with_holds', 'return', 'mark_duplicate', 'reject');--> statement-breakpoint
ALTER TABLE "package_decisions" ALTER COLUMN "decision" SET DATA TYPE "public"."human_package_decision" USING "decision"::"public"."human_package_decision";--> statement-breakpoint
ALTER TABLE "research_packages" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "research_packages" ALTER COLUMN "status" SET DEFAULT 'submitted'::text;--> statement-breakpoint
DROP TYPE "public"."research_package_status";--> statement-breakpoint
CREATE TYPE "public"."research_package_status" AS ENUM('draft', 'submitted', 'qa_pending', 'qa_complete', 'in_review', 'approved', 'approved_with_holds', 'returned', 'marked_duplicate', 'rejected', 'promoted');--> statement-breakpoint
ALTER TABLE "research_packages" ALTER COLUMN "status" SET DEFAULT 'submitted'::"public"."research_package_status";--> statement-breakpoint
ALTER TABLE "research_packages" ALTER COLUMN "status" SET DATA TYPE "public"."research_package_status" USING "status"::"public"."research_package_status";--> statement-breakpoint
CREATE UNIQUE INDEX "research_jobs_active_dedupe_unique" ON "research_jobs" USING btree ("dedupe_key") WHERE status in ('queued','claimed','researching','submitted');--> statement-breakpoint
ALTER TABLE "package_decisions" ADD CONSTRAINT "package_decisions_pkg_unique" UNIQUE("package_id");--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_type_or_typekey" CHECK ("relationships"."type" IS NOT NULL OR "relationships"."type_key" IS NOT NULL);