import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../lib/auth.middleware.js";
import { listRecentMedia } from "../lib/mediaDb.js";

const router = Router();

// GET /api/media/feed (public explorer helper; no private fields)
router.get("/feed", async (_req, res: Response) => {
  try {
    const rows = await listRecentMedia(120);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/admin (admin observability; useful for Metabase cross-check)
router.get(
  "/admin",
  authenticate,
  requireRole("owner", "platform_admin", "support", "developer"),
  async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await listRecentMedia(500);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;

