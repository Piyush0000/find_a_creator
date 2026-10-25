import { Router } from 'express';
import { z } from 'zod';
import { prisma, CollabStatus, UserRole } from '@evoc/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { antiLeakScan } from '../middleware/antiLeak.js';
import { CreateCollabBriefSchema } from '@evoc/types';

export const collabsRouter = Router();

// ============================================================================
// DTO Schemas for Day 2 Endpoints
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
// 2. POST /api/collabs/:id/draft (Creator uploads private draft video)
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

      // 4. State Machine Guard: Only allow upload from valid states
      const allowedUploadStates = (
        [
          CollabStatus.BRIEF_SUBMITTED,
          CollabStatus.DRAFT_REVISION_REQUESTED
        ] as CollabStatus[]
      );

      if (!allowedUploadStates.includes(collab.status)) {
        return res.status(400).json({
          error: `Cannot upload draft: Collaboration is in status '${collab.status}'. Draft upload is only allowed when status is BRIEF_SUBMITTED or DRAFT_REVISION_REQUESTED.`
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
// 3. GET /api/collabs/:id (View collaboration with Private Draft Locking & IDOR protection)
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

      res.json({ collab: responseData });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch collaboration details' });
    }
  }
);

// ============================================================================
// 4. PATCH /api/collabs/:id/evoc-review (Stage 1: EVOC Ops approves video draft)
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
// 5. PATCH /api/collabs/:id/merchant-approval (Stage 2: Merchant gives final approval)
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

      const utmDestinationUrl = `https://${merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/p?utm_content=${updated.utmTrackingSlug}`;

      res.json({
        message: approved
          ? 'Final approval recorded! Ad video asset delivered and UTM tracking link activated.'
          : 'Merchant feedback recorded. Collab remains pending merchant review.',
        status: updated.status,
        downloadableAssetUrl: updated.approvedVideoUrl,
        utmTrackingLink: utmDestinationUrl
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to process merchant approval' });
    }
  }
);
