import Link from 'next/link';
export default function NotFound() { return <main className="center-page"><h1>Page unavailable</h1><p>This page does not exist or is outside your account’s access.</p><Link className="button" href="/catalog">Return to your library</Link></main>; }
