import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { asset } from '../lib/asset';
import './globals.css';

const switzer = localFont({
  src: '../fonts/switzer-variable.woff2',
  variable: '--font-switzer',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pranavk429.github.io'),
  title: 'Anitoon — Type a character. Watch it perform.',
  description:
    'A motion compiler for brand characters. One sentence becomes a scene spec; a deterministic engine performs every frame at 60fps. Built for the Wispr No Hands Challenge.',
  keywords: [
    'Anitoon',
    'motion compiler',
    'brand characters',
    'SVG animation',
    'scene spec',
    'motion design',
    'Wispr Flow',
    'interface animation',
  ],
  authors: [{ name: 'Anitoon' }],
  openGraph: {
    title: 'Anitoon — Type a character. Watch it perform.',
    description:
      'One sentence becomes a scene spec. A deterministic engine performs it at 60fps. No footage, no upload, no waiting.',
    type: 'website',
    siteName: 'Anitoon',
    locale: 'en_US',
    images: [
      {
        url: asset('/og.png'),
        width: 1200,
        height: 630,
        alt: 'Anitoon — Type a character. Watch it perform.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anitoon — Type a character. Watch it perform.',
    description: 'A motion compiler for brand characters. One brief, one spec, one performance.',
    images: [{ url: asset('/og.png'), alt: 'Anitoon — Type a character. Watch it perform.' }],
  },
};

export const viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={switzer.variable}>
      <body>{children}</body>
    </html>
  );
}
