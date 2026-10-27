import { Router } from 'express';
import { prisma, PointsTransactionType, PointsStatus, PayoutStatus, UserRole } from '@evoc/database';
import { CreatePayoutRequestSchema, AdminClearPayoutSchema, AdminRejectSchema } from '@evoc/types';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const payoutsRouter = Router();

const MIN_PAYOUT_POINTS = 500;

// Helper: mask UPI VPA for audit storage (e.g. rohit@okhdfcbank -> ro***@okhdfcbank)
function maskUpiVpa(vpa: string): string {
  const [local, domain] = vpa.split('@');
  if (!local || !domain) return vpa;
  const visible = local.slice(0, 2);
  const masked = '*'.repeat(Math.max(local.length - 2, 3));
  return `${visible}${masked}@${domain}`;
}

// ============================================================================
// POST /api/payouts/request — Creator requests a payout
// ============================================================================
payoutsRouter.post(
  '/request',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const parsed = CreatePayoutRequestSchema.parse(req.body);
      const { upiVpa, pointsToRedeem } = parsed;

      // Fetch creator profile
      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      // Check for minimum settled points (must be SETTLED in ledger, not locked)
      const settledSum = await prisma.evocPointsLedger.aggregate({
        where: {
          creatorId: creator.id,
          status: PointsStatus.SETTLED,
          pointsDelta: { gt: 0 }
        },
        _sum: { pointsDelta: true }
      });

      // Also sum any previous PAYOUT_REDEEMED debits to get net settled balance
      const redeemedSum = await prisma.evocPointsLedger.aggregate({
        where: {
          creatorId: creator.id,
          transactionType: PointsTransactionType.PAYOUT_REDEEMED
        },
        _sum: { pointsDelta: true }
      });

      const totalSettled = (settledSum._sum.pointsDelta ?? 0) + (redeemedSum._sum.pointsDelta ?? 0);

      if (totalSettled < pointsToRedeem) {
        return res.status(400).json({
          error: 'Insufficient settled points',
          settledBalance: totalSettled,
          requested: pointsToRedeem,
          note: `You need ${MIN_PAYOUT_POINTS} settled points minimum. Points take 14 days after a sale to settle.`
        });
      }

      // Also check raw pointsBalance for safety
      if (creator.pointsBalance < pointsToRedeem) {
        return res.status(400).json({
          error: 'Insufficient points balance',
          currentBalance: creator.pointsBalance,
          requested: pointsToRedeem
        });
      }

      // Atomic transaction: deduct balance + create ledger debit + create payout record
      const result = await prisma.$transaction(async (tx) => {
        // 1. Deduct from creator's points balance
        const updatedCreator = await tx.creatorProfile.update({
          where: { id: creator.id },
          data: { pointsBalance: { decrement: pointsToRedeem } }
        });

        // 2. Create negative ledger entry (PAYOUT_REDEEMED debit)
        const ledgerEntry = await tx.evocPointsLedger.create({
          data: {
            creatorId: creator.id,
            pointsDelta: -pointsToRedeem,
            transactionType: PointsTransactionType.PAYOUT_REDEEMED,
            status: PointsStatus.SETTLED, // Payout debits are immediately settled
            description: `Payout request for ${pointsToRedeem} points`
          }
        });

        // 3. Create payout request record (store masked UPI VPA)
        const payoutRequest = await tx.payoutRequest.create({
          data: {
            creatorId: creator.id,
            pointsRedeemed: pointsToRedeem,
            upiVpa: maskUpiVpa(upiVpa),
            status: PayoutStatus.PENDING_UTR
          }
        });

        return { updatedCreator, ledgerEntry, payoutRequest };
      });

      console.log(
        `💸 [Payout] Creator ${creator.displayAlias} requested ${pointsToRedeem} pts → ${maskUpiVpa(upiVpa)}`
      );

      res.status(201).json({
        success: true,
        payoutRequestId: result.payoutRequest.id,
        pointsRedeemed: pointsToRedeem,
        newBalance: result.updatedCreator.pointsBalance,
        status: 'PENDING_UTR',
        note: 'Payout submitted. EVOC Finance will process within 3-5 business days.'
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(422).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Payout Request Error:', error);
      res.status(500).json({ error: error.message || 'Failed to process payout request' });
    }
  }
);

// ============================================================================
// GET /api/payouts/my — Creator sees their own payout history
// ============================================================================
payoutsRouter.get(
  '/my',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      const payouts = await prisma.payoutRequest.findMany({
        where: { creatorId: creator.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          pointsRedeemed: true,
          upiVpa: true,
          status: true,
          utrNumber: true,
          adminNotes: true,
          createdAt: true,
          updatedAt: true
        }
      });

      res.json({ payouts, totalCount: payouts.length });
    } catch (error: any) {
      console.error('Get Payouts Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch payout history' });
    }
  }
);

// ============================================================================
// PATCH /api/payouts/:id/clear — EVOC Admin marks payout as CLEARED with UTR
// ============================================================================
payoutsRouter.patch(
  '/:id/clear',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res) => {
    try {
      const parsed = AdminClearPayoutSchema.parse(req.body);
      const { id } = req.params;

      const payout = await prisma.payoutRequest.findUnique({ where: { id } });

      if (!payout) {
        return res.status(404).json({ error: 'Payout request not found' });
      }

      if (payout.status !== PayoutStatus.PENDING_UTR) {
        return res.status(409).json({
          error: `Cannot clear payout in status: ${payout.status}`
        });
      }

      const updated = await prisma.payoutRequest.update({
        where: { id },
        data: {
          status: PayoutStatus.CLEARED,
          utrNumber: parsed.utrNumber,
          adminNotes: parsed.adminNotes
        }
      });

      console.log(`✅ [Payout] Cleared payout ${id} with UTR: ${parsed.utrNumber}`);

      res.json({ success: true, payout: updated });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(422).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Payout Clear Error:', error);
      res.status(500).json({ error: error.message || 'Failed to clear payout' });
    }
  }
);

// ============================================================================
// PATCH /api/payouts/:id/reject — EVOC Admin rejects a payout + refunds points
// ============================================================================
payoutsRouter.patch(
  '/:id/reject',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res) => {
    try {
      const parsed = AdminRejectSchema.parse(req.body);
      const { id } = req.params;

      const payout = await prisma.payoutRequest.findUnique({ where: { id } });

      if (!payout) {
        return res.status(404).json({ error: 'Payout request not found' });
      }

      if (payout.status !== PayoutStatus.PENDING_UTR) {
        return res.status(409).json({
          error: `Cannot reject payout in status: ${payout.status}`
        });
      }

      // Atomic: reject payout + refund points to creator
      const result = await prisma.$transaction(async (tx) => {
        const updatedPayout = await tx.payoutRequest.update({
          where: { id },
          data: {
            status: PayoutStatus.REJECTED,
            adminNotes: parsed.adminNotes
          }
        });

        // Refund the points back to creator balance
        const refundedCreator = await tx.creatorProfile.update({
          where: { id: payout.creatorId },
          data: { pointsBalance: { increment: payout.pointsRedeemed } }
        });

        // Create refund ledger entry
        await tx.evocPointsLedger.create({
          data: {
            creatorId: payout.creatorId,
            pointsDelta: payout.pointsRedeemed,
            transactionType: PointsTransactionType.MILESTONE_BONUS,
            status: PointsStatus.SETTLED,
            referenceId: id,
            description: `Payout refund — request rejected: ${parsed.adminNotes}`
          }
        });

        return { updatedPayout, refundedCreator };
      });

      console.log(`❌ [Payout] Rejected payout ${id}, refunded ${payout.pointsRedeemed} pts`);

      res.json({
        success: true,
        payout: result.updatedPayout,
        refundedPoints: payout.pointsRedeemed,
        newBalance: result.refundedCreator.pointsBalance
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(422).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Payout Reject Error:', error);
      res.status(500).json({ error: error.message || 'Failed to reject payout' });
    }
  }
);
