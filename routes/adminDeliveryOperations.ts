import { Router } from 'express';
import prisma from '../lib/db.js';
import { authenticate } from '../lib/auth.middleware.js';
import { DeliveryService } from '../lib/delivery/service.js';
import { adminCapabilitySchema, idParamSchema } from '../lib/delivery/validation.js';
import { actorId, actorRole, deliveryHandler } from './deliveryHttp.js';

export function createAdminDeliveryOperationsRouter(service = new DeliveryService(prisma)) {
  const router = Router();
  router.use(authenticate);
  router.patch('/workspaces/:workspaceId/delivery-operations', deliveryHandler(async (req, res) => {
    const input = adminCapabilitySchema.parse(req.body);
    const workspaceId = idParamSchema.parse(req.params.workspaceId);
    res.json({ data: await service.setWorkspaceCapability(actorId(req), actorRole(req), workspaceId, input.enabled) });
  }));
  return router;
}

export default createAdminDeliveryOperationsRouter();
