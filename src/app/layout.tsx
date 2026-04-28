import type { Metadata } from 'next';
import '@/app/globals.css';
import { SiteHeader } from '@/components/layout/site-header';

export const metadata: Metadata = {
  title: 'Triple Track',
  description: 'Mobile-first golf betting PWA starter',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
