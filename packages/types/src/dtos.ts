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

export const UPI_VPA_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;

export const CreatePayoutRequestSchema = z.object({
  upiVpa: z
    .string()
    .regex(UPI_VPA_REGEX, 'Invalid UPI VPA format (e.g. name@okhdfcbank)'),
  pointsToRedeem: z
    .number()
    .int('Points must be a whole number')
    .min(500, 'Minimum payout is 500 points')
});

export const AdminClearPayoutSchema = z.object({
  utrNumber: z.string().min(6, 'UTR number is required'),
  adminNotes: z.string().optional()
});

export const AdminRejectPayoutSchema = z.object({
  adminNotes: z.string().min(5, 'Rejection reason is required')
});

// Export both names to prevent any import breakage
export const AdminRejectSchema = AdminRejectPayoutSchema;
