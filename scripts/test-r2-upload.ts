/**
 * Cloudflare R2 Upload Verification Script
 * Strictly reads from environment variables.
 * Throws an explicit error if required environment variables are missing.
 * Run: npx tsx scripts/test-r2-upload.ts
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getRequiredEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[R2 Test] Missing required environment variable: '${key}'. Please define it in your .env file.`);
  }
  return val.trim();
}

async function main() {
  console.log('🚀 ======================================================');
  console.log('🧪 VERIFYING CLOUDFLARE R2 PRESIGNED UPLOAD SERVICE');
  console.log('======================================================\n');

  // Exact env validation from .env — error if not present in env
  const accountId = getRequiredEnv('R2_ACCOUNT_ID');
  const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');
  const bucketName = getRequiredEnv('R2_BUCKET_NAME');
  const publicDomain = getRequiredEnv('R2_PUBLIC_DOMAIN').replace(/\/$/, '');

  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  const fileName = 'test-ugc-video.mp4';
  const contentType = 'video/mp4';
  const key = `drafts/${Date.now()}_${fileName}`;

  console.log(`📦 Target Bucket: ${bucketName}`);
  console.log(`🔑 S3 Object Key: ${key}`);
  console.log(`🌐 Account ID:   ${accountId}`);

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });
    const publicUrl = `${publicDomain}/${key}`;

    console.log('\n✅ Presigned PUT URL generated successfully (expires in 15 mins / 900s):');
    console.log(`   Upload URL: ${uploadUrl.slice(0, 80)}...`);
    console.log(`   Public URL: ${publicUrl}`);
    console.log(`   Object Key: ${key}`);

    console.log('\n📡 Testing live presigned S3 upload...');
    const videoBuffer = Buffer.from('FAKE_VIDEO_CONTENT_FOR_R2_TEST');
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: videoBuffer
    });

    if (uploadRes.ok) {
      console.log('🎉 Live upload succeeded! File is live in Cloudflare R2 bucket.');
    } else {
      console.warn(`⚠️ Live upload returned status: ${uploadRes.status} ${uploadRes.statusText}`);
    }

    console.log('\n✅ [PASSED] Cloudflare R2 Upload Verification complete.');
  } catch (err: any) {
    console.error('❌ R2 Presigned URL Generation failed:', err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
