import { Router } from 'express';
import { prisma, PointsStatus, UserRole } from '@evoc/database';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const adminRouter = Router();

// ============================================================================
// POST /api/admin/settle-points — Manually trigger 14-day settlement
// (Also used by the cron job internally)
// ============================================================================
adminRouter.post(
  '/settle-points',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res) => {
    try {
      const summary = await runSettlementCycle();
      res.json({ success: true, ...summary });
    } catch (error: any) {
      console.error('Manual settle-points error:', error);
      res.status(500).json({ error: error.message || 'Settlement failed' });
    }
  }
);

// ============================================================================
// GET /api/admin/settle-points/preview — Preview what would be settled
// ============================================================================
adminRouter.get(
  '/settle-points/preview',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res) => {
    try {
      const cutoffDate = getCutoffDate();

      const count = await prisma.evocPointsLedger.count({
        where: {
          status: PointsStatus.LOCKED,
          createdAt: { lte: cutoffDate }
        }
      });

      const totalPoints = await prisma.evocPointsLedger.aggregate({
        where: {
          status: PointsStatus.LOCKED,
          createdAt: { lte: cutoffDate }
        },
        _sum: { pointsDelta: true }
      });

      res.json({
        preview: true,
        cutoffDate: cutoffDate.toISOString(),
        eligibleEntries: count,
        totalPointsToSettle: totalPoints._sum.pointsDelta ?? 0
      });
    } catch (error: any) {
      console.error('Settlement preview error:', error);
      res.status(500).json({ error: error.message || 'Preview failed' });
    }
  }
);

// ============================================================================
// GET /api/admin/payouts — List all pending payout requests
// ============================================================================
adminRouter.get(
  '/payouts',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res) => {
    try {
      const status = (req.query.status as string) || 'PENDING_UTR';

      const payouts = await prisma.payoutRequest.findMany({
        where: { status: status as any },
        include: {
          creator: {
            select: {
              displayAlias: true,
              category: true,
              pointsBalance: true
            }
          }
        },
        orderBy: { createdAt: 'asc' } // FIFO — oldest first
      });

      res.json({ payouts, totalCount: payouts.length, filterStatus: status });
    } catch (error: any) {
      console.error('Admin payouts list error:', error);
      res.status(500).json({ error: error.message || 'Failed to list payouts' });
    }
  }
);

// ============================================================================
// Shared Settlement Logic (reused by cron + manual endpoint)
// ============================================================================
export function getCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14); // 14-day return window
  return cutoff;
}

export async function runSettlementCycle(): Promise<{
  settledCount: number;
  totalPointsSettled: number;
  cutoffDate: string;
  batchSize: number;
}> {
  const cutoffDate = getCutoffDate();
  const BATCH_SIZE = 500; // Process in chunks to avoid long transactions

  console.log(`🏦 [Settlement] Running 14-day settlement cycle. Cutoff: ${cutoffDate.toISOString()}`);

  // Find all eligible LOCKED entries older than 14 days
  const eligibleEntries = await prisma.evocPointsLedger.findMany({
    where: {
      status: PointsStatus.LOCKED,
      createdAt: { lte: cutoffDate }
    },
    select: { id: true, pointsDelta: true, creatorId: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' }
  });

  if (eligibleEntries.length === 0) {
    console.log('🏦 [Settlement] No entries eligible for settlement.');
    return {
      settledCount: 0,
      totalPointsSettled: 0,
      cutoffDate: cutoffDate.toISOString(),
      batchSize: BATCH_SIZE
    };
  }

  const entryIds = eligibleEntries.map((e) => e.id);
  const totalPoints = eligibleEntries.reduce((sum, e) => sum + e.pointsDelta, 0);

  // Atomic batch update: mark all eligible entries as SETTLED
  await prisma.$transaction(async (tx) => {
    await tx.evocPointsLedger.updateMany({
      where: { id: { in: entryIds } },
      data: { status: PointsStatus.SETTLED }
    });
  });

  console.log(
    `✅ [Settlement] Settled ${eligibleEntries.length} ledger entries (${totalPoints} pts) → SETTLED`
  );

  return {
    settledCount: eligibleEntries.length,
    totalPointsSettled: totalPoints,
    cutoffDate: cutoffDate.toISOString(),
    batchSize: BATCH_SIZE
  };
}
