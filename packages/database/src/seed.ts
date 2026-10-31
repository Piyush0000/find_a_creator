import 'dotenv/config';
import { PrismaClient, UserRole, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding EVOC Creator Network database...');

  // 1. Create Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@evoclabs.com' },
    update: {},
    create: {
      email: 'admin@evoclabs.com',
      phoneNumber: '9999999999',
      passwordHash: '$2b$10$77M1jBv1z3J3ZvVHSxju..DJYth8kSNJz.mz.E1Hg7XPLSDW5i/QC', // Password123!
      role: UserRole.SUPER_ADMIN,
      isVerified: true
    }
  });

  // 2. Create Sample Merchant
  const merchantUser = await prisma.user.upsert({
    where: { email: 'founder@glowskincare.com' },
    update: {},
    create: {
      email: 'founder@glowskincare.com',
      phoneNumber: '9876543210',
      passwordHash: '$2b$10$77M1jBv1z3J3ZvVHSxju..DJYth8kSNJz.mz.E1Hg7XPLSDW5i/QC', // Password123!
      role: UserRole.MERCHANT,
      isVerified: true,
      merchantProfile: {
        create: {
          brandName: 'Glow Skincare D2C',
          subscriptionPlan: SubscriptionPlan.GROWTH,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }
    }
  });

  // 3. Create Sample Creators (with Masked Aliases)
  const creator1 = await prisma.user.upsert({
    where: { email: 'rohit.creator@evoc.internal' },
    update: {},
    create: {
      email: 'rohit.creator@evoc.internal',
      phoneNumber: '9123456780',
      passwordHash: '$2b$10$77M1jBv1z3J3ZvVHSxju..DJYth8kSNJz.mz.E1Hg7XPLSDW5i/QC', // Password123!
      role: UserRole.CREATOR,
      isVerified: true,
      creatorProfile: {
        create: {
          displayAlias: 'Rohit S. — Men\'s Grooming & Lifestyle',
          category: 'Grooming',
          city: 'Mumbai',
          contentStyles: ['Unboxing', 'Routine Breakdown', 'Problem-Solution Hook'],
          bioSummary: 'Creates crisp, high-converting vertical ad reels for skincare and grooming D2C brands.',
          pointsBalance: 450,
          portfolioItems: {
            create: [
              {
                videoUrl: 'https://assets.evoclabs.com/sample_reel_1.mp4',
                thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600',
                caption: 'Face wash ad converting at 3.8% ROAS on Meta',
                aspectRatio: '9:16',
                viewsCount: 42000
              }
            ]
          }
        }
      }
    }
  });

  const creator2 = await prisma.user.upsert({
    where: { email: 'priya.creator@evoc.internal' },
    update: {},
    create: {
      email: 'priya.creator@evoc.internal',
      phoneNumber: '9123456781',
      passwordHash: '$2b$10$77M1jBv1z3J3ZvVHSxju..DJYth8kSNJz.mz.E1Hg7XPLSDW5i/QC', // Password123!
      role: UserRole.CREATOR,
      isVerified: true,
      creatorProfile: {
        create: {
          displayAlias: 'Kavita R. — Skincare & Organic Wellness',
          category: 'Beauty',
          city: 'Bangalore',
          contentStyles: ['Before & After Demo', 'Aesthetic Unboxing', 'Ingredients Focus'],
          bioSummary: 'Specializes in high-energy aesthetic reels with authentic product reviews.',
          pointsBalance: 1200,
          portfolioItems: {
            create: [
              {
                videoUrl: 'https://assets.evoclabs.com/sample_reel_2.mp4',
                thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600',
                caption: 'Hydration serum review - 50k views',
                aspectRatio: '9:16',
                viewsCount: 51200
              }
            ]
          }
        }
      }
    }
  });

  console.log('✅ Seed completed successfully: SuperAdmin, Merchant, and 2 Creators created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
