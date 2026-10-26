import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  generateR2PresignedUrl,
  MAX_VIDEO_SIZE_BYTES
} from '../services/r2.service.js';

export const mediaRouter = Router();

const PresignedUrlRequestSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.enum(['video/mp4', 'video/quicktime'], {
    errorMap: () => ({ message: 'Unsupported MIME type. Only MP4 and MOV (video/mp4, video/quicktime) are permitted.' })
  }),
  fileSizeBytes: z
    .number()
    .positive('File size must be positive')
    .max(MAX_VIDEO_SIZE_BYTES, 'File size exceeds maximum 150MB limit'),
  folder: z.enum(['drafts', 'portfolio', 'assets']).default('drafts')
});

// POST /api/media/presigned-url
// Generates a 15-minute S3-compatible Cloudflare R2 PUT URL for direct browser upload
mediaRouter.post(
  '/presigned-url',
  requireAuth,
  async (req, res) => {
    try {
      const validated = PresignedUrlRequestSchema.parse(req.body);

      const result = await generateR2PresignedUrl({
        filename: validated.filename,
        contentType: validated.contentType,
        fileSizeBytes: validated.fileSizeBytes,
        folder: validated.folder,
        expiresInSeconds: 900 // 15-minute expiration
      });

      res.status(200).json({
        success: true,
        message: 'Presigned R2 upload URL generated successfully (valid for 15 minutes).',
        uploadUrl: result.uploadUrl,
        publicUrl: result.publicUrl,
        key: result.key,
        expiresInSeconds: result.expiresInSeconds,
        maxSizeBytes: result.maxSizeBytes
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.flatten().fieldErrors
        });
      }

      res.status(400).json({
        error: err.message || 'Failed to generate presigned upload URL'
      });
    }
  }
);
