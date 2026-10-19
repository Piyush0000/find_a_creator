import { Router } from 'express';
import { prisma, CollabStatus, UserRole } from '@evoc/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { antiLeakScan } from '../middleware/antiLeak.js';
import { CreateCollabBriefSchema } from '@evoc/types';

export const collabsRouter = Router();

// POST /api/collabs (Merchant submits a brief with script)
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

// PATCH /api/collabs/:id/evoc-review (Stage 1: EVOC Ops approves video draft)
collabsRouter.patch(
  '/:id/evoc-review',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { approved, notes } = req.body;

      const nextStatus = approved
        ? CollabStatus.DRAFT_PENDING_MERCHANT // Unlocks privately for Merchant review
        : CollabStatus.DRAFT_PENDING_EVOC;

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          evocReviewNotes: notes
        }
      });

      res.json({ message: 'EVOC Review completed', status: updated.status });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update review status' });
    }
  }
);

// PATCH /api/collabs/:id/merchant-approval (Stage 2: Merchant gives final approval)
collabsRouter.patch(
  '/:id/merchant-approval',
  requireAuth,
  requireRole(UserRole.MERCHANT),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { approved, notes } = req.body;

      const updated = await prisma.collaborationRequest.update({
        where: { id },
        data: {
          status: approved ? CollabStatus.ASSET_DELIVERED : CollabStatus.DRAFT_PENDING_MERCHANT,
          merchantReviewNotes: notes
        }
      });

      res.json({
        message: 'Final approval recorded. Ad video asset unlocked for merchant campaigns.',
        status: updated.status,
        utmTrackingLink: `https://brand.com/p?utm_content=${updated.utmTrackingSlug}`
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to process merchant approval' });
    }
  }
);
