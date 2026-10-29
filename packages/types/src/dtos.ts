import { z } from 'zod';
import { UserRole } from './enums.js';

export const RegisterUserSchema = z.object({
  email: z.string().email(),
  phoneNumber: z.string().min(10).max(15),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum([UserRole.MERCHANT, UserRole.CREATOR]),
  brandName: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  displayAlias: z.string().optional(),
  category: z.string().optional(),
  city: z.string().optional(),
  bioSummary: z.string().optional()
});

export const LoginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const CreateCollabBriefSchema = z.object({
  creatorId: z.string().uuid(),
  productName: z.string().min(2),
  productLink: z.string().url(),
  productPrice: z.number().positive(),
  scriptGuidelines: z.string().min(20, 'Please provide detailed script/talking points'),
  videoHooks: z.string().min(10, 'Specify the opening 3-second hook'),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  deliverableType: z.string().default('1 UGC Video Ad (30-60s)'),
  commissionPointsPerSale: z.number().int().min(10).default(100)
});

export const OrderWebhookPayloadSchema = z.object({
  event: z.literal('order.completed'),
  orderId: z.string(),
  orderTotal: z.number().positive(),
  currency: z.string().default('INR'),
  utmCreatorId: z.string().optional(),
  couponCode: z.string().optional(),
  createdAt: z.string()
});

// Exact regex from Toufeeq's Plan: /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
export const UPI_VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export const CreatePayoutRequestSchema = z.object({
  upiVpa: z
    .string()
    .regex(UPI_VPA_REGEX, 'Invalid Indian UPI ID format (e.g. name@okhdfcbank)'),
  pointsToRedeem: z
    .number()
    .int('Points must be a whole number')
    .min(500, 'Minimum withdrawal threshold is 500 points (₹500)')
});

export const AdminClearPayoutSchema = z.object({
  utrNumber: z.string().min(6, 'Bank UTR reference is required'),
  adminNotes: z.string().optional()
});

export const AdminRejectPayoutSchema = z.object({
  adminNotes: z.string().min(5, 'Rejection reason is required')
});

// Export both names to prevent any import breakage
export const AdminRejectSchema = AdminRejectPayoutSchema;

export const REVIEW_REJECTION_TAGS = [
  'POOR_AUDIO',
  'WEAK_HOOK',
  'OFF_SCRIPT',
  'PII_LEAK',
  'BAD_LIGHTING'
] as const;

export type ReviewRejectionTag = (typeof REVIEW_REJECTION_TAGS)[number];

export const EvocReviewSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
  rejectionTags: z.array(z.enum(REVIEW_REJECTION_TAGS)).optional()
});
