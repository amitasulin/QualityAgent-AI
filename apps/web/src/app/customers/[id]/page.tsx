'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DetailError, DetailSkeleton, EntityDetail, type StatDef } from '@/components/master-data/EntityDetail';
import { api } from '@/lib/api';
import { CUSTOMER_FIELDS } from '@/lib/master-data-fields';
import { getApiErrorMessage, type Customer } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { canManageMasterData } = usePermissions();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCustomer(id);
      setCustomer(data as Customer);
    } catch (err) {
      setError(getApiErrorMessage(err, 'שגיאה בטעינת הלקוח'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DetailSkeleton />;

  if (error || !customer) {
    return (
      <DetailError
        message={error ?? 'הלקוח לא נמצא'}
        backHref="/customers"
        onRetry={load}
      />
    );
  }

  const stats: StatDef[] = [
    { label: 'איש קשר', value: customer.contact_person || '—' },
    { label: 'אימייל', value: customer.contact_email || '—' },
    { label: 'טלפון', value: customer.contact_phone || '—' },
    {
      label: 'סטטוס',
      value: customer.is_active ? 'פעיל' : 'לא פעיל',
      tone: customer.is_active ? 'success' : 'neutral',
    },
  ];

  return (
    <EntityDetail
      icon={Users}
      entityName="לקוח"
      entity={customer}
      fields={CUSTOMER_FIELDS}
      backHref="/customers"
      badges={
        <Badge variant={customer.is_active ? 'success' : 'secondary'}>
          {customer.is_active ? 'פעיל' : 'לא פעיל'}
        </Badge>
      }
      stats={stats}
      extra={<CustomerComplaints customerId={customer.id} />}
      canEdit={canManageMasterData}
      onSave={async (data) => {
        const updated = await api.updateCustomer(customer.id, data);
        setCustomer(updated as Customer);
      }}
    />
  );
}

function CustomerComplaints({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<
    Array<{ id: string; title: string; status: string; severity: string; created_at: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getComplaints({ page: 1, page_size: 5, customer_id: customerId })
      .then((data) => {
        if (active) setItems(data.items || []);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>תלונות לקוח מקושרות</CardTitle>
        <Link href="/complaints" className="text-sm text-primary-600 hover:underline">
          לכל התלונות
        </Link>
      </CardHeader>
      <CardBody className="p-0">
        {loading ? (
          <div className="divide-y divide-secondary-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-6 py-4 animate-pulse">
                <div className="h-3.5 w-1/2 rounded bg-secondary-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-6 py-6 text-sm text-secondary-500">
            אין תלונות מקושרות ללקוח זה
          </p>
        ) : (
          <ul className="divide-y divide-secondary-100">
            {items.map((complaint) => (
              <li key={complaint.id}>
                <Link
                  href={`/complaints/${complaint.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-3.5 hover:bg-secondary-50 transition-colors"
                >
                  <span className="text-sm font-medium text-secondary-900 truncate">
                    {complaint.title}
                  </span>
                  <StatusBadge status={complaint.status} type="complaint" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
