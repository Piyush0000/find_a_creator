import { prisma, PointsTransactionType, PointsStatus } from '@evoc/database';

export interface RecordCommissionParams {
  collabId: string;
  creatorId: string;
  orderId: string;
  orderTotal: number;
  pointsEarned: number;
  description?: string;
}

export class PointsService {
  /**
   * Idempotently records order attribution, creates a LOCKED ledger entry,
   * and increments the creator's points balance inside an atomic transaction.
   */
  static async recordOrderCommission(params: RecordCommissionParams) {
    const { collabId, creatorId, orderId, orderTotal, pointsEarned, description } = params;

    return await prisma.$transaction(async (tx) => {
      // 1. Idempotency Check: Prevent duplicate credit if webhook is received multiple times
      const existingAttribution = await tx.orderAttribution.findUnique({
        where: { orderId }
      });

      if (existingAttribution) {
        return {
          duplicate: true,
          attribution: existingAttribution,
          pointsCredited: 0,
          creatorId
        };
      }

      // 2. Create Order Attribution record
      const attribution = await tx.orderAttribution.create({
        data: {
          collabId,
          orderId,
          orderTotal,
          pointsEarned
        }
      });

      // 3. Create Points Ledger Entry (Status: LOCKED for 7-day return window)
      const ledgerEntry = await tx.evocPointsLedger.create({
        data: {
          creatorId,
          pointsDelta: pointsEarned,
          transactionType: PointsTransactionType.PURCHASE_COMMISSION,
          status: PointsStatus.LOCKED,
          referenceId: orderId,
          description: description || `Commission for Order #${orderId}`
        }
      });

      // 4. Update Creator's overall points balance
      const updatedCreator = await tx.creatorProfile.update({
        where: { id: creatorId },
        data: {
          pointsBalance: { increment: pointsEarned }
        }
      });

      return {
        duplicate: false,
        attribution,
        ledgerEntry,
        pointsCredited: pointsEarned,
        creatorId,
        newBalance: updatedCreator.pointsBalance
      };
    });
  }

  /**
   * Settles matured points that have completed the return window (default 7 days).
   * Moves status from LOCKED -> SETTLED.
   */
  static async settleMaturedPoints(daysThreshold = 7, creatorId?: string) {
    const cutoffDate = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

    const whereClause: any = {
      status: PointsStatus.LOCKED,
      createdAt: { lte: cutoffDate }
    };

    if (creatorId) {
      whereClause.creatorId = creatorId;
    }

    const updated = await prisma.evocPointsLedger.updateMany({
      where: whereClause,
      data: {
        status: PointsStatus.SETTLED
      }
    });

    return updated.count;
  }

  /**
   * Retrieves points summary for a creator:
   * total balance, locked points (pending 7-day clearance), and settled points.
   * Automatically matures any eligible locked transactions.
   */
  static async getCreatorPointsSummary(creatorId: string) {
    const creator = await prisma.creatorProfile.findUnique({
      where: { id: creatorId },
      select: { pointsBalance: true }
    });

    if (!creator) {
      return null;
    }

    // Automatically settle any entries that have reached the 7-day threshold
    await this.settleMaturedPoints(7, creatorId);

    // Aggregate locked points (still inside 7-day window)
    const lockedAggregate = await prisma.evocPointsLedger.aggregate({
      where: {
        creatorId,
        status: PointsStatus.LOCKED
      },
      _sum: {
        pointsDelta: true
      }
    });

    // Aggregate settled points (ready to withdraw)
    const settledAggregate = await prisma.evocPointsLedger.aggregate({
      where: {
        creatorId,
        status: PointsStatus.SETTLED
      },
      _sum: {
        pointsDelta: true
      }
    });

    const lockedPoints = lockedAggregate._sum.pointsDelta || 0;
    const settledPoints = settledAggregate._sum.pointsDelta || 0;

    return {
      pointsBalance: creator.pointsBalance,
      lockedPoints,
      settledPoints
    };
  }

  /**
   * Retrieves chronological ledger history for a creator
   */
  static async getCreatorLedger(creatorId: string, limit = 50, offset = 0) {
    const [entries, total] = await Promise.all([
      prisma.evocPointsLedger.findMany({
        where: { creatorId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.evocPointsLedger.count({
        where: { creatorId }
      })
    ]);

    return {
      total,
      entries
    };
  }
}
