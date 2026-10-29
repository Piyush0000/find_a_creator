import { Router } from 'express';
import { prisma } from '@evoc/database';
import { OrderWebhookPayloadSchema } from '@evoc/types';
import { PointsService } from '../services/points.service.js';

export const webhooksRouter = Router();

// POST /api/webhooks/order-completed (EVOC Checkout Webhook)
webhooksRouter.post('/order-completed', async (req, res) => {
  try {
    // Recommendation 1: Webhook Secret Authentication Gate
    const configuredSecret = process.env.CHECKOUT_WEBHOOK_SECRET;
    if (!configuredSecret) {
      return res.status(500).json({ error: 'Server misconfiguration: CHECKOUT_WEBHOOK_SECRET is not configured in .env' });
    }

    const incomingSecret = req.headers['x-webhook-secret'];
    if (!incomingSecret || incomingSecret !== configuredSecret) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing webhook signature' });
    }

    const payload = OrderWebhookPayloadSchema.parse(req.body);

    if (!payload.utmCreatorId) {
      return res.status(200).json({ received: true, note: 'No creator UTM attached' });
    }

    // Match UTM slug to active collaboration
    const collab = await prisma.collaborationRequest.findUnique({
      where: { utmTrackingSlug: payload.utmCreatorId },
      include: { creator: true }
    });

    if (!collab) {
      return res.status(200).json({ received: true, note: 'No matching creator campaign found' });
    }

    // Calculate Points (10% commission on order value)
    const pointsEarned = Math.round(Number(payload.orderTotal) * 0.1);

    // Call Sai's PointsService to atomically & idempotently record order attribution,
    // lock points in ledger, and increment creator balance
    const result = await PointsService.recordOrderCommission({
      collabId: collab.id,
      creatorId: collab.creatorId,
      orderId: payload.orderId,
      orderTotal: Number(payload.orderTotal),
      pointsEarned,
      description: `Commission for Order #${payload.orderId} via Ad Campaign`
    });

    if (result.duplicate) {
      return res.status(200).json({
        received: true,
        duplicate: true,
        message: 'Order attribution already processed (idempotent duplicate skipped)',
        orderId: payload.orderId
      });
    }

    res.status(200).json({
      success: true,
      collabId: collab.id,
      creatorId: collab.creatorId,
      orderId: payload.orderId,
      pointsEarned,
      pointsStatus: 'LOCKED',
      unlockNotice: 'Points locked for 14-day return window'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Webhook processing failed' });
  }
});
