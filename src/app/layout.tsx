import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Payana App Store', template: '%s · Payana' }, description: 'Your company apps, ready when you are.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
