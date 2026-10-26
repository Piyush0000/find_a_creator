import { prisma, PointsStatus } from '@evoc/database';

// ---------------------------------------------------------------------------
// 14-Day Financial Settlement Cron
// Settles all LOCKED points older than 14 days → marks them SETTLED
// so creators can then request payouts.
// ---------------------------------------------------------------------------

const SETTLEMENT_DAYS = 14;
const BATCH_SIZE = 500;
const CRON_INTERVAL_HOURS = 6; // Runs every 6 hours

interface SettlementResult {
  settledCount: number;
  totalPointsSettled: number;
  cutoffDate: string;
  ranAt: string;
}

function getCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SETTLEMENT_DAYS);
  return cutoff;
}

export async function runSettlementCycle(): Promise<SettlementResult> {
  const ranAt = new Date().toISOString();
  const cutoffDate = getCutoffDate();

  console.log(`🏦 [Settlement Cron] Cycle started at ${ranAt}`);
  console.log(`🏦 [Settlement Cron] Settling LOCKED entries older than ${cutoffDate.toISOString()}`);

  // Find eligible LOCKED ledger entries (older than 14 days)
  const eligibleEntries = await prisma.evocPointsLedger.findMany({
    where: {
      status: PointsStatus.LOCKED,
      pointsDelta: { gt: 0 }, // Only settle positive (commission) entries
      createdAt: { lte: cutoffDate }
    },
    select: { id: true, pointsDelta: true, creatorId: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' } // FIFO — settle oldest first
  });

  if (eligibleEntries.length === 0) {
    console.log('🏦 [Settlement Cron] No eligible entries. Cycle complete.');
    return {
      settledCount: 0,
      totalPointsSettled: 0,
      cutoffDate: cutoffDate.toISOString(),
      ranAt
    };
  }

  const entryIds = eligibleEntries.map((e) => e.id);
  const totalPoints = eligibleEntries.reduce((sum, e) => sum + e.pointsDelta, 0);

  console.log(
    `🏦 [Settlement Cron] Found ${eligibleEntries.length} entries to settle (${totalPoints} pts total)`
  );

  // Atomic batch update — all or nothing
  await prisma.$transaction(async (tx) => {
    const result = await tx.evocPointsLedger.updateMany({
      where: { id: { in: entryIds } },
      data: { status: PointsStatus.SETTLED }
    });
    console.log(`🏦 [Settlement Cron] Batch updated ${result.count} entries → SETTLED`);
  });

  const summary: SettlementResult = {
    settledCount: eligibleEntries.length,
    totalPointsSettled: totalPoints,
    cutoffDate: cutoffDate.toISOString(),
    ranAt
  };

  console.log(`✅ [Settlement Cron] Cycle complete:`, JSON.stringify(summary));
  return summary;
}

// ---------------------------------------------------------------------------
// Cron Job Scheduler using native setInterval
// (No external cron lib needed — BullMQ Scheduler is optional for this)
// ---------------------------------------------------------------------------

interface CronHandle {
  stop: () => void;
}

export function startSettlementCron(): CronHandle {
  const intervalMs = CRON_INTERVAL_HOURS * 60 * 60 * 1000;

  console.log(
    `⏰ [Settlement Cron] Scheduled to run every ${CRON_INTERVAL_HOURS} hours`
  );

  // Run immediately on startup to catch any missed settlements
  runSettlementCycle().catch((err) => {
    console.error('❌ [Settlement Cron] Initial run failed:', err.message);
  });

  const intervalId = setInterval(async () => {
    try {
      await runSettlementCycle();
    } catch (err: any) {
      console.error('❌ [Settlement Cron] Scheduled run failed:', err.message);
    }
  }, intervalMs);

  return {
    stop: () => {
      clearInterval(intervalId);
      console.log('⏰ [Settlement Cron] Stopped.');
    }
  };
}
