import { Worker, Job } from 'bullmq';
import { createWorkerConnection } from '../queues/index.js';

// ---------------------------------------------------------------------------
// Audit Processor
// Writes immutable audit trail entries to console/log sink.
// In production: forward to a dedicated audit log store (BigQuery, Loki, etc.)
// ---------------------------------------------------------------------------

type AuditJobData = {
  event: string;
  actorId: string;
  collabId?: string;
  timestamp: string;
  [key: string]: unknown;
};

async function processAudit(job: Job<AuditJobData>): Promise<void> {
  const { event, actorId, collabId, timestamp } = job.data;

  // Structured audit log — immutable record of who did what and when
  const auditEntry = {
    auditId: job.id,
    event,
    actorId,
    collabId: collabId ?? null,
    timestamp,
    processedAt: new Date().toISOString()
  };

  // In production: write to append-only audit log store (BigQuery / CloudWatch)
  console.log(`📋 [Audit Worker] AUDIT_TRAIL:`, JSON.stringify(auditEntry));
}

// ---------------------------------------------------------------------------
// Worker Bootstrap
// ---------------------------------------------------------------------------
export function startAuditWorker(): Worker {
  const worker = new Worker('audit-queue', processAudit, {
    connection: createWorkerConnection(),
    concurrency: 10 // Audit is lightweight — higher concurrency
  });

  worker.on('completed', (job) => {
    console.log(`✅ [Audit Worker] Audit job ${job.id} recorded`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [Audit Worker] Audit job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('❌ [Audit Worker] Worker error:', err.message);
  });

  return worker;
}
