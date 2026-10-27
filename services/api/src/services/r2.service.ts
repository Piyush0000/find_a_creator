import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

// Cloudflare R2 is 100% S3-compatible.
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || 'mock_r2_account_id';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY || 'mock_r2_access_key';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY || 'mock_r2_secret_key';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'evoc-media-vault';
export const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'https://media.evoclabs.com';

export function getR2Client(): S3Client {
  const accountId = (process.env.R2_ACCOUNT_ID || 'mock_r2_account_id').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY || 'mock_r2_access_key').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY || 'mock_r2_secret_key').trim();

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

export const r2Client = getR2Client();

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
 * Generates an S3-compatible presigned PUT URL for direct browser-to-R2 upload
 */
export async function generateR2PresignedUrl(options: GeneratePresignedUrlOptions) {
  const { filename, contentType, fileSizeBytes, folder = 'drafts', expiresInSeconds = 900 } = options;

  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(`Unsupported MIME type: '${contentType}'. Only MP4 and MOV (video/mp4, video/quicktime) are allowed.`);
  }

  if (fileSizeBytes > MAX_VIDEO_SIZE_BYTES) {
    throw new Error(`File size ${Math.round(fileSizeBytes / (1024 * 1024))}MB exceeds maximum allowed limit of 150MB.`);
  }

  const ext = filename.split('.').pop()?.toLowerCase() || (contentType === 'video/mp4' ? 'mp4' : 'mov');
  const uniqueId = crypto.randomBytes(6).toString('hex');
  const safeBaseName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 30);
  const key = `${folder}/${Date.now()}-${uniqueId}-${safeBaseName}.${ext}`;

  const isMockMode = !process.env.R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID === 'mock_r2_account_id';

  let uploadUrl: string;

  const bucketName = process.env.R2_BUCKET_NAME || R2_BUCKET_NAME;
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || R2_PUBLIC_DOMAIN;

  if (isMockMode) {
    uploadUrl = `https://${bucketName}.r2.cloudflarestorage.com/${key}?mock-presigned=true&expires=${expiresInSeconds}`;
  } else {
    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType
    });

    uploadUrl = await getSignedUrl(client, command, {
      expiresIn: expiresInSeconds // 15-minute expiration (900 seconds)
    });
  }

  const publicUrl = `${publicDomain}/${key}`;

  return {
    uploadUrl,
    publicUrl,
    key,
    expiresInSeconds,
    maxSizeBytes: MAX_VIDEO_SIZE_BYTES
  };
}
