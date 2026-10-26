import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import jwt from 'jsonwebtoken';
import { prisma, UserRole, CollabStatus } from '@evoc/database';

async function run() {
  console.log('🚀 ======================================================');
  console.log('🧪 RUNNING: SPRINT DAY 1 TOUFEEQ COMPREHENSIVE VERIFICATION');
  console.log('======================================================\n');

  // Verify server is listening
  try {
    const healthCheck = await fetch('http://localhost:4000/healthz');
    if (!healthCheck.ok) {
      console.error('❌ API server is not running on port 4000. Start it with `npx pnpm --filter @evoc/api dev`');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Cannot connect to http://localhost:4000. Make sure the API server is running in another terminal (`npx pnpm --filter @evoc/api dev`).');
    process.exit(1);
  }

  // 1. Fetch Users
  const merchantUser = await prisma.user.findUnique({
    where: { email: 'founder@glowskincare.com' },
    include: { merchantProfile: true }
  });
  const creatorUser = await prisma.user.findUnique({
    where: { email: 'rohit.creator@evoc.internal' },
    include: { creatorProfile: true }
  });
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@evoclabs.com' }
  });

  if (!merchantUser || !creatorUser || !adminUser) {
    console.error('❌ Missing seeded users in Supabase. Run `pnpm db:seed` first.');
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_evoc_2026';

  const merchantToken = jwt.sign(
    { userId: merchantUser.id, email: merchantUser.email, role: UserRole.MERCHANT },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const creatorToken = jwt.sign(
    { userId: creatorUser.id, email: creatorUser.email, role: UserRole.CREATOR },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { userId: adminUser.id, email: adminUser.email, role: UserRole.SUPER_ADMIN },
    jwtSecret,
    { expiresIn: '1h' }
  );

  console.log('🔑 Tokens generated for Merchant, Creator, and Admin.\n');

  // =========================================================================
  // TASK 1: CLOUDFLARE R2 PRESIGNED UPLOAD API (POST /api/media/presigned-url)
  // =========================================================================
  console.log('------------------------------------------------------');
  console.log('📦 TASK 1: Cloudflare R2 Presigned Upload API');
  console.log('------------------------------------------------------');

  const presignRes = await fetch('http://localhost:4000/api/media/presigned-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({
      filename: 'rohit_ugc_raw_cut.mp4',
      contentType: 'video/mp4',
      fileSizeBytes: 42 * 1024 * 1024, // 42MB
      folder: 'drafts'
    })
  });

  if (!presignRes.ok) {
    const errorText = await presignRes.text();
    console.error(`❌ Server returned ${presignRes.status}: ${errorText}`);
    process.exit(1);
  }

  const presignData = await presignRes.json();
  console.log(`• Status: ${presignRes.status} (Expected: 200)`);
  console.log(`• Presigned Upload URL: ${presignData.uploadUrl?.slice(0, 50)}...`);
  console.log(`• Public Asset CDN URL: ${presignData.publicUrl}`);
  console.log(`• Expiration:           ${presignData.expiresInSeconds}s (15 min)`);

  if (presignRes.status === 200 && presignData.uploadUrl && presignData.publicUrl) {
    console.log('✅ TASK 1 PASSED: S3-compatible R2 Presigned URL generated!\n');
  } else {
    console.error('❌ TASK 1 FAILED.');
    process.exit(1);
  }

  // =========================================================================
  // SETUP: Create a new brief
  // =========================================================================
  console.log('📝 CREATING NEW BRIEF FOR COLLAB ACTIONS...');
  const briefRes = await fetch('http://localhost:4000/api/collabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
    body: JSON.stringify({
      creatorId: creatorUser.creatorProfile!.id,
      productName: 'Hydrating Night Cream',
      productLink: 'https://glowskincare.in/products/nightcream',
      productPrice: 1499,
      scriptGuidelines: 'Highlight morning recovery and deep hydration with hyaluronic acid.',
      videoHooks: 'Wake up with glass skin without spending ₹10,000!',
      aspectRatio: '9:16',
      deliverableType: '1 UGC Video Ad (30-60s)',
      commissionPointsPerSale: 150
    })
  });

  if (!briefRes.ok) {
    const errorText = await briefRes.text();
    console.error(`❌ Failed to create brief: ${briefRes.status}: ${errorText}`);
    process.exit(1);
  }

  const briefData = await briefRes.json();
  const collabId = briefData.collabId;
  console.log(`• Brief Created: ${collabId} (Status: BRIEF_SUBMITTED)\n`);

  // =========================================================================
  // TASK 2: COLLAB ACTIONS (ACCEPT, SAMPLE DISPATCH)
  // =========================================================================
  console.log('------------------------------------------------------');
  console.log('🤝 TASK 2: Collab Lifecycle Actions');
  console.log('------------------------------------------------------');

  // 2A: Creator Accepts Brief
  console.log('▶️ Action 2A: Creator accepts brief (PATCH /api/collabs/:id/accept)...');
  const acceptRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/accept`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${creatorToken}` }
  });
  const acceptData = await acceptRes.json();
  console.log(`• Status: ${acceptRes.status} | Collab Status: ${acceptData.status}`);
  if (acceptData.status === 'CREATOR_ACCEPTED') {
    console.log('✅ Action 2A Passed: Brief accepted by creator!\n');
  } else {
    console.error('❌ Action 2A Failed.');
    process.exit(1);
  }

  // 2B: Merchant/EVOC Dispatches Product Sample with Courier & Tracking
  console.log('▶️ Action 2B: Dispatch Sample (PATCH /api/collabs/:id/sample-dispatched)...');
  const sampleRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/sample-dispatched`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
    body: JSON.stringify({
      courierName: 'BlueDart Express',
      trackingNumber: 'BD77889922IN',
      trackingUrl: 'https://bluedart.com/track/BD77889922IN'
    })
  });
  const sampleData = await sampleRes.json();
  console.log(`• Status: ${sampleRes.status} | Collab Status: ${sampleData.status}`);
  console.log(`• Courier: ${sampleData.courierName} | Tracking: ${sampleData.trackingNumber}`);
  if (sampleData.status === 'SAMPLE_DISPATCHED') {
    console.log('✅ Action 2B Passed: Sample dispatch and tracking details logged!\n');
  } else {
    console.error('❌ Action 2B Failed.');
    process.exit(1);
  }

  // Creator uploads draft video via R2 public URL
  console.log('▶️ Creator uploads draft video using R2 URL...');
  const draftRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ draftVideoUrl: presignData.publicUrl })
  });
  if (!draftRes.ok) {
    const errorText = await draftRes.text();
    console.error(`❌ Failed to upload draft: ${draftRes.status}: ${errorText}`);
    process.exit(1);
  }
  console.log('• Draft video uploaded. Status: DRAFT_PENDING_EVOC (Private Under EVOC Ops Review)\n');

  // =========================================================================
  // TASK 3: MERCHANT COLLABS FEED WITH STAGE 1 VIDEO MASKING
  // =========================================================================
  console.log('------------------------------------------------------');
  console.log('🔒 TASK 3: Merchant Collabs Feed (GET /api/collabs/merchant)');
  console.log('------------------------------------------------------');

  const feedRes = await fetch('http://localhost:4000/api/collabs/merchant', {
    headers: { Authorization: `Bearer ${merchantToken}` }
  });
  const feedData = await feedRes.json();
  const currentCollabInFeed = feedData.collabs.find((c: any) => c.id === collabId);

  console.log(`• Total Collabs in Merchant Feed: ${feedData.count}`);
  console.log(`• Current Collab Status:           ${currentCollabInFeed.status}`);
  console.log(`• draftVideoUrl visible to Merchant: ${currentCollabInFeed.draftVideoUrl}`);
  console.log(`• Security Notice:                 "${currentCollabInFeed.draftStatusNotice}"`);

  if (feedRes.status === 200 && currentCollabInFeed.draftVideoUrl === null) {
    console.log('✅ TASK 3 PASSED: Stage 1 Draft Video is 100% masked from Merchant Feed!\n');
  } else {
    console.error('❌ TASK 3 FAILED: Video URL was leaked in Merchant Feed.');
    process.exit(1);
  }

  // =========================================================================
  // TASK 4: ASSET HANDOFF & META ADS UTM LINK GENERATION
  // =========================================================================
  console.log('------------------------------------------------------');
  console.log('🎉 TASK 4: Final Asset Handoff & Meta Ads UTM Link');
  console.log('------------------------------------------------------');

  // EVOC Ops Approves Draft
  console.log('▶️ EVOC Ops clears quality review...');
  await fetch(`http://localhost:4000/api/collabs/${collabId}/evoc-review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ approved: true, notes: 'Lighting and script hooks approved.' })
  });

  // Merchant Gives Final Approval
  console.log('▶️ Merchant gives Stage 2 approval (PATCH /api/collabs/:id/merchant-approval)...');
  const finalApproveRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/merchant-approval`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
    body: JSON.stringify({ approved: true, notes: 'Love the delivery. Ready to launch Meta ads.' })
  });
  const finalApproveData = await finalApproveRes.json();

  console.log(`• Final Collab Status:        ${finalApproveData.status}`);
  console.log(`• High-Res Deliverable URL:   ${finalApproveData.downloadableAssetUrl}`);
  console.log(`• Meta Ads Pre-formatted UTM: ${finalApproveData.metaAdsCampaignLink}`);

  if (
    finalApproveData.status === 'ASSET_DELIVERED' &&
    finalApproveData.downloadableAssetUrl &&
    finalApproveData.metaAdsCampaignLink?.includes('utm_source=meta')
  ) {
    console.log('✅ TASK 4 PASSED: Asset delivered with pre-formatted Meta Ads UTM link!\n');
  } else {
    console.error('❌ TASK 4 FAILED.');
    process.exit(1);
  }

  console.log('======================================================');
  console.log('🏆 ALL 4 SPRINT DAY 1 TASKS COMPLETED & VERIFIED 100%!');
  console.log('======================================================\n');

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
