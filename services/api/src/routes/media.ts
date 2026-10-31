import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { presignLimiter } from '../middleware/rateLimiter.js';
import {
  generateR2PresignedUrl,
  MAX_VIDEO_SIZE_BYTES
} from '../services/r2.service.js';

export const mediaRouter = Router();

// Schema supports both naming conventions:
// 1. Plan standard: { fileName, fileType, fileSize }
// 2. Legacy / alternate: { filename, contentType, fileSizeBytes }
const PresignedUrlRequestSchema = z
  .object({
    fileName: z.string().optional(),
    filename: z.string().optional(),
    fileType: z.enum(['video/mp4', 'video/quicktime']).optional(),
    contentType: z.enum(['video/mp4', 'video/quicktime']).optional(),
    fileSize: z.number().positive().max(MAX_VIDEO_SIZE_BYTES, 'File size exceeds maximum 150MB limit').optional(),
    fileSizeBytes: z.number().positive().max(MAX_VIDEO_SIZE_BYTES, 'File size exceeds maximum 150MB limit').optional(),
    folder: z.enum(['drafts', 'portfolio', 'assets']).default('drafts')
  })
  .refine(
    (data) => !!(data.fileName || data.filename),
    { message: 'fileName is required', path: ['fileName'] }
  )
  .refine(
    (data) => !!(data.fileType || data.contentType),
    { message: 'fileType must be video/mp4 or video/quicktime', path: ['fileType'] }
  )
  .refine(
    (data) => !!(data.fileSize || data.fileSizeBytes),
    { message: 'fileSize is required (max 150MB)', path: ['fileSize'] }
  );

// POST /api/media/presigned-url
// Generates a 15-minute S3-compatible Cloudflare R2 PUT URL for direct browser upload
mediaRouter.post(
  '/presigned-url',
  presignLimiter,
  requireAuth,
  async (req, res) => {
    try {
      const validated = PresignedUrlRequestSchema.parse(req.body);

      const targetFileName = (validated.fileName || validated.filename)!;
      const targetFileType = (validated.fileType || validated.contentType)!;
      const targetFileSize = (validated.fileSize || validated.fileSizeBytes)!;

      const result = await generateR2PresignedUrl({
        filename: targetFileName,
        contentType: targetFileType,
        fileSizeBytes: targetFileSize,
        folder: validated.folder,
        expiresInSeconds: 900 // 15-minute expiration
      });

      // Strict return signature as specified in Toufeeq's plan: { uploadUrl, publicUrl, key }
      res.status(200).json({
        success: true,
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
