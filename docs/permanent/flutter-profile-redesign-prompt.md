# پرامپت بازطراحی صفحه پروفایل Flutter

این فایل رو کپی کن و به چت بعدی بده.

---

## وظیفه: بازطراحی صفحه پروفایل (Profile Screen) در Flutter

### 🖼️ اسکرین‌شات مرجع
به اسکرین‌شات زیر نگاه کن. این طراحی هدف (target design) برای صفحه پروفایله:
📸 `screenshots/3333.jpg`

**با ابزار `analyze_image` از MCP server image-vision تحلیلش کن و تم، آیکون‌ها، رنگ‌ها و چیدمانش رو کامل بررسی کن.**

---

### 📌 نمای کلی تغییرات
صفحه پروفایل فعلی (`flutter_project/lib/screens/profile_screen.dart`) رو باید کاملاً بازنویسی کنی تا شبیه اسکرین‌شات بشه، **با حفظ و اضافه کردن آدرس، ماشین، و پاک کردن کش**.

---

### 🎯 طرح نهایی باید این بخش‌ها رو داشته باشه:

#### بخش ۱ — هدر پروفایل
- عکس پروفایل (دایره‌ای، سمت چپ)
- نام کاربر (بزرگ، پررنگ)
- ایمیل کاربر (زیر نام، کوچیک‌تر، خاکستری)
- دکمه ویرایش پروفایل (آیکون مداد) — باز کردن صفحه/دیالوگ ویرایش نام و ایمیل
- تم: **Dark Mode** دقیقاً مثل اسکرین‌شات

#### بخش ۲ — منوی اصلی (لیست عمودی)
آیتم‌های منو با **آیکون خطی (Line Icons)** سمت چپ و فلش (›) سمت راست:

| آیکون | عنوان | عملکرد |
|-------|-------|--------|
| 📅 (تقویم) | **قرارهای من** (My Appointments) | بره به صفحه appointments |
| ❤️ (قلب) | **کسب‌وکارهای ذخیره شده** (Saved Businesses) | بره به لیست ذخیره‌ها |
| 💳 (کیف پول) | **پرداخت‌ها و کیف پول** (Payments & Wallet) | بره به صفحه پرداخت |
| 🏠 (خانه/لوکیشن) | **آدرس‌های من** (My Addresses) | **صفحه مدیریت آدرس‌ها** |
| 🚗 (ماشین) | **ماشین‌های من** (My Cars) | **صفحه مدیریت ماشین‌ها** |
| 🔔 (زنگوله) + badge | **اعلان‌ها** (Notifications) | بره به صفحه اعلان‌ها |
| ❓ (علامت سوال) | **راهنما و پشتیبانی** (Help & Support) | بره به صفحه پشتیبانی |
| 🗑️ (سطل زباله/پاک کردن) | **پاک کردن کش** (Clear Cache) | دیالوگ تأیید → پاک کردن کش |

#### بخش ۳ — پایین صفحه
- ⚙️ **تنظیمات** (Settings)
- 🚪 **خروج از حساب** (Logout) — با رنگ قرمز یا استایل متمایز

---

### 🏠 صفحه مدیریت آدرس‌ها (Address Management)
صفحه جداگونه (push navigation) با این قابلیت‌ها:
- لیست آدرس‌های کاربر (از `UserAddress` table در Prisma)
- هر آدرس: label (خونه/محل کار/...)، آدرس کامل، دکمه ستاره برای پیش‌فرض
- دکمه **➕ افزودن آدرس جدید**
- فرم افزودن/ویرایش: label, street, city, province, postalCode, country
- قابلیت حذف آدرس با swipe-to-delete یا دکمه حذف
- API endpoints: از route های موجود استفاده کن، اگر endpointهای CRUD برای UserAddress وجود نداره، به `routes/auth.ts` اضافه کن:
  - `GET /auth/addresses` — لیست آدرس‌ها
  - `POST /auth/addresses` — افزودن آدرس
  - `PUT /auth/addresses/:id` — ویرایش آدرس
  - `DELETE /auth/addresses/:id` — حذف آدرس
  - `PUT /auth/addresses/:id/default` — تنظیم به عنوان پیش‌فرض

### 🚗 صفحه مدیریت ماشین‌ها (Car Management)
صفحه جداگونه با این قابلیت‌ها:
- لیست ماشین‌های کاربر (از `UserCar` table در Prisma)
- هر ماشین: label, make, model, year, color, plate
- دکمه **➕ افزودن ماشین جدید**
- فرم افزودن/ویرایش: label, make, model, year, color, plate
- حذف ماشین
- API endpoints:
  - `GET /auth/cars` — لیست ماشین‌ها
  - `POST /auth/cars` — افزودن ماشین
  - `PUT /auth/cars/:id` — ویرایش ماشین
  - `DELETE /auth/cars/:id` — حذف ماشین

### 🗑️ پاک کردن کش (Clear Cache)
- دیالوگ تأیید: "آیا مطمئنی می‌خوای کش برنامه رو پاک کنی؟"
- پاک کردن: SharedPreferences کش, Image cache (cached_network_image), API cache, temporary files
- نمایش اسنک‌بار موفقیت‌آمیز بعد از پاک شدن

---

### 🎨 الزامات طراحی (Design Requirements)
1. **Dark Mode** دقیقاً مثل اسکرین‌شات — پس‌زمینه سرمه‌ای تیره، متن سفید/خاکستری
2. **Line Icons** — استفاده از phosphor_flutter یا iconsax (line style)
3. **ضخامت یکسان** همه آیکون‌ها
4. **فاصله‌گذاری منظم** بین آیتم‌های منو (16px vertical padding)
5. **Badge قرمز** روی آیکون اعلان‌ها برای نمایش تعداد
6. **فلش (Chevron)** سمت راست هر آیتم برای نشون دادن کلیک‌پذیر بودن
7. **Font**: IRANSans یا فونت فارسی فعلی پروژه (از pubspec.yaml چک کن)

---

### 🗂️ فایل‌هایی که باید تغییر کنن یا ساخته بشن:
- ✏️ `flutter_project/lib/screens/profile_screen.dart` — بازنویسی کامل
- 🆕 `flutter_project/lib/screens/addresses_screen.dart` — صفحه مدیریت آدرس
- 🆕 `flutter_project/lib/screens/cars_screen.dart` — صفحه مدیریت ماشین
- 🆕 `flutter_project/lib/screens/add_edit_address_screen.dart` — فرم آدرس
- 🆕 `flutter_project/lib/screens/add_edit_car_screen.dart` — فرم ماشین
- ✏️ `routes/auth.ts` — endpoint های CRUD برای UserAddress و UserCar

---

### 📊 دیتابیس — جداول موجود

**UserAddress** (`prisma/schema.prisma`):
```
id, userId, label, street, city, province, postalCode, country (default "CA"),
latitude, longitude, categoryTags (String[]), isDefault (Boolean), createdAt, archivedAt
```

**UserCar** (`prisma/schema.prisma`):
```
id, userId, label, make, model, year, color, plate, isDefault, createdAt, archivedAt
```

---

### ⚠️ قوانین اجباری (از AGENTS.md)
- فایل‌ها رو **کامل بخون** قبل از تغییر دادن
- از هیچ `any` type استفاده نکن — `unknown` + type guards
- همه async function ها try/catch داشته باشن — `next(error)` برای Express
- از فونت و تم پروژه فعلی استفاده کن
- **Flutter web server رو ری‌استارت کن** (`flutter run -d web-server --web-port 7357`)
- **با Playwright** صفحه پروفایل رو باز کن و از همه بخش‌ها اسکرین‌شات بگیر
- هیچ فایلی توی `lib/matching/`، `src/`، یا chat رو دست نزن
- TypeScript: ایمپورت‌ها با `.js` پسوند — `import { x } from './foo.js'`
- از `npm` استفاده کن نه yarn/pnpm
- بعد از تموم شدن: `git add -A && git commit -m "feat(flutter): redesign profile screen with addresses, cars, and cache clear" && git push`
- **Zod validation** برای همه API endpoint ها
- API response format: `{ data: T }` برای موفقیت، `{ code, message, details }` برای خطا
- Zero console.log — از structured logging استفاده کن
- تاریخ‌ها UTC ISO 8601
- No `// @ts-ignore` بدون JSDoc توضیح

---

### ✅ معیارهای تکمیل
- [ ] صفحه پروفایل دقیقاً شبیه اسکرین‌شات (Dark Mode, Line Icons, Layout)
- [ ] مدیریت آدرس‌ها (افزودن، ویرایش، حذف، پیش‌فرض)
- [ ] مدیریت ماشین‌ها (افزودن، ویرایش، حذف)
- [ ] پاک کردن کش با دیالوگ تأیید
- [ ] ویرایش پروفایل (نام، ایمیل)
- [ ] Playwright verification: باز کردن صفحه، کلیک همه آیتم‌ها، اسکرین‌شات
- [ ] بدون خطای کامپایل (`flutter analyze`)
- [ ] بدون خطای TypeScript (`npm run typecheck`)
- [ ] `git add -A && git commit -m "feat(flutter): redesign profile screen" && git push`

---

### 📸 اسکرین‌شات‌ها
عکس مرجع توی `screenshots/3333.jpg` هست. با ابزار `analyze_image` از MCP server image-vision تحلیلش کن و دقیقاً مطابقش طراحی کن.