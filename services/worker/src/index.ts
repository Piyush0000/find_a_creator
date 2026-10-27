import path from 'path';
import dotenv from 'dotenv';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

import { isRedisAvailable } from './queues/index.js';
import { startNotificationWorker } from './processors/notification.processor.js';
import { startAuditWorker } from './processors/audit.processor.js';
import { startSettlementCron } from './jobs/settlement.cron.js';

async function main() {
  console.log('🚀 EVOC Worker Service starting...');

  // 1. Start 14-day Settlement Cron (Database-backed, independent of Redis)
  const settlementCron = startSettlementCron();
  console.log('   → settlement-cron: active (every 6 hours)');

  // 2. Check Redis availability for BullMQ worker queues
  const redisOk = await isRedisAvailable();

  let notificationWorker: ReturnType<typeof startNotificationWorker> | null = null;
  let auditWorker: ReturnType<typeof startAuditWorker> | null = null;

  if (redisOk) {
    notificationWorker = startNotificationWorker();
    auditWorker = startAuditWorker();
    console.log('   → notification-queue: active (Redis connected)');
    console.log('   → audit-queue: active (Redis connected)');
    console.log('✅ EVOC Worker Service fully running. Listening for jobs...');
  } else {
    console.log('⚠️  Redis is not reachable on localhost:6379.');
    console.log('   (BullMQ queues require Redis. To enable queues: start Redis or run `docker compose -f infra/docker-compose.infra.yml up -d redis`)');
    console.log('✅ EVOC Worker Service running in CRON-ONLY mode. 14-Day Settlement is active.');
  }

  // Graceful shutdown
  async function shutdown(signal: string) {
    console.log(`\n⚠️  Received ${signal}. Shutting down worker gracefully...`);
    await Promise.all([
      notificationWorker?.close(),
      auditWorker?.close(),
      settlementCron.stop()
    ]);
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('❌ Worker failed to start:', err);
  process.exit(1);
});
