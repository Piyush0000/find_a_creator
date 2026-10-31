import { Router } from 'express';
import { prisma } from '@evoc/database';
import { OrderWebhookPayloadSchema } from '@evoc/types';
import { PointsService } from '../services/points.service.js';
import { dispatchOrderCommissionCredited } from '../queues/dispatcher.js';

export const webhooksRouter = Router();

// POST /api/webhooks/order-completed (EVOC Checkout Webhook)
webhooksRouter.post('/order-completed', async (req, res) => {
  try {
    // 1. Strict Webhook Secret Authentication Gate (Zero Fallback Policy)
    const configuredSecret = process.env.CHECKOUT_WEBHOOK_SECRET;
    if (!configuredSecret || configuredSecret.trim() === '') {
      throw new Error('[Webhook] Missing required environment variable: CHECKOUT_WEBHOOK_SECRET');
    }

    const incomingSecret = req.headers['x-webhook-secret'];
    const resolvedSecret = Array.isArray(incomingSecret) ? incomingSecret[0] : incomingSecret;
    if (!resolvedSecret || resolvedSecret !== configuredSecret) {
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

    // 2. Commission Points Calculation: Use collab commissionPointsPerSale, fallback to 10% of order total
    const pointsEarned =
      collab.commissionPointsPerSale !== null &&
      collab.commissionPointsPerSale !== undefined &&
      collab.commissionPointsPerSale > 0
        ? collab.commissionPointsPerSale
        : Math.round(Number(payload.orderTotal) * 0.1);

    // 3. Atomically & idempotently record order attribution, lock points in ledger, and credit creator balance
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

    console.log(`⚡ Order Webhook: ${pointsEarned} EVOC Points credited to Creator ${collab.creator.displayAlias}`);

    // 4. Dispatch WhatsApp template alert to Creator (non-blocking)
    dispatchOrderCommissionCredited({
      collabId: collab.id,
      creatorId: collab.creatorId,
      orderId: payload.orderId,
      pointsEarned,
      orderTotal: Number(payload.orderTotal)
    }).catch((err) => console.error('[Queue] dispatchOrderCommissionCredited failed:', err.message));

    res.status(200).json({
      success: true,
      collabId: collab.id,
      creatorId: collab.creatorId,
      orderId: payload.orderId,
      pointsEarned,
      pointsCredited: pointsEarned,
      pointsStatus: 'LOCKED',
      unlockNotice: 'Points locked for 14-day return window',
      newBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    res.status(400).json({ error: error.message || 'Webhook processing failed' });
  }
});
