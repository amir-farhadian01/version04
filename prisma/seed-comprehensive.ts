/**
 * Comprehensive Seed — 10 Businesses, 45 Posts, 10 Orders, 15 Notifications, 10 Reviews
 * 
 * Fixes the "Business not found" bug by creating real Company records that 
 * the /biz/:id route can look up. Also seeds all demo data needed for 
 * full UI testing of both React (localhost:5173) and Flutter (localhost:7357).
 */
import type { PrismaClient } from "@prisma/client";
import { BookingMode } from "@prisma/client";

// ── Helpers ──────────────────────────────────────────────────────────

function IMG(id: string, w = 800, h = 600) {
  return `https://images.unsplash.com/${id}?q=80&w=${w}&h=${h}&auto=format&fit=crop`;
}

const TORONTO_LOCATIONS = [
  { name: "Downtown Toronto", lat: 43.6532, lng: -79.3832, city: "Toronto", province: "ON" },
  { name: "North York", lat: 43.7615, lng: -79.4111, city: "Toronto", province: "ON" },
  { name: "Scarborough", lat: 43.7764, lng: -79.2318, city: "Toronto", province: "ON" },
  { name: "Etobicoke", lat: 43.6435, lng: -79.5657, city: "Toronto", province: "ON" },
  { name: "East York", lat: 43.6912, lng: -79.3417, city: "Toronto", province: "ON" },
  { name: "Liberty Village", lat: 43.6379, lng: -79.4216, city: "Toronto", province: "ON" },
  { name: "The Beaches", lat: 43.6701, lng: -79.2975, city: "Toronto", province: "ON" },
  { name: "High Park", lat: 43.6465, lng: -79.4636, city: "Toronto", province: "ON" },
  { name: "Midtown Toronto", lat: 43.7064, lng: -79.3988, city: "Toronto", province: "ON" },
  { name: "York", lat: 43.6723, lng: -79.4802, city: "Toronto", province: "ON" },
];

// ── Business Definitions ─────────────────────────────────────────────

interface BusinessDef {
  providerEmail: string;
  providerDisplayName: string;
  firstName: string;
  lastName: string;
  companyName: string;
  slug: string;
  slogan: string;
  about: string;
  categoryName: string;
  categoryDesc: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  coverImageUrl: string;
  history: string;
  mission: string;
  tags: string[];
  galleryUrls: string[];
  avgRating: number;
  reviewCount: number;
  experienceYears: number;
  businessHours: { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }[];
  licenseNumber: string;
  hasInsurance: boolean;
  services: {
    catalogSlug: string;
    catalogName: string;
    category: string;
    subcategory?: string;
    desc?: string;
    packages: {
      name: string;
      description: string;
      finalPrice: number;
      bookingMode: BookingMode;
      durationMinutes: number;
      products: { sku: string; name: string; unit: string; unitPrice: number; quantity: number }[];
    }[];
  }[];
  posts: {
    caption: string;
    images: string[];
    priceLabel?: string;
  }[];
}

const BUSINESSES: BusinessDef[] = [
  // 1 — Metro Hair Studio
  {
    providerEmail: "metrohair@neighborly.local",
    providerDisplayName: "Metro Hair Studio",
    firstName: "Sarah",
    lastName: "Johnson",
    companyName: "Metro Hair Studio",
    slug: "metro-hair-studio",
    slogan: "Style that comes to you — mobile haircare in Toronto",
    about: "Metro Hair Studio brings premium hair styling directly to your doorstep across the GTA. Our team of certified stylists specializes in cuts, coloring, treatments, and event styling for men, women, and children. We believe great hair shouldn't require a commute.",
    categoryName: "Personal Care",
    categoryDesc: "Barber, salon, spa, massage, and beauty services",
    address: "123 Bloor St W, Toronto, ON",
    city: "Toronto",
    postalCode: "M5S 1T4",
    phone: "+1-416-555-0101",
    email: "hello@metrohair.ca",
    website: "https://metrohair.ca",
    logoUrl: IMG("photo-1503951914875-452162b0f3f1"),
    coverImageUrl: IMG("photo-1560066984-138dadb4c035"),
    history: "Founded in 2018 by master stylist Sarah Johnson, Metro Hair Studio started as a small 2-chair salon in downtown Toronto. Within two years, we transitioned to a fully mobile model, bringing professional styling to homes, offices, and events across the city.",
    mission: "To make premium hair care accessible to everyone — no commute, no wait times, just great hair at your convenience.",
    tags: ["Haircut", "Coloring", "Mobile Styling", "Events", "Men's Grooming"],
    galleryUrls: [IMG("photo-1560066984-138dadb4c035"), IMG("photo-1522337360788-8b13dee7a37e"), IMG("photo-1487412917298-f7be40a8c717"), IMG("photo-1580618672591-eb180d1a973f")],
    avgRating: 4.7,
    reviewCount: 128,
    experienceYears: 7,
    businessHours: [
      { dayOfWeek: 1, openTime: "09:00", closeTime: "20:00", isOpen: true },
      { dayOfWeek: 2, openTime: "09:00", closeTime: "20:00", isOpen: true },
      { dayOfWeek: 3, openTime: "09:00", closeTime: "20:00", isOpen: true },
      { dayOfWeek: 4, openTime: "09:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 5, openTime: "09:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 6, openTime: "10:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isOpen: false },
    ],
    licenseNumber: "BT-2018-04521",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-men-haircut",
        catalogName: "Men's Haircut & Grooming",
        category: "Personal Care",
        subcategory: "Barbering",
        desc: "Professional men's haircut with hot towel finish.",
        packages: [
          { name: "Quick Cut", description: "Basic men's haircut, 20 min. Perfect for regular trims.", finalPrice: 25, bookingMode: BookingMode.direct_booking, durationMinutes: 20, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 25, quantity: 0.33 }] },
          { name: "Premium Cut + Beard", description: "Full haircut, beard trim, hot towel, and styling.", finalPrice: 45, bookingMode: BookingMode.booking, durationMinutes: 45, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 25, quantity: 0.75 }] },
          { name: "Coloring Service", description: "Full color or highlights by senior colorist.", finalPrice: 95, bookingMode: BookingMode.booking, durationMinutes: 120, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 25, quantity: 2 }] },
        ],
      },
    ],
    posts: [
      { caption: "Fresh fade Friday! Book your weekend appointment now. Mobile service — we come to you.\nجمعه فید تازه! همین الان نوبت آخر هفته رو رزرو کن. سرویس موبایل — ما میایم پیشت.", images: [IMG("photo-1503951914875-452162b0f3f1"), IMG("photo-1585747866715-20eac14b1b4e")], priceLabel: "From $25" },
      { caption: "Wedding season is here! Bridal hair & makeup packages. Group discounts for bridal parties.\nفصل عروسی شروع شد! پکیج مو و آرایش عروس. تخفیف گروهی برای همراهان عروس.", images: [IMG("photo-1487412917298-f7be40a8c717"), IMG("photo-1522337360788-8b13dee7a37e")], priceLabel: "Negotiable" },
      { caption: "New: Kids' haircut special — $20 for under 12s. Fun, fast, and fidget-friendly!\nجدید: ویژه اصلاح مو کودکان — ۲۰ دلار برای زیر ۱۲ سال. سریع، سرگرم‌کننده و مناسب بچه‌ها!", images: [IMG("photo-1596728325488-f58e3cb8e88f"), IMG("photo-1607006554991-2b1d1d5b5c7f")], priceLabel: "From $20" },
    ],
  },

  // 2 — QuickFix Auto Repair  
  {
    providerEmail: "quickfix@neighborly.local",
    providerDisplayName: "QuickFix Auto Repair",
    firstName: "Mohammed",
    lastName: "Al-Rashid",
    companyName: "QuickFix Auto Repair",
    slug: "quickfix-auto-repair",
    slogan: "Your car, fixed fast — certified mechanics in Scarborough",
    about: "QuickFix Auto Repair has been serving Scarborough drivers since 2015. We specialize in diagnostics, brake systems, transmission work, and preventive maintenance for all makes and models. Our ASE-certified technicians use factory-grade tools and parts. Free shuttle service while you wait.",
    categoryName: "Automotive",
    categoryDesc: "Car repair, detailing, tires, and auto services",
    address: "4521 Kingston Rd, Scarborough, ON",
    city: "Toronto",
    postalCode: "M1E 2P2",
    phone: "+1-416-555-0202",
    email: "service@quickfixauto.ca",
    website: "https://quickfixauto.ca",
    logoUrl: IMG("photo-1486262715619-67b85e0b08d3"),
    coverImageUrl: IMG("photo-1487754180451-c456f719a1fc"),
    history: "Mohammed Al-Rashid opened QuickFix in 2015 after 15 years as a lead technician at Toyota. Starting with just two bays, we've grown to a full 6-bay facility with specialized diagnostic equipment for all major brands.",
    mission: "To provide honest, transparent auto repair at fair prices — no upselling, no unnecessary work.",
    tags: ["Auto Repair", "Brakes", "Transmission", "Diagnostics", "Oil Change"],
    galleryUrls: [IMG("photo-1487754180451-c456f719a1fc"), IMG("photo-1492144534655-ae79c964c9d7"), IMG("photo-1530046339160-ce3e530c7d2f"), IMG("photo-1617886903355-9354e5bf798b")],
    avgRating: 4.5,
    reviewCount: 203,
    experienceYears: 10,
    businessHours: [
      { dayOfWeek: 1, openTime: "08:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 2, openTime: "08:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 3, openTime: "08:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 4, openTime: "08:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 5, openTime: "08:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 6, openTime: "09:00", closeTime: "14:00", isOpen: true },
      { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isOpen: false },
    ],
    licenseNumber: "AR-2015-00289",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-oil-change",
        catalogName: "Full Synthetic Oil Change",
        category: "Automotive",
        subcategory: "Maintenance",
        desc: "Complete oil change with synthetic oil and filter.",
        packages: [
          { name: "Standard Oil Change", description: "5W-30 synthetic oil + OEM filter for most sedans & SUVs.", finalPrice: 79, bookingMode: BookingMode.direct_booking, durationMinutes: 45, products: [{ sku: "COMP-OIL-SYN", name: "Synthetic Oil 5W-30", unit: "bottle", unitPrice: 32, quantity: 1 }, { sku: "COMP-FILTER", name: "Oil Filter OEM", unit: "each", unitPrice: 18, quantity: 1 }] },
          { name: "Brake Pad Replacement", description: "Front or rear pads + rotor inspection. Ceramic pads included.", finalPrice: 220, bookingMode: BookingMode.booking, durationMinutes: 90, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 30, quantity: 1.5 }] },
          { name: "Full Diagnostic Scan", description: "Computer diagnostic + visual inspection. Written report included.", finalPrice: 95, bookingMode: BookingMode.quote_first, durationMinutes: 60, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 30, quantity: 1 }] },
        ],
      },
    ],
    posts: [
      { caption: "Check engine light on? Don't ignore it! Free code scan with any service this month.\nچراغ چک موتور روشنه؟ نادیده نگیر! اسکن رایگان کد با هر سرویس در این ماه.", images: [IMG("photo-1486262715619-67b85e0b08d3"), IMG("photo-1492144534655-ae79c964c9d7")], priceLabel: "From $79" },
      { caption: "Winter tire swap special — $49.99 including balancing. Book before the rush!\nویژه تعویض لاستیک زمستانی — ۴۹.۹۹ دلار با بالانس. قبل از شلوغی رزرو کن!", images: [IMG("photo-1580273916550-e323be2ae537"), IMG("photo-1617886903355-9354e5bf798b")], priceLabel: "$49.99" },
      { caption: "Need major engine work? Get a free estimate. We handle timing belts, head gaskets & more.\nتعمیرات اساسی موتور نیاز داری؟ تخمین رایگان بگیر. تسمه تایم، واشر سرسیلندر و بیشتر انجام می‌دیم.", images: [IMG("photo-1530046339160-ce3e530c7d2f"), IMG("photo-1558618666-fcd25c85f82e")], priceLabel: "Negotiable" },
    ],
  },

  // 3 — Elite Insurance Brokers
  {
    providerEmail: "eliteinsurance@neighborly.local",
    providerDisplayName: "Elite Insurance Brokers",
    firstName: "Priya",
    lastName: "Sharma",
    companyName: "Elite Insurance Brokers",
    slug: "elite-insurance-brokers",
    slogan: "Protecting what matters — home, auto, life & business insurance",
    about: "Elite Insurance Brokers is an independent brokerage partnered with 25+ Canadian insurers. We compare rates across providers to find you the best coverage at the best price. Our licensed advisors specialize in home, auto, life, and small business insurance.",
    categoryName: "Insurance",
    categoryDesc: "Home, auto, life, and business insurance",
    address: "220 Bay St, Suite 500, Toronto, ON",
    city: "Toronto",
    postalCode: "M5J 2W4",
    phone: "+1-416-555-0303",
    email: "quotes@eliteinsurance.ca",
    website: "https://eliteinsurance.ca",
    logoUrl: IMG("photo-1450101499163-c8848c66ca85"),
    coverImageUrl: IMG("photo-1560472354-b33ff0c44a43"),
    history: "Established in 2012, Elite Insurance Brokers began as a two-person office serving the financial district. Today we serve 5,000+ clients across Ontario with a team of 12 licensed advisors.",
    mission: "To simplify insurance — transparent comparisons, no jargon, and coverage that actually fits your life.",
    tags: ["Home Insurance", "Auto Insurance", "Life Insurance", "Business Insurance"],
    galleryUrls: [IMG("photo-1450101499163-c8848c66ca85"), IMG("photo-1560472354-b33ff0c44a43"), IMG("photo-1454165804606-c3d57bc86b40"), IMG("photo-1573497620053-ea5300f94f21")],
    avgRating: 4.6,
    reviewCount: 87,
    experienceYears: 13,
    businessHours: [
      { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 4, openTime: "09:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 5, openTime: "09:00", closeTime: "16:00", isOpen: true },
      { dayOfWeek: 6, openTime: "00:00", closeTime: "00:00", isOpen: false },
      { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isOpen: false },
    ],
    licenseNumber: "FSRA-2012-00734",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-insurance-consult",
        catalogName: "Insurance Consultation",
        category: "Insurance",
        subcategory: "Consulting",
        desc: "Free insurance review and quote comparison.",
        packages: [
          { name: "Free Quote Comparison", description: "Get quotes from 25+ providers for home & auto. No obligation.", finalPrice: 0, bookingMode: BookingMode.direct_booking, durationMinutes: 30, products: [] },
          { name: "Business Insurance Package", description: "Custom liability, property & equipment coverage for small businesses.", finalPrice: 0, bookingMode: BookingMode.quote_first, durationMinutes: 60, products: [] },
          { name: "Life Insurance Review", description: "Full needs assessment + policy comparison. Licensed advisors.", finalPrice: 0, bookingMode: BookingMode.booking, durationMinutes: 45, products: [] },
        ],
      },
    ],
    posts: [
      { caption: "Home insurance rates going up? We compare 25+ providers to find you the best deal. Free quotes!\nنرخ بیمه خونه داره میره بالا؟ ما ۲۵+ شرکت رو مقایسه می‌کنیم تا بهترین قیمت رو برات پیدا کنیم. تخمین رایگان!", images: [IMG("photo-1450101499163-c8848c66ca85"), IMG("photo-1560518883-ce09059eeffa")], priceLabel: "Free" },
      { caption: "Small business owners: Are you properly insured? Liability, equipment, and income protection. Book a free review.\nصاحبان کسب‌وکار کوچک: آیا به درستی بیمه هستید؟ مسئولیت، تجهیزات و محافظت درآمد. بررسی رایگان رزرو کنید.", images: [IMG("photo-1507003211169-0a1dd7228f2d"), IMG("photo-1454165804606-c3d57bc86b40")], priceLabel: "Free consultation" },
      { caption: "Life insurance doesn't have to be confusing. 30-minute consult, clear options, no pressure.\nبیمه عمر نباید گیج‌کننده باشه. مشاوره ۳۰ دقیقه‌ای، گزینه‌های شفاف، بدون فشار.", images: [IMG("photo-1573497620053-ea5300f94f21"), IMG("photo-1600880292203-757bb62b4baf")], priceLabel: "Free" },
    ],
  },

  // 4 — Natural CanaGas Fuel
  {
    providerEmail: "canagas@neighborly.local",
    providerDisplayName: "Natural CanaGas Fuel",
    firstName: "Jean",
    lastName: "Tremblay",
    companyName: "Natural CanaGas Fuel",
    slug: "natural-canagas-fuel",
    slogan: "Clean, reliable fuel delivery across the GTA",
    about: "Natural CanaGas Fuel provides propane refills, heating oil delivery, and EV charging station installations for residential and commercial clients. Same-day delivery available across Toronto. We're committed to transitioning our fleet to carbon-neutral by 2028.",
    categoryName: "Fuel",
    categoryDesc: "Gas stations, propane, EV charging, and heating fuel",
    address: "890 Warden Ave, Scarborough, ON",
    city: "Toronto",
    postalCode: "M1L 4B6",
    phone: "+1-416-555-0404",
    email: "orders@canagas.ca",
    website: "https://canagas.ca",
    logoUrl: IMG("photo-1598970434795-0e1a3e74cae2"),
    coverImageUrl: IMG("photo-1543079948-1c54c7f0a4b8"),
    history: "CanaGas started in 2010 as a single propane truck serving East York. Today we operate 8 delivery vehicles and have installed over 500 residential EV chargers across the GTA.",
    mission: "To make clean fuel accessible to every Toronto household — from propane to EV charging.",
    tags: ["Propane", "Heating Oil", "EV Charging", "Same-Day Delivery"],
    galleryUrls: [IMG("photo-1598970434795-0e1a3e74cae2"), IMG("photo-1543079948-1c54c7f0a4b8"), IMG("photo-1593941707882-a5bba14938c7"), IMG("photo-1558618666-fcd25c85f82e")],
    avgRating: 4.3,
    reviewCount: 156,
    experienceYears: 15,
    businessHours: [
      { dayOfWeek: 1, openTime: "07:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 2, openTime: "07:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 3, openTime: "07:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 4, openTime: "07:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 5, openTime: "07:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 6, openTime: "08:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 0, openTime: "09:00", closeTime: "15:00", isOpen: true },
    ],
    licenseNumber: "TSSA-2010-00112",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-propane-refill",
        catalogName: "Propane Tank Refill & Exchange",
        category: "Fuel",
        subcategory: "Propane",
        desc: "Same-day propane refill or tank exchange.",
        packages: [
          { name: "Propane Tank Refill (20lb)", description: "Standard BBQ tank refill. Drop off or we pick up.", finalPrice: 22, bookingMode: BookingMode.direct_booking, durationMinutes: 15, products: [{ sku: "COMP-PROPANE", name: "Propane Refill 20lb", unit: "each", unitPrice: 22, quantity: 1 }] },
          { name: "Tank Exchange (20lb)", description: "Swap your empty tank for a full one. No waiting.", finalPrice: 28, bookingMode: BookingMode.direct_booking, durationMinutes: 10, products: [{ sku: "COMP-PROPANE", name: "Propane Refill 20lb", unit: "each", unitPrice: 22, quantity: 1 }] },
          { name: "EV Charger Installation", description: "Level 2 home charger install by licensed electrician. Rebates available.", finalPrice: 850, bookingMode: BookingMode.quote_first, durationMinutes: 240, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 35, quantity: 4 }] },
        ],
      },
    ],
    posts: [
      { caption: "BBQ season is here! Propane tank refill or exchange — same day delivery across GTA. Order online!\nفصل BBQ شروع شد! شارژ یا تعویض سیلندر پروپان — تحویل همان روز در GTA. آنلاین سفارش بده!", images: [IMG("photo-1598970434795-0e1a3e74cae2"), IMG("photo-1543079948-1c54c7f0a4b8")], priceLabel: "From $22" },
      { caption: "Going electric? We install Level 2 home chargers. Government rebates up to $1,000 available.\nبرقی می‌ری؟ شارژر خانگی Level 2 نصب می‌کنیم. تخفیف دولتی تا ۱۰۰۰ دلار موجوده.", images: [IMG("photo-1593941707882-a5bba14938c7"), IMG("photo-1558618666-fcd25c85f82e")], priceLabel: "From $850" },
      { caption: "Winter heating oil delivery — reliable, on-time, competitive pricing. Emergency fills available.\nتحویل روغن گرمایشی زمستانی — مطمئن، به موقع، قیمت رقابتی. شارژ اضطراری موجوده.", images: [IMG("photo-1585771724684-38269d6639fd"), IMG("photo-1504328341006-b4e09cf85dab")], priceLabel: "Negotiable" },
    ],
  },

  // 5 — CleanHome Plumbing
  {
    providerEmail: "cleanhome@neighborly.local",
    providerDisplayName: "CleanHome Plumbing",
    firstName: "Ahmed",
    lastName: "Hassan",
    companyName: "CleanHome Plumbing",
    slug: "cleanhome-plumbing",
    slogan: "Your trusted plumber — 24/7 emergency service in Toronto",
    about: "CleanHome Plumbing provides expert plumbing services for homes and businesses across Toronto. From leaky faucets to full bathroom renovations, our licensed plumbers handle it all. We're available 24/7 for emergencies — because pipes don't wait for business hours.",
    categoryName: "Home Services",
    categoryDesc: "Plumbing, electrical, cleaning, renovation, and repairs",
    address: "56 Danforth Ave, Toronto, ON",
    city: "Toronto",
    postalCode: "M4K 1N2",
    phone: "+1-416-555-0505",
    email: "help@cleanhomeplumbing.ca",
    website: "https://cleanhomeplumbing.ca",
    logoUrl: IMG("photo-1585704032915-c3400ca199e7"),
    coverImageUrl: IMG("photo-1607472585687-eefb9d8ff5e5"),
    history: "Ahmed Hassan founded CleanHome Plumbing in 2016 after completing his Red Seal certification. What started as a solo operation now employs 8 licensed plumbers serving over 3,000 Toronto households annually.",
    mission: "To be the most trusted name in Toronto plumbing — fast, fair, and always transparent pricing.",
    tags: ["Plumbing", "Emergency Repairs", "Drains", "Water Heater", "Renovations"],
    galleryUrls: [IMG("photo-1585704032915-c3400ca199e7"), IMG("photo-1607472585687-eefb9d8ff5e5"), IMG("photo-1584622650111-993a426fbf0a"), IMG("photo-1558618666-fcd25c85f82e")],
    avgRating: 4.8,
    reviewCount: 312,
    experienceYears: 9,
    businessHours: [
      { dayOfWeek: 1, openTime: "00:00", closeTime: "23:59", isOpen: true },
      { dayOfWeek: 2, openTime: "00:00", closeTime: "23:59", isOpen: true },
      { dayOfWeek: 3, openTime: "00:00", closeTime: "23:59", isOpen: true },
      { dayOfWeek: 4, openTime: "00:00", closeTime: "23:59", isOpen: true },
      { dayOfWeek: 5, openTime: "00:00", closeTime: "23:59", isOpen: true },
      { dayOfWeek: 6, openTime: "00:00", closeTime: "23:59", isOpen: true },
      { dayOfWeek: 0, openTime: "00:00", closeTime: "23:59", isOpen: true },
    ],
    licenseNumber: "OCOT-2016-00892",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-plumbing",
        catalogName: "Plumbing Services",
        category: "Home Services",
        subcategory: "Plumbing",
        desc: "Licensed plumbing repairs and installations.",
        packages: [
          { name: "Emergency Call-Out", description: "24/7 emergency response. First hour of diagnostics + labor included.", finalPrice: 120, bookingMode: BookingMode.direct_booking, durationMinutes: 60, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 40, quantity: 1 }] },
          { name: "Drain Cleaning", description: "Snake + hydro-jet for stubborn clogs. Includes camera inspection.", finalPrice: 195, bookingMode: BookingMode.booking, durationMinutes: 90, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 40, quantity: 1.5 }] },
          { name: "Water Heater Install", description: "Full replacement including removal of old unit. Tank & tankless options.", finalPrice: 1200, bookingMode: BookingMode.quote_first, durationMinutes: 240, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 40, quantity: 4 }] },
        ],
      },
    ],
    posts: [
      { caption: "Burst pipe? We're available 24/7. Call now — average response time under 45 minutes in Toronto.\nلوله ترکیده؟ ما ۲۴/۷ در دسترسیم. همین الان تماس بگیر — متوسط زمان پاسخ زیر ۴۵ دقیقه در تورنتو.", images: [IMG("photo-1585704032915-c3400ca199e7"), IMG("photo-1607472585687-eefb9d8ff5e5")], priceLabel: "From $120" },
      { caption: "Bathroom renovation? We handle all plumbing — rough-in, fixtures, waterproofing. Free estimates.\nبازسازی حمام؟ ما همه لوله‌کشی رو انجام می‌دیم — لوله‌کشی اولیه، شیرآلات، عایق‌کاری. تخمین رایگان.", images: [IMG("photo-1584622650111-993a426fbf0a"), IMG("photo-1558618666-fcd25c85f82e")], priceLabel: "Free estimate" },
      { caption: "Slow drain? Don't wait until it's fully clogged. $99 drain inspection + cleaning special this week.\nفاضلاب کند شده؟ صبر نکن تا کامل بگیره. ویژه این هفته: بازرسی و تمیزکاری فاضلاب ۹۹ دلار.", images: [IMG("photo-1558618666-fcd25c85f82e"), IMG("photo-1584622650111-993a426fbf0a")], priceLabel: "$99" },
    ],
  },

  // 6 — Toronto Wellness Spa
  {
    providerEmail: "wellnessspa@neighborly.local",
    providerDisplayName: "Toronto Wellness Spa",
    firstName: "Yuki",
    lastName: "Tanaka",
    companyName: "Toronto Wellness Spa",
    slug: "toronto-wellness-spa",
    slogan: "Recharge your body, refresh your mind — RMT massage & wellness",
    about: "Toronto Wellness Spa provides registered massage therapy (RMT), acupuncture, cupping, and holistic wellness treatments. Direct billing to most major insurance providers. Located in the heart of Midtown with a calming, Japanese-inspired atmosphere.",
    categoryName: "Health",
    categoryDesc: "Clinics, dental, physio, pharmacy, and wellness",
    address: "2345 Yonge St, Toronto, ON",
    city: "Toronto",
    postalCode: "M4P 2C8",
    phone: "+1-416-555-0606",
    email: "relax@towellness.ca",
    website: "https://torontowellness.ca",
    logoUrl: IMG("photo-1544161515-4ab6ce6db874"),
    coverImageUrl: IMG("photo-1600334089648-b0d9d3028eb2"),
    history: "Yuki Tanaka, a registered massage therapist with 15+ years of experience, opened Toronto Wellness Spa in 2019. Our team combines Eastern and Western techniques to provide truly holistic care.",
    mission: "To provide a sanctuary of wellness in the heart of Toronto — where every treatment is tailored to your body's needs.",
    tags: ["RMT Massage", "Acupuncture", "Cupping", "Wellness", "Insurance Direct Billing"],
    galleryUrls: [IMG("photo-1544161515-4ab6ce6db874"), IMG("photo-1600334089648-b0d9d3028eb2"), IMG("photo-1519823551278-64ac92734fb1"), IMG("photo-1540555700478-4be289fbec6f")],
    avgRating: 4.9,
    reviewCount: 245,
    experienceYears: 6,
    businessHours: [
      { dayOfWeek: 1, openTime: "08:00", closeTime: "20:00", isOpen: true },
      { dayOfWeek: 2, openTime: "08:00", closeTime: "20:00", isOpen: true },
      { dayOfWeek: 3, openTime: "08:00", closeTime: "20:00", isOpen: true },
      { dayOfWeek: 4, openTime: "08:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 5, openTime: "08:00", closeTime: "21:00", isOpen: true },
      { dayOfWeek: 6, openTime: "09:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 0, openTime: "10:00", closeTime: "16:00", isOpen: true },
    ],
    licenseNumber: "CMTO-2019-00345",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-rmt-massage",
        catalogName: "RMT Massage Therapy",
        category: "Health",
        subcategory: "Massage",
        desc: "Registered massage therapy with insurance direct billing.",
        packages: [
          { name: "60min RMT Massage", description: "Therapeutic or relaxation massage. Direct billing available.", finalPrice: 105, bookingMode: BookingMode.booking, durationMinutes: 60, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 35, quantity: 1 }] },
          { name: "90min Deep Tissue", description: "Targeted deep tissue work for chronic pain and tension.", finalPrice: 145, bookingMode: BookingMode.booking, durationMinutes: 90, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 35, quantity: 1.5 }] },
          { name: "Acupuncture Session", description: "Traditional acupuncture with licensed practitioner. 45 min.", finalPrice: 85, bookingMode: BookingMode.booking, durationMinutes: 45, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 35, quantity: 0.75 }] },
        ],
      },
    ],
    posts: [
      { caption: "Stressed? Our 60-min RMT massage is the reset you need. Direct billing to insurance. Book today.\nاسترس داری؟ ماساژ ۶۰ دقیقه‌ای RMT همون چیزیه که لازم داری. پرداخت مستقیم به بیمه. امروز رزرو کن.", images: [IMG("photo-1544161515-4ab6ce6db874"), IMG("photo-1600334089648-b0d9d3028eb2")], priceLabel: "From $105" },
      { caption: "New: Couples massage package! Side-by-side RMT treatments. Perfect date idea. Gift cards available.\nجدید: پکیج ماساژ زوج! درمان RMT کنار هم. ایده عالی برای قرار. کارت هدیه موجوده.", images: [IMG("photo-1519823551278-64ac92734fb1"), IMG("photo-1540555700478-4be289fbec6f")], priceLabel: "From $210" },
      { caption: "Acupuncture for pain relief — backed by science, covered by insurance. Free consultation available.\nطب سوزنی برای تسکین درد — پشتیبانی علمی، تحت پوشش بیمه. مشاوره رایگان موجوده.", images: [IMG("photo-1571019613454-1cb2f99b2d8b"), IMG("photo-1588776814546-1ffcf47267a5")], priceLabel: "From $85" },
    ],
  },

  // 7 — Canary Logistics
  {
    providerEmail: "canarylogistics@neighborly.local",
    providerDisplayName: "Canary Logistics",
    firstName: "David",
    lastName: "Chen",
    companyName: "Canary Logistics",
    slug: "canary-logistics",
    slogan: "Moving Toronto forward — reliable transport & delivery",
    about: "Canary Logistics offers local moving, same-day courier delivery, and airport transfer services across the GTA. Our fleet of 15 vehicles ranges from cargo vans to 26-foot trucks. Fully licensed, insured, and bonded. Flat rates with no hidden fees.",
    categoryName: "Transportation",
    categoryDesc: "Moving, delivery, rideshare, and courier services",
    address: "890 Progress Ave, Scarborough, ON",
    city: "Toronto",
    postalCode: "M1H 2X3",
    phone: "+1-416-555-0707",
    email: "dispatch@canarylogistics.ca",
    website: "https://canarylogistics.ca",
    logoUrl: IMG("photo-1600585152220-90363fe7e115"),
    coverImageUrl: IMG("photo-1558618666-fcd25c85f82e"),
    history: "David Chen started Canary Logistics in 2014 with one cargo van and a commitment to on-time delivery. Today we're one of Toronto's top-rated logistics companies with 15 vehicles and 25 team members.",
    mission: "To deliver peace of mind — every package, every move, every time.",
    tags: ["Moving", "Courier", "Airport Transfer", "Same-Day Delivery"],
    galleryUrls: [IMG("photo-1600585152220-90363fe7e115"), IMG("photo-1616432043562-3671ed8655ca"), IMG("photo-1580674285054-bed31e145f59"), IMG("photo-1549317661-bd32c8ce0db2")],
    avgRating: 4.4,
    reviewCount: 178,
    experienceYears: 11,
    businessHours: [
      { dayOfWeek: 1, openTime: "06:00", closeTime: "22:00", isOpen: true },
      { dayOfWeek: 2, openTime: "06:00", closeTime: "22:00", isOpen: true },
      { dayOfWeek: 3, openTime: "06:00", closeTime: "22:00", isOpen: true },
      { dayOfWeek: 4, openTime: "06:00", closeTime: "22:00", isOpen: true },
      { dayOfWeek: 5, openTime: "06:00", closeTime: "22:00", isOpen: true },
      { dayOfWeek: 6, openTime: "07:00", closeTime: "20:00", isOpen: true },
      { dayOfWeek: 0, openTime: "08:00", closeTime: "18:00", isOpen: true },
    ],
    licenseNumber: "CVOR-2014-00567",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-moving",
        catalogName: "Local Moving Services",
        category: "Transportation",
        subcategory: "Moving",
        desc: "Licensed and insured local moving across GTA.",
        packages: [
          { name: "Studio/1-Bedroom Move", description: "2 movers + 16ft truck for 3 hours. Basic furniture wrapping included.", finalPrice: 350, bookingMode: BookingMode.booking, durationMinutes: 180, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 35, quantity: 3 }] },
          { name: "Same-Day Courier", description: "Point-to-point delivery within GTA. Documents, parcels, or small furniture.", finalPrice: 45, bookingMode: BookingMode.direct_booking, durationMinutes: 120, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 30, quantity: 0.5 }] },
          { name: "Airport Transfer", description: "Pearson, Billy Bishop, or Hamilton. Luxury SUV. Meet & greet included.", finalPrice: 75, bookingMode: BookingMode.booking, durationMinutes: 60, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 30, quantity: 1 }] },
        ],
      },
    ],
    posts: [
      { caption: "Moving soon? Book early for weekend slots! 2 movers + truck from $350. Free estimates.\nبه زودی اثاث‌کشی داری؟ زودتر برای آخر هفته رزرو کن! ۲ نفر + کامیون از ۳۵۰ دلار. تخمین رایگان.", images: [IMG("photo-1600585152220-90363fe7e115"), IMG("photo-1558618666-fcd25c85f82e")], priceLabel: "From $350" },
      { caption: "Same-day courier across GTA — documents, parcels, food. Track your delivery in real time!\nپیک همان روز در GTA — اسناد، بسته، غذا. محموله‌ات رو لحظه‌ای پیگیری کن!", images: [IMG("photo-1616432043562-3671ed8655ca"), IMG("photo-1580674285054-bed31e145f59")], priceLabel: "From $45" },
      { caption: "Airport transfer — arrive relaxed. Luxury SUV, meet & greet, flight tracking. Book your ride.\nترانسفر فرودگاه — ریلکس برس. SUV لوکس، استقبال، پیگیری پرواز. سفرت رو رزرو کن.", images: [IMG("photo-1549317661-bd32c8ce0db2"), IMG("photo-1449965408869-eaa3f722e40d")], priceLabel: "From $75" },
    ],
  },

  // 8 — TrueStay Legal Services
  {
    providerEmail: "truestay@neighborly.local",
    providerDisplayName: "TrueStay Legal Services",
    firstName: "Olivia",
    lastName: "Brown",
    companyName: "TrueStay Legal Services",
    slug: "truestay-legal-services",
    slogan: "Legal clarity for life's big moments — notary, wills, & contracts",
    about: "TrueStay Legal Services provides affordable legal and notary services for individuals and small businesses. We specialize in will drafting, contract review, notarization, and real estate document preparation. Licensed paralegals and notaries under the Law Society of Ontario.",
    categoryName: "Government Services",
    categoryDesc: "Permits, licenses, taxes, and municipal services",
    address: "330 Bay St, Suite 200, Toronto, ON",
    city: "Toronto",
    postalCode: "M5H 2S8",
    phone: "+1-416-555-0808",
    email: "info@truestaylegal.ca",
    website: "https://truestaylegal.ca",
    logoUrl: IMG("photo-1454165804606-c3d57bc86b40"),
    coverImageUrl: IMG("photo-1507003211169-0a1dd7228f2d"),
    history: "Olivia Brown, a licensed paralegal with 20 years of experience, founded TrueStay in 2010 to bridge the gap between expensive law firms and DIY legal kits. We provide professional legal services at transparent, fixed prices.",
    mission: "To make basic legal services accessible and affordable for every Toronto resident.",
    tags: ["Notary", "Wills", "Contracts", "Real Estate", "Paralegal"],
    galleryUrls: [IMG("photo-1454165804606-c3d57bc86b40"), IMG("photo-1507003211169-0a1dd7228f2d"), IMG("photo-1450101499163-c8848c66ca85"), IMG("photo-1573497620053-ea5300f94f21")],
    avgRating: 4.6,
    reviewCount: 94,
    experienceYears: 15,
    businessHours: [
      { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 4, openTime: "09:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 5, openTime: "09:00", closeTime: "15:00", isOpen: true },
      { dayOfWeek: 6, openTime: "00:00", closeTime: "00:00", isOpen: false },
      { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isOpen: false },
    ],
    licenseNumber: "LSO-2010-00123",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-legal-notary",
        catalogName: "Legal & Notary Services",
        category: "Government Services",
        subcategory: "Legal",
        desc: "Notary, wills, and contract services.",
        packages: [
          { name: "Document Notarization", description: "Single document notarized by licensed notary. Walk-ins welcome.", finalPrice: 35, bookingMode: BookingMode.direct_booking, durationMinutes: 15, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 50, quantity: 0.25 }] },
          { name: "Simple Will Package", description: "Last will & testament for individuals. Includes consultation + draft + notarization.", finalPrice: 299, bookingMode: BookingMode.booking, durationMinutes: 90, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 50, quantity: 1.5 }] },
          { name: "Contract Review", description: "Review of standard contracts (up to 10 pages). Written summary + recommendations.", finalPrice: 150, bookingMode: BookingMode.booking, durationMinutes: 60, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 50, quantity: 1 }] },
        ],
      },
    ],
    posts: [
      { caption: "Need a document notarized? Walk in or book online. $35 per document. Fast, professional service.\nمدرک نیاز به تایید دفتر اسناد رسمی داری؟ حضوری یا آنلاین. ۳۵ دلار هر مدرک. سرویس سریع و حرفه‌ای.", images: [IMG("photo-1454165804606-c3d57bc86b40"), IMG("photo-1507003211169-0a1dd7228f2d")], priceLabel: "$35" },
      { caption: "Do you have a will? Protect your loved ones. Simple will package from $299. Book a consultation.\nوصیت‌نامه داری؟ از عزیزانت محافظت کن. پکیج وصیت‌نامه ساده از ۲۹۹ دلار. مشاوره رزرو کن.", images: [IMG("photo-1450101499163-c8848c66ca85"), IMG("photo-1573497620053-ea5300f94f21")], priceLabel: "From $299" },
      { caption: "Signing a contract? Get it reviewed by a licensed paralegal before you commit. $150 for peace of mind.\nقرارداد امضا می‌کنی؟ قبل از تعهد، توسط وکیل مجاز بررسیش کن. ۱۵۰ دلار برای آرامش خیال.", images: [IMG("photo-1507003211169-0a1dd7228f2d"), IMG("photo-1573497620053-ea5300f94f21")], priceLabel: "$150" },
    ],
  },

  // 9 — EcoPower Solar
  {
    providerEmail: "ecopower@neighborly.local",
    providerDisplayName: "EcoPower Solar",
    firstName: "Elena",
    lastName: "Rodriguez",
    companyName: "EcoPower Solar",
    slug: "ecopower-solar",
    slogan: "Power your home with the sun — solar installation & EV chargers",
    about: "EcoPower Solar designs and installs residential solar panel systems across the GTA. We handle everything from assessment and permits to installation and grid connection. Also offering EV charger installation and home battery backup solutions. Canada Greener Homes Grant eligible.",
    categoryName: "Utilities",
    categoryDesc: "Internet, phone, electricity, water, and waste",
    address: "1400 Dupont St, Toronto, ON",
    city: "Toronto",
    postalCode: "M6H 2B2",
    phone: "+1-416-555-0909",
    email: "hello@ecopowersolar.ca",
    website: "https://ecopowersolar.ca",
    logoUrl: IMG("photo-1509391366360-2e959784a276"),
    coverImageUrl: IMG("photo-1558618666-fcd25c85f82e"),
    history: "Elena Rodriguez, an electrical engineer turned solar entrepreneur, founded EcoPower in 2017. We've completed over 400 residential solar installations and are a certified Tesla Powerwall installer.",
    mission: "To make renewable energy accessible and affordable for every Toronto homeowner.",
    tags: ["Solar Panels", "EV Chargers", "Battery Backup", "Green Energy", "Rebates"],
    galleryUrls: [IMG("photo-1509391366360-2e959784a276"), IMG("photo-1558618666-fcd25c85f82e"), IMG("photo-1593941707882-a5bba14938c7"), IMG("photo-1473341304170-1112019b0ad9")],
    avgRating: 4.7,
    reviewCount: 112,
    experienceYears: 8,
    businessHours: [
      { dayOfWeek: 1, openTime: "08:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 2, openTime: "08:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 3, openTime: "08:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 4, openTime: "08:00", closeTime: "18:00", isOpen: true },
      { dayOfWeek: 5, openTime: "08:00", closeTime: "17:00", isOpen: true },
      { dayOfWeek: 6, openTime: "10:00", closeTime: "15:00", isOpen: true },
      { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isOpen: false },
    ],
    licenseNumber: "ECRA-2017-00456",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-solar-install",
        catalogName: "Solar Panel Installation",
        category: "Utilities",
        subcategory: "Solar",
        desc: "Residential solar panel system design and installation.",
        packages: [
          { name: "Free Solar Assessment", description: "On-site evaluation + energy analysis + savings projection. No obligation.", finalPrice: 0, bookingMode: BookingMode.booking, durationMinutes: 90, products: [] },
          { name: "Standard Solar Install (5kW)", description: "5kW system with 12-14 panels. Covers ~60% of average home usage.", finalPrice: 12500, bookingMode: BookingMode.quote_first, durationMinutes: 1440, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 40, quantity: 24 }] },
          { name: "EV Charger + Solar Bundle", description: "Level 2 charger with solar-ready wiring. Maximize your green energy use.", finalPrice: 2200, bookingMode: BookingMode.booking, durationMinutes: 240, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 40, quantity: 4 }] },
        ],
      },
    ],
    posts: [
      { caption: "Solar pays for itself in 7-10 years with current rebates. Free home assessment — find out your savings!\nبا تخفیف‌های فعلی، خورشیدی ۷-۱۰ ساله هزینه خودش رو جبران می‌کنه. ارزیابی رایگان — میزان صرفه‌جوییت رو بفهم!", images: [IMG("photo-1509391366360-2e959784a276"), IMG("photo-1558618666-fcd25c85f82e")], priceLabel: "Free assessment" },
      { caption: "Canada Greener Homes Grant — up to $5,000 for solar. We handle all the paperwork.\nکمک هزینه خانه‌های سبز کانادا — تا ۵۰۰۰ دلار برای خورشیدی. ما همه کارای اداری رو انجام می‌دیم.", images: [IMG("photo-1473341304170-1112019b0ad9"), IMG("photo-1558618666-fcd25c85f82e")], priceLabel: "Up to $5K grant" },
      { caption: "Power outages? Add battery backup to your solar system. Keep essentials running 24/7.\nقطعی برق؟ باتری پشتیبان به سیستم خورشیدیت اضافه کن. وسایل ضروری رو ۲۴/۷ روشن نگه دار.", images: [IMG("photo-1593941707882-a5bba14938c7"), IMG("photo-1558618666-fcd25c85f82e")], priceLabel: "Negotiable" },
    ],
  },

  // 10 — Simply Home Services
  {
    providerEmail: "simplyhome@neighborly.local",
    providerDisplayName: "Simply Home Services",
    firstName: "Maria",
    lastName: "Santos",
    companyName: "Simply Home Services",
    slug: "simply-home-services",
    slogan: "One call, all done — your complete home care partner",
    about: "Simply Home Services is your one-stop shop for home maintenance. From deep cleaning and handyman repairs to painting and gardening, our vetted professionals handle it all. Serving Toronto families since 2013 with a satisfaction guarantee on every job.",
    categoryName: "Home Services",
    categoryDesc: "Plumbing, electrical, cleaning, renovation, and repairs",
    address: "789 Queen St E, Toronto, ON",
    city: "Toronto",
    postalCode: "M4M 1H4",
    phone: "+1-416-555-1010",
    email: "hello@simplyhome.ca",
    website: "https://simplyhome.ca",
    logoUrl: IMG("photo-1581578731548-c64695cc6952"),
    coverImageUrl: IMG("photo-1527515637462-cff94eecc1ac"),
    history: "Maria Santos saw a gap in the market: homeowners needed a single trusted provider for all their home needs, not five different companies. Simply Home Services was born in 2013 and now serves 2,000+ Toronto households with a team of 30+ professionals.",
    mission: "To be the only number Toronto homeowners need for quality home maintenance.",
    tags: ["Cleaning", "Handyman", "Painting", "Gardening", "Renovations"],
    galleryUrls: [IMG("photo-1581578731548-c64695cc6952"), IMG("photo-1527515637462-cff94eecc1ac"), IMG("photo-1558618666-fcd25c85f82e"), IMG("photo-1621905252507-b35492cc74b4")],
    avgRating: 4.5,
    reviewCount: 267,
    experienceYears: 12,
    businessHours: [
      { dayOfWeek: 1, openTime: "07:00", closeTime: "19:00", isOpen: true },
      { dayOfWeek: 2, openTime: "07:00", closeTime: "19:00", isOpen: true },
      { dayOfWeek: 3, openTime: "07:00", closeTime: "19:00", isOpen: true },
      { dayOfWeek: 4, openTime: "07:00", closeTime: "19:00", isOpen: true },
      { dayOfWeek: 5, openTime: "07:00", closeTime: "19:00", isOpen: true },
      { dayOfWeek: 6, openTime: "08:00", closeTime: "16:00", isOpen: true },
      { dayOfWeek: 0, openTime: "00:00", closeTime: "00:00", isOpen: false },
    ],
    licenseNumber: "OCOT-2013-01234",
    hasInsurance: true,
    services: [
      {
        catalogSlug: "comprehensive-home-cleaning",
        catalogName: "Home Cleaning Services",
        category: "Home Services",
        subcategory: "Cleaning",
        desc: "Professional residential cleaning services.",
        packages: [
          { name: "Standard Clean (1BR)", description: "Full apartment clean: kitchen, bathroom, living area, bedroom. Eco products.", finalPrice: 99, bookingMode: BookingMode.direct_booking, durationMinutes: 120, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 25, quantity: 2 }] },
          { name: "Deep Clean (3BR House)", description: "Top-to-bottom deep clean including baseboards, windows, and appliances.", finalPrice: 259, bookingMode: BookingMode.booking, durationMinutes: 300, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 25, quantity: 5 }] },
          { name: "Handyman Hourly", description: "General repairs, furniture assembly, wall mounting, and odd jobs.", finalPrice: 55, bookingMode: BookingMode.booking, durationMinutes: 60, products: [{ sku: "COMP-LABOR-HR", name: "Labor Hour", unit: "hour", unitPrice: 30, quantity: 1 }] },
        ],
      },
    ],
    posts: [
      { caption: "Spring cleaning made easy! Book our deep clean team — top to bottom, every corner. Satisfaction guaranteed.\nنظافت بهاره آسون شد! تیم نظافت عمیق ما رو رزرو کن — از بالا تا پایین، هر گوشه. رضایت تضمینی.", images: [IMG("photo-1581578731548-c64695cc6952"), IMG("photo-1527515637462-cff94eecc1ac")], priceLabel: "From $99" },
      { caption: "Handyman for the day — $55/hr. Furniture assembly, repairs, painting, and more. Book a 2hr minimum.\nتعمیرکار برای روز — ۵۵ دلار/ساعت. مونتاژ مبلمان، تعمیرات، نقاشی و بیشتر. حداقل ۲ ساعت رزرو کن.", images: [IMG("photo-1621905252507-b35492cc74b4"), IMG("photo-1558618666-fcd25c85f82e")], priceLabel: "$55/hr" },
      { caption: "Moving out? Our move-out cleaning includes everything your landlord checks. Full deposit return guaranteed!\nاثاث‌کشی می‌کنی؟ نظافت خروج ما همه چیزایی که صاحبخونه چک می‌کنه رو شامل میشه. برگشت کامل ودیعه تضمینی!", images: [IMG("photo-1581578731548-c64695cc6952"), IMG("photo-1527515637462-cff94eecc1ac")], priceLabel: "From $199" },
    ],
  },
];

// ── General Post Definitions ─────────────────────────────────────────

interface GeneralPostDef {
  categoryName: string;
  posts: { caption: string; images: string[] }[];
}

const GENERAL_POSTS: GeneralPostDef[] = [
  {
    categoryName: "Community",
    posts: [
      { caption: "Block party this Saturday on Palmerston Ave! BBQ, games, live music. All neighbors welcome! Bring a dish to share.\nپارتی محله این شنبه در خیابان پالمرستون! BBQ، بازی، موسیقی زنده. همه همسایه‌ها خوش آمدید! یه غذا بیارین.", images: [IMG("photo-1464366400600-7168b8af9bc3"), IMG("photo-1429962714451-bb934ecdc4ec")] },
      { caption: "Community garage sale — Leslieville, June 15. Over 50 homes participating. Maps available at Tim Hortons.\nفروش گاراژی محلی — لزلی‌ویل، ۱۵ ژوئن. بیش از ۵۰ خانه شرکت می‌کنن. نقشه در تیم هورتونز موجوده.", images: [IMG("photo-1533900298318-6b8da08a523e"), IMG("photo-1472851294608-062f824d29cc")] },
      { caption: "Neighborhood cleanup day! Meet at Riverdale Park East, 9am Saturday. Gloves and bags provided. Coffee on us!\nروز پاکسازی محله! پارک ریوردیل شرق، شنبه ۹ صبح. دستکش و کیسه فراهمه. قهوه با ما!", images: [IMG("photo-1558618666-fcd25c85f82e"), IMG("photo-1571902943202-507ec2618e8f")] },
    ],
  },
  {
    categoryName: "Sports",
    posts: [
      { caption: "Weekly soccer pickup game — Sundays 10am at Trinity Bellwoods. All skill levels welcome. Bring water!\nفوتبال دوستانه هفتگی — یکشنبه‌ها ۱۰ صبح در ترینیتی بلوودز. همه سطوح خوش آمدید. آب بیارین!", images: [IMG("photo-1579952363873-27f3bade9f55"), IMG("photo-1431324155629-1a6deb1dec8d")] },
      { caption: "Tennis coach available for private & group lessons. 20 years playing, 5 years coaching. All ages. $50/hr.\nمربی تنیس برای درس خصوصی و گروهی موجوده. ۲۰ سال بازی، ۵ سال مربیگری. همه سنین. ۵۰ دلار/ساعت.", images: [IMG("photo-1595435934249-5df7534eee71"), IMG("photo-1622279457486-62b96224d87e")] },
      { caption: "Looking for a gym buddy! I train at GoodLife on Yonge St, 3-4x/week. Early mornings preferred. Let's motivate each other!\nدنبال هم‌باشگاه می‌گردم! گودلایف خیابان یانگ، ۳-۴ بار/هفته. صبح زود ترجیح داده میشه. بیا همدیگه رو تشویق کنیم!", images: [IMG("photo-1534438327276-14e5300c3a48"), IMG("photo-1571902943202-507ec2618e8f")] },
    ],
  },
  {
    categoryName: "Events",
    posts: [
      { caption: "Toronto Food Festival this weekend at Exhibition Place! 50+ food trucks, live cooking demos, craft beer garden. $15 entry.\nجشنواره غذای تورنتو این آخر هفته در Exhibition Place! ۵۰+ غذافروشی سیار، آشپزی زنده، باغ آبجو. ورودی ۱۵ دلار.", images: [IMG("photo-1414235077428-338989a2e8c0"), IMG("photo-1517248135467-4c7edcad34c4")] },
      { caption: "Live jazz at The Rex Hotel tonight — no cover! Amazing quartet from Montreal. Show starts 9pm.\nجاز زنده در هتل رکس امشب — ورودی رایگان! گروه چهارنفره عالی از مونترال. شروع ۹ شب.", images: [IMG("photo-1511192336575-5a79af67a629"), IMG("photo-1501386761578-eac5c94b800a")] },
      { caption: "Volunteer day at Daily Bread Food Bank — Saturday 8am-12pm. Great team-building activity. Sign up on their website!\nروز داوطلب در بانک غذای Daily Bread — شنبه ۸ صبح تا ۱۲. فعالیت تیمی عالی. در وبسایتشون ثبت‌نام کنین!", images: [IMG("photo-1559027615-cd4628902d4a"), IMG("photo-1469571486292-b53601010b89")] },
    ],
  },
  {
    categoryName: "News",
    posts: [
      { caption: "Road closure alert: Gardiner Expressway eastbound closed this weekend for maintenance. Use Lakeshore as alternate.\nهشدار بسته شدن جاده: گاردینر شرق‌رو این آخر هفته برای تعمیرات بسته است. از لیک‌شور استفاده کنین.", images: [IMG("photo-1570125909232-c1a64e24a7d3"), IMG("photo-1544620347-c4fd4a3d5957")] },
      { caption: "New community center opens in East York! Pool, gym, library, and daycare. Grand opening ceremony this Wednesday.\nمرکز اجتماعی جدید در ایست یورک افتتاح شد! استخر، باشگاه، کتابخانه و مهدکودک. مراسم افتتاحیه چهارشنبه.", images: [IMG("photo-1571902943202-507ec2618e8f"), IMG("photo-1582213782179-49a09fcc1f59")] },
      { caption: "School board announcement: PA day moved to June 20. After-school programs will run extended hours. Check your email.\nاطلاعیه آموزش و پرورش: روز PA به ۲۰ ژوئن منتقل شد. برنامه‌های بعد از مدرسه ساعت طولانی‌تر دارن. ایمیلتون رو چک کنین.", images: [IMG("photo-1503676260728-1c00da094a0b"), IMG("photo-1509062522246-37559710bdc6")] },
    ],
  },
  {
    categoryName: "Skills & Barter",
    posts: [
      { caption: "Web designer offering services in exchange for yoga lessons! 5 years of React/Figma experience. Let's trade skills!\nطراح وب خدمات خودش رو در ازای درس یوگا ارائه میده! ۵ سال تجربه React/Figma. بیا مهارت‌ها رو مبادله کنیم!", images: [IMG("photo-1460925895917-afdab827c52f"), IMG("photo-1544367567-0f2fcb009e0b")] },
      { caption: "English tutor available — will trade for lawn mowing! Native speaker, 3 years ESL teaching experience. Danforth area.\nمعلم انگلیسی در دسترس — در ازای چمن‌زنی! زبان مادری، ۳ سال تجربه تدریس ESL. منطقه دنفورث.", images: [IMG("photo-1503676260728-1c00da094a0b"), IMG("photo-1558618666-fcd25c85f82e")] },
      { caption: "Experienced handyman offering odd jobs. Painting, repairs, furniture assembly. Fair rates — first hour free estimate!\nتعمیرکار باتجربه برای کارهای متفرقه. نقاشی، تعمیرات، مونتاژ مبلمان. قیمت منصفانه — تخمین ساعت اول رایگان!", images: [IMG("photo-1581578731548-c64695cc6952"), IMG("photo-1621905252507-b35492cc74b4")] },
    ],
  },
];

// ── Main Export ───────────────────────────────────────────────────────

export async function seedComprehensive(prisma: PrismaClient, passwordHash: string) {
  console.log("🌱 [Comprehensive Seed] Starting comprehensive seed data generation...");
  console.log("━".repeat(60));

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Create 2 customer users
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 1: Creating customer users...");
  
  const customer1 = await prisma.user.upsert({
    where: { email: "sarah.j@testuser.com" },
    update: { displayName: "Sarah Williams", role: "customer", password: passwordHash, isVerified: true, status: "active", bio: "Toronto resident, love exploring local services.", location: "Toronto", firstName: "Sarah", lastName: "Williams" },
    create: { email: "sarah.j@testuser.com", displayName: "Sarah Williams", role: "customer", password: passwordHash, isVerified: true, status: "active", bio: "Toronto resident, love exploring local services.", location: "Toronto", firstName: "Sarah", lastName: "Williams" },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: "m.rashid@testuser.com" },
    update: { displayName: "Mike Chen", role: "customer", password: passwordHash, isVerified: true, status: "active", bio: "Tech worker, always looking for reliable home services.", location: "Toronto", firstName: "Mike", lastName: "Chen" },
    create: { email: "m.rashid@testuser.com", displayName: "Mike Chen", role: "customer", password: passwordHash, isVerified: true, status: "active", bio: "Tech worker, always looking for reliable home services.", location: "Toronto", firstName: "Mike", lastName: "Chen" },
  });
  console.log(`  ✅ Customer users: ${customer1.email}, ${customer2.email}`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Ensure category tree
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 2: Creating categories...");
  
  let bizParent = await prisma.category.findFirst({ where: { name: "Business Services", parentId: null } });
  if (!bizParent) {
    bizParent = await prisma.category.create({ data: { name: "Business Services", description: "All business and service categories" } });
  }

  const categoryCache: Record<string, string> = {};
  for (const b of BUSINESSES) {
    if (!categoryCache[b.categoryName]) {
      const existing = await prisma.category.findFirst({ where: { name: b.categoryName, parentId: bizParent.id } });
      if (existing) {
        categoryCache[b.categoryName] = existing.id;
      } else {
        const cat = await prisma.category.create({ data: { name: b.categoryName, description: b.categoryDesc, parentId: bizParent.id } });
        categoryCache[b.categoryName] = cat.id;
      }
    }
  }
  console.log(`  ✅ ${Object.keys(categoryCache).length} business categories ready`);

  // General categories
  let genParent = await prisma.category.findFirst({ where: { name: "General", parentId: null } });
  if (!genParent) {
    genParent = await prisma.category.create({ data: { name: "General", description: "General community and lifestyle categories" } });
  }

  const generalCatCache: Record<string, string> = {};
  for (const g of GENERAL_POSTS) {
    const existing = await prisma.category.findFirst({ where: { name: g.categoryName, parentId: genParent.id } });
    if (existing) {
      generalCatCache[g.categoryName] = existing.id;
    } else {
      const cat = await prisma.category.create({ data: { name: g.categoryName, description: g.categoryName, parentId: genParent.id } });
      generalCatCache[g.categoryName] = cat.id;
    }
  }
  console.log(`  ✅ ${Object.keys(generalCatCache).length} general categories ready`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Ensure locations
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 3: Creating locations...");
  const locIds: string[] = [];
  for (const loc of TORONTO_LOCATIONS) {
    const existing = await prisma.postLocation.findFirst({ where: { name: loc.name, city: loc.city } });
    if (existing) {
      locIds.push(existing.id);
    } else {
      const created = await prisma.postLocation.create({
        data: { name: loc.name, latitude: loc.lat, longitude: loc.lng, city: loc.city, province: loc.province, country: "CA" },
      });
      locIds.push(created.id);
    }
  }
  console.log(`  ✅ ${locIds.length} locations ready`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: Create each business (user + company + portfolio + services)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 4: Creating 10 businesses with full profiles...");
  
  const businessData: { userId: string; companyId: string; services: { catalogId: string; packages: { id: string; name: string }[] }[] }[] = [];

  for (const b of BUSINESSES) {
    // Create provider user
    const user = await prisma.user.upsert({
      where: { email: b.providerEmail },
      update: { displayName: b.providerDisplayName, role: "provider", password: passwordHash, isVerified: true, status: "active", bio: `Owner of ${b.companyName}. ${b.about.slice(0, 100)}`, location: b.city, firstName: b.firstName, lastName: b.lastName },
      create: { email: b.providerEmail, displayName: b.providerDisplayName, role: "provider", password: passwordHash, isVerified: true, status: "active", bio: `Owner of ${b.companyName}. ${b.about.slice(0, 100)}`, location: b.city, firstName: b.firstName, lastName: b.lastName },
    });

    // Create company
    const experienceDate = new Date();
    experienceDate.setFullYear(experienceDate.getFullYear() - b.experienceYears);
    
    const company = await prisma.company.upsert({
      where: { ownerId: user.id },
      update: {
        name: b.companyName, slug: b.slug, slogan: b.slogan, about: b.about,
        logoUrl: b.logoUrl, coverImageUrl: b.coverImageUrl,
        address: b.address, phone: b.phone, website: b.website,
        type: "business", kycStatus: "verified", experienceDate,
        licenseNumber: b.licenseNumber,
      },
      create: {
        ownerId: user.id, name: b.companyName, slug: b.slug, slogan: b.slogan, about: b.about,
        logoUrl: b.logoUrl, coverImageUrl: b.coverImageUrl,
        address: b.address, phone: b.phone, website: b.website,
        type: "business", kycStatus: "verified", experienceDate,
        licenseNumber: b.licenseNumber,
      },
    });

    await prisma.user.update({ where: { id: user.id }, data: { companyId: company.id } });

    // Business portfolio
    await prisma.businessPortfolio.upsert({
      where: { companyId: company.id },
      update: { history: b.history, mission: b.mission, galleryUrls: b.galleryUrls, businessHours: b.businessHours.reduce((acc, h) => ({ ...acc, [h.dayOfWeek]: { open: h.openTime, close: h.closeTime } }), {}), tags: b.tags },
      create: { companyId: company.id, history: b.history, mission: b.mission, galleryUrls: b.galleryUrls, businessHours: b.businessHours.reduce((acc, h) => ({ ...acc, [h.dayOfWeek]: { open: h.openTime, close: h.closeTime } }), {}), tags: b.tags },
    });

    // Business hours
    for (const h of b.businessHours) {
      await prisma.businessHours.upsert({
        where: { workspaceId_dayOfWeek: { workspaceId: company.id, dayOfWeek: h.dayOfWeek } },
        update: { openTime: h.openTime, closeTime: h.closeTime, isOpen: h.isOpen },
        create: { workspaceId: company.id, dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime, isOpen: h.isOpen },
      });
    }

    // Business verification
    const licenseVerifiedAt = new Date();
    licenseVerifiedAt.setFullYear(licenseVerifiedAt.getFullYear() - 1);
    const insuranceVerifiedAt = new Date();
    insuranceVerifiedAt.setFullYear(insuranceVerifiedAt.getFullYear() - 1);

    await prisma.businessVerification.upsert({
      where: { workspaceId: company.id },
      update: { requiresLicense: true, licenseNumber: b.licenseNumber, licenseVerifiedAt, hasLiabilityInsurance: b.hasInsurance, insuranceVerifiedAt: b.hasInsurance ? insuranceVerifiedAt : null },
      create: { workspaceId: company.id, requiresLicense: true, licenseNumber: b.licenseNumber, licenseVerifiedAt, hasLiabilityInsurance: b.hasInsurance, insuranceVerifiedAt: b.hasInsurance ? insuranceVerifiedAt : null },
    });

    // Business trust score
    await prisma.businessTrustScore.upsert({
      where: { workspaceId: company.id },
      update: { kycVerified: true, licenseVerified: true, insuranceVerified: b.hasInsurance, avgRating: b.avgRating, reviewCount: b.reviewCount, totalScore: b.avgRating * 20 + 20 },
      create: { workspaceId: company.id, kycVerified: true, licenseVerified: true, insuranceVerified: b.hasInsurance, avgRating: b.avgRating, reviewCount: b.reviewCount, totalScore: b.avgRating * 20 + 20 },
    });

    // Service catalogs and packages
    const bizServices: { catalogId: string; packages: { id: string; name: string }[] }[] = [];
    for (const s of b.services) {
      const existingCatalog = await prisma.serviceCatalog.findFirst({ where: { slug: s.catalogSlug } });
      const catalog = existingCatalog
        ? await prisma.serviceCatalog.update({
            where: { id: existingCatalog.id },
            data: { name: s.catalogName, category: s.category, subcategory: s.subcategory, description: s.desc, isActive: true, archivedAt: null, categoryId: categoryCache[b.categoryName] },
          })
        : await prisma.serviceCatalog.create({
            data: { slug: s.catalogSlug, name: s.catalogName, category: s.category, subcategory: s.subcategory, description: s.desc, isActive: true, categoryId: categoryCache[b.categoryName] },
          });

      const pkgResults: { id: string; name: string }[] = [];
      for (const p of s.packages) {
        // Create products for this package
        const productIds: { id: string; quantity: number; sortOrder: number }[] = [];
        for (let i = 0; i < p.products.length; i++) {
          const prod = p.products[i];
          const product = await prisma.product.upsert({
            where: { workspaceId_sku: { workspaceId: company.id, sku: `${b.slug}-${prod.sku}` } },
            create: { workspaceId: company.id, sku: `${b.slug}-${prod.sku}`, name: prod.name, unit: prod.unit, unitPrice: prod.unitPrice, isActive: true },
            update: { name: prod.name, unit: prod.unit, unitPrice: prod.unitPrice, isActive: true },
          });
          productIds.push({ id: product.id, quantity: prod.quantity, sortOrder: i });
        }

        // Create package
        const existingPkg = await prisma.providerServicePackage.findFirst({
          where: { workspaceId: company.id, serviceCatalogId: catalog.id, name: p.name },
        });
        const pkg = existingPkg
          ? await prisma.providerServicePackage.update({
              where: { id: existingPkg.id },
              data: { providerId: user.id, workspaceId: company.id, serviceCatalogId: catalog.id, name: p.name, description: p.description, finalPrice: p.finalPrice, bookingMode: p.bookingMode, durationMinutes: p.durationMinutes, isActive: true, archivedAt: null },
            })
          : await prisma.providerServicePackage.create({
              data: { providerId: user.id, workspaceId: company.id, serviceCatalogId: catalog.id, name: p.name, description: p.description, finalPrice: p.finalPrice, bookingMode: p.bookingMode, durationMinutes: p.durationMinutes, isActive: true },
            });

        // Set BOM
        if (productIds.length > 0) {
          await prisma.productInPackage.deleteMany({ where: { packageId: pkg.id } });
          for (const pi of productIds) {
            const product = await prisma.product.findUnique({ where: { id: pi.id } });
            if (!product) continue;
            await prisma.productInPackage.create({
              data: { packageId: pkg.id, productId: product.id, quantity: pi.quantity, sortOrder: pi.sortOrder, snapshotUnitPrice: product.unitPrice, snapshotCurrency: product.currency, snapshotProductName: product.name, snapshotUnit: product.unit },
            });
          }
        }

        pkgResults.push({ id: pkg.id, name: p.name });
      }
      bizServices.push({ catalogId: catalog.id, packages: pkgResults });
    }

    businessData.push({ userId: user.id, companyId: company.id, services: bizServices });
    console.log(`  ✅ ${b.companyName} (${b.slug}) — ${company.id.slice(0, 8)}...`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: Create 30 business posts
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 5: Creating 30 business posts...");
  let bizPostCount = 0;
  for (let i = 0; i < BUSINESSES.length; i++) {
    const b = BUSINESSES[i];
    const bd = businessData[i];
    const catId = categoryCache[b.categoryName];
    for (let j = 0; j < b.posts.length; j++) {
      const p = b.posts[j];
      const captionPrefix = p.caption.slice(0, 40);
      const existing = await prisma.post.findFirst({
        where: { authorId: bd.userId, categoryId: catId, caption: { startsWith: captionPrefix } },
      });
      if (existing) { bizPostCount++; continue; }
      const locationId = locIds[(i * 3 + j) % locIds.length];
      await prisma.post.create({
        data: {
          authorId: bd.userId, categoryId: catId, caption: p.caption,
          isBusinessPost: true, isPromoted: j === 0, moderationStatus: "approved", publishedAt: new Date(), locationId,
          media: { create: p.images.map((url, idx) => ({ type: "image" as const, url, sortOrder: idx })) },
        },
      });
      bizPostCount++;
    }
  }
  console.log(`  ✅ ${bizPostCount} business posts created`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 6: Create 15 general posts
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 6: Creating 15 general posts...");
  let genPostCount = 0;
  for (let g = 0; g < GENERAL_POSTS.length; g++) {
    const group = GENERAL_POSTS[g];
    const catId = generalCatCache[group.categoryName];
    for (let j = 0; j < group.posts.length; j++) {
      const p = group.posts[j];
      const captionPrefix = p.caption.slice(0, 40);
      const authorId = j % 2 === 0 ? customer1.id : customer2.id;
      const existing = await prisma.post.findFirst({
        where: { authorId, categoryId: catId, caption: { startsWith: captionPrefix } },
      });
      if (existing) { genPostCount++; continue; }
      const locationId = locIds[(g * 3 + j) % locIds.length];
      await prisma.post.create({
        data: {
          authorId, categoryId: catId, caption: p.caption,
          isBusinessPost: false, isPromoted: false, moderationStatus: "approved", publishedAt: new Date(), locationId,
          media: { create: p.images.map((url, idx) => ({ type: "image" as const, url, sortOrder: idx })) },
        },
      });
      genPostCount++;
    }
  }
  console.log(`  ✅ ${genPostCount} general posts created`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 7: Create 10 demo orders
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 7: Creating 10 demo orders...");
  const orderStatuses = ["submitted", "submitted", "matched", "matched", "in_progress", "in_progress", "completed", "completed", "cancelled", "cancelled"];
  const orderData = [
    { bizIdx: 0, svcName: "Quick Cut" },
    { bizIdx: 1, svcName: "Standard Oil Change" },
    { bizIdx: 2, svcName: "Free Quote Comparison" },
    { bizIdx: 3, svcName: "Propane Tank Refill (20lb)" },
    { bizIdx: 4, svcName: "Emergency Call-Out" },
    { bizIdx: 5, svcName: "60min RMT Massage" },
    { bizIdx: 6, svcName: "Same-Day Courier" },
    { bizIdx: 7, svcName: "Document Notarization" },
    { bizIdx: 8, svcName: "Free Solar Assessment" },
    { bizIdx: 9, svcName: "Standard Clean (1BR)" },
  ];

  const orderIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const o = orderData[i];
    const bd = businessData[o.bizIdx];
    const customerId = i % 2 === 0 ? customer1.id : customer2.id;
    const catalog = await prisma.serviceCatalog.findFirst({ where: { slug: BUSINESSES[o.bizIdx].services[0].catalogSlug } });
    if (!catalog) continue;
    
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + (i + 1) * 2);

    const existingOrder = await prisma.order.findFirst({
      where: { customerId, serviceCatalogId: catalog.id, description: { contains: o.svcName } },
    });
    if (existingOrder) { orderIds.push(existingOrder.id); continue; }

    const order = await prisma.order.create({
      data: {
        customerId, serviceCatalogId: catalog.id,
        schemaSnapshot: {}, answers: {}, photos: [],
        description: `Demo order: ${o.svcName} from ${BUSINESSES[o.bizIdx].companyName}`,
        scheduledAt: scheduledDate, scheduleFlexibility: "flexible",
        address: BUSINESSES[o.bizIdx].address,
        entryPoint: "explorer", urgency: "standard", status: orderStatuses[i] as any,
        phase: orderStatuses[i] === "completed" || orderStatuses[i] === "in_progress" ? "job" : orderStatuses[i] === "cancelled" ? "order" : "offer",
        matchedWorkspaceId: bd.companyId, matchedProviderId: bd.userId,
      },
    });
    orderIds.push(order.id);
  }
  console.log(`  ✅ ${orderIds.length} orders created`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 8: Create 15 demo notifications
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 8: Creating 15 demo notifications...");
  const notifTypes = ["order-status", "new-message", "business-update", "event-reminder", "review-request"];
  const allUserIds = [customer1.id, customer2.id, ...businessData.map(b => b.userId)];
  let notifCount = 0;
  
  for (let i = 0; i < 15; i++) {
    const userId = allUserIds[i % allUserIds.length];
    const nType = notifTypes[i % notifTypes.length];
    const titles: Record<string, string> = {
      "order-status": "Order Update",
      "new-message": "New Message Received",
      "business-update": "Business Profile Updated",
      "event-reminder": "Upcoming Appointment",
      "review-request": "Please Leave a Review",
    };
    const messages: Record<string, string> = {
      "order-status": "Your order #1000" + i + " has been updated. Tap to view details.",
      "new-message": "You have a new message from a provider. Check your inbox.",
      "business-update": "A business you follow posted new services. Check them out!",
      "event-reminder": "You have an upcoming appointment tomorrow at 10:00 AM.",
      "review-request": "How was your recent service? Leave a review to help others.",
    };
    const createdAt = new Date();
    createdAt.setHours(createdAt.getHours() - i * 8);

    await prisma.notification.create({
      data: { userId, type: nType, title: titles[nType], message: messages[nType], read: i < 3, createdAt },
    });
    notifCount++;
  }
  console.log(`  ✅ ${notifCount} notifications created`);

  // ═══════════════════════════════════════════════════════════════════
  // STEP 9: Create 10 demo reviews (link to each order regardless of status)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n📋 Step 9: Creating 10 demo reviews...");
  const reviewTexts = [
    "Excellent service! Arrived on time and did a fantastic job. Will definitely book again.",
    "Very professional and thorough. The pricing was transparent and fair. Highly recommend.",
    "Good work overall. Minor delay in arrival but the quality made up for it.",
    "Outstanding experience from start to finish. The provider was knowledgeable and friendly.",
    "Decent service for the price. Communication could have been better but work was solid.",
    "Absolutely love the results! Have been using this provider for months now. Consistent quality.",
    "Quick response and great attention to detail. Saved me when I had an emergency.",
    "Average experience. The service was okay but not exceptional. Might try someone else next time.",
    "Top-notch professional! Brought all necessary equipment and explained everything clearly.",
    "Really impressed with the quality. The provider went above and beyond my expectations.",
  ];
  const ratings = [5, 4, 5, 5, 3, 5, 4, 3, 5, 4];
  let reviewCount = 0;

  // Create reviews for all 10 orders (not just completed ones)
  for (let i = 0; i < Math.min(orderIds.length, 10); i++) {
    const orderId = orderIds[i];
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true } });
    if (!order) continue;
    
    const existingReview = await prisma.orderReview.findFirst({ where: { orderId } });
    if (existingReview) { reviewCount++; continue; }

    await prisma.orderReview.create({
      data: { orderId, customerId: order.customerId, rating: ratings[i], reviewText: reviewTexts[i], reviewType: "customer" },
    });
    reviewCount++;
  }
  console.log(`  ✅ ${reviewCount} reviews created`);

  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n" + "━".repeat(60));
  console.log("🎉 [Comprehensive Seed] Complete!");
  console.log(`   Businesses:  ${businessData.length}`);
  console.log(`   Business Posts: ${bizPostCount}`);
  console.log(`   General Posts:  ${genPostCount}`);
  console.log(`   Orders:     ${orderIds.length}`);
  console.log(`   Notifications: ${notifCount}`);
  console.log(`   Reviews:    ${reviewCount}`);
  console.log("━".repeat(60));
}