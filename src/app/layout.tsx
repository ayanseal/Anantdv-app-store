import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};
export const metadata: Metadata = { title: { default: 'Anantdv App Store', template: '%s · Anantdv' }, description: 'Your company apps, ready when you are.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
