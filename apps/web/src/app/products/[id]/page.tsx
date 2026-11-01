'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DetailError, DetailSkeleton, EntityDetail, type StatDef } from '@/components/master-data/EntityDetail';
import { api } from '@/lib/api';
import { PRODUCT_FIELDS } from '@/lib/master-data-fields';
import { getApiErrorMessage, type Product } from '@/lib/master-data';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProduct(id);
      setProduct(data as Product);
    } catch (err) {
      setError(getApiErrorMessage(err, 'שגיאה בטעינת המוצר'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DetailSkeleton />;

  if (error || !product) {
    return (
      <DetailError
        message={error ?? 'המוצר לא נמצא'}
        backHref="/products"
        onRetry={load}
      />
    );
  }

  const stats: StatDef[] = [
    { label: 'גרסה', value: product.revision || '—' },
    { label: 'יחידת מידה', value: product.unit || '—' },
    { label: 'קטגוריה', value: product.category || '—' },
    {
      label: 'סטטוס',
      value: product.is_active ? 'פעיל' : 'לא פעיל',
      tone: product.is_active ? 'success' : 'neutral',
    },
  ];

  const hasSpecification =
    product.specification &&
    typeof product.specification === 'object' &&
    Object.keys(product.specification).length > 0;

  return (
    <EntityDetail
      icon={Package}
      entityName="מוצר"
      entity={product}
      fields={PRODUCT_FIELDS}
      backHref="/products"
      badges={
        <Badge variant={product.is_active ? 'success' : 'secondary'}>
          {product.is_active ? 'פעיל' : 'לא פעיל'}
        </Badge>
      }
      stats={stats}
      extra={
        hasSpecification ? (
          <Card>
            <CardHeader>
              <CardTitle>מפרט טכני</CardTitle>
            </CardHeader>
            <CardBody>
              <pre
                className="text-xs text-secondary-700 bg-secondary-50 border border-secondary-100 rounded-lg p-4 overflow-x-auto"
                dir="ltr"
              >
                {JSON.stringify(product.specification, null, 2)}
              </pre>
            </CardBody>
          </Card>
        ) : null
      }
      onSave={async (data) => {
        const updated = await api.updateProduct(product.id, data);
        setProduct(updated as Product);
      }}
    />
  );
}
