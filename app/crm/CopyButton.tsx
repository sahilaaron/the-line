'use client';
import { useState } from 'react';
import s from './crm.module.css';

export default function CopyButton({ text, label, testid }: { text: string; label: string; testid?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      data-testid={testid}
      className={`${s.btn} ${s.ghost}`}
      style={{ fontSize: '0.72rem' }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? 'Copied ✓' : label}
    </button>
  );
}
