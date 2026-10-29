import type { Metadata } from 'next';
import { Inter, Assistant } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const assistant = Assistant({
  subsets: ['latin', 'hebrew'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-assistant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'QualityAgent - פלטפורמת AI לניהול איכות',
  description: 'מערכת חכמה לניהול איכות במפעלי ייצור עם סוכן AI פרואקטיבי',
  keywords: ['איכות', 'ייצור', 'NCR', 'CAPA', 'AI', 'אחראי איכות'],
  authors: [{ name: 'QualityAgent Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${inter.variable} ${assistant.variable} font-hebrew`}>
      <body className="min-h-screen bg-secondary-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}