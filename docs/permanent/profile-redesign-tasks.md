# بازطراحی صفحه پروفایل — React (5173) + Flutter (7357)

> Created: 2026-05-30T19:06:36.863Z
> Total tasks: 8

---

## TASK 1: تحلیل اسکرین‌شات مرجع (با image-vision)

با ابزار `analyze_image` از MCP server image-vision، عکس `screenshots/3333.jpg` رو تحلیل کن:

پرامپت تحلیل:
"این یک اسکرین‌شات از صفحه اکانت در یک اپلیکیشن موبایل است. با دقت کامل تحلیل کن: تم و رنگ‌ها (Dark Mode با چه رنگ‌هایی)، استایل آیکون‌ها (Line Icons با چه ضخامتی)، چیدمان صفحه (layout و spacing)، و نقاط قوت/ضعف. نتیجه رو به صورت خلاصه و کاربردی برای پیاده‌سازی ذخیره کن."

خروجی: تحلیل کامل برای استفاده در تسک‌های بعدی.

---

## TASK 2: مطالعه کد موجود در هر دو پلتفرم

این فایل‌ها رو کامل بخون (هر دو پلتفرم):

**React (پورت 5173):**
- `frontend/src/pages/customer/Profile.tsx` — ۸۰۹ خط، دو تب (General + Address & Cars)
- `frontend/src/app/router.tsx` — ببین route `/profile` و `/app/profile` کجان
- `frontend/src/store/authStore.ts` — چطور user data گرفته میشه
- `frontend/tailwind.config.ts` — رنگ‌های nh-primary, nh-bg, nh-text, nh-surface

**Flutter (پورت 7357):**
- `flutter_project/lib/screens/profile_screen.dart` — صفحه پروفایل فعلی (حدود ۱۵۸۷ خط)
- `flutter_project/pubspec.yaml` — فونت‌ها و پکیج‌های آیکون

**مشترک:**
- `prisma/schema.prisma` — جداول UserAddress و UserCar
- `routes/auth.ts` — endpoint های موجود

خروجی: شناخت کامل از کد هر دو پلتفرم.

---

## TASK 3: API endpoints برای آدرس و ماشین (در صورت نیاز)

چک کن که endpoint های زیر وجود دارن یا نه. اگه نیست، به `routes/auth.ts` اضافه کن:

**UserAddress:**
- GET /auth/addresses
- POST /auth/addresses
- PUT /auth/addresses/:id
- DELETE /auth/addresses/:id
- PUT /auth/addresses/:id/default

**UserCar:**
- GET /auth/cars
- POST /auth/cars
- PUT /auth/cars/:id
- DELETE /auth/cars/:id
- PUT /auth/cars/:id/default

برای React، endpoint های فعلی `/user-addresses` و `/user-cars` رو چک کن — ممکنه همینا کافی باشن.

قوانین: Zod validation، فرمت `{ data: T }`، authenticate middleware، try/catch با next(error).

تست با curl.

---

## TASK 4: بازنویسی صفحه پروفایل React (frontend/src/pages/customer/Profile.tsx)

فایل `frontend/src/pages/customer/Profile.tsx` رو مطابق اسکرین‌شات `screenshots/3333.jpg` بازنویسی کن:

**هدر پروفایل:**
- عکس دایره‌ای سمت چپ (حرف اول اسم داخل دایره، یا آواتار واقعی)
- نام کاربر (بزرگ، bold، text-lg)
- ایمیل (زیر نام، کوچیک‌تر، text-nh-text-muted)
- دکمه ویرایش (آیکون مداد کنار اسم) → باز کردن Edit Modal

**منوی اصلی (لیست عمودی با Divider):**
هر آیتم: آیکون Line سمت چپ + متن + Chevron سمت راست، bg-nh-surface، rounded-[14px]، border-nh-border

| # | آیکون | عنوان | عملکرد |
|---|-------|-------|--------|
| 1 | Calendar | My Appointments | navigate(/app/appointments) |
| 2 | Heart | Saved Businesses | navigate(/app/saved) |
| 3 | Wallet | Payments & Wallet | navigate(/app/payments) |
| 4 | MapPin/House | My Addresses | باز کردن Address Modal یا صفحه |
| 5 | Car | My Cars | باز کردن Car Modal یا صفحه |
| 6 | Bell + Badge | Notifications | navigate با badge count |
| 7 | Question | Help & Support | navigate(/app/help) |
| 8 | Trash | Clear Cache | Dialog تأیید → پاک کردن کش |

**پایین صفحه:**
- Settings
- Logout (قرمز)

**الزامات طراحی:**
- Dark Mode: bg-nh-bg (پس‌زمینه تیره)
- Line Icons: از lucide-react (موجود در پروژه) یا SVG inline
- Chevron سمت راست همه آیتم‌ها
- Badge قرمز (bg-red-500) روی Notifications
- Clear Cache: Dialog → localStorage.clear() برای cache keys (نه auth token)، Snackbar موفقیت

**Address & Cars:**
مدیریت آدرس و ماشین که الان توی تب دوم هست رو به صورت Modal نگه دار (یا inline section) — لازم نیست صفحه جدا باشه. کد موجود رو reuse کن فقط استایلش رو شبیه اسکرین‌شات کن.

---

## TASK 5: بازنویسی صفحه پروفایل Flutter (flutter_project/lib/screens/profile_screen.dart)

فایل `flutter_project/lib/screens/profile_screen.dart` رو کاملاً بازنویسی کن:

**ساختار کلی (Scaffold با AppBar و Body):**

**AppBar:**
- عنوان: "My Profile" (راست‌چین برای فارسی)
- دکمه Settings (آیکون چرخ‌دنده) سمت چپ

**Body (SingleChildScrollView > Column):**

**بخش ۱ — هدر پروفایل:**
- CircleAvatar (عکس یا حرف اول اسم) با قابلیت آپلود
- نام کاربر (headlineSmall، bold، white)
- ایمیل (bodySmall، grey)
- دکمه Edit (آیکون مداد) → باز کردن BottomSheet

**بخش ۲ — منوی اصلی (ListView.builder با physics: NeverScrollableScrollPhysics):**

آیتم‌ها:
1. Calendar → Appointments
2. Heart → Saved Businesses
3. Wallet → Payments & Wallet
4. House/Location → AddressesScreen (Navigator.push)
5. Car → CarsScreen (Navigator.push)
6. Bell + Badge → Notifications
7. Question → Help & Support
8. Trash → Clear Cache (showDialog)

**بخش ۳ — پایین:**
- Settings
- Logout (قرمز)

**الزامات Flutter:**
- Dark Theme: ThemeData.dark() با scaffoldBackgroundColor: Color(0xFF0D1B2A)
- Line Icons: PhosphorIconsRegular (phosphor_flutter)
- فونت: IRANSans (از pubspec.yaml)
- هر آیتم: Container با padding(16)، Divider نازک
- Badge قرمز: Container با شماره گوشه آیکون Notification
- Chevron: PhosphorIconsRegular.caretRight

**Address & Cars Screens (صفحات جدا):**
- `addresses_screen.dart` — AppBar + FAB + ListView + swipe delete
- `cars_screen.dart` — AppBar + FAB + ListView + swipe delete
- `add_edit_address_screen.dart` — Form
- `add_edit_car_screen.dart` — Form

---

## TASK 6: Clear Cache — هر دو پلتفرم

**React (Profile.tsx):**
```tsx
const handleClearCache = () => {
  // Dialog
  if (!confirm('Clear app cache?')) return
  
  // Clear caches
  localStorage.removeItem('neighborly-cache-v1')
  localStorage.removeItem('neighborly-feed-cache')
  // Keep: neighborly-auth, neighborly-dark-mode
  
  // Clear React Query cache if using
  queryClient.clear()
  
  showSnack('Cache cleared successfully')
}
```

**Flutter (profile_screen.dart):**
```dart
Future<void> _clearCache() async {
  final confirm = await showDialog<bool>(/* ... */);
  if (confirm != true) return;
  
  imageCache.clear();
  imageCache.clearLiveImages();
  PaintingBinding.instance.imageCache.clear();
  
  final prefs = await SharedPreferences.getInstance();
  prefs.remove('cached_feed');
  prefs.remove('cached_categories');
  // Keep: auth_token, dark_mode
  
  final tempDir = await getTemporaryDirectory();
  if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  
  ScaffoldMessenger.of(context).showSnackBar(/* ... */);
}
```

**نکته مهم:** auth token و dark mode setting رو پاک نکن!

---

## TASK 7: Playwright Verification — هر دو پورت

**نکته مهم: باید هر دو سرور در حال اجرا باشن:**
- Terminal 1: Backend (port 8080 + 9090)
- Terminal 2: React (port 5173)
- Terminal 3: Flutter (port 7357)

**React (5173) — تست‌ها:**
1. Navigate to http://localhost:5173/auth/login
2. Login with test credentials
3. Navigate to /app/profile (یا /profile)
4. Screenshot full page
5. Click each menu item → screenshot
6. Click Clear Cache → confirm dialog → screenshot
7. Mobile viewport (375px) → screenshot
8. Check console errors

**Flutter (7357) — تست‌ها:**
1. Navigate to http://localhost:7357
2. Login and navigate to profile
3. Screenshot full page
4. Click each menu item → screenshot
5. Test address CRUD → screenshot
6. Test car CRUD → screenshot
7. Test Clear Cache → screenshot
8. Mobile viewport (375px) → screenshot
9. Check console errors

همه اسکرین‌شات‌ها در `screenshots/` ذخیره بشن با نام مشخص: react-profile-01.png, flutter-profile-01.png و غیره.

---

## TASK 8: بررسی نهایی و commit

**بررسی‌های نهایی برای هر دو پلتفرم:**
1. React: `npm run typecheck` — بدون خطا
2. React: `npm run lint` — بدون خطا
3. Flutter: `flutter analyze` — بدون خطا
4. چک کن Dark Mode در هر دو درسته
5. چک کن Badge قرمز کار می‌کنه
6. چک کن Clear Cache کار می‌کنه
7. چک کن Address/Cars CRUD کار می‌کنه
8. اسکرین‌شات‌ها رو مقایسه کن با عکس مرجع

**Git:**
```bash
git add -A
git commit -m "feat: redesign profile screen for both React and Flutter with Dark Mode"
git push
```

**حتماً push کن — هیچ وقت local-only نذار.**

---

