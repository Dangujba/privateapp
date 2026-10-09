import Link from 'next/link';
import type { ReactNode } from 'react';

export function Legal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen p-6">
      <article className="glass-card mx-auto max-w-3xl space-y-5 p-8">
        <Link href="/" className="text-primary-600">← Home</Link>
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="space-y-4 text-gray-700 dark:text-gray-300">{children}</div>
      </article>
    </main>
  );
}
