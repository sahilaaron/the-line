/**
 * Anchor-specific YoL read endpoint: GET /api/yol/[anchorSlug]
 *
 * The canonical database -> Year-on-Line read path. Separate from the Seed
 * Inspector's /api/line-data (that route is a development inspector; this
 * one feeds the public experience). All SQL stays in
 * src/db/queries/yol-read-model.ts; this handler only shapes the envelope.
 *
 * Failure discipline: the public experience must never see paths, SQL
 * errors or stack traces — failures collapse to typed statuses and the
 * client falls back to the isolated prototype registry. Diagnostics belong
 * to the Seed Inspector (?debug=1), not this route.
 */
import { NextResponse } from 'next/server';
import { getDevDb } from '@/src/db/client/dev';
import { yolReadModelByAnchorSlug } from '@/src/db/queries/yol-read-model';
import type { YolApiResponse } from '@/src/domain/yol-read-model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_SLUG = /^[a-z0-9-]{1,64}$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ anchorSlug: string }> },
): Promise<NextResponse<YolApiResponse>> {
  const { anchorSlug } = await params;
  if (!VALID_SLUG.test(anchorSlug)) {
    return NextResponse.json({ status: 'not_found' } as const, { status: 404 });
  }
  try {
    const db = getDevDb();
    const model = await yolReadModelByAnchorSlug(db, anchorSlug);
    if (!model) {
      return NextResponse.json({ status: 'not_found' } as const, { status: 404 });
    }
    if (model.points.length === 0) {
      // migrated but unseeded chronology — treat as empty so the client
      // uses the fallback registry rather than rendering a hollow year
      return NextResponse.json({ status: 'empty' } as const);
    }
    return NextResponse.json({ status: 'ok', model } as const);
  } catch {
    // deliberately swallowed: no internals cross the public boundary
    return NextResponse.json({ status: 'error' } as const, { status: 503 });
  }
}
