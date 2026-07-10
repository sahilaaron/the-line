'use client';

import { useEffect, useState } from 'react';
import { ANCHORS } from '@/src/data/anchors';
import { useExperience } from '../store';
import { reloadLineData, useLineData, type Provenance } from './useLineData';

/**
 * Seed Inspector — a developer view of the seeded historical data, woven into
 * Line View but HIDDEN by default. It opens only when explicitly toggled
 * (button, or the `i` key), so the default experience stays clean.
 *
 * Reads the shared /api/line-data snapshot (see useLineData) and, for the
 * anchor active on the Line, shows the full record graph: period, YoL, themes,
 * featured entities, incoming/outgoing relationships, claims + sources — each
 * tagged prototype / synthetic / reviewed. The thousands of synthetic rows are
 * summarised by count only; never enumerated, never sent to the 3D canvas.
 */

function fmtYear(y: number | null): string {
  if (y === null || Number.isNaN(y)) return '—';
  return y < 0 ? `${Math.abs(y).toLocaleString()} BCE` : `${y.toLocaleString()}`;
}

function Tag({ p }: { p: Provenance }) {
  return <span className={`si-tag si-tag-${p}`}>{p}</span>;
}

export function DataLayer({
  active,
  debug = false,
}: {
  active: boolean;
  /** show the on-screen toggle (dev). Without it, only the `i` key opens. */
  debug?: boolean;
}) {
  const activeIndex = useExperience((s) => s.activeIndex);
  const activeSlug = ANCHORS[activeIndex]?.id ?? null;

  const [open, setOpen] = useState(false);
  const [pinnedSlug, setPinnedSlug] = useState<string | null>(null);
  const { data, error } = useLineData();

  // `i` toggles the inspector.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'i' || e.key === 'I') setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!active) return null;

  const shownSlug = pinnedSlug ?? activeSlug;
  const anchor = data?.anchors?.find((a) => a.slug === shownSlug) ?? null;

  return (
    <>
      {(debug || open) && (
        <button
          className={`si-toggle ${open ? 'is-open' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? '✕ Close inspector' : '⌗ Seed Inspector'}
        </button>
      )}

      {open && (
        <aside className="si-panel" role="dialog" aria-label="Seed Inspector">
          {(error || data?.dbError) && (
            <div className="si-state">
              <h3 className="si-h">Database unavailable</h3>
              <p className="si-msg">{data?.message ?? 'Could not reach /api/line-data.'}</p>
              {data?.dbPath && <code className="si-path">{data.dbPath}</code>}
              {data?.error && <p className="si-err">{data.error}</p>}
              <button className="si-retry" onClick={reloadLineData}>↻ retry</button>
            </div>
          )}

          {!error && !data && (
            <div className="si-state">
              <p className="si-msg">reading the archive…</p>
            </div>
          )}

          {data && !data.dbError && !data.seeded && (
            <div className="si-state">
              <h3 className="si-h">No seeded data</h3>
              <p className="si-msg">{data.message}</p>
              {data.dbPath && <code className="si-path">{data.dbPath}</code>}
              <button className="si-retry" onClick={reloadLineData}>↻ re-check</button>
            </div>
          )}

          {data && data.seeded && (
            <div className="si-body">
              <header className="si-head">
                <div className="si-title">Seed Inspector</div>
                <span className={`si-set si-set-${data.seedSet}`}>{data.seedSet} seed</span>
              </header>

              <div className="si-totals">
                {data.counts &&
                  (['entities', 'periods', 'relationships', 'claims', 'sources', 'yol'] as const).map((k) => (
                    <span key={k} className="si-total">
                      <b>{(data.counts?.[k] ?? 0).toLocaleString()}</b> {k}
                    </span>
                  ))}
              </div>

              {data.hasSynthetic && data.synthetic && data.prototype && (
                <div className="si-split">
                  <span className="si-split-p">prototype {(data.prototype.entities ?? 0).toLocaleString()} ent</span>
                  <span className="si-split-s">
                    synthetic {(data.synthetic.entities ?? 0).toLocaleString()} ent ·{' '}
                    {(data.synthetic.relationships ?? 0).toLocaleString()} links
                  </span>
                </div>
              )}

              <code className="si-path" title="Resolved PGlite directory (same one the db:* scripts write)">
                {data.dbPath}
              </code>

              <div className="si-tabs">
                {data.anchors?.map((a) => (
                  <button
                    key={a.slug ?? a.label}
                    className={`si-tab ${a.slug === shownSlug ? 'is-sel' : ''} ${a.slug === activeSlug ? 'is-active' : ''}`}
                    onClick={() => setPinnedSlug(a.slug)}
                    title={a.slug === activeSlug ? 'active on the Line' : undefined}
                  >
                    {fmtYear(a.displayYear ?? a.startYear)}
                  </button>
                ))}
                {pinnedSlug && (
                  <button className="si-follow" onClick={() => setPinnedSlug(null)}>↺ follow Line</button>
                )}
              </div>

              {anchor ? (
                <div className="si-detail">
                  <div className="si-anchor-year">{fmtYear(anchor.displayYear ?? anchor.startYear)}</div>
                  <div className="si-anchor-label">{anchor.label}</div>

                  <section className="si-sec">
                    <h4 className="si-sh">Period <Tag p={anchor.period.provenance} /></h4>
                    <p className="si-kv">
                      precision {anchor.period.precision ?? '—'} · confidence {anchor.period.confidence} ·{' '}
                      {anchor.period.editorialStatus}
                      {anchor.period.isPlaceholder && ' · placeholder'}
                    </p>
                  </section>

                  <section className="si-sec">
                    <h4 className="si-sh">YoL composition {anchor.yol && <Tag p={anchor.yol.provenance} />}</h4>
                    {anchor.yol ? (
                      <>
                        <p className="si-thesis">{anchor.yol.thesis}</p>
                        {anchor.yol.supportingLine && <p className="si-kv">{anchor.yol.supportingLine}</p>}
                        <p className="si-kv">atmosphere {anchor.yol.atmosphere} · {anchor.yol.editorialStatus}</p>
                      </>
                    ) : (
                      <p className="si-none">none</p>
                    )}
                  </section>

                  <section className="si-sec">
                    <h4 className="si-sh">Themes</h4>
                    {anchor.themes.length ? (
                      <div className="si-chips">
                        {anchor.themes.map((t) => (
                          <span key={t.label} className="si-chip">{t.label}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="si-none">none</p>
                    )}
                  </section>

                  <section className="si-sec">
                    <h4 className="si-sh">Featured entities</h4>
                    {anchor.featured.length ? (
                      <ul className="si-list">
                        {anchor.featured.map((f, i) => (
                          <li key={i}>
                            {f.label} <span className="si-dim">· {f.kind}</span> <Tag p={f.provenance} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="si-none">none recorded</p>
                    )}
                    <p className="si-kv">{anchor.entityCount} entities on this period</p>
                  </section>

                  <section className="si-sec">
                    <h4 className="si-sh">
                      Relationships
                      <span className="si-dim">
                        {' '}{anchor.relationships.outgoing.length} out · {anchor.relationships.incoming.length} in
                      </span>
                    </h4>
                    {anchor.relationships.outgoing.length === 0 && anchor.relationships.incoming.length === 0 ? (
                      <p className="si-none">none recorded</p>
                    ) : (
                      <ul className="si-list">
                        {anchor.relationships.outgoing.map((r, i) => (
                          <li key={`o${i}`}>
                            → <b>{r.type}</b> {r.other}{' '}
                            <span className="si-dim">s{r.strength}/c{r.confidence}</span>
                            {r.disputed && <span className="si-disp"> disputed</span>} <Tag p={r.provenance} />
                          </li>
                        ))}
                        {anchor.relationships.incoming.map((r, i) => (
                          <li key={`i${i}`}>
                            ← <b>{r.type}</b> {r.other}{' '}
                            <span className="si-dim">s{r.strength}/c{r.confidence}</span>
                            {r.disputed && <span className="si-disp"> disputed</span>} <Tag p={r.provenance} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="si-sec">
                    <h4 className="si-sh">Claims &amp; sources</h4>
                    {anchor.claims.length ? (
                      <ul className="si-list">
                        {anchor.claims.map((c, i) => (
                          <li key={i}>
                            {c.text} <span className="si-dim">· {c.verificationStatus}</span>
                            {c.disputed && <span className="si-disp"> disputed</span>} <Tag p={c.provenance} />
                            {c.sources.length > 0 && (
                              <ul className="si-sublist">
                                {c.sources.map((s, j) => (
                                  <li key={j}>
                                    {s.title}{' '}
                                    <span className="si-dim">· {s.type}{s.publicationYear ? ` · ${s.publicationYear}` : ''}</span>{' '}
                                    <Tag p={s.provenance} />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="si-none">none recorded</p>
                    )}
                  </section>
                </div>
              ) : (
                <p className="si-none">No curated anchor selected.</p>
              )}
            </div>
          )}
        </aside>
      )}
    </>
  );
}
