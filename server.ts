import express, { type Express, type RequestHandler } from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import "dotenv/config";

import prisma from "./lib/db.js";
import { getRedis } from "./lib/redis.js";
import { getNats, startNatsNotificationConsumers } from "./lib/bus.js";
import { apiLimiter, adminLimiter } from "./lib/rateLimiter.js";
import { ensureMediaSchema } from "./lib/mediaDb.js";
import { startLocationFlusher, stopLocationFlusher } from "./lib/locationCache.js";
import { autoReleaseEscrow } from "./scripts/autoReleaseEscrow.js";
import { expireMatchingWindows } from "./scripts/matchingWindowExpiry.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import serviceRoutes from "./routes/services.js";
import requestRoutes from "./routes/requests.js";
import contractRoutes from "./routes/contracts.js";
import ticketRoutes from "./routes/tickets.js";
import notificationRoutes from "./routes/notifications.js";
import companyRoutes from "./routes/companies.js";
import postRoutes from "./routes/posts.js";
import chatRoutes from "./routes/chat.js";
import categoryRoutes from "./routes/categories.js";
import adminRoutes from "./routes/admin.js";
import adminKycRoutes from "./routes/adminKyc.js";
import systemRoutes from "./routes/system.js";
import placesRoutes from "./routes/places.js";
import transactionRoutes from "./routes/transactions.js";
import kycRoutes from "./routes/kyc.js";
import kycUserRoutes from "./routes/kycUser.js";
import uploadRoutes from "./routes/upload.js";
import mediaRoutes from "./routes/media.js";
import serviceCatalogRoutes from "./routes/serviceCatalog.js";
import adminServiceDefinitionsRoutes from "./routes/adminServiceDefinitions.js";
import adminCategoriesTreeRoutes from "./routes/adminCategoriesTree.js";
import ordersRoutes from "./routes/orders.js";
import orderSessionsRoutes from "./routes/orderSessions.js";
import groupSessionsRoutes from "./routes/groupSessions.js";
import adminOrdersRoutes from "./routes/adminOrders.js";
import workspacesRoutes from "./routes/workspaces.js";
import adminServicePackagesRoutes from "./routes/adminServicePackages.js";
import adminProductsRoutes from "./routes/adminProducts.js";
import productsRoutes from "./routes/products.js";
import orderChatRoutes from "./routes/orderChat.js";
import adminChatRoutes from "./routes/adminChat.js";
import orderContractsRoutes from "./routes/orderContracts.js";
import adminContractsRoutes from "./routes/adminContracts.js";
import orderPaymentsRoutes from "./routes/orderPayments.js";
import adminPaymentsRoutes from "./routes/adminPayments.js";
import feedRoutes from "./routes/feed.js";
import utilityLinksRoutes from "./routes/utilityLinks.js";
import adminMediaRoutes from "./routes/adminMedia.js";
import adminUtilityLinksRoutes from "./routes/adminUtilityLinks.js";
import providersRoutes from "./routes/providers.js";
import userAddressesRoutes from "./routes/userAddresses.js";
import userCarsRoutes from "./routes/userCars.js";
import storiesRoutes from "./routes/stories.js";
import followRoutes from "./routes/follow.js";
import socialFeedRoutes from "./routes/socialFeed.js";
import businessPageRoutes from "./routes/businessPage.js";
import staffRoutes from "./routes/staff.js";
import schedulesRoutes from "./routes/schedules.js";
import homeIntelligenceRoutes from "./routes/homeIntelligence.js";
import homeContentRoutes from "./routes/homeContent.js";
import homeScreenRoutes from "./routes/homeScreen.js";
import adminHomeContentRoutes from "./routes/adminHomeContent.js";
import adminDisputesRouter from "./routes/adminDisputes.js";
import adminAnalyticsRoutes from "./routes/adminAnalytics.js";
import guestCheckoutRouter from "./routes/guestCheckout.js";
import gdprRoutes from "./routes/gdpr.js";
import kycBusinessRoutes from "./routes/kycBusiness.js";
import workspaceCrmRoutes from "./routes/workspaceCrm.js";
import stripeWebhookRoutes from "./routes/stripeWebhook.js";
import invoiceRoutes from "./routes/invoices.js";
import workspaceFinanceRoutes from "./routes/workspaceFinance.js";
import workspaceSocialRoutes from "./routes/workspaceSocial.js";
import { router as serviceSearchRoutes } from "./routes/serviceSearch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function mountApiRoutes(app: Express) {
  // Apply rate limiter to all API routes
  app.use("/api", apiLimiter);
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), version: "2.0.0" });
  });
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/services/search", serviceSearchRoutes);
  app.use("/api/services", serviceRoutes);
  app.use("/api/service-catalog", serviceCatalogRoutes);
  app.use("/api/requests", requestRoutes);
  app.use("/api/contracts", contractRoutes);
  app.use("/api/tickets", ticketRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/companies", companyRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/orders", ordersRoutes);
  app.use("/api/orders/:orderId/chat", orderChatRoutes);
  app.use("/api/orders/:orderId/contracts", orderContractsRoutes);
  app.use("/api/orders/:orderId/payments", orderPaymentsRoutes);
  app.use("/api/orders/:orderId/sessions", orderSessionsRoutes);
  app.use("/api/orders/:orderId/group-sessions", groupSessionsRoutes);
  app.use("/api/workspaces", workspacesRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/system", systemRoutes);
  app.use("/api/places", placesRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/kyc/v2", kycUserRoutes);
  app.use("/api/kyc", kycRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/feed", feedRoutes);
  app.use("/api/utility-links", utilityLinksRoutes);
  app.use("/api/providers", providersRoutes);
  app.use("/api/user-addresses", userAddressesRoutes);
  app.use("/api/user-cars", userCarsRoutes);
  app.use("/api/stories", storiesRoutes);
  app.use("/api/follow", followRoutes);
  app.use("/api/social", socialFeedRoutes);
  app.use("/api/business-page", businessPageRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/schedules", schedulesRoutes);
  app.use("/api/home-intelligence", homeIntelligenceRoutes);
  app.use("/api/home", homeContentRoutes);
  app.use("/api/home-screen", homeScreenRoutes);
  app.use("/api/kyc/business", kycBusinessRoutes);
  app.use("/api/workspace/crm", workspaceCrmRoutes);
  app.use("/api/workspace/invoices", invoiceRoutes);
  app.use("/api/workspace/finance", workspaceFinanceRoutes);
  app.use("/api/workspace/social", workspaceSocialRoutes);
  app.use("/api/guest", guestCheckoutRouter);
  app.use("/api/auth", gdprRoutes);
  // Stripe webhook must use express.raw() for signature verification
  app.use("/api/stripe", express.raw({ type: 'application/json' }), stripeWebhookRoutes);

}

/**
 * Mounts ONLY admin-prefixed API routes on the given Express app.
 * Used by the admin SPA (port 9090) so it only exposes admin endpoints.
 */
function mountAdminApiRoutes(app: Express) {
  // Apply admin rate limiter to all admin API routes
  app.use("/api", adminLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin/kyc", adminKycRoutes);
  app.use("/api/admin/service-definitions", adminServiceDefinitionsRoutes);
  app.use("/api/admin/categories-tree", adminCategoriesTreeRoutes);
  app.use("/api/admin/orders", adminOrdersRoutes);
  app.use("/api/admin/contracts", adminContractsRoutes);
  app.use("/api/admin/payments", adminPaymentsRoutes);
  app.use("/api/admin/chat", adminChatRoutes);
  app.use("/api/admin/service-packages", adminServicePackagesRoutes);
  app.use("/api/admin/products", adminProductsRoutes);
  app.use("/api/admin/media", adminMediaRoutes);
  app.use("/api/admin/utility-links", adminUtilityLinksRoutes);
  app.use("/api/admin/home", adminHomeContentRoutes);
  app.use("/api/admin/disputes", adminDisputesRouter);
  app.use("/api/admin/analytics", adminAnalyticsRoutes);
}

function createWebApp(opts?: { adminOnly?: boolean }): Express {
  const app = express();
  const isProd = process.env.NODE_ENV === "production";

  app.use(morgan("dev"));
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGIN || true,
      credentials: true,
    }),
  );
  // Content Security Policy
  // In development we relax some directives so Vite HMR and dev tools work.
  // In production we enforce a strict policy.
  const cspDirectives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https://*.googleapis.com', 'https://*.gstatic.com'],
    'connect-src': ["'self'", 'https://*.googleapis.com'],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  if (!isProd) {
    // Allow Vite HMR WebSocket connections in dev
    cspDirectives['connect-src']!.push('ws://localhost:*', 'http://localhost:*');
  }

  app.use(helmet({ contentSecurityPolicy: { directives: cspDirectives } }));

  const uploadsDir = path.join(process.cwd(), "uploads");
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      fallthrough: false,
      maxAge: "7d",
    }),
  );

  app.use((req, _res, next) => {
    const host = req.headers.host || "";
    const protocol = (req.headers["x-forwarded-proto"] as string) || (isProd ? "https" : "http");
    (req as any).rpID = host.split(":")[0];
    (req as any).origin = `${protocol}://${host}`;
    next();
  });

  // Mount API routes
  if (opts?.adminOnly) {
    mountAdminApiRoutes(app);
  } else {
    mountApiRoutes(app);
  }

  return app;
}

async function startServer() {
  const PORT = parseInt(process.env.PORT || "8080", 10);
  const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || "9090", 10);
  if (PORT === ADMIN_PORT) {
    console.error("PORT and ADMIN_PORT must differ. Set ADMIN_PORT in .env (e.g. 9090).");
    process.exit(1);
  }
  const isProd = process.env.NODE_ENV === "production";

  const mainApp = createWebApp();
  const adminApp = createWebApp({ adminOnly: true });

  // Root route — shows API status page in browser (only on mainApp, not adminApp)
  mainApp.get("/", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neighborly API</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0d0f1a; color: #f0f2ff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1a1d2e; border: 1px solid #2a2f4a; border-radius: 12px; padding: 2rem; max-width: 480px; width: 90%; }
    h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
    .status { color: #4ade80; font-weight: 600; }
    .links { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
    a { color: #60a5fa; text-decoration: none; padding: 0.5rem 1rem; border: 1px solid #2a2f4a; border-radius: 8px; text-align: center; }
    a:hover { background: #2a2f4a; }
    .badge { display: inline-block; background: #4ade80; color: #000; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Neighborly API</h1>
    <p><span class="badge">● RUNNING</span></p>
    <p style="color:#8b90b0;font-size:0.875rem;">Version 2.0</p>
    <div class="links">
      <a href="/api/system/config">⚙️ System Config</a>
      <a href="http://localhost:5173">🚀 Frontend (port 5173)</a>
      <a href="http://localhost:7357">📱 Flutter (port 7357)</a>
    </div>
  </div>
</body>
</html>`);
  });

  try {
    await prisma.$connect();
    console.log("PostgreSQL connected");
  } catch (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }

  try {
    await getRedis().ping();
    console.log("Redis ready");
  } catch {
    console.warn("Redis not available (non-fatal)");
  }

  // Start the async location flusher (batch-writes dirty locations to PostgreSQL every 5 min)
  startLocationFlusher();

  try {
    await getNats();
    await startNatsNotificationConsumers();
  } catch {
    console.warn("NATS not available (non-fatal)");
  }

  try {
    await ensureMediaSchema();
    console.log("Media DB schema ready");
  } catch {
    console.warn("Media DB not available (non-fatal)");
  }

  if (!isProd) {
    // Dev mode:
    //   - mainApp (PORT=8080): API-only — frontend served by Vite dev server on port 5173
    //   - adminApp (ADMIN_PORT=9090): serves the built admin SPA (frontend/admin/dist/)
    console.log("  Dev mode: frontend served separately at http://localhost:5173");

    // Serve built admin SPA on adminApp so http://localhost:9090/ renders the admin panel
    const adminDistPath = path.join(process.cwd(), "frontend", "admin", "dist");
    const adminIndexPath = path.join(adminDistPath, "index.html");
    const fs = await import("fs");
    if (fs.existsSync(adminDistPath)) {
      console.log(`  Admin panel: serving built admin SPA from ${adminDistPath}`);
      // Redirect root to admin login on port 9090
      adminApp.get("/", (_req, res) => {
        res.redirect("/login");
      });
      adminApp.use(express.static(adminDistPath));
      adminApp.get("*", (req, res, next) => {
        if (req.path.startsWith("/api")) {
          return next();
        }
        res.sendFile(adminIndexPath);
      });
    } else {
      console.warn(`  Admin panel: no build found at ${adminDistPath}`);
      console.warn("  Run: cd frontend && npm run build:admin");
      console.warn("  Falling back to API-only on admin port.");
    }
  } else {
    // Prod mode:
    //   - mainApp (PORT=8080): serves built client SPA (frontend/dist/)
    //   - adminApp (ADMIN_PORT=9090): serves built admin SPA (frontend/admin/dist/)
    const clientDistPath = path.join(__dirname, "dist");
    const clientIndexPath = path.join(clientDistPath, "index.html");
    const clientSpaFallback: RequestHandler = (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(clientIndexPath);
    };
    mainApp.use(express.static(clientDistPath));
    mainApp.get("*", clientSpaFallback);

    const adminDistPath = path.join(__dirname, "..", "frontend", "admin", "dist");
    const adminIndexPath = path.join(adminDistPath, "index.html");
    const adminSpaFallback: RequestHandler = (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(adminIndexPath);
    };
    adminApp.use(express.static(adminDistPath));
    adminApp.get("*", adminSpaFallback);
  }

  const mainServer = http.createServer(mainApp);
  const adminServer = http.createServer(adminApp);

  const onListenError = (p: number, label: string) => (err: NodeJS.ErrnoException) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`\n✗ ${label} — port ${p} is already in use (EADDRINUSE).`);
      if (p === ADMIN_PORT) {
        console.error("  The admin port must be free for Node (Vite + AdminDashboard).");
        console.error("  Do NOT set FLUTTER_WEB_PORT=9090 — Flutter and Node cannot share the same port.");
        console.error("  Fix:  fuser -k " + p + "/tcp   or choose another port in .env (ADMIN_PORT / VITE_ADMIN_PORT).");
        console.error("  Flutter: keep default 9088 or use run_dev_web.sh (7357).\n");
      }
    } else {
      console.error(err);
    }
    process.exit(1);
  };

  mainServer.on("error", onListenError(PORT, "Main (PORT)"));
  adminServer.on("error", onListenError(ADMIN_PORT, "Admin (ADMIN_PORT)"));

  mainServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n  App (Vite+API)  →  http://localhost:${PORT}/`);
  });
  adminServer.listen(ADMIN_PORT, "0.0.0.0", () => {
    console.log(`  Admin (React dashboard)  →  http://localhost:${ADMIN_PORT}/\n`);
  });

  // Start auto-release escrow cron job (runs every 10 minutes)
  const escrowCronInterval = parseInt(process.env.AUTO_RELEASE_ESCROW_CRON_INTERVAL_MS || "600000", 10);
  autoReleaseEscrow().catch(err => console.error('[AutoRelease] Startup error:', err));
  const escrowInterval = setInterval(() => {
    autoReleaseEscrow().catch(err => console.error('[AutoRelease] Error:', err));
  }, escrowCronInterval);

  // Start matching window expiry cron job (configurable via env, default 5 minutes)
  const matchingCronInterval = parseInt(process.env.MATCHING_EXPIRY_CRON_INTERVAL_MS || "300000", 10);
  expireMatchingWindows().catch(err => console.error('[MatchingExpiry] Startup error:', err));
  const matchingExpiryInterval = setInterval(() => {
    expireMatchingWindows().catch(err => console.error('[MatchingExpiry] Error:', err));
  }, matchingCronInterval);

  process.on("SIGTERM", async () => {
    clearInterval(escrowInterval);
    clearInterval(matchingExpiryInterval);
    console.log("Shutting down...");
    stopLocationFlusher();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down (SIGINT)...");
    clearInterval(escrowInterval);
    clearInterval(matchingExpiryInterval);
    stopLocationFlusher();
    await prisma.$disconnect();
    process.exit(0);
  });
}

startServer().catch(console.error);
