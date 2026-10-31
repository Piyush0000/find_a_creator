import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma, CollabStatus, UserRole } from '@evoc/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { antiLeakScan } from '../middleware/antiLeak.js';
import { CreateCollabBriefSchema, EvocReviewSchema, REVIEW_REJECTION_TAGS } from '@evoc/types';
import {
  dispatchBriefSubmitted,
  dispatchDraftUploaded,
  dispatchAssetApproved,
  dispatchDraftRevisionRequested,
  dispatchCreatorAccepted,
  dispatchBriefDeclined
} from '../queues/dispatcher.js';

export const collabsRouter = Router();

// ============================================================================
// DTO Schemas for Collab Lifecycle
// ============================================================================
const SubmitDraftSchema = z.object({
  draftVideoUrl: z.string().url('A valid video URL is required')
});

const MerchantApprovalSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional()
});

const DeclineBriefSchema = z.object({
  reason: z.string().optional()
});

// ============================================================================
// 1. POST /api/collabs (Merchant submits a new Video Ad Brief)
// ============================================================================
collabsRouter.post(
  '/',
  requireAuth,
  requireRole(UserRole.MERCHANT),
  antiLeakScan(['productName', 'scriptGuidelines', 'videoHooks']),
  async (req, res) => {
    try {
      const validated = CreateCollabBriefSchema.parse(req.body);

      // Verify authenticated merchant profile
      const merchant = await prisma.merchantProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!merchant) {
        return res.status(401).json({ error: 'Merchant profile not found or session expired' });
      }

      // Verify targeted creator exists
      const creator = await prisma.creatorProfile.findUnique({
        where: { id: validated.creatorId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator not found' });
      }

      // Generate unique high-entropy UTM tracking slug (e.g. evoc_tarayu_8f3a9e2d1c4b)
      const uniqueEntropy = crypto.randomBytes(6).toString('hex');
      const cleanBrand = merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const utmTrackingSlug = `evoc_${cleanBrand}_${uniqueEntropy}`;

      // Create collaboration in BRIEF_SUBMITTED status
      const collab = await prisma.collaborationRequest.create({
        data: {
          merchantId: merchant.id,
          creatorId: validated.creatorId,
          productName: validated.productName,
          productPrice: validated.productPrice,
          productUrl: validated.productUrl,
          scriptGuidelines: validated.scriptGuidelines,
          videoHooks: validated.videoHooks,
          aspectRatio: validated.aspectRatio,
          deliverableType: validated.deliverableType,
          commissionPointsPerSale: validated.commissionPointsPerSale,
          status: CollabStatus.BRIEF_SUBMITTED,
          utmTrackingSlug
        }
      });

      // Dispatch non-blocking BullMQ notifications
      dispatchBriefSubmitted({
        collabId: collab.id,
        creatorId: creator.id,
        merchantId: merchant.id,
        productName: collab.productName
      }).catch((err) => console.error('[Queue] dispatchBriefSubmitted failed:', err.message));

      res.status(201).json({
        message: 'Collaboration brief submitted successfully! Dispatched to Creator and EVOC Ops.',
        collabId: collab.id,
        utmTrackingSlug: collab.utmTrackingSlug,
        status: collab.status
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.flatten().fieldErrors });
      }
      res.status(500).json({ error: err.message || 'Failed to create collaboration brief' });
    }
  }
);

// ============================================================================
// 2. GET /api/collabs/merchant (Merchant Collaborations Feed with Stage 1 Video Masking)
// Supports optional query: ?tab=active | in_review | delivered
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
        return res.status(401).json({ error: 'Merchant profile not found or session expired' });
      }

      const { tab } = req.query;

      // Filter mapping based on Tab
      const whereClause: any = { merchantId: merchant.id };

      if (tab === 'active') {
        whereClause.status = {
          in: [
            CollabStatus.BRIEF_SUBMITTED,
            CollabStatus.EVOC_APPROVED,
            CollabStatus.CREATOR_ACCEPTED
          ]
        };
      } else if (tab === 'in_review') {
        whereClause.status = {
          in: [
            CollabStatus.DRAFT_PENDING_EVOC,
            CollabStatus.DRAFT_PENDING_MERCHANT,
            CollabStatus.DRAFT_REVISION_REQUESTED
          ]
        };
      } else if (tab === 'delivered') {
        whereClause.status = {
          in: [
            CollabStatus.ASSET_DELIVERED,
            CollabStatus.CAMPAIGN_ACTIVE,
            CollabStatus.COMPLETED
          ]
        };
      }

      // Query merchant collabs
      const collabs = await prisma.collaborationRequest.findMany({
        where: whereClause,
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
      const unlockedStatuses: CollabStatus[] = [
        CollabStatus.DRAFT_PENDING_MERCHANT,
        CollabStatus.ASSET_DELIVERED,
        CollabStatus.CAMPAIGN_ACTIVE,
        CollabStatus.COMPLETED
      ];

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
        if (
          collab.status === CollabStatus.ASSET_DELIVERED ||
          collab.status === CollabStatus.CAMPAIGN_ACTIVE ||
          collab.status === CollabStatus.COMPLETED
        ) {
          const brandDomain = merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const baseUrl = collab.productUrl || `https://${brandDomain}.com/p`;
          const joinChar = baseUrl.includes('?') ? '&' : '?';
          data.metaAdsUtmLink = `${baseUrl}${joinChar}utm_content=${collab.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad`;
        }

        return data;
      });

      res.json({
        success: true,
        count: sanitizedCollabs.length,
        filterTab: tab || 'all',
        collabs: sanitizedCollabs
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch merchant collaborations feed' });
    }
  }
);

// ============================================================================
// 2B. GET /api/collabs/admin/pending-review (EVOC Ops Review Queue API)
// Super Admin queries all unapproved draft videos (FIFO)
// ============================================================================
collabsRouter.get(
  '/admin/pending-review',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res) => {
    try {
      // Queries all collaborations with status DRAFT_PENDING_EVOC (FIFO order)
      const pendingCollabs = await prisma.collaborationRequest.findMany({
        where: {
          status: CollabStatus.DRAFT_PENDING_EVOC
        },
        include: {
          creator: {
            select: {
              id: true,
              displayAlias: true,
              category: true,
              contentStyles: true
            }
          },
          merchant: {
            select: {
              id: true,
              brandName: true
            }
          }
        },
        orderBy: {
          updatedAt: 'asc' // FIFO: Oldest draft first for rapid EVOC Ops turnaround
        }
      });

      const formattedQueue = pendingCollabs.map((collab) => ({
        id: collab.id,
        collabId: collab.id,
        creatorAlias: collab.creator.displayAlias,
        creatorId: collab.creator.id,
        creatorCategory: collab.creator.category,
        productName: collab.productName,
        aspectRatio: collab.aspectRatio,
        scriptGuidelines: collab.scriptGuidelines,
        videoHooks: collab.videoHooks,
        draftVideoUrl: collab.draftVideoUrl, // Private Cloudflare R2 video URL
        status: collab.status,
        submittedAt: collab.updatedAt,
        merchantBrand: collab.merchant.brandName
      }));

      res.json({
        success: true,
        count: formattedQueue.length,
        queue: formattedQueue
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch EVOC Ops review queue' });
    }
  }
);

// ============================================================================
// 2C. GET /api/collabs/creator (Creator Deals Kanban Feed)
// Queries all collaborations assigned to the authenticated creator.
// Uses composite index @@index([creatorId, status]) for high performance.
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
        return res.status(401).json({ error: 'Creator profile not found or session expired' });
      }

      const { status } = req.query;
      const whereClause: any = { creatorId: creator.id };
      if (status && typeof status === 'string') {
        whereClause.status = status as CollabStatus;
      }

      const collabs = await prisma.collaborationRequest.findMany({
        where: whereClause,
        include: {
          merchant: {
            select: {
              id: true,
              brandName: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      const deals = collabs.map((collab) => ({
        id: collab.id,
        collabId: collab.id,
        brandName: collab.merchant.brandName,
        productName: collab.productName,
        productPrice: Number(collab.productPrice),
        commissionPointsPerSale: collab.commissionPointsPerSale,
        deliverableType: collab.deliverableType,
        aspectRatio: collab.aspectRatio,
        status: collab.status,
        scriptGuidelines: collab.scriptGuidelines,
        videoHooks: collab.videoHooks,
        draftVideoUrl: collab.draftVideoUrl,
        evocReviewNotes: collab.evocReviewNotes,
        merchantReviewNotes: collab.merchantReviewNotes,
        approvedVideoUrl: collab.approvedVideoUrl,
        utmTrackingSlug: collab.utmTrackingSlug,
        createdAt: collab.createdAt,
        updatedAt: collab.updatedAt
      }));

      res.json({
        success: true,
        count: deals.length,
        deals
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch creator deals feed' });
    }
  }
);

// ============================================================================
// 3. PATCH /api/collabs/:id/accept (Creator accepts brief)
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
        return res.status(401).json({ error: 'Creator profile not found or session expired' });
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

      // Dispatch non-blocking notification
      dispatchCreatorAccepted({
        collabId: updated.id,
        creatorId: creator.id,
        merchantId: collab.merchantId,
        productName: collab.productName
      }).catch((err) => console.error('[Queue] dispatchCreatorAccepted failed:', err.message));

      res.json({
        success: true,
        message: 'Collaboration brief accepted! You can now produce and submit your video draft.',
        status: updated.status,
        collabId: updated.id
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to accept collaboration brief' });
    }
  }
);

// ============================================================================
// 4. PATCH /api/collabs/:id/decline (Creator declines brief, accepts optional reason)
// ============================================================================
collabsRouter.patch(
  '/:id/decline',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = DeclineBriefSchema.parse(req.body || {});

      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(401).json({ error: 'Creator profile not found or session expired' });
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

      // Dispatch non-blocking notification
      dispatchBriefDeclined({
        collabId: updated.id,
        creatorId: creator.id,
        merchantId: collab.merchantId,
        reason: reason || undefined
      }).catch((err) => console.error('[Queue] dispatchBriefDeclined failed:', err.message));

      res.json({
        success: true,
        message: 'Collaboration declined.',
        status: updated.status,
        collabId: updated.id,
        reason: reason || null
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to decline collaboration' });
    }
  }
);

// ============================================================================
// 5. POST /api/collabs/:id/draft (Creator uploads private draft video)
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
        return res.status(401).json({ error: 'Creator profile not found or session expired' });
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
      const allowedUploadStates: CollabStatus[] = [
        CollabStatus.BRIEF_SUBMITTED,
        CollabStatus.CREATOR_ACCEPTED,
        CollabStatus.DRAFT_REVISION_REQUESTED
      ];

      if (!allowedUploadStates.includes(collab.status)) {
        return res.status(400).json({
          error: `Cannot upload draft: Collaboration is in status '${collab.status}'. Draft upload is only allowed when status is BRIEF_SUBMITTED, CREATOR_ACCEPTED, or DRAFT_REVISION_REQUESTED.`
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
// 2b. GET /api/collabs/creator (Creator Deals Feed for Kanban Board)
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
        return res.status(401).json({ error: 'Creator profile not found or session expired' });
      }

      const collabs = await prisma.collaborationRequest.findMany({
        where: { creatorId: creator.id },
        include: {
          merchant: {
            select: { id: true, brandName: true }
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
        // Revision feedback from EVOC Ops is shared only when a re-shoot is requested
        revisionNotes:
          collab.status === CollabStatus.DRAFT_REVISION_REQUESTED ? collab.evocReviewNotes : undefined,
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
// 2c. GET /api/collabs/admin (Admin Moderation Queue)
// ============================================================================
collabsRouter.get(
  '/admin',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res) => {
    try {
      const collabs = await prisma.collaborationRequest.findMany({
        include: {
          merchant: {
            select: { id: true, brandName: true }
          },
          creator: {
            select: { id: true, displayAlias: true, category: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ collabs });
    } catch (err: any) {
      console.error('Failed to fetch admin moderation collabs:', err);
      res.status(500).json({ error: 'Failed to fetch admin moderation queue' });
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
            select: { id: true, brandName: true }
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

      // SECURITY RULE: Internal Admin Notes & Product URL Privacy
      if (!isAdmin) {
        delete responseData.evocReviewNotes;
      }
      if (isCreatorOwner) {
        delete (responseData as any).productUrl;
      }

      // Attach Asset Handoff details for delivered assets
      if (collab.status === CollabStatus.ASSET_DELIVERED || collab.status === CollabStatus.CAMPAIGN_ACTIVE || collab.status === CollabStatus.COMPLETED) {
        const brandDomain = collab.merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const baseUrl = collab.productUrl || `https://${brandDomain}.com/p`;
        const joinChar = baseUrl.includes('?') ? '&' : '?';
        responseData.metaAdsUtmLink = `${baseUrl}${joinChar}utm_content=${collab.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad`;
      }

      res.json({ collab: responseData });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch collaboration details' });
    }
  }
);

// ============================================================================
// 8. PATCH /api/collabs/:id/evoc-review (Stage 1: EVOC Ops approves/rejects video draft)
// Supports optional structured rejection tags: ['POOR_AUDIO', 'WEAK_HOOK', 'OFF_SCRIPT', 'PII_LEAK', 'BAD_LIGHTING']
// ============================================================================
collabsRouter.patch(
  '/:id/evoc-review',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  antiLeakScan(['notes']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { approved, notes, rejectionTags } = EvocReviewSchema.parse(req.body);

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

      // If approved: false, format notes with structured tags for creator clarity
      let reviewNotes = notes?.trim() || '';
      if (!approved && rejectionTags && rejectionTags.length > 0) {
        const tagSummary = `[REVISION_TAGS: ${rejectionTags.join(', ')}]`;
        reviewNotes = reviewNotes ? `${tagSummary} ${reviewNotes}` : tagSummary;
      }

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          evocReviewNotes: reviewNotes || (approved ? 'Approved by EVOC Ops QC' : 'Revisions requested')
        }
      });

      if (!approved) {
        dispatchDraftRevisionRequested({
          collabId: collab.id,
          creatorId: collab.creatorId,
          revisionReason: rejectionTags && rejectionTags.length > 0 ? rejectionTags.join(', ') : 'EVOC Quality Control Review',
          reviewNotes: reviewNotes
        }).catch((err) => console.error('[Queue] dispatchDraftRevisionRequested failed:', err.message));
      }

      res.json({
        success: true,
        message: approved
          ? 'EVOC Quality Review passed! Draft unlocked privately for Merchant review.'
          : 'EVOC Review completed. Changes requested from creator — status set to DRAFT_REVISION_REQUESTED.',
        status: updated.status,
        collabId: updated.id,
        rejectionTags: rejectionTags || [],
        evocReviewNotes: updated.evocReviewNotes
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.flatten().fieldErrors });
      }
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
        return res.status(401).json({ error: 'Merchant profile not found or session expired' });
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
      const nextStatus = approved ? CollabStatus.ASSET_DELIVERED : CollabStatus.DRAFT_REVISION_REQUESTED;
      const approvedVideoUrl = approved ? (collab.draftVideoUrl || null) : null;

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          merchantReviewNotes: notes,
          ...(approved ? { approvedVideoUrl } : {})
        }
      });

      const brandDomain = merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const baseUrl = updated.productUrl || `https://${brandDomain}.com/p`;
      const joinChar = baseUrl.includes('?') ? '&' : '?';
      const metaAdsUtmLink = `${baseUrl}${joinChar}utm_content=${updated.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad`;

      // Dispatch async notifications on approval or correction request (fire-and-forget)
      if (approved) {
        dispatchAssetApproved({
          collabId: updated.id,
          merchantId: merchant.id,
          creatorId: collab.creatorId,
          approvedVideoUrl: approvedVideoUrl ?? '',
          utmTrackingSlug: updated.utmTrackingSlug ?? undefined
        }).catch((err) => console.error('[Queue] dispatchAssetApproved failed:', err.message));
      } else {
        dispatchDraftRevisionRequested({
          collabId: updated.id,
          creatorId: collab.creatorId,
          revisionReason: 'Merchant Correction Request',
          reviewNotes: notes || 'Merchant requested adjustments on the submitted video.'
        }).catch((err) => console.error('[Queue] dispatchDraftRevisionRequested failed:', err.message));
      }

      res.json({
        message: approved
          ? 'Final approval recorded! High-res asset delivered and Meta Ads UTM link generated.'
          : 'Corrections requested. Collaboration moved to DRAFT_REVISION_REQUESTED for creator fixes.',
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

// ============================================================================
// 10. GET /api/collabs/:id/asset-handoff (Turnkey high-res MP4 download & Meta Ads UTM link)
// ============================================================================
collabsRouter.get(
  '/:id/asset-handoff',
  requireAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const collab = await prisma.collaborationRequest.findUnique({
        where: { id },
        include: { merchant: true, creator: true }
      });

      if (!collab) {
        return res.status(404).json({ error: 'Collaboration request not found' });
      }

      // Must be merchant owner, creator assigned, or super admin
      if (user.role === UserRole.MERCHANT) {
        const merchant = await prisma.merchantProfile.findUnique({ where: { userId: user.userId } });
        if (!merchant || merchant.id !== collab.merchantId) {
          return res.status(403).json({ error: 'Forbidden: Access restricted to collaboration owner' });
        }
      } else if (user.role === UserRole.CREATOR) {
        const creator = await prisma.creatorProfile.findUnique({ where: { userId: user.userId } });
        if (!creator || creator.id !== collab.creatorId) {
          return res.status(403).json({ error: 'Forbidden: You are not assigned to this collaboration' });
        }
      }

      const deliveredStatuses: CollabStatus[] = [
        CollabStatus.ASSET_DELIVERED,
        CollabStatus.CAMPAIGN_ACTIVE,
        CollabStatus.COMPLETED
      ];

      if (!deliveredStatuses.includes(collab.status)) {
        return res.status(400).json({
          error: `Asset handoff not available in status '${collab.status}'. Asset must be approved (ASSET_DELIVERED).`
        });
      }

      const brandDomain = collab.merchant.brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const baseUrl = collab.productUrl || `https://${brandDomain}.com/p`;
      const joinChar = baseUrl.includes('?') ? '&' : '?';
      const metaAdsUtmLink = `${baseUrl}${joinChar}utm_content=${collab.utmTrackingSlug}&utm_source=meta&utm_medium=ugc_ad`;
      const downloadableAssetUrl = collab.approvedVideoUrl || collab.draftVideoUrl;
      if (!downloadableAssetUrl) {
        return res.status(404).json({ error: 'No video asset found for this collaboration' });
      }

      res.json({
        success: true,
        collabId: collab.id,
        status: collab.status,
        downloadableAssetUrl,
        metaAdsUtmLink,
        utmTrackingSlug: collab.utmTrackingSlug
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch asset handoff' });
    }
  }
);
