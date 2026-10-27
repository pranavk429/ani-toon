import type { Metadata } from 'next';
import { Inter, Shantell_Sans, Space_Mono, Bagel_Fat_One } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--ff-inter', subsets: ['latin'], display: 'swap' });
const hand = Shantell_Sans({ variable: '--ff-hand', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });
const mono = Space_Mono({ variable: '--ff-mono', subsets: ['latin'], weight: ['400', '700'], display: 'swap' });
const display = Bagel_Fat_One({ variable: '--ff-display', subsets: ['latin'], weight: ['400'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Ani — mascots that move',
  description:
    'Type a brand thought. Ani invents an original vector mascot and writes a one-of-a-kind performance for it. No templates, no video models — just code.',
  keywords: ['mascot generator', 'SVG animation', 'brand character', 'Wispr Flow', 'AI motion'],
  openGraph: {
    title: 'Ani — mascots that move',
    description: 'Describe a feeling. Meet a character that moves like it means it.',
    type: 'website',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${hand.variable} ${mono.variable} ${display.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
