CREATE TYPE "public"."yol_point_role" AS ENUM('overview', 'development', 'context', 'closing');--> statement-breakpoint
CREATE TABLE "yol_point_themes" (
	"id" text PRIMARY KEY NOT NULL,
	"point_id" text NOT NULL,
	"yol_theme_id" text NOT NULL,
	CONSTRAINT "yol_point_themes_unique" UNIQUE("point_id","yol_theme_id")
);
--> statement-breakpoint
CREATE TABLE "yol_timeline_points" (
	"id" text PRIMARY KEY NOT NULL,
	"yol_id" text NOT NULL,
	"role" "yol_point_role" DEFAULT 'development' NOT NULL,
	"entity_id" text,
	"period_id" text,
	"display_order" integer NOT NULL,
	"section_key" text,
	"headline" text,
	"summary" text,
	"is_placeholder" boolean DEFAULT true NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"editorial_status" "editorial_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "yol_timeline_points_order_unique" UNIQUE("yol_id","display_order")
);
--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "start_month" integer;--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "start_day" integer;--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "end_month" integer;--> statement-breakpoint
ALTER TABLE "periods" ADD COLUMN "end_day" integer;--> statement-breakpoint
ALTER TABLE "entity_theme_details" ADD COLUMN "lens_key" text;--> statement-breakpoint
ALTER TABLE "yol_themes" ADD COLUMN "display_label" text;--> statement-breakpoint
ALTER TABLE "yol_point_themes" ADD CONSTRAINT "yol_point_themes_point_id_yol_timeline_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."yol_timeline_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_point_themes" ADD CONSTRAINT "yol_point_themes_yol_theme_id_yol_themes_id_fk" FOREIGN KEY ("yol_theme_id") REFERENCES "public"."yol_themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_timeline_points" ADD CONSTRAINT "yol_timeline_points_yol_id_yol_compositions_id_fk" FOREIGN KEY ("yol_id") REFERENCES "public"."yol_compositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_timeline_points" ADD CONSTRAINT "yol_timeline_points_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yol_timeline_points" ADD CONSTRAINT "yol_timeline_points_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "yol_point_themes_point_idx" ON "yol_point_themes" USING btree ("point_id");--> statement-breakpoint
CREATE INDEX "yol_timeline_points_yol_idx" ON "yol_timeline_points" USING btree ("yol_id");--> statement-breakpoint
CREATE INDEX "yol_timeline_points_entity_idx" ON "yol_timeline_points" USING btree ("entity_id");--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_month_range" CHECK (("periods"."start_month" IS NULL OR ("periods"."start_month" >= 1 AND "periods"."start_month" <= 12)) AND ("periods"."end_month" IS NULL OR ("periods"."end_month" >= 1 AND "periods"."end_month" <= 12)));--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_day_range" CHECK (("periods"."start_day" IS NULL OR ("periods"."start_day" >= 1 AND "periods"."start_day" <= 31)) AND ("periods"."end_day" IS NULL OR ("periods"."end_day" >= 1 AND "periods"."end_day" <= 31)));