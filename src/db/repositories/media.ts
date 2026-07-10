import { and, eq, inArray } from 'drizzle-orm';
import { media, mediaAssociations, type Media, type NewMedia } from '../schema';
import type { Db } from './types';

export async function createMedia(db: Db, input: NewMedia): Promise<Media> {
  const [row] = await db.insert(media).values(input).returning();
  return row;
}

export async function associateMedia(
  db: Db,
  mediaId: string,
  subjectType: 'entity' | 'period' | 'yol_composition',
  subjectId: string,
): Promise<void> {
  await db.insert(mediaAssociations).values({ mediaId, subjectType, subjectId });
}

export async function listMediaForSubject(
  db: Db,
  subjectType: 'entity' | 'period' | 'yol_composition',
  subjectId: string,
): Promise<Media[]> {
  const links = await db.query.mediaAssociations.findMany({
    where: and(eq(mediaAssociations.subjectType, subjectType), eq(mediaAssociations.subjectId, subjectId)),
  });
  if (links.length === 0) return [];
  return db.query.media.findMany({ where: inArray(media.id, links.map((l) => l.mediaId)) });
}
