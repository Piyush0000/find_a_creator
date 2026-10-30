import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

/**
 * Strict Environment Variable Helper.
 * Throws an explicit error if the required environment variable is not defined.
 * No dummy fallbacks or placeholder defaults.
 */
function getRequiredEnv(key: string, alternateKey?: string): string {
  const val = process.env[key] || (alternateKey ? process.env[alternateKey] : undefined);
  if (!val || val.trim() === '') {
    throw new Error(`[R2 Service] Missing required environment variable: '${key}'${alternateKey ? ` or '${alternateKey}'` : ''}. Please define it in your .env file.`);
  }
  return val.trim();
}

/**
 * Returns a configured S3Client instance for Cloudflare R2.
 * Strictly uses credentials from process.env.
 */
export function getR2Client(): S3Client {
  const accountId = getRequiredEnv('R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID');
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY', 'R2_SECRET_KEY');

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED'
  });
}

export interface GeneratePresignedUrlOptions {
  filename: string;
  contentType: 'video/mp4' | 'video/quicktime';
  fileSizeBytes: number;
  folder?: string;
  expiresInSeconds?: number;
}

export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024; // 150MB limit
export const ALLOWED_MIME_TYPES = ['video/mp4', 'video/quicktime'] as const;

/**
 * Generates an S3-compatible presigned PUT URL for direct browser-to-R2 upload.
 * Strictly uses credentials and bucket configuration from process.env.
 * Throws an error immediately if any required environment variable is missing.
 */
export async function generateR2PresignedUrl(options: GeneratePresignedUrlOptions) {
  const { filename, contentType, fileSizeBytes, folder = 'drafts', expiresInSeconds = 900 } = options;

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`Unsupported MIME type: '${contentType}'. Only MP4 and MOV (video/mp4, video/quicktime) are allowed.`);
  }

  if (fileSizeBytes > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(`File size ${Math.round(fileSizeBytes / (1024 * 1024))}MB exceeds maximum allowed limit of 150MB.`);
  }

  const bucketName = getRequiredEnv('R2_BUCKET_NAME');
  const publicDomain = getRequiredEnv('R2_PUBLIC_DOMAIN');

  const ext = filename.split('.').pop()?.toLowerCase() || (contentType === 'video/mp4' ? 'mp4' : 'mov');
  const uniqueId = crypto.randomBytes(6).toString('hex');
  const safeBaseName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 30);
  const key = `${folder}/${Date.now()}-${uniqueId}-${safeBaseName}.${ext}`;

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds // 15-minute expiration (900 seconds)
  });

  const publicUrl = `${publicDomain.replace(/\/$/, '')}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
    expiresInSeconds,
    maxSizeBytes: MAX_VIDEO_SIZE_BYTES
  };
}
