import { Worker, Job } from 'bullmq';
import { prisma } from '@evoc/database';
import { createWorkerConnection } from '../queues/index.js';
import { WapiService } from '../services/wapi.service.js';

// ---------------------------------------------------------------------------
// Notification Processor
// Handles outbound alerts via WAPI (WhatsApp Business API)
// ---------------------------------------------------------------------------

const wapi = new WapiService();

export type NotificationJobData = {
  event: string;
  recipient: 'creator' | 'merchant' | 'evoc_ops';
  collabId?: string;
  creatorId?: string;
  merchantId?: string;
  productName?: string;
  pointsEarned?: number;
  orderId?: string;
  revisionReason?: string;
  reviewNotes?: string;
  draftVideoUrl?: string;
  approvedVideoUrl?: string;
  utmTrackingSlug?: string;
  timestamp: string;
};

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { event, recipient, timestamp, ...meta } = job.data;

  const safeLog = {
    jobId: job.id,
    jobName: job.name,
    event,
    recipient,
    collabId: meta.collabId,
    timestamp
  };

  console.log(`📬 [Notification Worker] Processing job:`, JSON.stringify(safeLog));

  try {
    switch (event) {
      case 'BRIEF_SUBMITTED':
        await handleBriefSubmitted(job.data);
        break;

      case 'DRAFT_REVISION_REQUESTED':
        await handleDraftRevisionRequested(job.data);
        break;

      case 'ORDER_COMMISSION_CREDITED':
        await handleOrderCommissionCredited(job.data);
        break;

      case 'DRAFT_UPLOADED':
        await handleDraftUploaded(job.data);
        break;

      case 'ASSET_APPROVED':
      case 'ASSET_DELIVERED':
        await handleAssetApproved(job.data);
        break;

      default:
        console.warn(`[Notification Worker] Unknown event type: ${event} — skipping`);
    }
  } catch (err: any) {
    console.error(`❌ [Notification Worker] Job ${job.id} failed:`, err.message);
    throw err; // Allow BullMQ retry
  }
}

// ---------------------------------------------------------------------------
// 1. Template: creator_brief_received (Approved Utility on Meta)
// ---------------------------------------------------------------------------
async function handleBriefSubmitted(data: NotificationJobData): Promise<void> {
  if (data.recipient === 'evoc_ops') {
    console.log(`📣 [Ops Alert] New brief submitted for collab:${data.collabId} (${data.productName})`);
    return;
  }

  if (data.recipient === 'creator' && data.collabId) {
    const collab = await prisma.collaborationRequest.findUnique({
      where: { id: data.collabId },
      include: {
        creator: { include: { user: true } },
        merchant: true
      }
    });

    if (!collab || !collab.creator?.user?.phoneNumber) {
      console.warn(`⚠️ [WAPI] Cannot send creator_brief_received: Creator or phone not found for collab:${data.collabId}`);
      return;
    }

    const creatorPhone = collab.creator.user.phoneNumber;
    const creatorName = collab.creator.displayAlias.split('—')[0].trim() || 'Creator';
    const brandName = collab.merchant?.brandName || 'EVOC Partner Brand';
    const productName = collab.productName || 'Featured Product';
    const commission = `${collab.commissionPointsPerSale} EVOC Points per sale`;

    console.log(`📱 [WhatsApp] Sending 'creator_brief_received' to ${creatorPhone}...`);
    const result = await wapi.sendTemplateMessage(
      creatorPhone,
      'creator_brief_received',
      'en',
      {
        field_1: creatorName,
        field_2: brandName,
        field_3: productName,
        field_4: commission
      }
    );

    if (result.success) {
      console.log(`✅ [WhatsApp] 'creator_brief_received' delivered to ${creatorPhone} (log_uid: ${result.log_uid})`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Template: draft_revision_alert (Approved Utility on Meta)
// ---------------------------------------------------------------------------
async function handleDraftRevisionRequested(data: NotificationJobData): Promise<void> {
  if (data.recipient === 'creator' && data.collabId) {
    const collab = await prisma.collaborationRequest.findUnique({
      where: { id: data.collabId },
      include: {
        creator: { include: { user: true } }
      }
    });

    if (!collab || !collab.creator?.user?.phoneNumber) {
      console.warn(`⚠️ [WAPI] Cannot send draft_revision_alert: Creator or phone not found for collab:${data.collabId}`);
      return;
    }

    const creatorPhone = collab.creator.user.phoneNumber;
    const creatorName = collab.creator.displayAlias.split('—')[0].trim() || 'Creator';
    const productName = collab.productName || 'UGC Ad Video';
    const reason = data.revisionReason || 'Quality Standards Update';
    const notes = data.reviewNotes || collab.evocReviewNotes || 'Please check feedback on creator dashboard.';

    console.log(`📱 [WhatsApp] Sending 'draft_revision_alert' to ${creatorPhone}...`);
    const result = await wapi.sendTemplateMessage(
      creatorPhone,
      'draft_revision_alert',
      'en',
      {
        field_1: creatorName,
        field_2: productName,
        field_3: reason,
        field_4: notes
      }
    );

    if (result.success) {
      console.log(`✅ [WhatsApp] 'draft_revision_alert' delivered to ${creatorPhone} (log_uid: ${result.log_uid})`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Template: creator_sale_commission (Approved Utility on Meta)
// ---------------------------------------------------------------------------
async function handleOrderCommissionCredited(data: NotificationJobData): Promise<void> {
  if (data.recipient === 'creator' && data.collabId) {
    const collab = await prisma.collaborationRequest.findUnique({
      where: { id: data.collabId },
      include: {
        creator: { include: { user: true } }
      }
    });

    if (!collab || !collab.creator?.user?.phoneNumber) {
      console.warn(`⚠️ [WAPI] Cannot send creator_sale_commission: Creator or phone not found for collab:${data.collabId}`);
      return;
    }

    const creatorPhone = collab.creator.user.phoneNumber;
    const productName = collab.productName || 'Product';
    const points = String(data.pointsEarned || collab.commissionPointsPerSale);
    const orderRef = data.orderId || 'ORD-EVOC';

    console.log(`📱 [WhatsApp] Sending 'creator_sale_commission' to ${creatorPhone}...`);
    const result = await wapi.sendTemplateMessage(
      creatorPhone,
      'creator_sale_commission',
      'en',
      {
        field_1: productName,
        field_2: points,
        field_3: points,
        field_4: orderRef
      }
    );

    if (result.success) {
      console.log(`✅ [WhatsApp] 'creator_sale_commission' delivered to ${creatorPhone} (log_uid: ${result.log_uid})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Other Lifecycle Events
// ---------------------------------------------------------------------------
async function handleDraftUploaded(data: NotificationJobData): Promise<void> {
  console.log(`🎬 [Ops Alert] Draft uploaded for review → collab:${data.collabId}`);
}

async function handleAssetApproved(data: NotificationJobData): Promise<void> {
  console.log(`🎉 [Asset Event] Collab:${data.collabId} approved & delivered.`);
}

// ---------------------------------------------------------------------------
// Worker Bootstrap
// ---------------------------------------------------------------------------
export function startNotificationWorker(): Worker {
  const worker = new Worker('notification-queue', processNotification, {
    connection: createWorkerConnection(),
    concurrency: 5
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
