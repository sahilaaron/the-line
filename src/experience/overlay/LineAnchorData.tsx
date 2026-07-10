'use client';

import { ANCHORS } from '@/src/data/anchors';
import { useExperience } from '../store';
import { useLineData } from './useLineData';

/**
 * Always-on, subtle inline readout on the Line: the live DB record for the
 * anchor currently active, shown under the year label and updating as you move
 * along the Line. Silent (renders nothing) when the DB is empty or unreachable
 * so it never clutters the Line — the Seed Inspector surfaces those states.
 * Only ever reflects a single curated anchor; synthetic rows never appear here.
 */
export function LineAnchorData() {
  const activeIndex = useExperience((s) => s.activeIndex);
  const slug = ANCHORS[activeIndex]?.id ?? null;
  const { data, error } = useLineData();

  if (error || !data || !data.seeded) return null;
  const a = data.anchors?.find((x) => x.slug === slug);
  if (!a) return null;

  const relTotal = a.relationships.outgoing.length + a.relationships.incoming.length;

  return (
    <div className="line-db" data-testid="line-db">
      <div className="line-db-row">
        <span className={`si-tag si-tag-${a.period.provenance}`}>{a.period.provenance}</span>
        <span className="line-db-src">from the data layer</span>
      </div>
      {a.yol?.thesis && <p className="line-db-thesis">{a.yol.thesis}</p>}
      {a.themes.length > 0 && (
        <div className="line-db-chips">
          {a.themes.map((t) => (
            <span key={t.label} className="line-db-chip">{t.label}</span>
          ))}
        </div>
      )}
      <p className="line-db-counts">
        {a.entityCount} entities · {relTotal} relationships · {a.claims.length} claims
      </p>
    </div>
  );
}
