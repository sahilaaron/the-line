'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Refresh server data at a modest interval via router.refresh(), which
 * re-renders server components WITHOUT a full navigation, preserving most
 * client form state. Default 12s. */
export default function AutoRefresh({ seconds = 12 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
