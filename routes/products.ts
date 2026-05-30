/**
 * GET /api/products — inventory for the authenticated user's default workspace
 * (User.companyId) or an explicit ?workspaceId= after membership check.
 */
import { Router, Response } from "express";
import prisma from "../lib/db.js";
import { authenticate, AuthRequest } from "../lib/auth.middleware.js";
import { assertWorkspaceMember, WorkspaceAccessError } from "../lib/workspaceAccess.js";

const router = Router();

function isWorkspaceAccessError(err: unknown): err is WorkspaceAccessError {
  return err instanceof WorkspaceAccessError;
}

router.use(authenticate);

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const qWs = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { companyId: true },
    });
    const workspaceId = qWs || user?.companyId || null;
    if (!workspaceId) {
      return res.status(400).json({
        error: "No workspace context: set User.companyId or pass workspaceId query parameter",
      });
    }
    if (qWs) {
      await assertWorkspaceMember(req.user!.userId, workspaceId);
    }

    const items = await prisma.product.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        workspaceId: true,
        name: true,
        sku: true,
        description: true,
        category: true,
        unit: true,
        unitPrice: true,
        currency: true,
        stockQuantity: true,
        isActive: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ items, workspaceId });
  } catch (err: unknown) {
    if (isWorkspaceAccessError(err)) {
      return res.status(err.statusCode).json(err.body ?? { error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
