/**
 * Period repository: exact-year lookup, containment, curated-anchor
 * nearest match, range/overlap listing. Curated anchors are periods with
 * a non-null `slug` (mirrors the 5 prototype anchors).
 */
import { and, asc, eq, gte, isNotNull, lte, or, sql } from 'drizzle-orm';
import { periods, type NewPeriod, type Period } from '../schema';
import type { Db } from './types';

export async function createPeriod(db: Db, input: NewPeriod): Promise<Period> {
  const [row] = await db.insert(periods).values(input).returning();
  return row;
}

export async function findPeriodById(db: Db, id: string): Promise<Period | undefined> {
  return db.query.periods.findFirst({ where: eq(periods.id, id) });
}

export async function findPeriodBySlug(db: Db, slug: string): Promise<Period | undefined> {
  return db.query.periods.findFirst({ where: eq(periods.slug, slug) });
}

/** Periods whose [startYear, endYear] contains the exact year (open ends
 * count as containing everything on that side). */
export async function findExactYear(db: Db, year: number): Promise<Period[]> {
  return db.query.periods.findMany({
    where: and(
      or(sql`${periods.startYear} IS NULL`, lte(periods.startYear, year)),
      or(sql`${periods.endYear} IS NULL`, gte(periods.endYear, year)),
    ),
  });
}

/** Periods that fully contain [rangeStart, rangeEnd]. */
export async function findContainingRange(
  db: Db,
  rangeStart: number,
  rangeEnd: number,
): Promise<Period[]> {
  return db.query.periods.findMany({
    where: and(
      or(sql`${periods.startYear} IS NULL`, lte(periods.startYear, rangeStart)),
      or(sql`${periods.endYear} IS NULL`, gte(periods.endYear, rangeEnd)),
    ),
  });
}

/** Nearest curated anchor (slug IS NOT NULL) to a given year, by
 * displayYear/startYear distance. Curated anchor set is small (≤ tens),
 * so an in-memory scan over just that subset is fine. */
export async function findNearestCuratedAnchor(db: Db, year: number): Promise<Period | undefined> {
  const anchors = await db.query.periods.findMany({ where: isNotNull(periods.slug) });
  let best: Period | undefined;
  let bestDist = Infinity;
  for (const p of anchors) {
    const y = p.displayYear ?? p.startYear ?? p.endYear;
    if (y === null || y === undefined) continue;
    const dist = Math.abs(y - year);
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

/** Periods overlapping [rangeStart, rangeEnd] at all (not necessarily
 * containing it fully). */
export async function listOverlappingPeriods(
  db: Db,
  rangeStart: number,
  rangeEnd: number,
): Promise<Period[]> {
  return db.query.periods.findMany({
    where: and(
      or(sql`${periods.startYear} IS NULL`, lte(periods.startYear, rangeEnd)),
      or(sql`${periods.endYear} IS NULL`, gte(periods.endYear, rangeStart)),
    ),
    orderBy: [asc(periods.startYear)],
  });
}

export async function listPeriodsWithinRange(
  db: Db,
  rangeStart: number,
  rangeEnd: number,
): Promise<Period[]> {
  return db.query.periods.findMany({
    where: and(gte(periods.startYear, rangeStart), lte(periods.endYear, rangeEnd)),
    orderBy: [asc(periods.startYear)],
  });
}
