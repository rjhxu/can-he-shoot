import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Can he shoot?',
  description:
    'Ask basketball questions in plain English and get StatMuse-style answers, plus interactive NBA shot maps.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
