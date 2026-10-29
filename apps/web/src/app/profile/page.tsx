'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Mail, Phone, Shield, User as UserIcon } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string | null;
  site_id?: string | null;
  is_active: boolean;
  last_login_at?: string | null;
}

const roleLabels: Record<string, string> = {
  admin: 'מנהל מערכת',
  quality_manager: 'אחראי איכות',
  quality_inspector: 'מבקר איכות',
  production_worker: 'עובד ייצור',
  viewer: 'צופה',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getMeProfile();
        setProfile(data);
      } catch (err) {
        console.error(err);
        setError('שגיאה בטעינת הפרופיל');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          icon={UserIcon}
          title="הפרופיל שלי"
          badge={profile ? <Badge variant={profile.is_active ? 'success' : 'secondary'}>{profile.is_active ? 'פעיל' : 'לא פעיל'}</Badge> : undefined}
          subtitle="פרטי המשתמש וההרשאות שלך במערכת"
        />

        {loading ? (
          <Card>
            <CardBody className="p-8">
              <div className="animate-pulse space-y-4">
                <div className="h-6 w-1/4 rounded bg-secondary-100" />
                <div className="h-4 w-1/3 rounded bg-secondary-50" />
              </div>
            </CardBody>
          </Card>
        ) : error || !profile ? (
          <Card>
            <CardBody className="p-12 text-center">
              <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto" />
              <p className="mt-3 text-danger-600">{error || 'לא נמצא פרופיל'}</p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-l from-primary-400 to-primary-600" />
              <CardBody className="p-6">
                <div className="text-center py-2">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25 flex items-center justify-center mx-auto mb-4">
                    <UserIcon className="h-12 w-12 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-secondary-900">{profile.full_name}</h2>
                  <p className="text-sm text-secondary-500 mt-0.5">
                    {roleLabels[profile.role] || profile.role}
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary-600" />
                <CardTitle>פרטים</CardTitle>
              </CardHeader>
              <CardBody className="pt-2">
                <dl className="divide-y divide-secondary-100">
                  {[
                    { icon: Mail, label: 'אימייל', value: profile.email, ltr: true },
                    { icon: Phone, label: 'טלפון', value: profile.phone || '—', ltr: true },
                    { icon: Shield, label: 'תפקיד', value: roleLabels[profile.role] || profile.role },
                    {
                      icon: UserIcon,
                      label: 'התחברות אחרונה',
                      value: profile.last_login_at ? formatDateTime(profile.last_login_at) : '—',
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-start gap-3 py-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary-50 border border-secondary-100 flex items-center justify-center shrink-0">
                        <row.icon className="h-4 w-4 text-secondary-400" />
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs font-medium text-secondary-400">{row.label}</dt>
                        <dd className="text-sm text-secondary-900 mt-0.5" dir={row.ltr ? 'ltr' : undefined}>
                          {row.value}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
