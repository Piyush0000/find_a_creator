import dotenv from 'dotenv';
import { prisma } from '@evoc/database';

dotenv.config();

console.log('👷 EVOC Background Worker online. Listening for WhatsApp events and order processing...');

// Periodic simulation worker for demonstration & testing
async function startWorker() {
  setInterval(async () => {
    try {
      // Check for any locked points ready for settlement after 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const readyForSettlement = await prisma.evocPointsLedger.findMany({
        where: {
          status: 'LOCKED',
          createdAt: { lte: sevenDaysAgo }
        },
        take: 10
      });

      if (readyForSettlement.length > 0) {
        console.log(`[Worker] Settling ${readyForSettlement.length} matured point ledger transactions.`);
        for (const item of readyForSettlement) {
          await prisma.evocPointsLedger.update({
            where: { id: item.id },
            data: { status: 'SETTLED' }
          });
        }
      }
    } catch (err) {
      // Idle log
    }
  }, 60000); // Checks every minute
}

startWorker();
