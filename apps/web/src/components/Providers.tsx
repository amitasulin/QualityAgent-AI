'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastViewport } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

/**
 * Restore the signed-in user into the client store when the auth cookies are
 * still valid but localStorage was cleared. Permission-gated actions (NCR
 * transitions, CAPA workflow) depend on the role being present.
 */
function AuthHydrator() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (user) return;
    if (typeof document === 'undefined') return;
    const hasAuthCookie =
      document.cookie.includes('access_token=') || document.cookie.includes('refresh_token=');
    if (!hasAuthCookie) return;

    let cancelled = false;
    (async () => {
      try {
        const me = await api.getMeProfile();
        if (cancelled || !me?.id) return;
        setUser({
          id: me.id,
          email: me.email,
          full_name: me.full_name,
          role: me.role,
          tenant_id: me.tenant_id,
          site_id: me.site_id ?? undefined,
          permissions: me.permissions ?? [],
        });
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, setUser]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthHydrator />
      {children}
      <ToastViewport />
    </QueryClientProvider>
  );
}
