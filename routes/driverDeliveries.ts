import { Router } from 'express';
import prisma from '../lib/db.js';
import { authenticate } from '../lib/auth.middleware.js';
import { DeliveryService } from '../lib/delivery/service.js';
import {
  assignmentResponseSchema,
  assignmentTransitionSchema,
  availabilitySchema,
  idParamSchema,
  presenceSchema,
  relationshipResponseSchema,
  termResponseSchema,
  updateAvailabilitySchema,
} from '../lib/delivery/validation.js';
import { actorId, deliveryHandler } from './deliveryHttp.js';

export function createDriverDeliveriesRouter(service = new DeliveryService(prisma)) {
  const router = Router();
  router.use(authenticate);

  const driverId = (params: Record<string, string>) => idParamSchema.parse(params.businessDriverId);
  const assignmentId = (params: Record<string, string>) => idParamSchema.parse(params.assignmentId);

  router.get('/relationships', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listRelationships(actorId(req)) });
  }));
  router.post('/relationships/:businessDriverId/respond', deliveryHandler(async (req, res) => {
    const input = relationshipResponseSchema.parse(req.body);
    res.json({ data: await service.respondRelationship(actorId(req), driverId(req.params), input) });
  }));
  router.post('/relationships/:businessDriverId/compensation-terms/:termId/respond', deliveryHandler(async (req, res) => {
    const input = termResponseSchema.parse(req.body);
    res.json({ data: await service.respondTerms(actorId(req), driverId(req.params), idParamSchema.parse(req.params.termId), input) });
  }));
  router.patch('/relationships/:businessDriverId/presence', deliveryHandler(async (req, res) => {
    const input = presenceSchema.parse(req.body);
    res.json({ data: await service.setPresence(actorId(req), driverId(req.params), input) });
  }));
  router.get('/relationships/:businessDriverId/availability', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listAvailabilityForSelf(actorId(req), driverId(req.params)) });
  }));
  router.post('/relationships/:businessDriverId/availability', deliveryHandler(async (req, res) => {
    const input = availabilitySchema.parse(req.body);
    res.status(201).json({ data: await service.createAvailabilityForSelf(actorId(req), driverId(req.params), input) });
  }));
  router.patch('/relationships/:businessDriverId/availability/:scheduleId', deliveryHandler(async (req, res) => {
    const input = updateAvailabilitySchema.parse(req.body);
    res.json({ data: await service.updateAvailabilityForSelf(actorId(req), driverId(req.params), idParamSchema.parse(req.params.scheduleId), input) });
  }));
  router.delete('/relationships/:businessDriverId/availability/:scheduleId', deliveryHandler(async (req, res) => {
    res.json({ data: await service.archiveAvailabilityForSelf(actorId(req), driverId(req.params), idParamSchema.parse(req.params.scheduleId)) });
  }));
  router.get('/assignments', deliveryHandler(async (req, res) => {
    res.json({ data: await service.listAssignmentsForSelf(actorId(req)) });
  }));
  router.get('/assignments/:assignmentId', deliveryHandler(async (req, res) => {
    res.json({ data: await service.getAssignmentForSelf(actorId(req), assignmentId(req.params)) });
  }));
  router.post('/assignments/:assignmentId/respond', deliveryHandler(async (req, res) => {
    const input = assignmentResponseSchema.parse(req.body);
    res.json({ data: await service.respondAssignment(actorId(req), assignmentId(req.params), input) });
  }));
  router.post('/assignments/:assignmentId/transition', deliveryHandler(async (req, res) => {
    const input = assignmentTransitionSchema.parse(req.body);
    res.json({ data: await service.transitionAssignment(actorId(req), assignmentId(req.params), input) });
  }));

  return router;
}

export default createDriverDeliveriesRouter();
