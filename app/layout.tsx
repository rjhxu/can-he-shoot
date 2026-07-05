import type { Metadata } from 'next';
import { Big_Shoulders, Inter } from 'next/font/google';
import ThemeProvider from '@/components/ThemeProvider';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const bigShoulders = Big_Shoulders({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Can He Shoot?',
  description:
    'Ask basketball questions in plain English and get StatMuse-style answers, plus interactive NBA shot maps.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${bigShoulders.variable} flex min-h-screen flex-col font-sans antialiased`}
      >
        <ThemeProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
