import Link from 'next/link';
import { getDevDb } from '@/src/db/client/dev';
import { getEntityProof } from '@/src/db/queries/crm';
import s from '../../crm.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EntityProof({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDevDb();
  const proof = await getEntityProof(db, slug).catch(() => undefined);
  if (!proof) return <p className={s.sub}>Entity not found.</p>;
  const { entity, aliases, externalIds, classifications, timeAssocs, outRels, inRels, claims, provenancePackage } = proof;

  return (
    <div>
      <Link href="/crm" className={s.back}>← Dashboard</Link>
      <h1 className={s.h}>{entity.label}</h1>
      <p className={s.sub}>
        <span className={`${s.pill} ${s.ok}`}>{entity.graphStatus}</span>{' '}
        <span className={s.pill}>{entity.editorialStatus}</span>{' '}
        {entity.isPlaceholder && <span className={s.pill}>placeholder</span>}{' '}
        <span data-testid="entity-privacy" className={`${s.pill} ${s.warn}`}>private — not published</span>
      </p>

      <div className={s.card}>
        <dl className={s.kv}>
          <dt>slug</dt><dd>{entity.slug}</dd>
          <dt>kind</dt><dd>{entity.kind}</dd>
          <dt>classifications</dt><dd>{classifications.map((c) => c.classification).join(', ') || '—'}</dd>
          <dt>aliases</dt><dd>{aliases.map((a) => a.alias).join(', ') || '—'}</dd>
          <dt>external ids</dt><dd>{externalIds.map((x) => `${x.scheme}:${x.value}`).join(', ') || '—'}</dd>
          <dt>revision</dt><dd>{entity.revision}</dd>
        </dl>
      </div>

      <h2 className={s.h}>Time associations</h2>
      <div className={s.card}>
        {timeAssocs.length === 0 && <div className={s.empty}>None.</div>}
        {timeAssocs.map((t) => (
          <div key={t.id} className={s.row}>
            <span><span className={s.pill}>{t.role}</span> {t.period?.label}</span>
            <span className={s.muted}>{t.period?.startYear}{t.period?.endYear ? `–${t.period.endYear}` : ''} · conf {t.confidence}</span>
          </div>
        ))}
      </div>

      <h2 className={s.h}>Connections</h2>
      <div className={s.card}>
        {outRels.length + inRels.length === 0 && <div className={s.empty}>None.</div>}
        {outRels.map((r) => (
          <div key={r.id} className={s.row}>
            <span>{entity.label} <span className={s.muted}>{r.typeKey ?? r.type}</span> {r.target?.label ?? '—'}</span>
            <span className={s.muted}>{r.assertionClass}</span>
          </div>
        ))}
        {inRels.map((r) => (
          <div key={r.id} className={s.row}>
            <span>{r.source?.label ?? '—'} <span className={s.muted}>{r.typeKey ?? r.type}</span> {entity.label}</span>
            <span className={s.muted}>{r.assertionClass}</span>
          </div>
        ))}
      </div>

      <h2 className={s.h}>Claims &amp; sources</h2>
      <div className={s.card}>
        {claims.length === 0 && <div className={s.empty}>None.</div>}
        {claims.map((c) => (
          <div key={c.id} className={s.itemline}>
            <span style={{ flex: 1 }}>
              {c.text} <span className={s.muted}>[{c.assertionClass} · {c.verificationStatus}]</span>
              {c.sources.map((src, i) => (
                <div key={i} className={s.muted} style={{ fontSize: '0.76rem' }}>↳ {src.title}{src.locator ? ` (${src.locator})` : ''}</div>
              ))}
            </span>
          </div>
        ))}
      </div>

      <h2 className={s.h}>Provenance</h2>
      <div className={s.card}>
        {provenancePackage ? (
          <div className={s.row}>
            <Link href={`/crm/packages/${provenancePackage.id}`}>Promoted from package {provenancePackage.id.slice(0, 8)}</Link>
            <span className={s.muted}>run {provenancePackage.runId?.slice(0, 8) ?? '—'} · {provenancePackage.promotedAt?.toISOString().slice(0, 10)}</span>
          </div>
        ) : (
          <div className={s.empty}>No promotion provenance (seeded/existing canon).</div>
        )}
        <p className={s.muted} style={{ marginTop: '0.6rem' }}>
          Acceptance into the canonical graph is separate from public presentation. This record is private; nothing here is published to the YoL / Historical Field.
        </p>
      </div>
    </div>
  );
}
