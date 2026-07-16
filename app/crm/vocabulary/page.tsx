import Link from 'next/link';
import { getDevDb } from '@/src/db/client/dev';
import { getRelationshipVocabulary } from '@/src/services/research/vocabulary';
import { entityKindValues, ENTITY_KIND_LABELS } from '@/src/db/validation/entity';
import s from '../crm.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function VocabularyPage() {
  const db = getDevDb();
  let vocab: Awaited<ReturnType<typeof getRelationshipVocabulary>> = [];
  try {
    vocab = await getRelationshipVocabulary(db);
  } catch {
    return <p className={s.sub}>Database not migrated. Run <code>npm run db:migrate</code>.</p>;
  }
  return (
    <div>
      <Link href="/crm" className={s.back}>← Dashboard</Link>
      <h1 className={s.h}>Controlled vocabulary v1 <span className={s.muted} style={{ fontSize: '0.72rem' }}>(read-only)</span></h1>
      <p className={s.sub}>Entity kinds and relationship types are distinct: kinds are nouns; relationship types are verb-like edges. The registry is authoritative; extension is deliberate governance.</p>

      <h2 className={s.h}>Entity kinds</h2>
      <div className={s.card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {entityKindValues.map((k) => (
            <span key={k} className={s.pill} data-testid={`kind-${k}`}>{ENTITY_KIND_LABELS[k]} <span className={s.muted} style={{ fontSize: '0.68rem' }}>({k})</span></span>
          ))}
        </div>
      </div>

      <h2 className={s.h}>Relationship types <span className={s.muted} style={{ fontSize: '0.72rem' }}>({vocab.length})</span></h2>
      <div className={s.card}>
        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', color: '#7f8798' }}>
            <th>key</th><th>forward</th><th>inverse</th><th>direction</th><th>category</th><th>source&rarr;target kinds</th><th>state</th>
          </tr></thead>
          <tbody>
            {vocab.map((v) => (
              <tr key={v.key} data-testid={`vocab-${v.key}`} style={{ borderTop: '1px solid #161a24' }}>
                <td><code>{v.key}</code></td>
                <td>{v.label}</td>
                <td className={s.muted}>{v.inverseLabel}</td>
                <td>{v.directionality}</td>
                <td>{v.category}</td>
                <td className={s.muted} style={{ fontSize: '0.72rem' }}>
                  {(v.allowedSourceKinds ?? ['any']).join('/')} &rarr; {(v.allowedTargetKinds ?? ['any']).join('/')}
                </td>
                <td>
                  {v.isBuiltin && <span className={s.pill}>builtin</span>}
                  {v.isActive ? <span className={`${s.pill} ${s.ok}`}>active</span> : <span className={`${s.pill} ${s.warn}`}>deprecated</span>}
                  {v.isProvisional && <span className={`${s.pill} ${s.hold}`} data-testid="provisional-flag">provisional</span>}
                  {v.isAcyclic && <span className={s.pill}>acyclic</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
