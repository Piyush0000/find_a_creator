import { Router } from 'express';
import { prisma } from '@evoc/database';

export const creatorsRouter = Router();

// GET /api/creators (Directory Search with Masked Data)
creatorsRouter.get('/', async (req, res) => {
  try {
    const { category, city, search } = req.query;

    const where: any = {};
    if (category) where.category = String(category);
    if (city) where.city = String(city);
    if (search) {
      where.OR = [
        { displayAlias: { contains: String(search), mode: 'insensitive' } },
        { bioSummary: { contains: String(search), mode: 'insensitive' } }
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
            viewsCount: true
          }
        },
        reviews: {
          select: {
            rating: true,
            reviewText: true
          }
        }
      }
    });

    res.json({ creators });
  } catch (error) {
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
        portfolioItems: true,
        reviews: true
        // NOTE: email, phoneNumber, upiId are STRICTLY EXCLUDED
      }
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    res.json({ creator });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch creator profile' });
  }
});
