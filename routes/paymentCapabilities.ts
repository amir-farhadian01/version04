import { Router } from 'express';
import { paymentCapabilities } from '../lib/paymentProvider.js';

const router = Router();
router.get('/capabilities', (_req, res) => res.json({ providers: paymentCapabilities() }));
export default router;
