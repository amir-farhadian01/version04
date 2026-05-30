# 📘 Neighborly — راهنمای گردش کارها (Workflows)

**نسخه:** ۱.۰.۰ | **تاریخ:** ۲۰۲۶-۰۵-۲۷

> **این فایل برای کیه؟** برای هر کسی که میخواد بفهمه توی Neighborly چی به چیه.
> همه توضیحات به زبان ساده نوشته شدن. دیاگرام‌ها مسیر حرکت داده و کاربر رو نشون میدن.

---

## 🧭 فهرست

1. [کاربران و سطح دسترسی](#1-کاربران-و-سطح-دسترسی)
2. [نمای کلی سیستم](#2-نمای-کلی-سیستم)
3. [ترمینال‌ها و پردازش‌ها](#3-ترمینال‌ها-و-پردازش‌ها)
4. [Workflow ثبت‌نام و احراز هویت](#4-ثبت‌نام-و-احراز-هویت)
5. [Workflow احراز هویت KYC](#5-احراز-هویت-kyc)
6. [Workflow پست و استوری (شبکه اجتماعی)](#6-پست-و-استوری-شبکه-اجتماعی)
7. [Workflow سفارش خدمات](#7-سفارش-خدمات)
8. [Workflow مچینگ (پیدا کردن سرویس‌دهنده)](#8-مچینگ-پیدا-کردن-سرویس‌دهنده)
9. [Workflow چت و قرارداد](#9-چت-و-قرارداد)
10. [Workflow پرداخت](#10-پرداخت)
11. [Workflow بیزینس ورک‌اسپیس](#11-بیزینس-ورک‌اسپیس)
12. [Workflow پنل ادمین](#12-پنل-ادمین)
13. [نقشه کامل API ها](#13-نقشه-کامل-api-ها)

---

## ۱. کاربران و سطح دسترسی

### 👥 چهار نوع کاربر داریم:

| نوع کاربر | توضیح | چطور تشخیص داده میشه |
|-----------|-------|----------------------|
| **بازدیدکننده (Public)** | کسی که لاگین نکرده | بدون JWT token ← فیلتر `optionalAuth` |
| **مشتری (Client)** | کاربر عادی ثبت‌نام کرده | JWT با role=`customer` |
| **بیزینس (Business Client)** | مشتری که کسب‌وکار داره | JWT با role=`customer` + عضویت در `Company` (workspace) |
| **ادمین (Admin)** | کارمند داخلی پلتفرم | JWT با role=`platform_admin`, `support`, `finance`, `owner` |

### 🔐 چطور کاربر رو تشخیص میدیم؟

```mermaid
flowchart TD
    A[درخواست میرسه] --> B{Header Authorization داره؟}
    B -->|نه| C[بازدیدکننده = بدون دسترسی]
    B -->|بله| D[Token JWT رو decode کن]
    D --> E{Token معتبره؟}
    E -->|نه| F[خطای 401 برگردون]
    E -->|بله| G[role کاربر رو چک کن]
    G --> H{role چیه؟}
    H -->|customer| I[مشتری عادی]
    H -->|platform_admin| J[ادمین]
    H -->|provider/staff| K[سرویس‌دهنده]
```

### 📊 جدول دسترسی‌ها:

| کار | بازدیدکننده | مشتری | بیزینس | ادمین |
|-----|------------|-------|--------|-------|
| دیدن فید عمومی | ✅ | ✅ | ✅ | ✅ |
| دیدن پروفایل بیزینس | ✅ | ✅ | ✅ | ✅ |
| ثبت‌نام | ✅ | - | - | - |
| ساختن پست | ❌ | ✅ | ✅ | ✅ |
| ثبت سفارش | ❌ | ✅ | ✅ | ❌ |
| چت در سفارش | ❌ | ✅ | ✅ | ❌ |
| مدیریت کارکنان | ❌ | ❌ | ✅ | ❌ |
| تأیید KYC | ❌ | ❌ | ❌ | ✅ |
| مدیریت کاربران | ❌ | ❌ | ❌ | ✅ |

---

## ۲. نمای کلی سیستم

```mermaid
graph TB
    subgraph "کاربران"
        U1[بازدیدکننده]
        U2[مشتری]
        U3[بیزینس]
        U4[ادمین]
    end
    
    subgraph "Frontend ها"
        F1[React SPA :5173]
        F2[Flutter Mobile :7357]
        F3[Admin SPA :9090]
    end
    
    subgraph "Backend"
        B1[API Server :8080]
        B2[Admin API :9090]
    end
    
    subgraph "سرویس‌ها"
        DB[(PostgreSQL :5432)]
        R[(Redis :6379)]
        N[NATS]
    end
    
    U1 --> F1
    U1 --> F2
    U2 --> F1
    U2 --> F2
    U3 --> F1
    U4 --> F3
    
    F1 --> B1
    F2 --> B1
    F3 --> B2
    
    B1 --> DB
    B1 --> R
    B1 --> N
    B2 --> DB
    
    style B1 fill:#4ade80,color:#000
    style B2 fill:#60a5fa,color:#000
    style F3 fill:#f59e0b,color:#000
```

---

## ۳. ترمینال‌ها و پردازش‌ها

هر ترمینال رو جداگانه اجرا کن:

| ترمینال | دستور | پورت | کارش چیه |
|---------|-------|------|----------|
| **Backend** | `npx tsx server.ts` | `8080` + `9090` | API اصلی + API ادمین + سرو صفحات SPA |
| **React Frontend** | `cd frontend && npm run dev` | `5173` | رابط کاربری وب |
| **Flutter Web** | `cd flutter_project && flutter run -d web-server --web-port 7357` | `7357` | اپ موبایل/وب |
| **Flutter Mobile** | `cd flutter_project && flutter run` | دستگاه | اپ روی گوشی |

### 🔄 پشت صحنه (Background Jobs):

وقتی `server.ts` اجرا میشه، این کارها اتوماتیک انجام میشن:

```
server.ts startup:
├── 🔌 وصل شدن به PostgreSQL
├── 📡 وصل شدن به Redis (اگه در دسترس باشه)
├── 📨 وصل شدن به NATS (اگه در دسترس باشه)
├── 🗄️ آماده‌سازی Media DB Schema
├── 📍 شروع Location Flusher (هر ۵ دقیقه موقعیت‌ها رو ذخیره میکنه)
├── 💰 شروع Escrow Auto-Release (هر ۱۰ دقیقه)
└── ⏰ شروع Matching Window Expiry (هر ۵ دقیقه)
```

---

## ۴. ثبت‌نام و احراز هویت

### 📝 workflow ثبت‌نام:

```mermaid
sequenceDiagram
    actor U as کاربر
    participant F as Frontend
    participant A as Auth API
    participant D as Database
    
    U->>F: فرم ثبت‌نام (email + password)
    F->>A: POST /api/auth/register
    A->>D: چک تکراری نبودن email
    A->>D: ذخیره کاربر با password هش‌شده
    A-->>F: JWT Token + user info
    F-->>U: ورود موفق → صفحه اصلی
```

### 🔑 workflow لاگین:

```mermaid
sequenceDiagram
    actor U as کاربر
    participant F as Frontend
    participant A as Auth API
    participant D as Database
    
    U->>F: email + password
    F->>A: POST /api/auth/login
    A->>D: پیدا کردن کاربر با email
    A->>A: چک کردن password با bcrypt
    A->>A: ساختن JWT (شامل userId و role)
    A-->>F: { data: { token, user } }
    F->>F: ذخیره token تو localStorage
    F-->>U: هدایت به صفحه اصلی
```

### 🧠 JWT Token چیه؟

JWT یه رشته رمزنگاری‌شده‌س که داخلش این اطلاعات هست:
```json
{
  "userId": "clx...",
  "role": "customer",
  "email": "user@example.com"
}
```

**هر درخواست API** که نیاز به احراز هویت داره، باید این token رو تو Header بفرسته:
```
Authorization: Bearer eyJhbGciOi...
```

---

## ۵. احراز هویت KYC

### 🪪 workflow تأیید هویت (KYC):

```mermaid
flowchart TD
    A[کاربر ثبت‌نام کرده] --> B{KYC Level 0}
    B --> B1[تأیید ایمیل]
    B --> B2[تأیید تلفن]
    B1 & B2 --> C{KYC Level 1 - شخصی}
    C --> C1[آپلود کارت ملی]
    C --> C2[آپلود سلفی]
    C1 & C2 --> D[در صف بررسی ادمین]
    D --> E{ادمین چک میکنه}
    E -->|تأیید| F[✅ کاربر فعال]
    E -->|رد| G[❌ درخواست دوباره]
    G --> C
    
    F --> H{KYC Level 2 - بیزینسی}
    H --> H1[آپلود مدارک کسب‌وکار]
    H --> H2[مجوز کسب]
    H --> H3[بیمه]
    H1 & H2 & H3 --> I[بررسی ادمین]
    I -->|تأیید| J[✅ بیزینس فعال]
```

---

## ۶. پست و استوری (شبکه اجتماعی)

### 📸 workflow ساختن پست:

```mermaid
sequenceDiagram
    actor U as کاربر
    participant F as Frontend
    participant S as SocialFeed API
    participant M as ChatModeration
    participant D as Database
    participant N as NATS
    
    U->>F: نوشتن متن + آپلود عکس
    F->>S: POST /api/social/posts
    S->>M: بررسی PII (شماره تلفن، ایمیل)
    M-->>S: نتیجه moderation
    S->>D: ذخیره پست با وضعیت moderation
    S->>N: publish('social.post.created')
    N-->>D: Notification برای فالوئرها
    S-->>F: { data: post, moderationWarnings? }
    F-->>U: "پست شما منتشر شد"
```

### 👀 workflow دیدن فید:

```mermaid
flowchart LR
    A[باز کردن صفحه Explorer] --> B[GET /api/social/posts/feed]
    B --> C{کاربر لاگین کرده؟}
    C -->|نه| D[نمایش پست‌های عمومی]
    C -->|بله| E[نمایش پست‌های فالوئینگ + عمومی]
    E --> F[مرتب‌سازی بر اساس زمان]
    D --> F
    F --> G[نشان دادن like/save برای کاربر]
```

---

## ۷. سفارش خدمات

### 🛒 workflow کامل سفارش:

```mermaid
flowchart TD
    A[مشتری وارد Explorer میشه] --> B[یک سرویس انتخاب میکنه]
    B --> C[فرم سفارش رو پر میکنه]
    C --> C1[توضیحات کار]
    C --> C2[زمان مورد نظر]
    C --> C3[آدرس]
    C --> C4[عکس از محل]
    C1 & C2 & C3 & C4 --> D[ثبت سفارش = draft]
    D --> E[Submit = وضعیت submitted]
    E --> F{سیستم مچینگ}
```

### 📋 وضعیت‌های یک سفارش:

```
draft → submitted → matching → matched → contracted → paid → in_progress → completed
  ↓         ↓          ↓
cancelled  expired   disputed → closed
```

---

## ۸. مچینگ (پیدا کردن سرویس‌دهنده)

### 🎯 workflow مچینگ:

```mermaid
sequenceDiagram
    participant O as Order
    participant M as Matching Engine
    participant P as Provider
    participant N as NATS
    
    O->>M: سفارش submit شد
    M->>M: پیدا کردن providerهای واجد شرایط
    M->>M: محاسبه امتیاز (فاصله + امتیاز + تخصص)
    M->>P1: ارسال پیشنهاد به ۵ نفر برتر
    M->>P2: ارسال پیشنهاد
    M->>P3: ارسال پیشنهاد
    M->>N: publish('orders.matched')
    
    P1->>M: قبول
    M->>O: وضعیت → matched
    N->>O: notification به مشتری
```

---

## ۹. چت و قرارداد

### 💬 workflow چت و قرارداد:

```mermaid
sequenceDiagram
    actor C as مشتری
    actor P as سرویس‌دهنده
    participant CH as Chat API
    participant CT as Contract API
    participant AI as AI Engine
    participant D as Database
    
    C->>CH: پیام تو چت
    CH->>CH: moderation (حذف PII)
    CH->>D: ذخیره پیام امن
    P->>CH: پاسخ به مشتری
    
    P->>CT: ساختن قرارداد
    CT->>AI: تولید قرارداد از chat history
    AI-->>CT: متن قرارداد
    CT->>D: ذخیره ContractVersion
    CT-->>C: "قرارداد آماده بررسی"
    
    C->>CT: تأیید قرارداد
    CT->>D: بروزرسانی وضعیت → approved
```

---

## ۱۰. پرداخت

### 💳 workflow پرداخت:

```mermaid
flowchart LR
    A[قرارداد تأیید شد] --> B[مشتری وارد درگاه پرداخت]
    B --> C[پرداخت موفق]
    C --> D[Payment = captured]
    D --> E[پول تو escrow]
    E --> F{کار تموم شد؟}
    F -->|بله| G[Escrow آزاد میشه]
    F -->|اختلاف| H[Dispute → ادمین بررسی]
    G --> I[پول به سرویس‌دهنده]
    
    style E fill:#f59e0b,color:#000
    style G fill:#4ade80,color:#000
    style H fill:#ef4444,color:#fff
```

---

## ۱۱. بیزینس ورک‌اسپیس

### 🏢 workflow مدیریت کسب‌وکار:

```mermaid
flowchart TD
    A[بیزینس کلاینت] --> B[پنل workspace]
    B --> C1[👥 کارکنان]
    B --> C2[🛠️ خدمات]
    B --> C3[📦 محصولات]
    B --> C4[💰 مالی]
    B --> C5[📊 CRM مشتریان]
    B --> C6[📋 برنامه‌ریزی]
    
    C1 --> D1[اضافه/حذف کارمند]
    C1 --> D2[تخصیص نقش]
    C2 --> E1[تعریف پکیج]
    C2 --> E2[قیمت‌گذاری]
    C2 --> E3[BOM (مواد مصرفی)]
    C4 --> F1[مشاهده درآمد]
    C4 --> F2[صدور فاکتور]
    C4 --> F3[تنظیمات پرداخت]
```

### 📍 API های workspace:

| مسیر | کاربرد |
|------|--------|
| `/api/workspace/crm` | مدیریت مشتریان |
| `/api/workspace/invoices` | فاکتورها |
| `/api/workspace/finance` | مالی و تراکنش‌ها |
| `/api/workspace/social` | دسترسی شبکه اجتماعی |
| `/api/workspaces` | مدیریت خود workspace |

---

## ۱۲. پنل ادمین

### 🛡️ workflow ادمین:

```mermaid
flowchart TD
    A[ادمین لاگین میکنه] --> B[داشبورد]
    B --> C1[👤 کاربران]
    B --> C2[🆔 بررسی KYC]
    B --> C3[📋 سفارشات]
    B --> C4[📝 قراردادها]
    B --> C5[💰 پرداخت‌ها]
    B --> C6[🖼️ رسانه‌ها]
    B --> C7[📊 آنالیز]
    
    C1 --> D1[لیست کاربران]
    C1 --> D2[جزئیات کاربر]
    C1 --> D3[تعلیق/فعال‌سازی]
    
    C2 --> E1[بررسی مدارک]
    C2 --> E2[تأیید / رد]
    C2 --> E3[درخواست مجدد]
    
    C6 --> F1[بررسی محتوای پست‌ها]
    C6 --> F2[تأیید / حذف]
```

---

## ۱۳. نقشه کامل API ها

### 🌐 API های عمومی (Port 8080):

```
/api/health               → سلامت سرور
/api/auth/*               → لاگین، ثبت‌نام، refresh
/api/users/*              → پروفایل کاربران
/api/feed                 → فید عمومی
/api/social/*             → پست، استوری، کامنت، فالو
/api/categories/*         → دسته‌بندی‌ها
/api/service-catalog/*    → کاتالوگ سرویس‌ها
/api/orders/*             → سفارشات
/api/workspace/*          → workspace (CRM, مالی, فاکتور)
/api/home-screen           → صفحه اصلی
/api/home                 → محتوای صفحه اصلی
/api/kyc/*                → احراز هویت
/api/chat/*               → چت
/api/guest/*              → خرید مهمان
```

### 🔒 API های ادمین (Port 9090):

```
/api/auth/*               → لاگین ادمین
/api/admin/*              → داشبورد مدیریت
/api/admin/kyc/*          → بررسی KYC
/api/admin/orders/*       → مدیریت سفارشات
/api/admin/contracts/*    → بررسی قراردادها
/api/admin/payments/*     → مدیریت پرداخت‌ها
/api/admin/chat/*         → مدیریت چت‌ها
/api/admin/media/*        → مدیریت رسانه‌ها
/api/admin/analytics/*    → آمار و گزارشات
/api/admin/disputes/*     → مدیریت اختلافات
```

---

## 📌 نکات مهم

1. **هر سرویس جداگانه اجرا میشه** — backend، frontend، Flutter هر کدوم ترمینال خودشون رو دارن
2. **همیشه اول backend رو اجرا کن** — بعد frontend و Flutter
3. **پورت ۸۰۸۰ برای API اصلیه** — پورت ۳۰۰۰ فقط تو Docker استفاده میشه
4. **برای دیدن لاگ‌ها** از Dozzle (پورت ۸۸۹۹ تو Docker) یا `npm run dev` استفاده کن
5. **برای مدیریت دیتابیس** از `npx prisma studio` (پورت ۵۵۵۵) استفاده کن
6. **فایل‌های lib/matching/** رو هرگز تغییر نده — الگوریتم مچینگ مقدسه
7. **فایل‌های chat** رو هرگز تغییر نده — سیستم چت کامله

---

> **آخرین بروزرسانی:** ۲۰۲۶-۰۵-۲۷
> **نگارنده:** Amir Farhadian + AI Agents