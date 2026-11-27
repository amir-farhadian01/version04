import type { BaseOrderStatusValue, FormFieldTypeValue } from '../../lib/validations/customOrderValidation.js';

export interface MockFormFieldFixture {
  id: string;
  label: string;
  fieldType: FormFieldTypeValue;
  isRequired: boolean;
  placeholder?: string;
  options?: string[];
  sortOrder: number;
}

export const validIntakeFormWithTenFields: {
  name: string;
  description: string;
  isActive: boolean;
  fields: MockFormFieldFixture[];
} = {
  name: 'فرم استاندارد سفارش خدمات منزل',
  description: 'فرم پذیرش با سقف کامل ۱۰ فیلد و پوشش تمام ۶ نوع داده‌ای مجاز',
  isActive: true,
  fields: [
    { id: 'f1', label: 'نام پروژه', fieldType: 'text', isRequired: true, sortOrder: 0 },
    { id: 'f2', label: 'متراژ محیط', fieldType: 'number', isRequired: true, sortOrder: 1 },
    { id: 'f3', label: 'تاریخ ترجیحی', fieldType: 'date', isRequired: true, sortOrder: 2 },
    {
      id: 'f4',
      label: 'نوع فضا',
      fieldType: 'single_select',
      isRequired: true,
      options: ['مسکونی', 'اداری', 'تجاری'],
      sortOrder: 3,
    },
    {
      id: 'f5',
      label: 'خدمات جانبی',
      fieldType: 'multi_select',
      isRequired: false,
      options: ['شستشوی شیشه', 'ضدعفونی', 'نظافت بالکن'],
      sortOrder: 4,
    },
    { id: 'f6', label: 'تصویر محل', fieldType: 'file_upload', isRequired: false, sortOrder: 5 },
    { id: 'f7', label: 'تعداد اتاق', fieldType: 'number', isRequired: false, sortOrder: 6 },
    { id: 'f8', label: 'کد پستی', fieldType: 'text', isRequired: false, sortOrder: 7 },
    { id: 'f9', label: 'توضیحات دسترسی', fieldType: 'text', isRequired: false, sortOrder: 8 },
    { id: 'f10', label: 'مستندات PDF نقشه', fieldType: 'file_upload', isRequired: false, sortOrder: 9 },
  ],
};

export const invalidIntakeFormWithElevenFields = {
  ...validIntakeFormWithTenFields,
  fields: [
    ...validIntakeFormWithTenFields.fields,
    { id: 'f11', label: 'فیلد یازدهم غیرمجاز', fieldType: 'text' as const, isRequired: false, sortOrder: 10 },
  ],
};

export const validPipelineStagesFixture: Array<{
  id: string;
  name: string;
  baseStatus: BaseOrderStatusValue;
  sortOrder: number;
  isDefault: boolean;
}> = [
  { id: 'st-1', name: 'ثبت اولیه', baseStatus: 'Submitted', sortOrder: 0, isDefault: true },
  { id: 'st-2', name: 'ارزیابی فنی', baseStatus: 'InReview', sortOrder: 1, isDefault: false },
  { id: 'st-3', name: 'تأیید و برنامه‌ریزی', baseStatus: 'Accepted', sortOrder: 2, isDefault: false },
  { id: 'st-4', name: 'در حال اجرا', baseStatus: 'InProgress', sortOrder: 3, isDefault: false },
  { id: 'st-5', name: 'تحویل نهایی', baseStatus: 'Completed', sortOrder: 4, isDefault: false },
];

export const validCustomBundleWithTwoItems = {
  workspaceId: 'ws-test-1',
  serviceCatalogId: 'cat-test-1',
  description: 'سفارش ترکیبی نظافت و تعمیر شیرآلات',
  address: 'تهران، خیابان ولیعصر',
  items: [
    {
      packageId: 'pkg-1',
      title: 'نظافت کامل واحد',
      quantity: 1,
      unitPriceCents: 12000,
      scheduledStartAt: '2026-12-01T10:00:00.000Z',
      scheduledEndAt: '2026-12-01T13:00:00.000Z',
    },
    {
      title: 'تعمیر و سرویس شیرآلات',
      quantity: 2,
      unitPriceCents: 4500,
      scheduledStartAt: '2026-12-02T14:00:00.000Z',
      scheduledEndAt: '2026-12-02T16:00:00.000Z',
    },
  ],
  intakeAnswers: {
    f1: 'واحد ۴ طبقه ۲',
    f2: 110,
    f3: '2026-12-01T10:00:00.000Z',
    f4: 'مسکونی',
    f6: { sizeBytes: 2 * 1024 * 1024, mimeType: 'image/jpeg', fileUrl: 'uploads/room.jpg' },
  },
};

export const invalidSchedulingBundle = {
  workspaceId: 'ws-test-1',
  serviceCatalogId: 'cat-test-1',
  items: [
    {
      title: 'آیتم با تاریخ نامعتبر',
      quantity: 1,
      unitPriceCents: 5000,
      scheduledStartAt: '2026-12-02T16:00:00.000Z',
      scheduledEndAt: '2026-12-02T14:00:00.000Z',
    },
  ],
};

export const validFileUploadMeta = {
  sizeBytes: 4 * 1024 * 1024,
  mimeType: 'application/pdf' as const,
  fileUrl: 'uploads/blueprint.pdf',
};

export const invalidOversizedFileUploadMeta = {
  sizeBytes: 12 * 1024 * 1024,
  mimeType: 'application/pdf',
};

export const invalidMimeFileUploadMeta = {
  sizeBytes: 1024,
  mimeType: 'application/x-msdownload',
};
