import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Can he shoot?',
  description: 'Interactive 2025-26 NBA shot map for every active player.',
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
