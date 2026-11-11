import type { FieldDef, FormValues } from '@/components/master-data/EntityFormFields';

export const CUSTOMER_FIELDS: FieldDef[] = [
  { name: 'code', label: 'קוד לקוח *', required: true, placeholder: 'CUST-001', dir: 'ltr' },
  { name: 'name', label: 'שם לקוח *', required: true, placeholder: 'שם החברה' },
  { name: 'contact_person', label: 'איש קשר', placeholder: 'שם מלא' },
  { name: 'contact_email', label: 'אימייל', type: 'email', dir: 'ltr', placeholder: 'name@company.com' },
  { name: 'contact_phone', label: 'טלפון', type: 'tel', dir: 'ltr', placeholder: '03-1234567' },
  { name: 'address', label: 'כתובת', fullWidth: true, placeholder: 'רחוב, עיר, מיקוד' },
  {
    name: 'quality_requirements',
    label: 'דרישות איכות',
    type: 'textarea',
    rows: 3,
    fullWidth: true,
    placeholder: 'תקנים, דרישות מיוחדות, תנאי אספקה...',
  },
  { name: 'is_active', label: 'לקוח פעיל', type: 'checkbox' },
];

export const CUSTOMER_INITIAL: FormValues = {
  code: '',
  name: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  quality_requirements: '',
  is_active: true,
};

export const SUPPLIER_FIELDS: FieldDef[] = [
  { name: 'code', label: 'קוד ספק *', required: true, placeholder: 'SUP-001', dir: 'ltr' },
  { name: 'name', label: 'שם ספק *', required: true, placeholder: 'שם החברה' },
  { name: 'contact_person', label: 'איש קשר', placeholder: 'שם מלא' },
  { name: 'contact_email', label: 'אימייל', type: 'email', dir: 'ltr', placeholder: 'name@company.com' },
  { name: 'contact_phone', label: 'טלפון', type: 'tel', dir: 'ltr', placeholder: '03-1234567' },
  {
    name: 'quality_rating',
    label: 'דירוג איכות',
    type: 'number',
    min: 0,
    max: 5,
    step: 0.1,
    placeholder: '0 - 5',
    helperText: 'ציון בין 0 ל־5 (למשל 4.5)',
  },
  { name: 'address', label: 'כתובת', fullWidth: true, placeholder: 'רחוב, עיר, מיקוד' },
  { name: 'is_approved', label: 'ספק מאושר', type: 'checkbox' },
  { name: 'is_active', label: 'ספק פעיל', type: 'checkbox' },
];

export const SUPPLIER_INITIAL: FormValues = {
  code: '',
  name: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  quality_rating: '',
  address: '',
  is_approved: false,
  is_active: true,
};

export const PRODUCT_FIELDS: FieldDef[] = [
  { name: 'sku', label: 'מק"ט *', required: true, placeholder: 'SKU-1001', dir: 'ltr' },
  { name: 'name', label: 'שם מוצר *', required: true, placeholder: 'שם המוצר' },
  {
    name: 'description',
    label: 'תיאור',
    type: 'textarea',
    rows: 3,
    fullWidth: true,
    placeholder: 'תיאור קצר של המוצר',
  },
  { name: 'revision', label: 'גרסה *', required: true, placeholder: '1.0', dir: 'ltr' },
  { name: 'unit', label: 'יחידת מידה', placeholder: 'יח׳ / ק"ג / מטר', dir: 'ltr' },
  { name: 'category', label: 'קטגוריה', placeholder: 'למשל: מכלולים' },
  { name: 'drawing_number', label: 'מספר שרטוט', placeholder: 'DWG-001', dir: 'ltr' },
  { name: 'is_active', label: 'מוצר פעיל', type: 'checkbox' },
];

export const PRODUCT_INITIAL: FormValues = {
  sku: '',
  name: '',
  description: '',
  revision: '1.0',
  unit: '',
  category: '',
  drawing_number: '',
  is_active: true,
};

export const SITE_FIELDS: FieldDef[] = [
  { name: 'name', label: 'שם אתר *', required: true, placeholder: 'מפעל ראשי' },
  { name: 'code', label: 'קוד אתר', placeholder: 'SITE-001', dir: 'ltr' },
  { name: 'contact_person', label: 'איש קשר', placeholder: 'שם מלא' },
  { name: 'contact_email', label: 'אימייל', type: 'email', dir: 'ltr', placeholder: 'name@company.com' },
  { name: 'contact_phone', label: 'טלפון', type: 'tel', dir: 'ltr', placeholder: '03-1234567' },
  { name: 'address', label: 'כתובת', fullWidth: true, placeholder: 'רחוב, עיר, מיקוד' },
  { name: 'is_active', label: 'אתר פעיל', type: 'checkbox' },
];

export const SITE_INITIAL: FormValues = {
  name: '',
  code: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  is_active: true,
};
