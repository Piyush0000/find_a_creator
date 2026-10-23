import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma, UserRole, SubscriptionPlan, SubscriptionStatus } from '@evoc/database';
import { RegisterUserSchema, LoginUserSchema } from '@evoc/types';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

// POST /api/auth/register (Register Merchant or Creator)
authRouter.post('/register', async (req, res) => {
  try {
    const parseResult = RegisterUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const data = parseResult.data;
    const normalizedEmail = data.email.toLowerCase();

    // Check if user already exists with email or phone
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { phoneNumber: data.phoneNumber }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User with this email or phone number already exists'
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        phoneNumber: data.phoneNumber,
        passwordHash,
        role: data.role as UserRole,
        isVerified: true,
        ...(data.role === UserRole.MERCHANT
          ? {
              merchantProfile: {
                create: {
                  brandName: data.brandName || normalizedEmail.split('@')[0],
                  websiteUrl: data.websiteUrl || null,
                  subscriptionPlan: SubscriptionPlan.STARTER,
                  subscriptionStatus: SubscriptionStatus.ACTIVE,
                  subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
              }
            }
          : {
              creatorProfile: {
                create: {
                  displayAlias: data.displayAlias || `${normalizedEmail.split('@')[0]} (Creator)`,
                  category: data.category || 'General',
                  city: data.city || null,
                  bioSummary: data.bioSummary || null,
                  pointsBalance: 0,
                  contentStyles: ['Unboxing', 'Testimonial', 'Hook+Problem+Solution']
                }
              }
            })
      },
      include: {
        merchantProfile: true,
        creatorProfile: true
      }
    });

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('Server configuration error: JWT_SECRET environment variable is missing');
      return res.status(500).json({
        error: 'Server configuration error: JWT_SECRET environment variable is missing'
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...safeUser } = user;

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/auth/login (Password verification & JWT return)
authRouter.post('/login', async (req, res) => {
  try {
    const parseResult = LoginUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors
      });
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        merchantProfile: true,
        creatorProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('Server configuration error: JWT_SECRET environment variable is missing');
      return res.status(500).json({
        error: 'Server configuration error: JWT_SECRET environment variable is missing'
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    const { passwordHash: _, ...safeUser } = user;

    res.json({
      message: 'Login successful',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /api/auth/me (Authenticated User Profile)
authRouter.get('/me', requireAuth, async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        merchantProfile: true,
        creatorProfile: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash: _, ...safeUser } = user;

    res.json({ user: safeUser });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});
