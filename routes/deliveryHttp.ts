import type { Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { DeliveryError } from '../lib/delivery/errors.js';

export function deliveryHandler(
  handler: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof ZodError) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.issues });
        return;
      }
      if (error instanceof DeliveryError) {
        res.status(error.status).json({ code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) });
        return;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({ code: 'RESOURCE_CONFLICT', message: 'The resource already exists' });
        return;
      }
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    });
  };
}

export function actorId(req: Request): string {
  return (req as Request & { user: { userId: string } }).user.userId;
}

export function actorRole(req: Request): string {
  return (req as Request & { user: { role: string } }).user.role;
}
