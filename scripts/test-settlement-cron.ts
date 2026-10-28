/**
 * 14-Day Financial Settlement Cron Verification Script
 * Simulates ledger records older than 14 days and triggers settlement.
 * Run: npx tsx scripts/test-settlement-cron.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import { prisma, PointsStatus, PointsTransactionType } from '@evoc/database';
import { runSettlementCycle } from '../services/worker/src/cron/settlePoints.js';

async function main() {
  console.log('🚀 ======================================================');
  console.log('🧪 VERIFYING 14-DAY FINANCIAL SETTLEMENT CRON ENGINE');
  console.log('======================================================\n');

  // 1. Locate sample creator in Supabase
  const creatorUser = await prisma.user.findUnique({
    where: { email: 'rohit.creator@evoc.internal' },
    include: { creatorProfile: true }
  });

  if (!creatorUser || !creatorUser.creatorProfile) {
    console.error('❌ Sample creator not found in DB. Run `npx pnpm db:seed` first.');
    process.exit(1);
  }

  const creatorId = creatorUser.creatorProfile.id;
  console.log(`👤 Target Creator: ${creatorUser.creatorProfile.displayAlias} (${creatorId})`);

  // 2. Insert a simulated LOCKED transaction with createdAt 15 days ago (outside 14-day return window)
  const simulatedOldDate = new Date();
  simulatedOldDate.setDate(simulatedOldDate.getDate() - 15);

  const testPoints = 250;
  console.log(`\n📝 Simulating 15-day-old purchase commission: +${testPoints} points (LOCKED)...`);
  const simulatedEntry = await prisma.evocPointsLedger.create({
    data: {
      creatorId,
      pointsDelta: testPoints,
      transactionType: PointsTransactionType.PURCHASE_COMMISSION,
      status: PointsStatus.LOCKED,
      description: 'Simulated 15-day-old commission for 14-day settlement verification',
      createdAt: simulatedOldDate
    }
  });

  console.log(`   Simulated Ledger ID: ${simulatedEntry.id}`);
  console.log(`   Status before cron:  ${simulatedEntry.status}`);
  console.log(`   Created At:          ${simulatedEntry.createdAt.toISOString()}`);

  // 3. Run settlement cycle
  console.log('\n⚙️ Executing runSettlementCycle()...');
  const result = await runSettlementCycle();

  console.log(`\n📊 Settlement Run Summary:`);
  console.log(`   Settled Count:       ${result.settledCount}`);
  console.log(`   Total Points Matured: ${result.totalPointsSettled}`);
  console.log(`   Cutoff Threshold:    ${result.cutoffDate}`);

  // 4. Verify the entry in DB is now SETTLED
  const verifiedEntry = await prisma.evocPointsLedger.findUnique({
    where: { id: simulatedEntry.id }
  });

  if (!verifiedEntry || verifiedEntry.status !== PointsStatus.SETTLED) {
    console.error(`❌ Verification failed: Ledger status is '${verifiedEntry?.status}', expected 'SETTLED'`);
    process.exit(1);
  }

  console.log(`\n✅ Database Verification PASSED:`);
  console.log(`   Ledger ID: ${verifiedEntry.id}`);
  console.log(`   Updated Status: ${verifiedEntry.status} (Matured from LOCKED)`);
  console.log(`\n🎉 [PASSED] 14-Day Financial Settlement Engine is 100% functional.\n`);
}

main().catch((err) => {
  console.error('💥 Unhandled error in settlement test:', err);
  process.exit(1);
});
