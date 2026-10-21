import { Router } from 'express';
import { prisma } from '@evoc/database';

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
