'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Star, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DetailError, DetailSkeleton, EntityDetail, type StatDef } from '@/components/master-data/EntityDetail';
import { api } from '@/lib/api';
import { SUPPLIER_FIELDS } from '@/lib/master-data-fields';
import { getApiErrorMessage, type Supplier } from '@/lib/master-data';
import { usePermissions } from '@/lib/permissions';

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { canManageMasterData } = usePermissions();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSupplier(id);
      setSupplier(data as Supplier);
    } catch (err) {
      setError(getApiErrorMessage(err, 'שגיאה בטעינת הספק'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DetailSkeleton />;

  if (error || !supplier) {
    return (
      <DetailError
        message={error ?? 'הספק לא נמצא'}
        backHref="/suppliers"
        onRetry={load}
      />
    );
  }

  const hasRating = supplier.quality_rating !== null && supplier.quality_rating !== undefined;
  const rating = hasRating ? Number(supplier.quality_rating) : null;

  const stats: StatDef[] = [
    {
      label: 'דירוג איכות',
      value: rating !== null ? `${rating.toFixed(1)} / 5` : '—',
      tone: rating !== null ? (rating >= 4 ? 'success' : 'warning') : 'neutral',
      hint: rating !== null ? 'ציון ספק' : 'טרם דורג',
    },
    {
      label: 'אישור ספק',
      value: supplier.is_approved ? 'מאושר' : 'לא מאושר',
      tone: supplier.is_approved ? 'success' : 'warning',
    },
    {
      label: 'סטטוס',
      value: supplier.is_active ? 'פעיל' : 'לא פעיל',
      tone: supplier.is_active ? 'success' : 'neutral',
    },
    { label: 'איש קשר', value: supplier.contact_person || '—' },
  ];

  return (
    <EntityDetail
      icon={Truck}
      entityName="ספק"
      entity={supplier}
      fields={SUPPLIER_FIELDS}
      backHref="/suppliers"
      badges={
        <>
          <Badge variant={supplier.is_approved ? 'success' : 'secondary'}>
            {supplier.is_approved ? 'מאושר' : 'לא מאושר'}
          </Badge>
          {hasRating && (
            <Badge variant={rating !== null && rating >= 4 ? 'success' : 'warning'}>
              <Star className="h-3 w-3 ml-1 fill-current" />
              {rating !== null ? rating.toFixed(1) : '—'}
            </Badge>
          )}
        </>
      }
      stats={stats}
      canEdit={canManageMasterData}
      onSave={async (data) => {
        const updated = await api.updateSupplier(supplier.id, data);
        setSupplier(updated as Supplier);
      }}
    />
  );
}
