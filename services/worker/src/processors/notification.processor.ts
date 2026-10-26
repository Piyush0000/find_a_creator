import { Worker, Job } from 'bullmq';
import { createWorkerConnection } from '../queues/index.js';

// ---------------------------------------------------------------------------
// Notification Processor
// Handles all outbound alerts: WhatsApp/Email/Push (stub in dev mode)
// ---------------------------------------------------------------------------

type NotificationJobData = {
  event: string;
  recipient: string;
  collabId?: string;
  creatorId?: string;
  merchantId?: string;
  productName?: string;
  draftVideoUrl?: string;
  approvedVideoUrl?: string;
  utmTrackingSlug?: string;
  timestamp: string;
};

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { event, recipient, timestamp, ...meta } = job.data;

  // Mask any sensitive fields before logging
  const safeLog = {
    jobId: job.id,
    jobName: job.name,
    event,
    recipient,
    timestamp,
    collabId: meta.collabId,
    // Never log full video URLs or PII in production — just ID references
    hasVideoUrl: !!meta.draftVideoUrl || !!meta.approvedVideoUrl,
    utmSlug: meta.utmTrackingSlug ?? null
  };

  console.log(`📬 [Notification Worker] Processing job:`, JSON.stringify(safeLog));

  // Route by event type
  switch (event) {
    case 'BRIEF_SUBMITTED':
      await handleBriefSubmitted(job.data);
      break;

    case 'DRAFT_UPLOADED':
      await handleDraftUploaded(job.data);
      break;

    case 'ASSET_APPROVED':
    case 'ASSET_DELIVERED':
      await handleAssetEvent(job.data);
      break;

    default:
      console.warn(`[Notification Worker] Unknown event type: ${event} — skipping`);
  }
}

// ---------------------------------------------------------------------------
// Event-specific handlers (stub implementations for dev)
// In production: replace console.log with WhatsApp Business API / SendGrid
// ---------------------------------------------------------------------------

async function handleBriefSubmitted(data: NotificationJobData): Promise<void> {
  if (data.recipient === 'evoc_ops') {
    // → In production: POST to EVOC Ops WhatsApp group or internal Slack
    console.log(
      `  📣 [STUB] Ops Alert: New brief submitted for collab:${data.collabId} (${data.productName})`
    );
  } else if (data.recipient === 'creator') {
    // → In production: WhatsApp message to creator's registered phone
    console.log(
      `  📣 [STUB] Creator Alert: New collaboration brief arrived → collab:${data.collabId}`
    );
  }
}

async function handleDraftUploaded(data: NotificationJobData): Promise<void> {
  if (data.recipient === 'evoc_ops') {
    // → In production: POST to EVOC Ops review queue / internal system
    console.log(
      `  🎬 [STUB] Ops Alert: Draft uploaded for review → collab:${data.collabId}`
    );
  }
}

async function handleAssetEvent(data: NotificationJobData): Promise<void> {
  if (data.recipient === 'creator') {
    // → In production: WhatsApp celebration message + earnings update
    console.log(
      `  🎉 [STUB] Creator Alert: Your ad asset was approved! UTM: ${data.utmTrackingSlug ?? 'pending'}`
    );
  } else if (data.recipient === 'merchant') {
    // → In production: Email with download link to approved video
    console.log(
      `  📦 [STUB] Merchant Alert: Ad asset delivered → collab:${data.collabId}`
    );
  }
}

// ---------------------------------------------------------------------------
// Worker Bootstrap
// ---------------------------------------------------------------------------
export function startNotificationWorker(): Worker {
  const worker = new Worker('notification-queue', processNotification, {
    connection: createWorkerConnection(),
    concurrency: 5 // Process 5 notifications in parallel
  });

  worker.on('completed', (job) => {
    console.log(`✅ [Notification Worker] Job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ [Notification Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('❌ [Notification Worker] Worker error:', err.message);
  });

  return worker;
}
