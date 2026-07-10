/**
 * Transactional (all-or-nothing) fixture import. `dryRun: true` runs the
 * exact same insert sequence inside a transaction and then always rolls
 * it back, so it validates against real FK/unique constraints without
 * writing anything. On any failure the whole import is rolled back — no
 * partial corruption.
 */
import * as schema from '../schema';
import type { Db } from '../repositories/types';
import { EXPORT_FORMAT_VERSION, type ExportPayload, type ImportSummary } from './types';

class DryRunAbort extends Error {
  constructor(public summary: ImportSummary) {
    super('dry-run-abort');
  }
}

export interface ImportOptions {
  dryRun?: boolean;
}

export async function importFixture(db: Db, payload: ExportPayload, opts: ImportOptions = {}): Promise<ImportSummary> {
  const created: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  const failed: Record<string, number> = {};
  const errorMessages: string[] = [];

  if (payload.formatVersion !== EXPORT_FORMAT_VERSION) {
    return {
      created,
      skipped,
      failed,
      dryRun: !!opts.dryRun,
      ok: false,
      errorMessages: [`unsupported formatVersion ${payload.formatVersion} (expected ${EXPORT_FORMAT_VERSION})`],
    };
  }

  // Chunked to avoid exceeding SQL parameter/stack limits on large
  // imports (e.g. the synthetic stress dataset has 10k+ periods / 20k+
  // relationships) — one INSERT per chunk, all still inside the same
  // transaction so atomicity is preserved.
  const INSERT_CHUNK_SIZE = 500;

  async function insertTable<T extends Record<string, unknown>>(
    tx: Db,
    table: Parameters<Db['insert']>[0],
    label: string,
    rows: T[],
  ) {
    if (rows.length === 0) return;
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
      const result = await tx.insert(table).values(chunk as never).onConflictDoNothing().returning();
      created[label] = (created[label] ?? 0) + result.length;
      skipped[label] = (skipped[label] ?? 0) + (chunk.length - result.length);
    }
  }

  try {
    await db.transaction(async (tx) => {
      const d = payload.data;
      await insertTable(tx, schema.periods, 'periods', d.periods);
      await insertTable(tx, schema.entities, 'entities', d.entities);
      await insertTable(tx, schema.entityPersonDetails, 'entityPersonDetails', d.entityPersonDetails);
      await insertTable(tx, schema.entityInventionDetails, 'entityInventionDetails', d.entityInventionDetails);
      await insertTable(tx, schema.entityEventDetails, 'entityEventDetails', d.entityEventDetails);
      await insertTable(tx, schema.entityThemeDetails, 'entityThemeDetails', d.entityThemeDetails);
      await insertTable(tx, schema.entityPlaceDetails, 'entityPlaceDetails', d.entityPlaceDetails);
      await insertTable(tx, schema.entityOrganisationDetails, 'entityOrganisationDetails', d.entityOrganisationDetails);
      await insertTable(tx, schema.entityCivilisationDetails, 'entityCivilisationDetails', d.entityCivilisationDetails);
      await insertTable(tx, schema.entityConceptDetails, 'entityConceptDetails', d.entityConceptDetails);
      await insertTable(tx, schema.entityPeriodDetails, 'entityPeriodDetails', d.entityPeriodDetails);
      await insertTable(tx, schema.relationships, 'relationships', d.relationships);
      await insertTable(tx, schema.sources, 'sources', d.sources);
      await insertTable(tx, schema.claims, 'claims', d.claims);
      await insertTable(tx, schema.claimSources, 'claimSources', d.claimSources);
      await insertTable(tx, schema.relationshipClaims, 'relationshipClaims', d.relationshipClaims);
      await insertTable(tx, schema.yolCompositions, 'yolCompositions', d.yolCompositions);
      await insertTable(tx, schema.yolThemes, 'yolThemes', d.yolThemes);
      await insertTable(tx, schema.yolSceneHints, 'yolSceneHints', d.yolSceneHints);
      await insertTable(tx, schema.yolFeaturedEntities, 'yolFeaturedEntities', d.yolFeaturedEntities);
      await insertTable(tx, schema.yolTimelinePoints, 'yolTimelinePoints', d.yolTimelinePoints ?? []);
      await insertTable(tx, schema.yolPointThemes, 'yolPointThemes', d.yolPointThemes ?? []);
      await insertTable(tx, schema.media, 'media', d.media);
      await insertTable(tx, schema.mediaAssociations, 'mediaAssociations', d.mediaAssociations);

      if (opts.dryRun) {
        throw new DryRunAbort({ created, skipped, failed, dryRun: true, ok: true, errorMessages });
      }
    });
  } catch (err) {
    if (err instanceof DryRunAbort) {
      return err.summary;
    }
    return {
      created: {},
      skipped: {},
      failed,
      dryRun: !!opts.dryRun,
      ok: false,
      errorMessages: [
        err instanceof Error
          ? `${err.message}${(err as { cause?: unknown }).cause ? ` | cause: ${String((err as { cause?: unknown }).cause)}` : ''}`
          : String(err),
      ],
    };
  }

  return { created, skipped, failed, dryRun: !!opts.dryRun, ok: true, errorMessages };
}
