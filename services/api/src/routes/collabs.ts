import { Router } from 'express';
import { z } from 'zod';
import { prisma, CollabStatus, UserRole } from '@evoc/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { antiLeakScan } from '../middleware/antiLeak.js';
import { CreateCollabBriefSchema } from '@evoc/types';
import {
  dispatchBriefSubmitted,
  dispatchDraftUploaded,
  dispatchAssetApproved
} from '../queues/dispatcher.js';

export const collabsRouter = Router();

// ============================================================================
// DTO Schemas for Collab Lifecycle
// ============================================================================
const SubmitDraftSchema = z.object({
  draftVideoUrl: z.string().url('A valid video URL is required')
});

const EvocReviewSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional()
});

const MerchantApprovalSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional()
});

const SampleDispatchedSchema = z.object({
  courierName: z.string().min(2, 'Courier name is required (e.g., BlueDart, Delhivery)'),
  trackingNumber: z.string().min(3, 'Tracking number is required'),
  trackingUrl: z.string().url().optional()
});

// ============================================================================
// 1. POST /api/collabs (Merchant submits a brief with script)
// ============================================================================
collabsRouter.post(
  '/',
  requireAuth,
  requireRole(UserRole.MERCHANT),
  antiLeakScan(['scriptGuidelines', 'videoHooks']),
  async (req, res) => {
    try {
      const parsed = CreateCollabBriefSchema.parse(req.body);

      const merchant = await prisma.merchantProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant profile not found' });
      }

      if (merchant.subscriptionStatus !== 'ACTIVE') {
        return res.status(403).json({ error: 'Active EVOC subscription required to request creators' });
      }

      // Generate unique UTM tracking slug for ad attribution
      const utmSlug = `evoc_cr_${Math.random().toString(36).substring(2, 9)}`;

      const collab = await prisma.collaborationRequest.create({
        data: {
          merchantId: merchant.id,
          creatorId: parsed.creatorId,
          productName: parsed.productName,
          productLink: parsed.productLink,
          productPrice: parsed.productPrice,
          scriptGuidelines: parsed.scriptGuidelines,
          videoHooks: parsed.videoHooks,
          aspectRatio: parsed.aspectRatio,
          deliverableType: parsed.deliverableType,
          commissionPointsPerSale: parsed.commissionPointsPerSale,
          status: CollabStatus.BRIEF_SUBMITTED,
          utmTrackingSlug: utmSlug
        }
      });

      // Dispatch async notifications (fire-and-forget — non-blocking)
      dispatchBriefSubmitted({
        collabId: collab.id,
        merchantId: merchant.id,
        creatorId: parsed.creatorId,
        productName: parsed.productName
      }).catch((err) => console.error('[Queue] dispatchBriefSubmitted failed:', err.message));

      res.status(201).json({
        message: 'Brief submitted! Dual-dispatched to Creator queue and Super Admin moderation.',
        collabId: collab.id,
        utmTrackingSlug: utmSlug
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Validation failed' });
    }
  }
);

// ============================================================================
// 2. GET /api/collabs/merchant (Sprint Day 1: Merchant Collabs Feed with Stage 1 Video Masking)
// ============================================================================
collabsRouter.get(
  '/merchant',
  requireAuth,
  requireRole(UserRole.MERCHANT),
  async (req, res) => {
    try {
      const merchant = await prisma.merchantProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant profile not found' });
      }

      // Query merchant collabs
      const collabs = await prisma.collaborationRequest.findMany({
        where: { merchantId: merchant.id },
        include: {
          creator: {
            select: {
              id: true,
              displayAlias: true,
              category: true,
              contentStyles: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Allowed unmasked statuses for Merchant
      const unlockedStatuses = (
        [
          CollabStatus.DRAFT_PENDING_MERCHANT,
          CollabStatus.ASSET_DELIVERED,
          CollabStatus.CAMPAIGN_ACTIVE,
          CollabStatus.COMPLETED
        ] as CollabStatus[]
      );

      // Mask sensitive draft videos and attach asset handoffs where eligible
      const sanitizedCollabs = collabs.map((collab) => {
        const isUnlocked = unlockedStatuses.includes(collab.status);
        const data: any = { ...collab };

        // Internal EVOC admin moderation notes are strictly confidential
        delete data.evocReviewNotes;

        if (!isUnlocked) {
          data.draftVideoUrl = null;
          data.draftStatusNotice = 'Creator submitted draft — Under EVOC Quality Review';
        }

        // Attach pre-formatted Meta Ads UTM campaign link for delivered assets
        if (collab.status === CollabStatus.ASSET_DELIVERED || collab.status === CollabStatus.CAMPAIGN_ACTIVE || collab.status === CollabStatus.COMPLETED) {
          const brandDomain = merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
          data.metaAdsUtmLink = `https://${brandDomain}.com/p?utm_content=${collab.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad`;
        }

        return data;
      });

      res.json({
        success: true,
        count: sanitizedCollabs.length,
        collabs: sanitizedCollabs
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch merchant collaborations feed' });
    }
  }
);

// ============================================================================
// 3. PATCH /api/collabs/:id/accept (Sprint Day 1: Creator accepts brief)
// ============================================================================
collabsRouter.patch(
  '/:id/accept',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const { id } = req.params;

      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      const collab = await prisma.collaborationRequest.findUnique({ where: { id } });
      if (!collab) {
        return res.status(404).json({ error: 'Collaboration request not found' });
      }

      // IDOR Protection: Verify caller is assigned to this brief
      if (collab.creatorId !== creator.id) {
        return res.status(403).json({ error: 'Forbidden: You are not assigned to this collaboration' });
      }

      // State machine guard: Can only accept from BRIEF_SUBMITTED or EVOC_APPROVED
      if (collab.status !== CollabStatus.BRIEF_SUBMITTED && collab.status !== CollabStatus.EVOC_APPROVED) {
        return res.status(400).json({
          error: `Cannot accept brief in status '${collab.status}'. Must be BRIEF_SUBMITTED.`
        });
      }

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: { status: CollabStatus.CREATOR_ACCEPTED }
      });

      res.json({
        success: true,
        message: 'Collaboration brief accepted! Waiting for merchant/EVOC logistics sample dispatch.',
        status: updated.status,
        collabId: updated.id
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to accept collaboration brief' });
    }
  }
);

// ============================================================================
// 4. PATCH /api/collabs/:id/decline (Sprint Day 1: Creator declines brief)
// ============================================================================
collabsRouter.patch(
  '/:id/decline',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const { id } = req.params;

      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      const collab = await prisma.collaborationRequest.findUnique({ where: { id } });
      if (!collab) {
        return res.status(404).json({ error: 'Collaboration request not found' });
      }

      // IDOR Protection
      if (collab.creatorId !== creator.id) {
        return res.status(403).json({ error: 'Forbidden: You are not assigned to this collaboration' });
      }

      // State machine guard: Cannot decline if already shooting/delivered
      if (
        collab.status === CollabStatus.ASSET_DELIVERED ||
        collab.status === CollabStatus.CAMPAIGN_ACTIVE ||
        collab.status === CollabStatus.COMPLETED
      ) {
        return res.status(400).json({ error: `Cannot decline collaboration in status '${collab.status}'.` });
      }

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: { status: CollabStatus.DECLINED }
      });

      res.json({
        success: true,
        message: 'Collaboration declined.',
        status: updated.status,
        collabId: updated.id
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to decline collaboration' });
    }
  }
);

// ============================================================================
// 5. PATCH /api/collabs/:id/sample-dispatched (Sprint Day 1: Logs courier & tracking)
// ============================================================================
collabsRouter.patch(
  '/:id/sample-dispatched',
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;
      const { courierName, trackingNumber, trackingUrl } = SampleDispatchedSchema.parse(req.body);

      const collab = await prisma.collaborationRequest.findUnique({ where: { id } });
      if (!collab) {
        return res.status(404).json({ error: 'Collaboration request not found' });
      }

      // Authorization Check: Must be Merchant Owner or Super Admin
      let isAuthorized = user.role === UserRole.SUPER_ADMIN;
      if (user.role === UserRole.MERCHANT) {
        const merchant = await prisma.merchantProfile.findUnique({ where: { userId: user.userId } });
        if (merchant && merchant.id === collab.merchantId) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: 'Forbidden: Only the merchant or EVOC Ops can dispatch samples' });
      }

      // State Machine Guard: Collab must be in CREATOR_ACCEPTED or BRIEF_SUBMITTED
      if (collab.status !== CollabStatus.CREATOR_ACCEPTED && collab.status !== CollabStatus.BRIEF_SUBMITTED) {
        return res.status(400).json({
          error: `Cannot dispatch sample while collab is in status '${collab.status}'. Creator must accept first.`
        });
      }

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: {
          status: CollabStatus.SAMPLE_DISPATCHED,
          courierName,
          trackingNumber,
          trackingUrl: trackingUrl || null,
          sampleDispatchedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Product sample dispatched! Tracking details logged for creator.',
        status: updated.status,
        courierName: updated.courierName,
        trackingNumber: updated.trackingNumber,
        trackingUrl: updated.trackingUrl
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to record sample dispatch' });
    }
  }
);

// ============================================================================
// 6. POST /api/collabs/:id/draft (Creator uploads private draft video)
// ============================================================================
collabsRouter.post(
  '/:id/draft',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { draftVideoUrl } = SubmitDraftSchema.parse(req.body);

      // 1. Identify authenticated creator
      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      // 2. Fetch collaboration
      const collab = await prisma.collaborationRequest.findUnique({
        where: { id }
      });

      if (!collab) {
        return res.status(404).json({ error: 'Collaboration request not found' });
      }

      // 3. IDOR Protection: Verify caller is the creator assigned to this brief
      if (collab.creatorId !== creator.id) {
        return res.status(403).json({ error: 'Forbidden: You are not assigned to this collaboration' });
      }

      // 4. State Machine Guard: Only allow upload from valid draft states
      const allowedUploadStates = (
        [
          CollabStatus.BRIEF_SUBMITTED,
          CollabStatus.CREATOR_ACCEPTED,
          CollabStatus.SAMPLE_DISPATCHED,
          CollabStatus.DRAFT_REVISION_REQUESTED
        ] as CollabStatus[]
      );

      if (!allowedUploadStates.includes(collab.status)) {
        return res.status(400).json({
          error: `Cannot upload draft: Collaboration is in status '${collab.status}'. Draft upload is only allowed when status is BRIEF_SUBMITTED, CREATOR_ACCEPTED, SAMPLE_DISPATCHED, or DRAFT_REVISION_REQUESTED.`
        });
      }

      // 5. Update draft and transition to DRAFT_PENDING_EVOC (100% PRIVATE)
      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: {
          draftVideoUrl,
          status: CollabStatus.DRAFT_PENDING_EVOC
        }
      });

      // Dispatch async notification to EVOC Ops (fire-and-forget)
      dispatchDraftUploaded({
        collabId: updated.id,
        creatorId: creator.id,
        draftVideoUrl
      }).catch((err) => console.error('[Queue] dispatchDraftUploaded failed:', err.message));

      res.status(200).json({
        message: 'Draft video uploaded successfully. Status: DRAFT_PENDING_EVOC (100% PRIVATE — Under EVOC Ops Quality Review).',
        collabId: updated.id,
        status: updated.status
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to submit draft' });
    }
  }
);

// ============================================================================
// 2b. GET /api/collabs/creator (Creator's Deals Feed for Kanban Board)
// ============================================================================
collabsRouter.get(
  '/creator',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      const collabs = await prisma.collaborationRequest.findMany({
        where: { creatorId: creator.id },
        include: {
          merchant: {
            select: { id: true, brandName: true, websiteUrl: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedDeals = collabs.map((collab) => ({
        id: collab.id,
        brandName: collab.merchant?.brandName || 'Brand Partner',
        productName: collab.productName,
        productPrice: Number(collab.productPrice),
        commissionPointsPerSale: collab.commissionPointsPerSale,
        deliverableType: collab.deliverableType,
        aspectRatio: collab.aspectRatio,
        status: collab.status,
        scriptGuidelines: collab.scriptGuidelines,
        videoHooks: collab.videoHooks,
        draftVideoUrl: collab.draftVideoUrl,
        courierTracking: collab.status === CollabStatus.SAMPLE_DISPATCHED ? 'Bluedart Express: BD-9948210-IN' : undefined,
        createdAt: collab.createdAt
      }));

      res.json({ deals: formattedDeals });
    } catch (err: any) {
      console.error('Failed to fetch creator deals:', err);
      res.status(500).json({ error: 'Failed to fetch creator deals feed' });
    }
  }
);

// ============================================================================
// 7. GET /api/collabs/:id (View collaboration with Private Draft Locking & IDOR protection)
// ============================================================================
collabsRouter.get(
  '/:id',
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const collab = await prisma.collaborationRequest.findUnique({
        where: { id },
        include: {
          merchant: {
            select: { id: true, brandName: true, websiteUrl: true }
          },
          creator: {
            select: { id: true, displayAlias: true, category: true, contentStyles: true }
          }
        }
      });

      if (!collab) {
        return res.status(404).json({ error: 'Collaboration request not found' });
      }

      // Tenant Authorization Check
      let isMerchantOwner = false;
      let isCreatorOwner = false;

      if (user.role === UserRole.MERCHANT) {
        const merchant = await prisma.merchantProfile.findUnique({ where: { userId: user.userId } });
        isMerchantOwner = !!merchant && merchant.id === collab.merchantId;
      } else if (user.role === UserRole.CREATOR) {
        const creator = await prisma.creatorProfile.findUnique({ where: { userId: user.userId } });
        isCreatorOwner = !!creator && creator.id === collab.creatorId;
      }

      const isAdmin = user.role === UserRole.SUPER_ADMIN;

      if (!isMerchantOwner && !isCreatorOwner && !isAdmin) {
        return res.status(404).json({ error: 'Collaboration request not found' }); // 404 prevents ID enumeration
      }

      // SECURITY RULE: Private Draft Locking
      const isUnlockedForMerchant = (
        [
          CollabStatus.DRAFT_PENDING_MERCHANT,
          CollabStatus.ASSET_DELIVERED,
          CollabStatus.CAMPAIGN_ACTIVE,
          CollabStatus.COMPLETED
        ] as CollabStatus[]
      ).includes(collab.status);

      const responseData: any = { ...collab };

      if (isMerchantOwner && !isUnlockedForMerchant) {
        responseData.draftVideoUrl = null;
        responseData.draftStatusNotice = 'Creator submitted draft — Under EVOC Quality Review';
      }

      // SECURITY RULE: Internal Admin Notes Privacy
      if (!isAdmin) {
        delete responseData.evocReviewNotes;
      }

      // Attach Asset Handoff details for delivered assets
      if (collab.status === CollabStatus.ASSET_DELIVERED || collab.status === CollabStatus.CAMPAIGN_ACTIVE || collab.status === CollabStatus.COMPLETED) {
        const brandDomain = collab.merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
        responseData.metaAdsUtmLink = `https://${brandDomain}.com/p?utm_content=${collab.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad`;
      }

      res.json({ collab: responseData });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch collaboration details' });
    }
  }
);

// ============================================================================
// 8. PATCH /api/collabs/:id/evoc-review (Stage 1: EVOC Ops approves video draft)
// ============================================================================
collabsRouter.patch(
  '/:id/evoc-review',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  antiLeakScan(['notes']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { approved, notes } = EvocReviewSchema.parse(req.body);

      const collab = await prisma.collaborationRequest.findUnique({ where: { id } });
      if (!collab) {
        return res.status(404).json({ error: 'Collaboration request not found' });
      }

      // State Machine Guard: Collab must be in DRAFT_PENDING_EVOC
      if (collab.status !== CollabStatus.DRAFT_PENDING_EVOC) {
        return res.status(400).json({
          error: `Invalid state transition: Cannot review collab in status '${collab.status}'. Must be DRAFT_PENDING_EVOC.`
        });
      }

      const nextStatus = approved
        ? CollabStatus.DRAFT_PENDING_MERCHANT          // Unlocks privately for Merchant review
        : CollabStatus.DRAFT_REVISION_REQUESTED;       // Creator must fix & re-upload

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          evocReviewNotes: notes
        }
      });

      res.json({
        message: approved
          ? 'EVOC Quality Review passed! Draft unlocked privately for Merchant review.'
          : 'EVOC Review completed. Changes requested from creator — status set to DRAFT_REVISION_REQUESTED.',
        status: updated.status
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update EVOC review status' });
    }
  }
);

// ============================================================================
// 9. PATCH /api/collabs/:id/merchant-approval (Stage 2: Merchant gives final approval & Asset Handoff)
// ============================================================================
collabsRouter.patch(
  '/:id/merchant-approval',
  requireAuth,
  requireRole(UserRole.MERCHANT),
  antiLeakScan(['notes']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { approved, notes } = MerchantApprovalSchema.parse(req.body);

      // 1. Identify authenticated merchant
      const merchant = await prisma.merchantProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!merchant) {
        return res.status(404).json({ error: 'Merchant profile not found' });
      }

      // 2. Fetch collaboration
      const collab = await prisma.collaborationRequest.findUnique({ where: { id } });
      if (!collab) {
        return res.status(404).json({ error: 'Collaboration request not found' });
      }

      // 3. IDOR Protection: Caller must own this collaboration
      if (collab.merchantId !== merchant.id) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to approve this collaboration' });
      }

      // 4. State Machine Guard: Collab must be in DRAFT_PENDING_MERCHANT
      if (collab.status !== CollabStatus.DRAFT_PENDING_MERCHANT) {
        return res.status(400).json({
          error: `Invalid state transition: Cannot approve draft while in status '${collab.status}'. Must be cleared by EVOC Ops first (DRAFT_PENDING_MERCHANT).`
        });
      }

      // 5. Update Status & Generate Asset Handoff
      const nextStatus = approved ? CollabStatus.ASSET_DELIVERED : CollabStatus.DRAFT_PENDING_MERCHANT;
      const approvedVideoUrl = approved ? (collab.draftVideoUrl || `https://assets.evoclabs.com/approved/${collab.id}.mp4`) : null;

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          merchantReviewNotes: notes,
          ...(approved ? { approvedVideoUrl } : {})
        }
      });

      const brandDomain = merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const metaAdsUtmLink = `https://${brandDomain}.com/p?utm_content=${updated.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad`;

      // Dispatch async notifications on approval (fire-and-forget)
      if (approved) {
        dispatchAssetApproved({
          collabId: updated.id,
          merchantId: merchant.id,
          creatorId: collab.creatorId,
          approvedVideoUrl: approvedVideoUrl ?? '',
          utmTrackingSlug: updated.utmTrackingSlug ?? undefined
        }).catch((err) => console.error('[Queue] dispatchAssetApproved failed:', err.message));
      }

      res.json({
        message: approved
          ? 'Final approval recorded! High-res asset delivered and Meta Ads UTM link generated.'
          : 'Merchant feedback recorded. Collab remains pending merchant review.',
        status: updated.status,
        downloadableAssetUrl: updated.approvedVideoUrl,
        utmTrackingLink: metaAdsUtmLink,
        metaAdsCampaignLink: metaAdsUtmLink
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to process merchant approval' });
    }
  }
);
