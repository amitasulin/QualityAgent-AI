'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, Building2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
  industry?: string | null;
  timezone: string;
  status: string;
  created_at?: string | null;
  settings?: Record<string, unknown>;
}

const statusLabels: Record<string, string> = {
  active: 'פעיל',
  inactive: 'לא פעיל',
  trial: 'ניסיון',
};

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getOrganization(params.id);
        if (!cancelled) setOrg(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('שגיאה בטעינת הארגון');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
          <ArrowRight className="h-4 w-4" />
          חזרה להגדרות
        </Link>

        {loading ? (
          <Card>
            <CardBody>
              <p className="text-center text-secondary-500 py-12">טוען ארגון...</p>
            </CardBody>
          </Card>
        ) : error || !org ? (
          <Card>
            <CardBody>
              <p className="text-center text-danger-600 py-12">{error || 'הארגון לא נמצא'}</p>
            </CardBody>
          </Card>
        ) : (
          <>
            <Card>
              <CardBody>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">
                    <Building2 className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={org.status === 'active' ? 'success' : 'secondary'}>
                        {statusLabels[org.status] || org.status}
                      </Badge>
                    </div>
                    <h1 className="text-2xl font-bold text-secondary-900 mt-1">{org.name}</h1>
                    <p className="text-secondary-500 mt-1">{org.industry || '—'}</p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>פרטי הארגון</CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-secondary-500">אזור זמן</dt>
                    <dd className="text-secondary-900 mt-1">{org.timezone}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-secondary-500">נוצר ב־</dt>
                    <dd className="text-secondary-900 mt-1">
                      {org.created_at ? formatDateTime(org.created_at) : '—'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-secondary-500">מזהה</dt>
                    <dd className="text-secondary-900 mt-1 font-mono text-sm">{org.id}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
