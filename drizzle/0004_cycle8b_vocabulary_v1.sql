ALTER TYPE "public"."entity_kind" ADD VALUE 'discovery';--> statement-breakpoint
ALTER TYPE "public"."entity_kind" ADD VALUE 'technology';--> statement-breakpoint
ALTER TYPE "public"."entity_kind" ADD VALUE 'movement';--> statement-breakpoint
ALTER TYPE "public"."entity_kind" ADD VALUE 'publication';--> statement-breakpoint
ALTER TYPE "public"."entity_kind" ADD VALUE 'product';--> statement-breakpoint
ALTER TYPE "public"."entity_kind" ADD VALUE 'law_policy';--> statement-breakpoint
ALTER TABLE "relationship_type_registry" ADD COLUMN "is_provisional" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Cycle 8B: seed relationship vocabulary v1 additions (idempotent).
INSERT INTO "relationship_type_registry"
  ("key","label","inverse_label","directionality","category","is_acyclic","allowed_source_kinds","allowed_target_kinds","is_builtin","is_active","is_provisional","description")
VALUES
  ('invented_by','was invented by','invented','directed','attribution',true,'["invention","technology","product"]'::jsonb,'["person","organisation"]'::jsonb,false,true,false,'Attributes an invention/technology/product to its inventor.'),
  ('discovered_by','was discovered by','discovered','directed','attribution',true,'["discovery","concept","place"]'::jsonb,'["person","organisation"]'::jsonb,false,true,false,'Attributes a discovery/concept/place to its discoverer.'),
  ('authored_by','was authored by','authored','directed','attribution',true,'["publication","concept","law_policy"]'::jsonb,'["person","organisation"]'::jsonb,false,true,false,'Attributes a publication/work/law to its author.'),
  ('founded_by','was founded by','founded','directed','attribution',true,'["organisation","movement","civilisation"]'::jsonb,'["person"]'::jsonb,false,true,false,'Attributes an organisation/movement to its founder.'),
  ('funded_by','was funded by','funded','directed','support',false,NULL,'["person","organisation"]'::jsonb,false,true,false,'Financial support relationship.'),
  ('commissioned_by','was commissioned by','commissioned','directed','support',false,NULL,'["person","organisation"]'::jsonb,false,true,false,'Commissioned/ordered by a patron.'),
  ('sponsored_by','was sponsored by','sponsored','directed','support',false,NULL,'["person","organisation"]'::jsonb,false,true,false,'Sponsorship/patronage relationship.'),
  ('caused','caused','was caused by','directed','causal',true,NULL,NULL,false,true,false,'Direct causation (stronger than influence/contribution).'),
  ('hindered','hindered','was hindered by','directed','causal',false,NULL,NULL,false,true,false,'Impeded or slowed a development.'),
  ('inspired','inspired','was inspired by','directed','influence',false,NULL,NULL,false,true,false,'Creative/intellectual inspiration.'),
  ('derived_from','derived from','was the source for','directed','influence',true,NULL,NULL,false,true,false,'Derived/adapted from a prior subject.'),
  ('based_on','based on','was the basis for','directed','influence',true,NULL,NULL,false,true,false,'Built directly upon a prior subject.'),
  ('preceded','preceded','followed','directed','succession',true,NULL,NULL,false,true,false,'Temporal/logical predecessor.'),
  ('superseded','superseded','was superseded by','directed','succession',true,NULL,NULL,false,true,false,'Rendered a predecessor obsolete.'),
  ('subtype_of','subtype of','has subtype','directed','structural',true,NULL,NULL,false,true,false,'Classification: a more specific kind of the target.'),
  ('instance_of','instance of','has instance','directed','structural',true,NULL,NULL,false,true,false,'A concrete instance of a class/concept.'),
  ('member_of','member of','has member','directed','institutional',false,'["person","organisation"]'::jsonb,'["organisation","movement"]'::jsonb,false,true,false,'Membership in an organisation/movement.'),
  ('affiliated_with','affiliated with','affiliated with','symmetric','institutional',false,NULL,NULL,false,true,false,'Loose institutional affiliation (symmetric).'),
  ('owned_by','owned by','owns','directed','institutional',false,NULL,'["person","organisation"]'::jsonb,false,true,false,'Ownership relationship.'),
  ('collaborated_with','collaborated with','collaborated with','symmetric','interaction',false,'["person","organisation"]'::jsonb,'["person","organisation"]'::jsonb,false,true,false,'Cooperative work (symmetric).'),
  ('competed_with','competed with','competed with','symmetric','interaction',false,NULL,NULL,false,true,false,'Rivalry/competition (symmetric).'),
  ('developed_in','was developed in','was where it was developed','directed','spatial',false,NULL,'["place","organisation"]'::jsonb,false,true,false,'Place/organisation where a subject was developed.'),
  ('headquartered_in','is headquartered in','is the headquarters of','directed','spatial',false,'["organisation"]'::jsonb,'["place"]'::jsonb,false,true,false,'Organisation headquarters location.'),
  ('adopted_by','was adopted by','adopted','directed','diffusion',false,NULL,NULL,false,true,false,'Adoption/uptake by a group or place.'),
  ('commercialized_by','was commercialized by','commercialized','directed','diffusion',false,'["invention","technology","product"]'::jsonb,'["organisation","person"]'::jsonb,false,true,false,'Brought to market by an organisation/person.')
ON CONFLICT ("key") DO NOTHING;

--> statement-breakpoint
-- The fallback type is imprecise/provisional and belongs to its own category.
UPDATE "relationship_type_registry" SET "is_provisional" = true, "category" = 'fallback' WHERE "key" = 'associated_with';
