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
  title: 'Anitoon — a 60fps motion clip library',
  description:
    'A small library of 60fps, code-rendered motion clips. Play them, scrub them, inspect the spec, and take the motion into your own work. Built for the Wispr No Hands Challenge.',
  keywords: ['Anitoon', '60fps', 'motion clips', 'animation library', 'motion design', 'Wispr Flow', 'hackathon'],
  authors: [{ name: 'Anitoon' }],
  openGraph: {
    title: 'Anitoon — a 60fps motion clip library',
    description:
      'Three clips. Three specs. Every frame at 60fps. A small, honest motion library built for the Wispr No Hands Challenge.',
    type: 'website',
    images: [{ url: asset('/og.png'), width: 1200, height: 630, alt: 'Anitoon — clips that feel alive at 60fps' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anitoon — a 60fps motion clip library',
    description: 'Three clips. Three specs. Every frame at 60fps.',
    images: [asset('/og.png')],
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
