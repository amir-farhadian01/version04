import { Router } from 'express';
import prisma from '../lib/db.js';
import { authenticate } from '../lib/auth.middleware.js';
import { DeliveryService } from '../lib/delivery/service.js';
import {
  availabilitySchema,
  cancelFulfillmentSchema,
  compensationTermsSchema,
  createDriverSchema,
  createFulfillmentSchema,
  driverLifecycleSchema,
  idParamSchema,
  offerAssignmentSchema,
  updateAvailabilitySchema,
} from '../lib/delivery/validation.js';
import { actorId, deliveryHandler } from './deliveryHttp.js';

export function createDeliveryOperationsRouter(service = new DeliveryService(prisma)) {
  const router = Router({ mergeParams: true });
  router.use(authenticate);

  const workspaceId = (params: Record<string, string>) => idParamSchema.parse(params.workspaceId);
  const driverId = (params: Record<string, string>) => idParamSchema.parse(params.businessDriverId);
  const fulfillmentId = (params: Record<string, string>) => idParamSchema.parse(params.fulfillmentId);

  router.get('/capability', deliveryHandler(async (req, res) => {
    res.json({ data: await service.getCapability(actorId(req), workspaceId(req.params)) });
  }));
  router.get('/driver-candidates', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listCandidates(actorId(req), workspaceId(req.params)) });
  }));
  router.get('/drivers', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listDrivers(actorId(req), workspaceId(req.params)) });
  }));
  router.post('/drivers', deliveryHandler(async (req, res) => {
    const input = createDriverSchema.parse(req.body);
    res.status(201).json({ data: await service.createDriver(actorId(req), workspaceId(req.params), input) });
  }));
  router.patch('/drivers/:businessDriverId', deliveryHandler(async (req, res) => {
    const input = driverLifecycleSchema.parse(req.body);
    res.json({ data: await service.changeDriverLifecycle(actorId(req), workspaceId(req.params), driverId(req.params), input) });
  }));
  router.get('/drivers/:businessDriverId/compensation-terms', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listTermsForManager(actorId(req), workspaceId(req.params), driverId(req.params)) });
  }));
  router.post('/drivers/:businessDriverId/compensation-terms', deliveryHandler(async (req, res) => {
    const input = compensationTermsSchema.parse(req.body);
    res.status(201).json({ data: await service.proposeTerms(actorId(req), workspaceId(req.params), driverId(req.params), input) });
  }));
  router.get('/drivers/:businessDriverId/availability', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listAvailabilityForManager(actorId(req), workspaceId(req.params), driverId(req.params)) });
  }));
  router.post('/drivers/:businessDriverId/availability', deliveryHandler(async (req, res) => {
    const input = availabilitySchema.parse(req.body);
    res.status(201).json({ data: await service.createAvailabilityForManager(actorId(req), workspaceId(req.params), driverId(req.params), input) });
  }));
  router.patch('/drivers/:businessDriverId/availability/:scheduleId', deliveryHandler(async (req, res) => {
    const input = updateAvailabilitySchema.parse(req.body);
    res.json({ data: await service.updateAvailabilityForManager(actorId(req), workspaceId(req.params), driverId(req.params), idParamSchema.parse(req.params.scheduleId), input) });
  }));
  router.delete('/drivers/:businessDriverId/availability/:scheduleId', deliveryHandler(async (req, res) => {
    res.json({ data: await service.archiveAvailabilityForManager(actorId(req), workspaceId(req.params), driverId(req.params), idParamSchema.parse(req.params.scheduleId)) });
  }));
  router.get('/eligible-orders', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listEligibleOrders(actorId(req), workspaceId(req.params)) });
  }));
  router.get('/fulfillments', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listFulfillments(actorId(req), workspaceId(req.params)) });
  }));
  router.post('/fulfillments', deliveryHandler(async (req, res) => {
    const input = createFulfillmentSchema.parse(req.body);
    res.status(201).json({ data: await service.createFulfillment(actorId(req), workspaceId(req.params), input) });
  }));
  router.get('/fulfillments/:fulfillmentId', deliveryHandler(async (req, res) => {
    res.json({ data: await service.getFulfillmentForManager(actorId(req), workspaceId(req.params), fulfillmentId(req.params)) });
  }));
  router.post('/fulfillments/:fulfillmentId/assignments', deliveryHandler(async (req, res) => {
    const input = offerAssignmentSchema.parse(req.body);
    res.status(201).json({ data: await service.offerAssignment(actorId(req), workspaceId(req.params), fulfillmentId(req.params), input) });
  }));
  router.post('/fulfillments/:fulfillmentId/cancel', deliveryHandler(async (req, res) => {
    const input = cancelFulfillmentSchema.parse(req.body);
    res.json({ data: await service.cancelFulfillment(actorId(req), workspaceId(req.params), fulfillmentId(req.params), input) });
  }));

  return router;
}

export default createDeliveryOperationsRouter();
