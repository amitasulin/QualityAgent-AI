'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/master-data';
import {
  EntityFormFields,
  type FieldDef,
  type FormValue,
  type FormValues,
  payloadFromValues,
} from './EntityFormFields';

interface CreateEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initialValues: FormValues;
  submitLabel?: string;
  errorFallback?: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}

export function CreateEntityModal({
  isOpen,
  onClose,
  title,
  description,
  fields,
  initialValues,
  submitLabel = 'צור',
  errorFallback = 'יצירת הרשומה נכשלה',
  onSubmit,
}: CreateEntityModalProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues);
      setError(null);
    }
  }, [isOpen, initialValues]);

  const handleChange = (name: string, value: FormValue) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = payloadFromValues(values, fields, 'create');
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, errorFallback));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} description={description} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <EntityFormFields fields={fields} values={values} onChange={handleChange} />

        {error && (
          <p className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-sm text-danger-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            ביטול
          </Button>
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
