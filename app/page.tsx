'use client';

import dynamic from 'next/dynamic';

// The experience is browser-only (WebGL); never render on the server.
const Experience = dynamic(() => import('@/src/experience/Experience'), {
  ssr: false,
  loading: () => <div className="boot" aria-hidden />,
});

export default function Page() {
  return <Experience />;
}
