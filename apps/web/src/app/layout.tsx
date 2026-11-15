import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'QualityAgent - פלטפורמת AI לניהול איכות',
  description: 'מערכת חכמה לניהול איכות במפעלי ייצור עם סוכן AI פרואקטיבי',
  keywords: ['איכות', 'ייצור', 'NCR', 'CAPA', 'AI', 'אחראי איכות'],
  authors: [{ name: 'QualityAgent Team' }],
};

// Runs before first paint so a stored dark preference never flashes light.
const themeInitScript = `(function(){try{var key='qualityagent-theme';var stored=localStorage.getItem(key);if(stored!=='light'&&stored!=='dark'&&stored!=='system'){stored='system';}var dark=stored==='dark'||(stored==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var root=document.documentElement;root.classList.toggle('dark',dark);root.dataset.theme=dark?'dark':'light';root.style.colorScheme=dark?'dark':'light';}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-secondary-50 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
