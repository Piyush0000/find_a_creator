import { Router } from 'express';
import { prisma, PointsTransactionType, PointsStatus } from '@evoc/database';
import { OrderWebhookPayloadSchema } from '@evoc/types';

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

    // Calculate Points (e.g. 10% of order value or custom points)
    const pointsEarned = Math.round(Number(payload.orderTotal) * 0.1);

    // 1. Record Attribution
    await prisma.orderAttribution.create({
      data: {
        collabId: collab.id,
        orderId: payload.orderId,
        orderTotal: payload.orderTotal,
        pointsEarned
      }
    });

    // 2. Add to Points Ledger (LOCKED for 7-day return window)
    await prisma.evocPointsLedger.create({
      data: {
        creatorId: collab.creatorId,
        pointsDelta: pointsEarned,
        transactionType: PointsTransactionType.PURCHASE_COMMISSION,
        status: PointsStatus.LOCKED,
        referenceId: payload.orderId,
        description: `Order #${payload.orderId} from Ad Campaign`
      }
    });

    // 3. Update Creator Points Balance
    await prisma.creatorProfile.update({
      where: { id: collab.creatorId },
      data: { pointsBalance: { increment: pointsEarned } }
    });

    console.log(`⚡ Order Webhook: ${pointsEarned} EVOC Points credited to Creator ${collab.creator.displayAlias}`);

    res.status(200).json({
      success: true,
      pointsCredited: pointsEarned,
      creatorId: collab.creatorId
    });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    res.status(400).json({ error: error.message || 'Webhook processing failed' });
  }
});
