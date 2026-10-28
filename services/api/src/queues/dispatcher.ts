import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// ---------------------------------------------------------------------------
// Redis Connection (shared across all queues)
// ---------------------------------------------------------------------------
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let connection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      connectTimeout: 3000,
      retryStrategy: (times) => {
        if (times > 5) return 10000;
        return Math.min(times * 1500, 5000);
      }
    });

    connection.on('error', (err: any) => {
      if (err.code !== 'ECONNREFUSED') {
        console.warn('⚠️  Redis connection warning (queue dispatcher):', err.message);
      }
    });

    connection.on('connect', () => {
      console.log('✅ Queue dispatcher connected to Redis');
    });
  }
  return connection;
}

// ---------------------------------------------------------------------------
// Queue Definitions
// ---------------------------------------------------------------------------
let notificationQueue: Queue | null = null;
let auditQueue: Queue | null = null;

function getNotificationQueue(): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue('notification-queue', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 }
      }
    });
  }
  return notificationQueue;
}

function getAuditQueue(): Queue {
  if (!auditQueue) {
    auditQueue = new Queue('audit-queue', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 }
      }
    });
  }
  return auditQueue;
}

// Timeout helper: prevents async queue adds from hanging if Redis is offline
function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Redis queue dispatch timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}

// ---------------------------------------------------------------------------
// Graceful shutdown helper
// ---------------------------------------------------------------------------
export async function closeQueues(): Promise<void> {
  await Promise.all([
    notificationQueue?.close(),
    auditQueue?.close()
  ]);
  await connection?.quit();
}

// ---------------------------------------------------------------------------
// Event Dispatchers (non-blocking, fire-and-forget, gracefully handles offline Redis)
// ---------------------------------------------------------------------------

/**
 * Dispatched when a Merchant submits a new collab brief.
 * Notifies: EVOC Ops (to review) + Creator (brief arrived).
 */
export async function dispatchBriefSubmitted(payload: {
  collabId: string;
  merchantId: string;
  creatorId: string;
  productName: string;
}): Promise<void> {
  try {
    const queue = getNotificationQueue();

    await withTimeout(
      Promise.all([
        queue.add('notify-ops-brief-submitted', {
          event: 'BRIEF_SUBMITTED',
          recipient: 'evoc_ops',
          ...payload,
          timestamp: new Date().toISOString()
        }),
        queue.add('notify-creator-brief-arrived', {
          event: 'BRIEF_SUBMITTED',
          recipient: 'creator',
          creatorId: payload.creatorId,
          collabId: payload.collabId,
          productName: payload.productName,
          timestamp: new Date().toISOString()
        }),
        getAuditQueue().add('audit-brief-submitted', {
          event: 'BRIEF_SUBMITTED',
          actorId: payload.merchantId,
          collabId: payload.collabId,
          timestamp: new Date().toISOString()
        })
      ]),
      2500
    );

    console.log(`📨 [Queue] dispatchBriefSubmitted → collab:${payload.collabId}`);
  } catch (err: any) {
    console.log(`ℹ️  [Queue] Redis offline or busy (${err.message}). Brief submitted successfully without background job.`);
  }
}

/**
 * Dispatched when a Creator uploads their draft video.
 * Notifies: EVOC Ops (to review draft) — merchant is NOT notified yet.
 */
export async function dispatchDraftUploaded(payload: {
  collabId: string;
  creatorId: string;
  draftVideoUrl: string;
}): Promise<void> {
  try {
    const queue = getNotificationQueue();

    await withTimeout(
      Promise.all([
        queue.add('notify-ops-draft-uploaded', {
          event: 'DRAFT_UPLOADED',
          recipient: 'evoc_ops',
          collabId: payload.collabId,
          creatorId: payload.creatorId,
          draftVideoUrl: payload.draftVideoUrl,
          timestamp: new Date().toISOString()
        }),
        getAuditQueue().add('audit-draft-uploaded', {
          event: 'DRAFT_UPLOADED',
          actorId: payload.creatorId,
          collabId: payload.collabId,
          timestamp: new Date().toISOString()
        })
      ]),
      2500
    );

    console.log(`📨 [Queue] dispatchDraftUploaded → collab:${payload.collabId}`);
  } catch (err: any) {
    console.log(`ℹ️  [Queue] Redis offline or busy (${err.message}). Draft uploaded successfully.`);
  }
}

/**
 * Dispatched when Merchant approves the final ad asset.
 * Notifies: Creator (congratulations) + Ops (asset delivered).
 */
export async function dispatchAssetApproved(payload: {
  collabId: string;
  merchantId: string;
  creatorId: string;
  approvedVideoUrl: string;
  utmTrackingSlug?: string;
}): Promise<void> {
  try {
    const queue = getNotificationQueue();

    await withTimeout(
      Promise.all([
        queue.add('notify-creator-asset-approved', {
          event: 'ASSET_APPROVED',
          recipient: 'creator',
          creatorId: payload.creatorId,
          collabId: payload.collabId,
          utmTrackingSlug: payload.utmTrackingSlug,
          timestamp: new Date().toISOString()
        }),
        queue.add('notify-merchant-asset-delivered', {
          event: 'ASSET_DELIVERED',
          recipient: 'merchant',
          merchantId: payload.merchantId,
          collabId: payload.collabId,
          approvedVideoUrl: payload.approvedVideoUrl,
          timestamp: new Date().toISOString()
        }),
        getAuditQueue().add('audit-asset-approved', {
          event: 'ASSET_APPROVED',
          actorId: payload.merchantId,
          collabId: payload.collabId,
          timestamp: new Date().toISOString()
        })
      ]),
      2500
    );

    console.log(`📨 [Queue] dispatchAssetApproved → collab:${payload.collabId}`);
  } catch (err: any) {
    console.log(`ℹ️  [Queue] Redis offline or busy (${err.message}). Asset approved successfully.`);
  }
}

/**
 * Dispatched when EVOC Admin/QC requests revisions on a draft video.
 * Fires WhatsApp template 'draft_revision_alert' to the Creator.
 */
export async function dispatchDraftRevisionRequested(payload: {
  collabId: string;
  creatorId: string;
  revisionReason?: string;
  reviewNotes?: string;
}): Promise<void> {
  try {
    const queue = getNotificationQueue();

    await withTimeout(
      Promise.all([
        queue.add('notify-creator-draft-revision', {
          event: 'DRAFT_REVISION_REQUESTED',
          recipient: 'creator',
          collabId: payload.collabId,
          creatorId: payload.creatorId,
          revisionReason: payload.revisionReason,
          reviewNotes: payload.reviewNotes,
          timestamp: new Date().toISOString()
        }),
        getAuditQueue().add('audit-draft-revision-requested', {
          event: 'DRAFT_REVISION_REQUESTED',
          actorId: 'super_admin',
          collabId: payload.collabId,
          timestamp: new Date().toISOString()
        })
      ]),
      2500
    );

    console.log(`📨 [Queue] dispatchDraftRevisionRequested → collab:${payload.collabId}`);
  } catch (err: any) {
    console.log(`ℹ️  [Queue] Redis offline or busy (${err.message}). Revision recorded.`);
  }
}

/**
 * Dispatched when an external Evo Checkout order is attributed to a creator.
 * Fires WhatsApp template 'creator_sale_commission' to the Creator.
 */
export async function dispatchOrderCommissionCredited(payload: {
  collabId: string;
  creatorId: string;
  orderId: string;
  pointsEarned: number;
  orderTotal?: number;
}): Promise<void> {
  try {
    const queue = getNotificationQueue();

    await withTimeout(
      Promise.all([
        queue.add('notify-creator-commission-credited', {
          event: 'ORDER_COMMISSION_CREDITED',
          recipient: 'creator',
          collabId: payload.collabId,
          creatorId: payload.creatorId,
          orderId: payload.orderId,
          pointsEarned: payload.pointsEarned,
          orderTotal: payload.orderTotal,
          timestamp: new Date().toISOString()
        }),
        getAuditQueue().add('audit-order-commission-credited', {
          event: 'ORDER_COMMISSION_CREDITED',
          actorId: 'system',
          collabId: payload.collabId,
          orderId: payload.orderId,
          pointsEarned: payload.pointsEarned,
          timestamp: new Date().toISOString()
        })
      ]),
      2500
    );

    console.log(`📨 [Queue] dispatchOrderCommissionCredited → collab:${payload.collabId} (order:${payload.orderId})`);
  } catch (err: any) {
    console.log(`ℹ️  [Queue] Redis offline or busy (${err.message}). Commission credited.`);
  }
}
