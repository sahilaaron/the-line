import type { ReactNode } from 'react';
import Link from 'next/link';
import s from './crm.module.css';

export const metadata = { title: 'The Line — Research CRM' };

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <div className={s.shell}>
      <header className={s.bar}>
        <div className={s.brand}>
          The Line · <b>Research Control</b>
        </div>
        <nav className={s.nav}>
          <Link href="/crm">Dashboard</Link>
          <Link href="/crm/queue">Queue &amp; Runs</Link>
          <Link href="/crm/vocabulary">Vocabulary</Link>
        </nav>
        <span className={s.muted} style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
          local · internal · not production-secure
        </span>
      </header>
      <main className={s.main}>{children}</main>
    </div>
  );
}
