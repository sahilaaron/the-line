/**
 * Prototype seed — the 5 existing prototype anchors (10,000 BCE / 1450 /
 * 1769 / 1969 / 2026) as periods + minimal theme entities + one YoL
 * composition per anchor, reusing labels from src/data/anchors.ts and
 * src/data/yol.ts. Everything is marked isPlaceholder: true /
 * editorialStatus: 'draft' — nothing here is researched history, mirroring
 * the existing `placeholder: true` convention in src/data.
 *
 * Idempotent: re-running upserts by slug (onConflictDoNothing after an
 * existence check), so `db:seed` can run any number of times safely.
 */
import { ANCHORS } from '../../data/anchors';
import { YOL_CONTENT } from '../../data/yol';
import { entities, entityThemeDetails, periods, yolCompositions, yolSceneHints, yolThemes } from '../schema';
import type { Db } from '../repositories/types';
import { findPeriodBySlug } from '../repositories/periods';
import { findEntityBySlug } from '../repositories/entities';
import { findYolByAnchorSlug } from '../repositories/yol';

export interface PrototypeSeedSummary {
  periodsCreated: number;
  entitiesCreated: number;
  yolCompositionsCreated: number;
}

export async function seedPrototype(db: Db): Promise<PrototypeSeedSummary> {
  let periodsCreated = 0;
  let entitiesCreated = 0;
  let yolCompositionsCreated = 0;

  for (const anchor of ANCHORS) {
    // 1. Period
    let period = await findPeriodBySlug(db, anchor.id);
    if (!period) {
      const [row] = await db
        .insert(periods)
        .values({
          slug: anchor.id,
          label: anchor.label,
          precision: anchor.id === 'bce-10000' ? 'approximate' : 'exact',
          startYear: anchor.year,
          endYear: anchor.year,
          displayYear: anchor.year,
          confidence: 40,
          isPlaceholder: true,
          isSynthetic: false,
          editorialStatus: 'draft',
        })
        .returning();
      period = row;
      periodsCreated++;
    }

    // 2. Theme entities for this anchor
    const themeEntityIds: string[] = [];
    for (const theme of anchor.themes) {
      const slug = `theme-${anchor.id}-${theme.id}`;
      let entity = await findEntityBySlug(db, slug);
      if (!entity) {
        const [row] = await db
          .insert(entities)
          .values({
            slug,
            kind: 'theme',
            label: theme.label,
            summary: `Placeholder theme associated with anchor "${anchor.label}".`,
            primaryPeriodId: period.id,
            isPlaceholder: true,
            isSynthetic: false,
            editorialStatus: 'draft',
          })
          .returning();
        entity = row;
        entitiesCreated++;
        await db.insert(entityThemeDetails).values({ entityId: entity.id, colorHex: theme.color });
      }
      themeEntityIds.push(entity.id);
    }

    // 3. YoL composition (only 1969 has real placeholder thesis content in
    // src/data/yol.ts today; other anchors get a generic draft placeholder
    // so every anchor has a composition row to demonstrate the shape).
    let yol = await findYolByAnchorSlug(db, anchor.id);
    if (!yol) {
      const content = YOL_CONTENT[anchor.id];
      const [row] = await db
        .insert(yolCompositions)
        .values({
          periodId: period.id,
          anchorSlug: anchor.id,
          title: content?.title ?? anchor.label,
          thesis: content?.thesis ?? `Placeholder thesis for "${anchor.label}" — not researched history.`,
          supportingLine: anchor.subtitle,
          atmospherePreset: anchor.era.fieldStyle,
          isPlaceholder: true,
          isSynthetic: false,
          editorialStatus: 'draft',
        })
        .returning();
      yol = row;
      yolCompositionsCreated++;

      await db.insert(yolSceneHints).values([
        { yolId: yol.id, hintKey: 'motif', hintValue: anchor.era.fieldStyle },
        { yolId: yol.id, hintKey: 'density', hintValue: String(anchor.era.density) },
        { yolId: yol.id, hintKey: 'order', hintValue: String(anchor.era.order) },
      ]);

      if (themeEntityIds.length > 0) {
        await db.insert(yolThemes).values(
          themeEntityIds.map((themeEntityId, i) => ({
            yolId: yol!.id,
            themeEntityId,
            importance: 100 - i * 10,
            displayOrder: i,
          })),
        );
      }
    }
  }

  return { periodsCreated, entitiesCreated, yolCompositionsCreated };
}
