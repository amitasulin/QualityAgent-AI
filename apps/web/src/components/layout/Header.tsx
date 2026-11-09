'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Menu, Bell, User, LogOut, Settings, ChevronDown, Moon, Sun } from 'lucide-react';
import { useUIStore, useAuthStore, useNotificationStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { formatRelativeTime } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { user, logout } = useAuthStore();
  const { notifications, removeNotification } = useNotificationStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className={cn('fixed top-0 left-0 right-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-secondary-200 shadow-sm transition-all duration-300', sidebarOpen ? 'lg:mr-64' : 'lg:mr-0')}>
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Mobile menu button */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 text-secondary-400 hover:text-secondary-600"
          aria-label="פתח תפריט"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Page title */}
        <div className="flex-1 lg:hidden">
          <h1 className="text-lg font-semibold text-secondary-900 truncate">QualityAgent</h1>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-secondary-400 hover:text-secondary-600 rounded-lg hover:bg-secondary-100"
              aria-label={`התראות${unreadCount > 0 ? `, ${unreadCount} חדשות` : ''}`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <Fragment>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-secondary-200 py-2 z-50 animate-slide-in-right">
                  <div className="px-4 py-3 border-b border-secondary-200 flex items-center justify-between">
                    <h3 className="font-medium text-secondary-900">התראות</h3>
                    {notifications.length > 0 && (
                      <button
                        onClick={() => notifications.forEach(n => removeNotification(n.id))}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        סמן הכול כנקרא
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-secondary-500">
                      אין התראות חדשות
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="px-4 py-3 hover:bg-secondary-50 border-b border-secondary-100 last:border-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-secondary-900">{notification.title}</p>
                              {notification.message && (
                                <p className="text-sm text-secondary-500 mt-1">{notification.message}</p>
                              )}
                              <p className="text-xs text-secondary-400 mt-1">
                                {formatRelativeTime(new Date())}
                              </p>
                            </div>
                            <button
                              onClick={() => removeNotification(notification.id)}
                              className="text-secondary-400 hover:text-secondary-600 p-1"
                              aria-label="הסר התראה"
                            >
                              <ChevronDown className="h-4 w-4 rotate-90" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Fragment>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 text-secondary-600 hover:text-secondary-900 rounded-lg hover:bg-secondary-100"
              aria-label="תפריט משתמש"
              aria-expanded={showUserMenu}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-white" />
              </div>
              <span className="hidden md:block font-medium text-sm">{user?.full_name}</span>
              <ChevronDown className="h-4 w-4 text-secondary-400" />
            </button>

            {showUserMenu && (
              <Fragment>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-secondary-200 py-2 z-50 animate-slide-in-right">
                  <div className="px-4 py-3 border-b border-secondary-200">
                    <p className="font-medium text-secondary-900">{user?.full_name}</p>
                    <p className="text-sm text-secondary-500">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                      {user?.role}
                    </span>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-secondary-600 hover:bg-secondary-50"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings className="h-4 w-4" />
                    פרופיל
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-4 py-2 text-danger-600 hover:bg-danger-50"
                  >
                    <LogOut className="h-4 w-4" />
                    התנתקות
                  </button>
                </div>
              </Fragment>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}