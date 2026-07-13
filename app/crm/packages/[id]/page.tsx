import Link from 'next/link';
import { getDevDb } from '@/src/db/client/dev';
import { getPackageDetail } from '@/src/db/queries/crm';
import { decisionAction } from '../../actions';
import s from '../../crm.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function payload(p: unknown): Record<string, unknown> {
  return (p ?? {}) as Record<string, unknown>;
}

export default async function PackageReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDevDb();
  const detail = await getPackageDetail(db, id).catch(() => undefined);
  if (!detail) return <p className={s.sub}>Package not found.</p>;
  const { package: pkg, sections, flags, decisions } = detail;
  const decided = ['approved', 'approved_with_holds', 'returned', 'merged', 'rejected', 'promoted'].includes(pkg.status);
  const central = sections.entity.find((e) => payload(e.payload).role === 'central');

  const flagFor = (section: string, ref: string) => flags.find((f) => f.targetSection === section && f.targetRef === ref);

  return (
    <div>
      <Link href="/crm" className={s.back}>← Dashboard</Link>
      <h1 className={s.h}>{pkg.centralLabel}</h1>
      <p className={s.sub}>
        <span data-testid="pkg-status" className={`${s.pill} ${pkg.status === 'promoted' ? s.ok : ''}`}>{pkg.status}</span>{' '}
        central match: {central ? String(central.matchStatus) : '—'}
        {pkg.promotedEntityId && <> · <Link href={`/crm/entities/${pkg.centralSlug}`}>view canonical record →</Link></>}
      </p>

      <form action={decisionAction}>
        <input type="hidden" name="packageId" value={pkg.id} />

        <Section title="Entities">
          {sections.entity.map((it) => {
            const e = payload(it.payload);
            return (
              <div key={it.id} className={`${s.itemline} ${it.held ? s.held : ''}`}>
                <span className={s.ref}>{it.localRef}</span>
                <span style={{ flex: 1 }}>
                  <b>{String(e.label)}</b> <span className={s.muted}>({String(e.kind ?? '—')})</span>{' '}
                  <span className={`${s.pill} ${it.matchEntityId ? s.ok : s.frontier}`}>{String(it.matchStatus)}</span>
                  {it.isSynthetic && <span className={`${s.pill} ${s.warn}`}>synthetic — excluded</span>}
                </span>
                <HoldBox it={it} section="entity" decided={decided} />
              </div>
            );
          })}
        </Section>

        <Section title="Chronology">
          {sections.time.map((it) => {
            const t = payload(it.payload);
            return (
              <div key={it.id} className={s.itemline}>
                <span className={s.ref}>{it.localRef}</span>
                <span style={{ flex: 1 }}>{String(t.role)} · {String(t.startYear)}{t.endYear ? `–${String(t.endYear)}` : ''} <span className={s.muted}>{String(t.label ?? '')}</span></span>
              </div>
            );
          })}
        </Section>

        <Section title="Connections">
          {sections.relationship.map((it) => {
            const r = payload(it.payload);
            const flag = flagFor('relationship', it.localRef);
            return (
              <div key={it.id} className={`${s.itemline} ${it.held ? s.held : ''}`}>
                <span className={s.ref}>{it.localRef}</span>
                <span style={{ flex: 1 }}>
                  {String(r.sourceRef)} <span className={s.muted}>{String(r.typeKey)}</span> {String(r.targetRef)}
                  {flag && <span className={`${s.pill} ${s.hold}`}>QA: {flag.explanation}</span>}
                </span>
                <HoldBox it={it} section="relationship" decided={decided} />
              </div>
            );
          })}
        </Section>

        <Section title="Claims &amp; sources">
          {sections.claim.map((it) => {
            const c = payload(it.payload);
            return (
              <div key={it.id} className={`${s.itemline} ${it.held ? s.held : ''}`}>
                <span className={s.ref}>{it.localRef}</span>
                <span style={{ flex: 1 }}>{String(c.text)} <span className={s.muted}>[{String(c.assertionClass)} · {String(c.verification)}]</span></span>
                <HoldBox it={it} section="claim" decided={decided} />
              </div>
            );
          })}
          {sections.source.map((it) => (
            <div key={it.id} className={s.itemline}><span className={s.ref}>{it.localRef}</span><span className={s.muted}>{String(payload(it.payload).title)}</span></div>
          ))}
        </Section>

        <Section title="Unresolved questions">
          {sections.question.length === 0 && <div className={s.empty}>None.</div>}
          {sections.question.map((it) => {
            const q = payload(it.payload);
            return <div key={it.id} className={s.itemline}><span className={`${s.pill} ${s.hold}`}>{String(q.category)}</span><span style={{ flex: 1 }}>{String(q.detail)}</span></div>;
          })}
        </Section>

        <Section title="Suggested next entities (→ frontier jobs)">
          {sections.next_entity.map((it) => {
            const n = payload(it.payload);
            return <div key={it.id} className={s.itemline}><span style={{ flex: 1 }}>{String(n.title)} <span className={s.muted}>— {String(n.reason)}</span></span></div>;
          })}
        </Section>

        {!decided ? (
          <div className={s.card}>
            <div className={s.field} style={{ marginBottom: '0.6rem' }}>
              <label>Correction instructions / rejection reason / merge target slug (as needed)</label>
              <input name="instructions" placeholder="return instructions" />
              <input name="reason" placeholder="rejection reason" style={{ marginTop: '0.35rem' }} />
              <input name="mergeTargetSlug" placeholder="merge target slug" style={{ marginTop: '0.35rem' }} />
            </div>
            <div className={s.form}>
              <button className={s.btn} name="decision" value="approve" type="submit">Approve as submitted</button>
              <button data-testid="approve-holds" className={s.btn} name="decision" value="approve_with_holds" type="submit">Approve, hold checked</button>
              <button className={`${s.btn} ${s.ghost}`} name="decision" value="return" type="submit">Return</button>
              <button className={`${s.btn} ${s.ghost}`} name="decision" value="merge" type="submit">Merge</button>
              <button className={`${s.btn} ${s.danger}`} name="decision" value="reject" type="submit">Reject</button>
            </div>
            <p className={s.muted} style={{ marginTop: '0.6rem' }}>
              One decision applies to the whole package; checked items are held/excluded and stay in staging with their evidence.
            </p>
          </div>
        ) : (
          <div className={s.card}>
            <b>Decision recorded.</b>{' '}
            {decisions[0] && <span className={s.muted}>{decisions[0].decision} by {decisions[0].reviewer ?? '—'}</span>}
          </div>
        )}
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={s.section}>
      <h2 className={s.h} dangerouslySetInnerHTML={{ __html: title }} />
      <div className={s.card}>{children}</div>
    </div>
  );
}

function HoldBox({ it, section, decided }: { it: { localRef: string; held: boolean }; section: string; decided: boolean }) {
  void section;
  return (
    <label className={s.muted} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.72rem' }}>
      <input type="checkbox" name="held" value={it.localRef} defaultChecked={it.held} disabled={decided} /> hold
    </label>
  );
}
