import { z } from 'zod';
import { UserRole } from './enums.js';

export const RegisterUserSchema = z.object({
  email: z.string().email(),
  phoneNumber: z.string().min(10).max(15),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum([UserRole.MERCHANT, UserRole.CREATOR]),
  brandName: z.string().optional(),
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
  productPrice: z.number().positive(),
  productUrl: z.string().url('Please enter a valid product URL (e.g. https://yourbrand.com/product)'),
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
