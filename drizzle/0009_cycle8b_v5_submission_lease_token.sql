ALTER TYPE "package_edit_kind" ADD VALUE IF NOT EXISTS 'clear_agent_hold';--> statement-breakpoint
ALTER TYPE "package_edit_kind" ADD VALUE IF NOT EXISTS 'confirm_agent_hold';--> statement-breakpoint
ALTER TABLE "research_packages" ADD COLUMN "submission_lease_token" text;
