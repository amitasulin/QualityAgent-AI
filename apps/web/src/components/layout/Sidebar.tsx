'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  CheckSquare,
  ClipboardList,
  FolderOpen,
  Users,
  Package,
  Truck,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { useUIStore } from '@/lib/store';

const navigation = [
  { name: 'לוח בקרה', href: '/', icon: LayoutDashboard },
  { name: 'אי התאמות', href: '/nonconformities', icon: AlertTriangle },
  { name: 'פעולות מתקנות', href: '/corrective-actions', icon: CheckSquare },
  { name: 'בדיקות איכות', href: '/inspections', icon: ClipboardList },
  { name: 'תלונות לקוח', href: '/complaints', icon: FileText },
  { name: 'ספקים', href: '/suppliers', icon: Truck },
  { name: 'לקוחות', href: '/customers', icon: Users },
  { name: 'מוצרים', href: '/products', icon: Package },
  { name: 'מסמכים', href: '/documents', icon: FolderOpen },
  { name: 'סוכן AI', href: '/agent', icon: Bot },
  { name: 'הגדרות', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={toggleSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'sidebar flex flex-col',
          sidebarOpen ? 'sidebar-open' : 'sidebar-closed'
        )}
        aria-label="תפריט ניווט ראשי"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-secondary-200">
            <Link href="/" className="flex items-center gap-2" aria-label="QualityAgent - דף הבית">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">QA</span>
              </div>
              <span className="font-semibold text-lg text-secondary-900 hidden lg:block">
                QualityAgent
              </span>
            </Link>
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 text-secondary-400 hover:text-secondary-600"
              aria-label={sidebarOpen ? 'סגור תפריט' : 'פתח תפריט'}
            >
              {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2" role="navigation" aria-label="ראשי">
            <ul className="space-y-1" role="list">
              {navigation.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {isActive && (
                        <span className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-primary-600" />
                      )}
                      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-secondary-200">
            <div className="flex items-center gap-2.5 rounded-lg bg-secondary-50 border border-secondary-100 px-3 py-2">
              <HelpCircle className="h-4 w-4 text-secondary-400 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-secondary-600">גרסה 0.1.0</p>
                <p className="text-[11px] text-secondary-400">סביבת פיתוח</p>
              </div>
              <span className="mr-auto h-1.5 w-1.5 rounded-full bg-success-500 shrink-0" title="מערכת פעילה" />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}