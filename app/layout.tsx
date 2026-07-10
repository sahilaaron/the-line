import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Line',
  description:
    'An interactive 3D experience for travelling through human history. Desktop physics prototype.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
