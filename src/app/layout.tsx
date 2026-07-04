import type { Metadata } from 'next';
import '@/app/globals.css';
import { SiteHeader } from '@/components/layout/site-header';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';

export const metadata: Metadata = {
  title: 'Triple Track',
  description: 'Live golf scoring, side games, and event tracking for groups on the course.',
  applicationName: 'Triple Track',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Triple Track',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport = {
  themeColor: '#071b12',
  viewportFit: 'cover',
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
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
