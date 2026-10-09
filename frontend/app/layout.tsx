import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'YIRS Blockchain Revenue System',
  description: 'Blockchain-assisted tax and revenue collection for Yobe State Internal Revenue Service.',
  keywords: ['YIRS', 'Yobe State', 'TON', 'Blockchain', 'Tax Collection', 'Revenue Collection'],
  authors: [{ name: 'YIRS Revenue System' }],
  openGraph: { title: 'YIRS Blockchain Revenue System', description: 'Secure tax and statutory revenue payments using TON.', type: 'website', siteName: 'YIRS Revenue System' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;
}
