# AGENTS.md — Neighborly AI Team Operations

> **نسخه:** 1.0 | **تاریخ:** 2026-07-31  
> **این فایل قوانین کلی تیم AI را تعریف می‌کند.**  
> **هر agent باید این فایل را قبل از هر کاری بخواند.**

---

## 🏗️ معماری تیم (Team Structure)

```
مدیر پروژه: امیر فرهادیان
    │
    ▼ وظیفه می‌دهد
Prompt Engineer ← گلوگاه کیفیت (همه پرامپت‌ها از اینجا رد می‌شوند)
    │
    ▼ پرامپت تأیید شده
    ├── Flutter Developer   → UI/UX موبایل + وب
    ├── Backend Developer   → API + business logic
    ├── Database Architect  → Prisma schema + migrations
    ├── UI/UX Designer      → Design system + mockups
    └── DevOps Engineer     → Docker + CI/CD + infrastructure
    │
    ▼ کد تحویل داده شده
QA Engineer ← تأیید نهایی قبل از commit
    │
    ▼ تأیید شده
git commit + push
```

---

## 🚫 قوانین مطلق (NEVER VIOLATE — برای همه agents)

1. **هرگز `lib/matching/`** را لمس نکن — الگوریتم matching مقدس است
2. **هرگز chat-related files** را تغییر نده — chat کامل است
3. **هرگز `src/` directory** را تغییر نده
4. **Prisma 5.x ثابت** — هیچ upgrade یا downgrade
5. **همه TS/JS imports با `.js` extension** — مثال: `import './foo.js'`
6. **فقط `npm`** — هیچ‌وقت yarn یا pnpm
7. **READ قبل از WRITE** — هر فایل را کاملاً بخوان قبل از ویرایش
8. **Business logic جدید ممنوع** مگر دستور صریح از مدیر
9. **هر سرویس در process جداگانه** — هرگز ترکیب نکن
10. **بعد از تغییر:** `git add -A && git commit -m "..." && git push`
11. **UI تغییر = Screenshot اجباری** (Playwright)
12. **ادمین SPA در `frontend/admin/`** — نه در `frontend/src/pages/admin/`

---

## 📌 پروژه Neighborly

**نوع:** شبکه اجتماعی محلی (Social-First) + بازار خدمات  
**استراتژی فعلی:** Phase S1 — ساخت Social Foundation  
**هدف کوتاه‌مدت:** Flutter Feed Screen + Stories + Post Creation

### Stack
| لایه | تکنولوژی |
|------|-----------|
| Backend API | Node.js 22 + TypeScript + Express |
| ORM | Prisma 5.x (PostgreSQL 16) |
| Cache | Redis |
| Storage | MinIO (S3-compatible) |
| Web Frontend | React 18 + Vite + TailwindCSS |
| Mobile | Flutter 3.x |
| Admin SPA | React (جداگانه در `frontend/admin/`) |

### Ports
| سرویس | Port محلی |
|--------|-----------|
| Backend API | **8080** |
| Admin API + SPA | **9090** |
| React Client | **5173** |
| Flutter Web | **7357** |

---

## 🔄 چرخه کاری (Workflow)

### برای هر task:
```
۱. این فایل (AGENTS.md) بخوانده می‌شود
۲. SKILL.md نقش مرتبط بخوانده می‌شود
۳. فایل‌های پروژه مرتبط بخوانده می‌شوند
۴. Implementation Plan نوشته می‌شود
۵. کد نوشته می‌شود
۶. تست اجرا می‌شود
۷. Screenshot (برای UI) گرفته می‌شود
۸. git commit انجام می‌شود
۹. گزارش ارائه می‌شود
```

### گزارش نهایی هر task:
```
[TASK COMPLETION REPORT]

Security:   [Passed/Failed] — verified against common vulnerabilities
Visual/UX:  [Passed/Failed] — verified layout and responsiveness (screenshot)
Tests:      [Passed/Failed] — unit/integration tests
Edge Cases: [Passed/Failed] — error states verified

Status: ✅ DONE / ❌ NEEDS REVISION
git commit: [commit hash]
```

---

## ✅ تاریخچه کارهای تمام‌شده

- **F5, F6, F7, F8-admin** — Done
- **Admin Dashboard API Fixes** — Done (2026-05-23)
- **Admin Login** — Done (email+password only)
- **Admin SPA Separation** — Done (frontend/admin/)
- **Social Foundation** — Schema Done, UI in Progress

---

## 📁 نقشه پوشه‌ها

```
/home/amir/version04/
├── server.ts              ← Backend entry (port 8080)
├── routes/                ← API routes (76 files)
├── lib/
│   └── matching/          ← 🚫 SACRED — DO NOT TOUCH
├── prisma/
│   └── schema.prisma      ← DB schema (Prisma 5.x)
├── frontend/              ← React Client SPA (port 5173)
│   └── admin/             ← Admin SPA (port 9090)
├── flutter_project/       ← Flutter app (port 7357)
├── docs/                  ← Documentation
│   ├── AGENTS.md          ← Full canonical rules
│   ├── FEATURES.md        ← UI specifications
│   └── ROADMAP.md         ← Project roadmap
├── .agents/               ← AI Team Skills (این پوشه)
│   └── skills/
│       ├── flutter-dev/
│       ├── backend-dev/
│       ├── db-architect/
│       ├── qa-engineer/
│       ├── ui-designer/
│       ├── devops-engineer/
│       └── prompt-engineer/
└── screenshots/           ← UI verification screenshots
```

---

## 🎯 اولویت فعلی (Phase S1 — Social Foundation)

```
اولویت ۱: Flutter Feed Screen (این هفته)
اولویت ۲: Flutter Story Viewer
اولویت ۳: Flutter Post Creation
اولویت ۴: Flutter Like/Comment
اولویت ۵: Flutter Follow System
```

---

## 📞 تماس با مدیر پروژه

هر تصمیم معماری مهم یا تغییر بزرگ باید با **امیر فرهادیان** هماهنگ شود.  
هیچ task بدون تأیید Prompt Engineer اجرا نمی‌شود.  
هیچ code بدون تأیید QA Engineer commit نمی‌شود.
