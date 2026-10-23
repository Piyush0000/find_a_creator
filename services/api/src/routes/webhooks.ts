import { Router } from 'express';
import { prisma } from '@evoc/database';
import { OrderWebhookPayloadSchema } from '@evoc/types';
import { PointsService } from '../services/points.service.js';

export const webhooksRouter = Router();

// POST /api/webhooks/order-completed (EVOC Checkout Webhook)
webhooksRouter.post('/order-completed', async (req, res) => {
  try {
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

    // Commission points directly set in the collaboration agreement
    const pointsEarned = collab.commissionPointsPerSale;

    // Record order commission using PointsService (Atomic + Idempotent)
    const result = await PointsService.recordOrderCommission({
      collabId: collab.id,
      creatorId: collab.creatorId,
      orderId: payload.orderId,
      orderTotal: Number(payload.orderTotal),
      pointsEarned,
      description: `Order #${payload.orderId} via Ad Campaign`
    });

    if (result.duplicate) {
      return res.status(200).json({
        received: true,
        note: `Order #${payload.orderId} was already processed and credited`,
        creatorId: collab.creatorId
      });
    }

    console.log(`⚡ Order Webhook: ${pointsEarned} EVOC Points credited to Creator ${collab.creator.displayAlias}`);

    res.status(200).json({
      success: true,
      pointsCredited: pointsEarned,
      creatorId: collab.creatorId,
      newBalance: result.newBalance
    });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    res.status(400).json({ error: error.message || 'Webhook processing failed' });
  }
});
