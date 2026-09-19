# AGENTS.md — Neighborly AI Team Operations

Engineering rules apply to engineering tasks. The growth governance below applies to growth work and supplements engineering safeguards. Explicit user instructions and the current ReleaseGuard approval policy take precedence over historical workflow descriptions.

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
reviewed commit scope → approval → commit; separate approval → push
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
10. **Source control:** prepare an exact reviewed scope, verify it, and check for secrets. Request confirmation for that scope before committing; request explicit approval immediately before push or PR. Never stage all changes blindly.
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

---

# Growth Agent Governance

This directory adds a growth organization alongside any current or future engineering agents. Growth agents must not edit application business logic, matching, chat, payment, database schema, or production behavior unless a separately approved engineering task explicitly requires it.

## Runtime and discovery

- Agent definitions live in `growth/<role>/AGENT.md`; reusable procedures live in `skills/<skill>/SKILL.md`.
- The design targets native Google Antigravity agents/subagents but is framework-independent. CrewAI, LangGraph, AutoGen, and n8n are not runtime dependencies.
- The GTM orchestrator delegates specialist analysis and synthesizes it; it does not redo specialist work.
- Git files under `../marketing/` are shared memory. Evidence and dated learnings belong there, not only in chat history.

## Mandatory context protocol

Before meaningful work, every growth agent must:

1. Read `../README.md`, `../CLAUDE.md`, `../docs/ROADMAP.md`, `../docs/AGENTS.md`, and relevant documentation.
2. Read relevant `../marketing/context/` files.
3. Read the active `../marketing/markets/` micro-market file. If none is designated, stop market-specific execution and report the gap.
4. Read `../marketing/metrics/WEEKLY_SCORECARD.md` and the latest dated scorecard, if present.
5. Read active records in `../marketing/experiments/`.
6. Read the specific task and its approval scope.
7. Execute only within that scope.
8. Record evidence with source, retrieval date, geography/category, and limitations.
9. Write decisions and learnings, including contradictory evidence.
10. Update shared memory when evidence changes a reusable fact; never replace an unknown with a guess.

## Permission gates

All three gates are deny-by-default when status is unclear:

1. **LEGAL GATE:** required for commercial electronic messages, legal claims, consent questions, regulated categories, and privacy-sensitive use. Use `skills/casl-compliance/` for Canadian outreach. `DO NOT SEND` is mandatory when the legal basis is unclear.
2. **SAFETY GATE:** required for provider transaction eligibility, identity/business verification, material disputes, fraud decisions, and serious account action. Research/contact may precede verification; transacting or receiving payments may not.
3. **MONEY/ACTION GATE:** explicit human approval is required before spend, refunds, bulk sends, publishing, commission/payment changes, or other consequential writes.

Agents may autonomously research, analyze, draft, compare, score with documented evidence, recommend, and create internal reports. They may not approve KYC, resolve serious disputes, suspend high-value accounts, publish legally sensitive claims, or treat tool access as authorization.

## Evidence and data rules

- Never fabricate research, metrics, scores, customer statements, or competitor findings. Use `STATUS: RESEARCH REQUIRED`.
- Optimize marketplace health and liquidity by geography × category, not vanity metrics.
- Treat unsubscribe and suppression state as global across every agent and channel.
- Never commit credentials. Use named environment-variable placeholders in documentation only.
- Keep personally identifiable information out of Git; store only aggregate or appropriately redacted research artifacts.

## Changes and review

Agent and marketing-memory changes must preserve existing engineering architecture. Important market, launch, pricing, automation, or expansion recommendations require `skills/red-team-review/` before a final recommendation.
