import { Router } from 'express';
import { prisma, UserRole } from '@evoc/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { PointsService } from '../services/points.service.js';

export const creatorsRouter = Router();

// GET /api/creators (Directory Search with Masked Data & Zero PII)
creatorsRouter.get('/', async (req, res) => {
  try {
    const { category, city, search } = req.query;

    const where: any = {};
    if (category) {
      where.category = { equals: String(category), mode: 'insensitive' };
    }
    if (city) {
      where.city = { equals: String(city), mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { displayAlias: { contains: String(search), mode: 'insensitive' } },
        { bioSummary: { contains: String(search), mode: 'insensitive' } },
        { category: { contains: String(search), mode: 'insensitive' } }
      ];
    }

    const creators = await prisma.creatorProfile.findMany({
      where,
      select: {
        id: true,
        displayAlias: true,
        category: true,
        city: true,
        contentStyles: true,
        bioSummary: true,
        pointsBalance: true,
        portfolioItems: {
          take: 3,
          select: {
            id: true,
            videoUrl: true,
            thumbnailUrl: true,
            caption: true,
            viewsCount: true,
            aspectRatio: true
          }
        },
        reviews: {
          select: {
            rating: true,
            reviewText: true
          }
        }
        // STRICT PRIVACY POLICY ("Upwork Guard"):
        // user relation (email, phoneNumber, passwordHash) and upiIdEncrypted are NEVER selected.
      }
    });

    res.json({ creators });
  } catch (error) {
    console.error('Error fetching creator directory:', error);
    res.status(500).json({ error: 'Failed to fetch creator directory' });
  }
});

// GET /api/creators/me/points (Authenticated Creator Points Balance Breakdown)
creatorsRouter.get(
  '/me/points',
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

      const summary = await PointsService.getCreatorPointsSummary(creator.id);

      res.json({
        creatorId: creator.id,
        displayAlias: creator.displayAlias,
        ...summary
      });
    } catch (error) {
      console.error('Error fetching creator points summary:', error);
      res.status(500).json({ error: 'Failed to fetch points summary' });
    }
  }
);

// GET /api/creators/me/ledger (Authenticated Creator Ledger Transaction History)
creatorsRouter.get(
  '/me/ledger',
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

      const rawLimit = parseInt(String(req.query.limit), 10);
      const limit = !Number.isNaN(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50;

      const rawOffset = parseInt(String(req.query.offset), 10);
      const offset = !Number.isNaN(rawOffset) ? Math.max(0, rawOffset) : 0;

      const ledger = await PointsService.getCreatorLedger(creator.id, limit, offset);

      res.json({
        creatorId: creator.id,
        ...ledger
      });
    } catch (error) {
      console.error('Error fetching creator ledger:', error);
      res.status(500).json({ error: 'Failed to fetch points ledger' });
    }
  }
);

// GET /api/creators/:id (Single Masked Creator Profile)
creatorsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const creator = await prisma.creatorProfile.findUnique({
      where: { id },
      select: {
        id: true,
        displayAlias: true,
        category: true,
        city: true,
        contentStyles: true,
        bioSummary: true,
        portfolioItems: {
          select: {
            id: true,
            videoUrl: true,
            thumbnailUrl: true,
            caption: true,
            viewsCount: true,
            aspectRatio: true
          }
        },
        reviews: {
          select: {
            rating: true,
            reviewText: true
          }
        }
        // STRICT PRIVACY POLICY: zero PII returned
      }
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    res.json({ creator });
  } catch (error) {
    console.error('Error fetching creator profile:', error);
    res.status(500).json({ error: 'Failed to fetch creator profile' });
  }
});
