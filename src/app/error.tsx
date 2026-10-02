'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="empty"><h2>We couldn’t load this page</h2><p>Try again, or contact your administrator if the issue continues.</p><button className="button" style={{ marginTop: 20 }} onClick={reset}>Try again</button></section>; }
