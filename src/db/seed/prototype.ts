/**
 * Prototype seed — the 5 existing prototype anchors (10,000 BCE / 1450 /
 * 1769 / 1969 / 2026) as periods + theme entities + one YoL composition per
 * anchor, PLUS the full local chronology (timeline points) for the years
 * that carry YoL content (1769, 1969), reusing copy from src/data/yol and
 * date/kind metadata from ./yol-chronology.
 *
 * Everything is isPlaceholder: true / editorialStatus: 'draft' — provisional
 * content, not researched history; NO sources are invented.
 *
 * Idempotent AND upgrade-safe: re-running against an already-seeded
 * database only creates what is missing (existence checks by slug /
 * composition+entity), and back-fills the new columns (theme lens keys,
 * long display labels) on rows created by older seed versions.
 */
import { eq } from 'drizzle-orm';
import { ANCHORS } from '../../data/anchors';
import { getYolYear, YOL_CONTENT } from '../../data/yol';
import {
  entities,
  entityEventDetails,
  entityThemeDetails,
  periods,
  yolCompositions,
  yolPointThemes,
  yolSceneHints,
  yolThemes,
  yolTimelinePoints,
} from '../schema';
import type { Db } from '../repositories/types';
import { findPeriodBySlug } from '../repositories/periods';
import { findEntityBySlug } from '../repositories/entities';
import { findYolByAnchorSlug } from '../repositories/yol';
import { lensKeyOf, YOL_CHRONOLOGY } from './yol-chronology';
import type { Anchor } from '../../data/types';

export interface PrototypeSeedSummary {
  periodsCreated: number;
  entitiesCreated: number;
  yolCompositionsCreated: number;
  timelinePointsCreated: number;
}

const DRAFT = {
  isPlaceholder: true,
  isSynthetic: false,
  editorialStatus: 'draft',
} as const;

export async function seedPrototype(db: Db): Promise<PrototypeSeedSummary> {
  const summary: PrototypeSeedSummary = {
    periodsCreated: 0,
    entitiesCreated: 0,
    yolCompositionsCreated: 0,
    timelinePointsCreated: 0,
  };

  for (const anchor of ANCHORS) {
    // 1. Anchor period
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
          ...DRAFT,
        })
        .returning();
      period = row;
      summary.periodsCreated++;
    }

    // 2. Theme entities (+ lens key back-fill for pre-existing rows)
    const themeEntityIdByLens = new Map<string, string>();
    for (const theme of anchor.themes) {
      const slug = `theme-${anchor.id}-${theme.id}`;
      const lensKey = lensKeyOf(theme.id);
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
            ...DRAFT,
          })
          .returning();
        entity = row;
        summary.entitiesCreated++;
        await db.insert(entityThemeDetails).values({ entityId: entity.id, colorHex: theme.color, lensKey });
      } else {
        // upgrade path: ensure the stable lens key exists
        const details = await db.query.entityThemeDetails.findFirst({
          where: eq(entityThemeDetails.entityId, entity.id),
        });
        if (details && details.lensKey === null) {
          await db.update(entityThemeDetails).set({ lensKey }).where(eq(entityThemeDetails.entityId, entity.id));
        } else if (!details) {
          await db.insert(entityThemeDetails).values({ entityId: entity.id, colorHex: theme.color, lensKey });
        }
      }
      themeEntityIdByLens.set(lensKey, entity.id);
    }

    // 3. YoL composition
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
          ...DRAFT,
        })
        .returning();
      yol = row;
      summary.yolCompositionsCreated++;

      await db.insert(yolSceneHints).values([
        { yolId: yol.id, hintKey: 'motif', hintValue: anchor.era.fieldStyle },
        { yolId: yol.id, hintKey: 'density', hintValue: String(anchor.era.density) },
        { yolId: yol.id, hintKey: 'order', hintValue: String(anchor.era.order) },
      ]);

      if (themeEntityIdByLens.size > 0) {
        await db.insert(yolThemes).values(
          [...themeEntityIdByLens.values()].map((themeEntityId, i) => ({
            yolId: yol!.id,
            themeEntityId,
            importance: 100 - i * 10,
            displayOrder: i,
          })),
        );
      }
    }

    // 4. YoL curation upgrades + local chronology for content-carrying years
    await ensureThemeDisplayLabels(db, anchor, yol.id);
    summary.timelinePointsCreated += await ensureYolChronology(db, anchor, yol.id, period.id);
  }

  return summary;
}

/** Long-form YoL theme labels ("Steam & Mechanisation") from the content
 *  registry onto yol_themes.displayLabel (create-or-back-fill). */
async function ensureThemeDisplayLabels(db: Db, anchor: Anchor, yolId: string): Promise<void> {
  const year = getYolYear(anchor.id);
  if (!year) return;
  const rows = await db.query.yolThemes.findMany({ where: eq(yolThemes.yolId, yolId) });
  const entityIds = rows.map((r) => r.themeEntityId);
  if (entityIds.length === 0) return;
  const details = await db.query.entityThemeDetails.findMany();
  const lensByEntity = new Map(details.map((d) => [d.entityId, d.lensKey]));
  for (const [i, theme] of anchor.themes.entries()) {
    const displayLabel = year.content.themeLabels[i];
    if (!displayLabel) continue;
    const lens = lensKeyOf(theme.id);
    const row = rows.find((r) => lensByEntity.get(r.themeEntityId) === lens);
    if (row && row.displayLabel === null) {
      await db.update(yolThemes).set({ displayLabel }).where(eq(yolThemes.id, row.id));
    }
  }
}

/**
 * Seeds the ordered local chronology for one composition:
 * contexts before -> year overview -> dated/undated developments (curated
 * chronological order) -> contexts after -> closing point.
 * Existence-checked per point, so it is idempotent and fills gaps in
 * databases seeded by earlier versions.
 */
async function ensureYolChronology(db: Db, anchor: Anchor, yolId: string, anchorPeriodId: string): Promise<number> {
  const year = getYolYear(anchor.id);
  const chron = YOL_CHRONOLOGY[anchor.id];
  if (!year || !chron) return 0;
  let created = 0;

  const themeRows = await db.query.yolThemes.findMany({ where: eq(yolThemes.yolId, yolId) });
  const details = await db.query.entityThemeDetails.findMany();
  const lensByEntity = new Map(details.map((d) => [d.entityId, d.lensKey]));
  const themeRowByLens = new Map(
    themeRows.flatMap((r) => {
      const lens = lensByEntity.get(r.themeEntityId);
      return lens ? [[lens, r.id] as const] : [];
    }),
  );

  const existingPoints = await db.query.yolTimelinePoints.findMany({ where: eq(yolTimelinePoints.yolId, yolId) });
  const existingByEntity = new Map(existingPoints.filter((p) => p.entityId).map((p) => [p.entityId!, p]));
  const existingByRole = new Map(existingPoints.map((p) => [p.role, p]));
  let order = existingPoints.reduce((m, p) => Math.max(m, p.displayOrder), 0);
  const nextOrder = () => (order += 10);

  const ensurePeriod = async (slug: string, label: string, y: number, date?: { month?: number; day?: number; endMonth?: number; endDay?: number }) => {
    const existing = await findPeriodBySlug(db, slug);
    if (existing) return existing;
    const [row] = await db
      .insert(periods)
      .values({
        slug,
        label,
        precision: 'exact',
        startYear: y,
        endYear: y,
        displayYear: y,
        startMonth: date?.month,
        startDay: date?.day,
        endMonth: date?.endMonth,
        endDay: date?.endDay,
        confidence: 40,
        ...DRAFT,
      })
      .returning();
    return row;
  };

  const ensurePointThemes = async (pointId: string, lensKeys: string[]) => {
    for (const lens of lensKeys) {
      const yolThemeId = themeRowByLens.get(lens);
      if (!yolThemeId) continue;
      await db.insert(yolPointThemes).values({ pointId, yolThemeId }).onConflictDoNothing();
    }
  };

  const addPoint = async (values: typeof yolTimelinePoints.$inferInsert) => {
    const [row] = await db.insert(yolTimelinePoints).values(values).returning();
    created++;
    return row;
  };

  // context points (before and after the anchor year)
  for (const ctx of [...chron.contextsBefore, ...chron.contextsAfter]) {
    const slug = `ctx-${anchor.id}-${ctx.year}`;
    let entity = await findEntityBySlug(db, slug);
    if (!entity) {
      const ctxPeriod = await ensurePeriod(`year-${ctx.year}`, String(ctx.year), ctx.year);
      const [row] = await db
        .insert(entities)
        .values({
          slug,
          kind: 'event',
          label: ctx.label,
          summary: null,
          primaryPeriodId: ctxPeriod.id,
          ...DRAFT,
        })
        .returning();
      entity = row;
    }
    if (!existingByEntity.has(entity.id)) {
      const ctxPeriod = await ensurePeriod(`year-${ctx.year}`, String(ctx.year), ctx.year);
      await addPoint({
        yolId,
        role: 'context',
        entityId: entity.id,
        periodId: ctxPeriod.id,
        displayOrder: ctx.year < anchor.year ? -(anchor.year - ctx.year) * 10 : nextOrderAfter(ctx.year),
        ...DRAFT,
      });
    }
  }

  /** contexts after the year sort behind the developments; encode the year
   *  distance so ordering stays stable and unique. */
  function nextOrderAfter(y: number): number {
    return 10_000 + (y - anchor.year) * 10;
  }

  // year overview (order 0 — the entered year sits between before/after)
  if (!existingByRole.has('overview')) {
    await addPoint({
      yolId,
      role: 'overview',
      entityId: null,
      periodId: anchorPeriodId,
      displayOrder: 0,
      sectionKey: 'overview',
      ...DRAFT,
    });
  }

  // developments, in the curated chronological order from yol-chronology
  order = 0;
  for (const meta of chron.events) {
    const ev = year.events.find((e) => e.id === meta.eventId);
    if (!ev) continue;
    const slug = `yolev-${anchor.id}-${meta.eventId}`;
    let entity = await findEntityBySlug(db, slug);
    const evPeriod = await ensurePeriod(
      `evt-${anchor.id}-${meta.eventId}`,
      `${ev.title} (${ev.date})`,
      anchor.year,
      meta.date,
    );
    if (!entity) {
      const [row] = await db
        .insert(entities)
        .values({
          slug,
          kind: meta.kind,
          label: ev.title,
          summary: ev.text,
          primaryPeriodId: evPeriod.id,
          ...DRAFT,
        })
        .returning();
      entity = row;
      if (meta.kind === 'event') {
        await db.insert(entityEventDetails).values({ entityId: entity.id, periodId: evPeriod.id });
      }
    }
    const pointOrder = nextOrder();
    if (!existingByEntity.has(entity.id)) {
      const point = await addPoint({
        yolId,
        role: 'development',
        entityId: entity.id,
        periodId: evPeriod.id,
        displayOrder: pointOrder,
        sectionKey: ev.section,
        headline: ev.title,
        summary: ev.text,
        ...DRAFT,
      });
      await ensurePointThemes(point.id, ev.themes);
    }
  }

  // closing/transition point, after everything
  if (!existingByRole.has('closing')) {
    await addPoint({
      yolId,
      role: 'closing',
      entityId: null,
      periodId: null,
      displayOrder: 100_000,
      sectionKey: 'closing',
      headline: chron.closingHeadline,
      ...DRAFT,
    });
  }

  return created;
}
