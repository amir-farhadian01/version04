import { PrismaClient } from "@prisma/client";

/**
 * Seed demo posts (45 total) for feed/explorer UI testing.
 *
 *  30 business posts: 10 categories × 3 posts each
 *  15 general posts:   5 categories × 3 posts each
 *
 * Every post includes 2-3 PostMedia images and a Toronto-based PostLocation.
 * Posts are approved + published so they show immediately in the feed.
 */

// ── Unsplash image helper ──────────────────────────────────────────
const IMG = (id: string, w = 800, h = 600) =>
  `https://images.unsplash.com/${id}?q=80&w=${w}&h=${h}&auto=format&fit=crop`;

// ── Toronto coordinates (approximate neighbourhood spread) ─────────
const TORONTO_LOCATIONS = [
  { name: "Downtown Toronto", lat: 43.6532, lng: -79.3832, city: "Toronto", province: "ON" },
  { name: "North York",       lat: 43.7615, lng: -79.4111, city: "Toronto", province: "ON" },
  { name: "Scarborough",      lat: 43.7764, lng: -79.2318, city: "Toronto", province: "ON" },
  { name: "Etobicoke",        lat: 43.6435, lng: -79.5657, city: "Toronto", province: "ON" },
  { name: "East York",        lat: 43.6912, lng: -79.3417, city: "Toronto", province: "ON" },
  { name: "York",             lat: 43.6723, lng: -79.4802, city: "Toronto", province: "ON" },
  { name: "Midtown Toronto",  lat: 43.7064, lng: -79.3988, city: "Toronto", province: "ON" },
  { name: "Liberty Village",  lat: 43.6379, lng: -79.4216, city: "Toronto", province: "ON" },
  { name: "The Beaches",      lat: 43.6701, lng: -79.2975, city: "Toronto", province: "ON" },
  { name: "High Park",        lat: 43.6465, lng: -79.4636, city: "Toronto", province: "ON" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Category definitions ───────────────────────────────────────────

interface CategoryDef {
  name: string;
  description: string;
  parent: "BUSINESS" | "GENERAL";
}

const BUSINESS_CATEGORIES: CategoryDef[] = [
  { name: "Automotive",          description: "Car repair, detailing, tires, and auto services" },
  { name: "Insurance",           description: "Home, auto, life, and business insurance" },
  { name: "Banking",             description: "Accounts, loans, mortgages, and financial advice" },
  { name: "Fuel",                description: "Gas stations, propane, EV charging, and heating fuel" },
  { name: "Government Services", description: "Permits, licenses, taxes, and municipal services" },
  { name: "Health",              description: "Clinics, dental, physio, pharmacy, and wellness" },
  { name: "Home Services",       description: "Plumbing, electrical, cleaning, renovation, and repairs" },
  { name: "Personal Care",       description: "Barber, salon, spa, massage, and beauty services" },
  { name: "Transportation",      description: "Moving, delivery, rideshare, and courier services" },
  { name: "Utilities",           description: "Internet, phone, electricity, water, and waste" },
];

const GENERAL_CATEGORIES: CategoryDef[] = [
  { name: "Lifestyle",     description: "Food, fashion, fitness, travel, and hobbies" },
  { name: "Events",        description: "Local meetups, concerts, festivals, and workshops" },
  { name: "Tips & Advice", description: "DIY guides, money tips, and how-to articles" },
  { name: "Local News",    description: "Neighbourhood updates, traffic, weather, and announcements" },
  { name: "Community",     description: "Volunteering, lost & found, recommendations, and discussions" },
];

// ── Post caption templates per category ────────────────────────────
// Each category gets 3 posts; captions have English + Persian.

type PostTemplate = {
  caption: string;
  images: string[];
};

const BUSINESS_POSTS: Record<string, PostTemplate[]> = {
  Automotive: [
    {
      caption: "Full-service auto repair — brakes, engine, transmission. Book online today!\nسرویس کامل تعمیرات خودرو — ترمز، موتور، گیربکس. همین امروز رزرو کنید!",
      images: [IMG("photo-1486262715619-67b85e0b08d3"), IMG("photo-1487754180451-c456f719a1fc"), IMG("photo-1492144534655-ae79c964c9d7")],
    },
    {
      caption: "Winter tire change & storage packages available now. Don't wait for the first snowfall!\nپکیج تعویض و انبار لاستیک زمستانی موجود است. منتظر اولین برف نمانید!",
      images: [IMG("photo-1580273916550-e323be2ae537"), IMG("photo-1617886903355-9354e5bf798b")],
    },
    {
      caption: "Professional car detailing — interior, exterior, ceramic coating. Showroom shine guaranteed.\nدیتیلینگ حرفه‌ای خودرو — داخلی، خارجی، پوشش سرامیکی. درخشش نمایشگاهی تضمینی.",
      images: [IMG("photo-1601362840469-51e4d8d58792"), IMG("photo-1558618666-fcd25c85f82e"), IMG("photo-1552519507-da3b142c6e3d")],
    },
  ],
  Insurance: [
    {
      caption: "Compare home & auto insurance quotes from 20+ providers. Save up to 30% in minutes.\nمقایسه قیمت بیمه خانه و خودرو از ۲۰+ شرکت. تا ۳۰٪ صرفه‌جویی در چند دقیقه.",
      images: [IMG("photo-1450101499163-c8848c66ca85"), IMG("photo-1560472354-b33ff0c44a43")],
    },
    {
      caption: "Small business insurance tailored for local service providers. Liability, equipment, and more.\nبیمه کسب‌وکار کوچک مخصوص ارائه‌دهندگان خدمات محلی. مسئولیت، تجهیزات و بیشتر.",
      images: [IMG("photo-1507003211169-0a1dd7228f2d"), IMG("photo-1454165804606-c3d57bc86b40")],
    },
    {
      caption: "Life insurance doesn't have to be complicated. Get a free consultation with our licensed advisors.\nبیمه عمر نباید پیچیده باشد. مشاوره رایگان با مشاوران مجاز ما دریافت کنید.",
      images: [IMG("photo-1573497620053-ea5300f94f21"), IMG("photo-1600880292203-757bb62b4baf")],
    },
  ],
  Banking: [
    {
      caption: "Open a business account with zero monthly fees for the first year. Apply in 10 minutes.\nحساب تجاری با کارمزد ماهانه صفر برای سال اول باز کنید. در ۱۰ دقیقه درخواست دهید.",
      images: [IMG("photo-1501163268664-3fdf329d019f"), IMG("photo-1563986768609-322da13575f2")],
    },
    {
      caption: "Need a small business loan? Check your eligibility without affecting your credit score.\nوام کسب‌وکار کوچک نیاز دارید؟ واجد شرایط بودن خود را بدون تأثیر بر امتیاز اعتباری بررسی کنید.",
      images: [IMG("photo-1579621970563-ebec7560ff3e"), IMG("photo-1554226655-9c294e490aa0"), IMG("photo-1567427017947-545c5f8d16ad")],
    },
    {
      caption: "Mortgage pre-approval in 24 hours. Competitive rates for first-time home buyers.\nپیش‌تأیید وام مسکن در ۲۴ ساعت. نرخ‌های رقابتی برای خریداران خانه اول.",
      images: [IMG("photo-1560518883-ce09059eeffa"), IMG("photo-1560185893-aae6d4183453")],
    },
  ],
  Fuel: [
    {
      caption: "Propane tank refill & exchange — same-day delivery across GTA. BBQ season is here!\nشارژ و تعویض سیلندر پروپان — تحویل همان روز در سراسر GTA. فصل باربیکیو شروع شد!",
      images: [IMG("photo-1598970434795-0e1a3e74cae2"), IMG("photo-1543079948-1c54c7f0a4b8")],
    },
    {
      caption: "EV charging station installation for homes & condos. Government rebates available.\nنصب ایستگاه شارژ خودرو برقی برای خانه‌ها و کاندوها. تخفیف‌های دولتی موجود است.",
      images: [IMG("photo-1593941707882-a5bba14938c7"), IMG("photo-1558618666-fcd25c85f82e")],
    },
    {
      caption: "Heating oil & furnace maintenance packages. Stay warm this winter with reliable service.\nپکیج‌های روغن گرمایشی و نگهداری کوره. با سرویس مطمئن این زمستان گرم بمانید.",
      images: [IMG("photo-1585771724684-38269d6639fd"), IMG("photo-1504328341006-b4e09cf85dab"), IMG("photo-1517649763962-0c623066013b")],
    },
  ],
  "Government Services": [
    {
      caption: "Need a building permit? We handle the paperwork so you can focus on your renovation.\nمجوز ساختمان نیاز دارید؟ ما کارهای اداری را انجام می‌دهیم تا شما روی بازسازی تمرکز کنید.",
      images: [IMG("photo-1454165804606-c3d57bc86b40"), IMG("photo-1503387761673-9b2235a13064")],
    },
    {
      caption: "Passport renewal service — photos, forms, and expedited processing. Skip the lineup.\nسرویس تمدید پاسپورت — عکس، فرم‌ها و پردازش سریع. از صف رد شوید.",
      images: [IMG("photo-1544005313-94ddf0286df2"), IMG("photo-1554226655-9c294e490aa0")],
    },
    {
      caption: "Property tax assessment review. Our experts can challenge your assessment and potentially save you thousands.\nبررسی ارزیابی مالیات ملک. کارشناسان ما می‌توانند ارزیابی شما را به چالش بکشند و هزاران دلار صرفه‌جویی کنند.",
      images: [IMG("photo-1560518883-ce09059eeffa"), IMG("photo-1507003211169-0a1dd7228f2d")],
    },
  ],
  Health: [
    {
      caption: "Walk-in clinic — no appointment needed. Open 7 days a week, extended hours.\nکلینیک سرپایی — بدون نیاز به نوبت. ۷ روز هفته باز، ساعات طولانی.",
      images: [IMG("photo-1576091160550-2173dba999ef"), IMG("photo-1505751172876-fa1923c5c528")],
    },
    {
      caption: "Registered massage therapy (RMT) — direct billing to insurance. Relax, recover, rejuvenate.\nماساژ درمانی ثبت‌شده (RMT) — پرداخت مستقیم به بیمه. آرامش، بهبودی، تجدید قوا.",
      images: [IMG("photo-1544161515-4ab6ce6db874"), IMG("photo-1600334089648-b0d9d3028eb2"), IMG("photo-1519823551278-64ac92734fb1")],
    },
    {
      caption: "Physiotherapy & sports injury clinic. Custom rehab plans with one-on-one care.\nکلینیک فیزیوتراپی و آسیب‌های ورزشی. برنامه‌های توانبخشی سفارشی با مراقبت اختصاصی.",
      images: [IMG("photo-1571019613454-1cb2f99b2d8b"), IMG("photo-1588776814546-1ffcf47267a5")],
    },
  ],
  "Home Services": [
    {
      caption: "Licensed electrician — panel upgrades, rewiring, pot lights, and EV charger installs.\nبرقکار مجاز — ارتقاء پنل، سیم‌کشی مجدد، نورپردازی و نصب شارژر خودرو برقی.",
      images: [IMG("photo-1621905252507-b35492cc74b4"), IMG("photo-1558618666-fcd25c85f82e")],
    },
    {
      caption: "Professional house cleaning — deep clean, move-in/out, regular maintenance. Eco-friendly products.\nنظافت حرفه‌ای منزل — نظافت عمیق، ورود/خروج، نگهداری منظم. محصولات سازگار با محیط زیست.",
      images: [IMG("photo-1581578731548-c64695cc6952"), IMG("photo-1527515637462-cff94eecc1ac"), IMG("photo-1558618666-fcd25c85f82e")],
    },
    {
      caption: "Plumbing emergency? We're available 24/7. Burst pipes, clogged drains, water heater repair.\nاضطراری لوله‌کشی؟ ما ۲۴/۷ در دسترسیم. ترکیدگی لوله، گرفتگی فاضلاب، تعمیر آبگرمکن.",
      images: [IMG("photo-1585704032915-c3400ca199e7"), IMG("photo-1607472585687-eefb9d8ff5e5")],
    },
  ],
  "Personal Care": [
    {
      caption: "Premium barber shop — hot towel shave, fade, beard trim. Walk-ins welcome.\nآرایشگاه پریمیوم — اصلاح با حوله گرم، فید، ریش. بدون نوبت پذیرش می‌شود.",
      images: [IMG("photo-1503951914875-452162b0f3f1"), IMG("photo-1585747866715-20eac14b1b4e")],
    },
    {
      caption: "Luxury spa day packages — facial, massage, mani-pedi. Gift cards available.\nپکیج روز اسپا لوکس — فیشیال، ماساژ، مانی‌پدی. کارت هدیه موجود است.",
      images: [IMG("photo-1540555700478-4be289fbec6f"), IMG("photo-1600334089648-b0d9d3028eb2"), IMG("photo-1519823551278-64ac92734fb1")],
    },
    {
      caption: "Professional makeup & hair styling for weddings, events, and photoshoots. Trial sessions available.\nآرایش و موی حرفه‌ای برای عروسی، رویدادها و عکاسی. جلسات آزمایشی موجود است.",
      images: [IMG("photo-1487412917298-f7be40a8c717"), IMG("photo-1522337360788-8b13dee7a37e")],
    },
  ],
  Transportation: [
    {
      caption: "Local moving company — licensed & insured. Flat rates, no hidden fees. Free estimates.\nشرکت حمل‌ونقل محلی — مجاز و بیمه. نرخ ثابت، بدون هزینه پنهان. تخمین رایگان.",
      images: [IMG("photo-1600585152220-90363fe7e115"), IMG("photo-1558618666-fcd25c85f82e")],
    },
    {
      caption: "Same-day courier service across GTA. Documents, parcels, and food delivery.\nسرویس پیک همان روز در سراسر GTA. اسناد، بسته‌ها و تحویل غذا.",
      images: [IMG("photo-1616432043562-3671ed8655ca"), IMG("photo-1580674285054-bed31e145f59")],
    },
    {
      caption: "Airport transfer — Pearson, Billy Bishop, Hamilton. Luxury sedans & SUVs.\nترانسفر فرودگاه — پیرسون، بیلی بیشاپ، همیلتون. سدان‌ها و SUVهای لوکس.",
      images: [IMG("photo-1549317661-bd32c8ce0db2"), IMG("photo-1507003211169-0a1dd7228f2d"), IMG("photo-1449965408869-eaa3f722e40d")],
    },
  ],
  Utilities: [
    {
      caption: "High-speed internet for your home or business. No contracts, unlimited data, $49.99/mo.\nاینترنت پرسرعت برای خانه یا کسب‌وکار شما. بدون قرارداد، دیتای نامحدود، ۴۹.۹۹ دلار/ماه.",
      images: [IMG("photo-1558494949-ef010cbdcc31"), IMG("photo-1563770660941-10a6380d94e9")],
    },
    {
      caption: "Smart home setup — thermostats, cameras, doorbells, and automation. Save on energy bills.\nنصب خانه هوشمند — ترموستات، دوربین، زنگ در و اتوماسیون. در قبض انرژی صرفه‌جویی کنید.",
      images: [IMG("photo-1558002038-1055907df827"), IMG("photo-1558618666-fcd25c85f82e"), IMG("photo-1558618666-fcd25c85f82e")],
    },
    {
      caption: "Waste removal & junk disposal. We haul away furniture, appliances, renovation debris.\nحمل زباله و دورریز. مبلمان، لوازم خانگی، نخاله‌های بازسازی را می‌بریم.",
      images: [IMG("photo-1532996122724-e3c354a0b15b"), IMG("photo-1504328341006-b4e09cf85dab")],
    },
  ],
};

const GENERAL_POSTS: Record<string, PostTemplate[]> = {
  Lifestyle: [
    {
      caption: "Top 5 Persian restaurants in North York — tried & tested by our community!\n۵ رستوران برتر ایرانی در نورث یورک — تست شده توسط جامعه ما!",
      images: [IMG("photo-1414235077428-338989a2e8c0"), IMG("photo-1517248135467-4c7edcad34c4"), IMG("photo-1552566626-52f8b828add9")],
    },
    {
      caption: "Best hiking trails near Toronto for a weekend escape. Pack your boots!\nبهترین مسیرهای پیاده‌روی نزدیک تورنتو برای فرار آخر هفته. کفش‌هایتان را بردارید!",
      images: [IMG("photo-1551632811-561732d1e306"), IMG("photo-1501555088652-021faa106b9b")],
    },
    {
      caption: "Toronto Farmers' Market guide — fresh produce, baked goods, and artisan crafts every Saturday.\nراهنمای بازار کشاورزان تورنتو — محصولات تازه، نان و صنایع دستی هر شنبه.",
      images: [IMG("photo-1488459717023-24bff7da1e81"), IMG("photo-1542838132-82a9d30b6af0"), IMG("photo-1579113800032-c38bd7635818")],
    },
  ],
  Events: [
    {
      caption: "Nowruz Festival 2026 at Mel Lastman Square — music, dance, food, and family fun!\nجشنواره نوروز ۲۰۲۶ در میدان مل لستمن — موسیقی، رقص، غذا و سرگرمی خانوادگی!",
      images: [IMG("photo-1464366400600-7168b8af9bc3"), IMG("photo-1429962714451-bb934ecdc4ec")],
    },
    {
      caption: "Free yoga in the park every Sunday morning at Trinity Bellwoods. All levels welcome.\nیوگا رایگان در پارک هر یکشنبه صبح در ترینیتی بلوودز. همه سطوح خوش آمدید.",
      images: [IMG("photo-1544367567-0f2fcb009e0b"), IMG("photo-1506126613408-eca07ce68773")],
    },
    {
      caption: "Community garage sale — Leslieville, June 15. Over 50 homes participating. Great finds!\nفروش گاراژی محلی — لزلی‌ویل، ۱۵ ژوئن. بیش از ۵۰ خانه شرکت می‌کنند. چیزهای عالی پیدا کنید!",
      images: [IMG("photo-1533900298318-6b8da08a523e"), IMG("photo-1472851294608-062f824d29cc"), IMG("photo-1558618666-fcd25c85f82e")],
    },
  ],
  "Tips & Advice": [
    {
      caption: "How to winterize your home: 10 tips every Toronto homeowner should know. Save on heating!\nچگونه خانه خود را زمستانی کنید: ۱۰ نکته که هر صاحب‌خانه تورنتویی باید بداند. در گرمایش صرفه‌جویی کنید!",
      images: [IMG("photo-1544027993-37dbfe43562a"), IMG("photo-1585771724684-38269d6639fd")],
    },
    {
      caption: "First-time home buyer? Here's what you need to know about mortgages, land transfer tax, and rebates.\nخریدار خانه اول؟ این چیزی است که باید درباره وام مسکن، مالیات انتقال زمین و تخفیف‌ها بدانید.",
      images: [IMG("photo-1560518883-ce09059eeffa"), IMG("photo-1560185893-aae6d4183453"), IMG("photo-1507003211169-0a1dd7228f2d")],
    },
    {
      caption: "DIY car maintenance: 5 things you can check at home to avoid a breakdown this summer.\nنگهداری خودرو DIY: ۵ چیزی که می‌توانید در خانه بررسی کنید تا از خرابی در تابستان جلوگیری کنید.",
      images: [IMG("photo-1486262715619-67b85e0b08d3"), IMG("photo-1530046339160-ce3e530c7d2f")],
    },
  ],
  "Local News": [
    {
      caption: "TTC Line 1 weekend closure — shuttle buses running between Finch & Sheppard. Plan ahead!\nتعطیلی آخر هفته خط ۱ TTC — اتوبوس‌های جایگزین بین فینچ و شپرد. از قبل برنامه‌ریزی کنید!",
      images: [IMG("photo-1570125909232-c1a64e24a7d3"), IMG("photo-1544620347-c4fd4a3d5957")],
    },
    {
      caption: "New community center opening in Scarborough — pool, gym, library, and daycare services.\nمرکز اجتماعی جدید در اسکاربرو افتتاح می‌شود — استخر، باشگاه، کتابخانه و خدمات مهدکودک.",
      images: [IMG("photo-1571902943202-507ec2618e8f"), IMG("photo-1582213782179-49a09fcc1f59"), IMG("photo-1558618666-fcd25c85f82e")],
    },
    {
      caption: "Weather alert: freezing rain expected tonight. Drive carefully and allow extra travel time.\nهشدار هواشناسی: باران یخ‌زده امشب پیش‌بینی می‌شود. با احتیاط رانندگی کنید و زمان سفر اضافی در نظر بگیرید.",
      images: [IMG("photo-1492011221367-f47e3d4cfb4a"), IMG("photo-1514632595-cf8c72ee392e")],
    },
  ],
  Community: [
    {
      caption: "Lost cat — orange tabby, answers to 'Milo'. Last seen near Yonge & Eglinton. Please help!\nگربه گم شده — تابی نارنجی، به نام 'میلو' پاسخ می‌دهد. آخرین بار نزدیک یانگ و اگلینتون دیده شد. لطفاً کمک کنید!",
      images: [IMG("photo-1574158622682-e40e69881006"), IMG("photo-1514888286974-6c03e2c0cc29")],
    },
    {
      caption: "Neighbourhood watch meeting — Tuesday 7pm at the public library. All residents welcome.\nجلسه نگهبانی محله — سه‌شنبه ساعت ۷ عصر در کتابخانه عمومی. همه ساکنان خوش آمدید.",
      images: [IMG("photo-1577894940115-63ed1d1e1e21"), IMG("photo-1529070538774-1843cb3265df"), IMG("photo-1558618666-fcd25c85f82e")],
    },
    {
      caption: "Looking for a piano teacher for my 8-year-old in the Danforth area. Recommendations appreciated!\nدنبال معلم پیانو برای فرزند ۸ ساله‌ام در منطقه دنفورث می‌گردم. پیشنهادات شما قدردانی می‌شود!",
      images: [IMG("photo-1507838153414-b4b713384a76"), IMG("photo-1552422535-c45813f7b4c5")],
    },
  ],
};

// ── Main seed function ─────────────────────────────────────────────

export async function seedPosts(prisma: PrismaClient, authorId: string) {
  console.log("🌱 Seeding demo posts (45 total: 30 business + 15 general) …");

  // ── 1. UPSERT CATEGORIES ─────────────────────────────────────────
  //    Business parent → "Business Services"
  //    General parent  → "General"

  let businessParent = await prisma.category.findFirst({
    where: { name: "Business Services", parentId: null },
  });
  if (!businessParent) {
    businessParent = await prisma.category.create({
      data: { name: "Business Services", description: "All business and service categories" },
    });
  }

  let generalParent = await prisma.category.findFirst({
    where: { name: "General", parentId: null },
  });
  if (!generalParent) {
    generalParent = await prisma.category.create({
      data: { name: "General", description: "General community and lifestyle categories" },
    });
  }

  // Upsert each child category
  async function upsertCategory(def: CategoryDef) {
    const parentId = def.parent === "BUSINESS" ? businessParent.id : generalParent.id;
    const existing = await prisma.category.findFirst({ where: { name: def.name, parentId } });
    if (existing) return existing;
    return prisma.category.create({
      data: { name: def.name, description: def.description, parentId },
    });
  }

  const businessCats: Record<string, string> = {};
  for (const def of BUSINESS_CATEGORIES) {
    const cat = await upsertCategory(def);
    businessCats[def.name] = cat.id;
  }

  const generalCats: Record<string, string> = {};
  for (const def of GENERAL_CATEGORIES) {
    const cat = await upsertCategory(def);
    generalCats[def.name] = cat.id;
  }

  console.log(`  Categories ready: ${Object.keys(businessCats).length} business, ${Object.keys(generalCats).length} general`);

  // ── 2. CREATE LOCATIONS ──────────────────────────────────────────
  const locIds: string[] = [];
  for (const loc of TORONTO_LOCATIONS) {
    const existing = await prisma.postLocation.findFirst({
      where: { name: loc.name, city: loc.city },
    });
    if (existing) {
      locIds.push(existing.id);
    } else {
      const created = await prisma.postLocation.create({
        data: {
          name: loc.name,
          latitude: loc.lat,
          longitude: loc.lng,
          city: loc.city,
          province: loc.province,
          country: "CA",
        },
      });
      locIds.push(created.id);
    }
  }

  console.log(`  Locations ready: ${locIds.length}`);

  // ── 3. IDEMPOTENCY CHECK ─────────────────────────────────────────
  const existingPostCount = await prisma.post.count({
    where: { authorId, isBusinessPost: true },
  });
  if (existingPostCount >= 30) {
    // Also check general posts
    const generalCount = await prisma.post.count({
      where: { authorId, isBusinessPost: false },
    });
    if (generalCount >= 15) {
      console.log(`  ⏭️  Posts already seeded (${existingPostCount} business, ${generalCount} general). Skipping.`);
      return;
    }
  }

  // ── 4. CREATE BUSINESS POSTS (30) ────────────────────────────────
  console.log("  Creating 30 business posts …");
  for (const [catName, templates] of Object.entries(BUSINESS_POSTS)) {
    const categoryId = businessCats[catName];
    if (!categoryId) {
      console.warn(`  ⚠️  Category "${catName}" not found, skipping.`);
      continue;
    }

    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      // Check if this specific post already exists (by author + category + caption prefix)
      const captionPrefix = t.caption.slice(0, 40);
      const existing = await prisma.post.findFirst({
        where: { authorId, categoryId, caption: { startsWith: captionPrefix } },
      });
      if (existing) {
        console.log(`    ⏭️  Skipping existing: ${catName} #${i + 1}`);
        continue;
      }

      const locationId = pick(locIds);
      const post = await prisma.post.create({
        data: {
          authorId,
          categoryId,
          caption: t.caption,
          isBusinessPost: true,
          isPromoted: i === 0, // first post in each category is promoted
          moderationStatus: "approved",
          publishedAt: new Date(),
          locationId,
          media: {
            create: t.images.map((url, idx) => ({
              type: "image" as const,
              url,
              sortOrder: idx,
            })),
          },
        },
      });
      console.log(`    ✅ ${catName} #${i + 1} (${post.id.slice(0, 8)}…)`);
    }
  }

  // ── 5. CREATE GENERAL POSTS (15) ─────────────────────────────────
  console.log("  Creating 15 general posts …");
  for (const [catName, templates] of Object.entries(GENERAL_POSTS)) {
    const categoryId = generalCats[catName];
    if (!categoryId) {
      console.warn(`  ⚠️  Category "${catName}" not found, skipping.`);
      continue;
    }

    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const captionPrefix = t.caption.slice(0, 40);
      const existing = await prisma.post.findFirst({
        where: { authorId, categoryId, caption: { startsWith: captionPrefix } },
      });
      if (existing) {
        console.log(`    ⏭️  Skipping existing: ${catName} #${i + 1}`);
        continue;
      }

      const locationId = pick(locIds);
      const post = await prisma.post.create({
        data: {
          authorId,
          categoryId,
          caption: t.caption,
          isBusinessPost: false,
          isPromoted: false,
          moderationStatus: "approved",
          publishedAt: new Date(),
          locationId,
          media: {
            create: t.images.map((url, idx) => ({
              type: "image" as const,
              url,
              sortOrder: idx,
            })),
          },
        },
      });
      console.log(`    ✅ ${catName} #${i + 1} (${post.id.slice(0, 8)}…)`);
    }
  }

  // ── 6. SUMMARY ───────────────────────────────────────────────────
  const [totalBiz, totalGeneral] = await Promise.all([
    prisma.post.count({ where: { authorId, isBusinessPost: true } }),
    prisma.post.count({ where: { authorId, isBusinessPost: false } }),
  ]);
  console.log(`🎉 Posts seeding complete: ${totalBiz} business + ${totalGeneral} general = ${totalBiz + totalGeneral} total`);
}