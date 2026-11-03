import { Router } from 'express';
import { prisma, UserRole } from '@evoc/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { PointsService } from '../services/points.service.js';
import { UpdateCreatorProfileSchema, CreatePortfolioItemSchema } from '@evoc/types';

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
        avatarUrl: true,
        pointsBalance: true,
        portfolioItems: {
          take: 20,
          orderBy: { createdAt: 'desc' },
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

// GET /api/creators/me/profile (Authenticated Creator's Own Profile)
creatorsRouter.get(
  '/me/profile',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId },
        include: {
          portfolioItems: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      res.json({ creator });
    } catch (error) {
      console.error('Error fetching creator profile:', error);
      res.status(500).json({ error: 'Failed to fetch creator profile' });
    }
  }
);

// PUT /api/creators/me/profile (Update Profile Info & Avatar)
creatorsRouter.put(
  '/me/profile',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const parseResult = UpdateCreatorProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors
        });
      }

      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      const data = parseResult.data;
      const updated = await prisma.creatorProfile.update({
        where: { id: creator.id },
        data: {
          ...(data.displayAlias !== undefined ? { displayAlias: data.displayAlias } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.bioSummary !== undefined ? { bioSummary: data.bioSummary } : {}),
          ...(data.contentStyles !== undefined ? { contentStyles: data.contentStyles } : {}),
          ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {})
        },
        include: {
          portfolioItems: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      res.json({ message: 'Profile updated successfully', creator: updated });
    } catch (error) {
      console.error('Error updating creator profile:', error);
      res.status(500).json({ error: 'Failed to update creator profile' });
    }
  }
);

// POST /api/creators/me/portfolio (Upload / Add Preview Video to Portfolio)
creatorsRouter.post(
  '/me/portfolio',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const parseResult = CreatePortfolioItemSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors
        });
      }

      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      const { videoUrl, caption, thumbnailUrl, aspectRatio } = parseResult.data;

      const item = await prisma.creatorPortfolioItem.create({
        data: {
          creatorId: creator.id,
          videoUrl,
          caption: caption || null,
          thumbnailUrl: thumbnailUrl || null,
          aspectRatio: aspectRatio || '9:16'
        }
      });

      res.status(201).json({ message: 'Portfolio video added successfully', item });
    } catch (error) {
      console.error('Error adding portfolio item:', error);
      res.status(500).json({ error: 'Failed to add portfolio item' });
    }
  }
);

// DELETE /api/creators/me/portfolio/:itemId (Remove a Portfolio Video)
creatorsRouter.delete(
  '/me/portfolio/:itemId',
  requireAuth,
  requireRole(UserRole.CREATOR),
  async (req, res) => {
    try {
      const { itemId } = req.params;

      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: req.user!.userId }
      });

      if (!creator) {
        return res.status(404).json({ error: 'Creator profile not found' });
      }

      const item = await prisma.creatorPortfolioItem.findUnique({
        where: { id: itemId }
      });

      if (!item || item.creatorId !== creator.id) {
        return res.status(404).json({ error: 'Portfolio item not found or unauthorized' });
      }

      await prisma.creatorPortfolioItem.delete({
        where: { id: itemId }
      });

      res.json({ message: 'Portfolio video removed successfully' });
    } catch (error) {
      console.error('Error deleting portfolio item:', error);
      res.status(500).json({ error: 'Failed to delete portfolio item' });
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
        avatarUrl: true,
        portfolioItems: {
          orderBy: { createdAt: 'desc' },
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
