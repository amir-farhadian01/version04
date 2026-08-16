// test-helpers/app.ts — minimal Express app factory for supertest integration tests.
//
// NOTE: This intentionally does NOT import server.ts, because server.ts executes
// startServer() at module load (which refuses to boot without a production
// JWT_SECRET and starts real listeners). Instead we build a small app with just
// the middleware + routes that the integration tests exercise.
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from '../routes/auth.js';
import ordersRoutes from '../routes/orders.js';

export async function createApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(cors({ origin: true, credentials: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/orders', ordersRoutes);
  return { app };
}
