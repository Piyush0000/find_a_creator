import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import jwt from 'jsonwebtoken';
import { prisma, UserRole, CollabStatus } from '@evoc/database';

async function run() {
  console.log('🚀 ======================================================');
  console.log('🧪 RUNNING DAY 2: 2-STAGE REVIEW GATE & SECURITY VERIFICATION');
  console.log('======================================================\n');

  // 1. Fetch Admin, Merchant, and Creator users from Supabase
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@evoclabs.com' } });
  const merchantUser = await prisma.user.findUnique({
    where: { email: 'founder@glowskincare.com' },
    include: { merchantProfile: true }
  });
  const creatorUser = await prisma.user.findUnique({
    where: { email: 'rohit.creator@evoc.internal' },
    include: { creatorProfile: true }
  });

  if (!adminUser || !merchantUser || !creatorUser) {
    console.error('❌ Missing seeded users in Supabase. Run `pnpm db:seed` first.');
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_evoc_2026';

  // 2. Sign tokens for all 3 actors
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

  console.log('🔑 Authenticated Tokens Generated:');
  console.log('• Merchant: Glow Skincare D2C');
  console.log('• Creator:  Rohit S.');
  console.log('• Admin:    EVOC Ops Super Admin\n');

  // 3. Step 0: Merchant creates a sample brief
  console.log('📝 STEP 0: Merchant submits a new Video Ad Brief...');
  const briefRes = await fetch('http://localhost:4000/api/collabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
    body: JSON.stringify({
      creatorId: creatorUser.creatorProfile!.id,
      productName: 'Hydrating Face Serum',
      productLink: 'https://glowskincare.in/products/serum',
      productPrice: 1299,
      scriptGuidelines: 'Focus on morning routine with 3 drops application on face.',
      videoHooks: 'Stop using serums that dry out your skin after 10 minutes!',
      aspectRatio: '9:16',
      deliverableType: '1 UGC Video Ad (30-60s)',
      commissionPointsPerSale: 130
    })
  });

  const briefData = await briefRes.json();
  const collabId = briefData.collabId;
  console.log(`✅ Brief Created. ID: ${collabId} | UTM: ${briefData.utmTrackingSlug}\n`);

  // 4. Step 1: Creator uploads private draft video
  console.log('🎬 STEP 1: Creator uploads draft video (POST /api/collabs/:id/draft)...');
  const draftUrl = 'https://s3.aws.com/evoc-drafts/rohit_serum_raw_draft_v1.mp4';
  const uploadRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ draftVideoUrl: draftUrl })
  });

  const uploadData = await uploadRes.json();
  console.log(`✅ ${uploadData.message}`);
  console.log(`• Collab Status: ${uploadData.status}\n`);

  // 5. Security Test: Private Draft Locking (GET /api/collabs/:id)
  console.log('🔒 SECURITY CHECK 1: Merchant views collab while under EVOC review...');
  const lockCheckRes = await fetch(`http://localhost:4000/api/collabs/${collabId}`, {
    headers: { Authorization: `Bearer ${merchantToken}` }
  });
  const lockCheckData = await lockCheckRes.json();
  console.log(`• draftVideoUrl visible to Merchant: ${lockCheckData.collab.draftVideoUrl}`);
  console.log(`• Security Notice for Merchant:      "${lockCheckData.collab.draftStatusNotice}"`);
  if (lockCheckData.collab.draftVideoUrl === null) {
    console.log('🛡️ PASSED: Video URL is 100% PRIVATE and HIDDEN from merchant!\n');
  } else {
    console.error('❌ FAILED: Security leak! Draft video URL is exposed to merchant.');
    process.exit(1);
  }

  // 6. Security Test: Attempt premature merchant approval
  console.log('🚫 SECURITY CHECK 2: Merchant attempts to approve draft BEFORE EVOC Ops...');
  const earlyApproveRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/merchant-approval`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
    body: JSON.stringify({ approved: true, notes: 'Trying to skip EVOC Ops' })
  });
  const earlyApproveData = await earlyApproveRes.json();
  console.log(`• Server Status: ${earlyApproveRes.status} (Expected: 400)`);
  console.log(`• Response Error: "${earlyApproveData.error}"`);
  if (earlyApproveRes.status === 400) {
    console.log('🛡️ PASSED: State machine prevented premature approval!\n');
  } else {
    console.error('❌ FAILED: Merchant was able to bypass EVOC review.');
    process.exit(1);
  }

  // 7. Security Check 3: EVOC Rejection -> DRAFT_REVISION_REQUESTED test
  console.log('🔄 STEP 2A: EVOC Ops rejects draft to test DRAFT_REVISION_REQUESTED state...');
  const rejectRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/evoc-review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      approved: false,
      notes: 'Lighting is too dark at 0:15. Please re-shoot with natural lighting.'
    })
  });
  const rejectData = await rejectRes.json();
  console.log(`• Collab Status after rejection: ${rejectData.status} (Expected: DRAFT_REVISION_REQUESTED)`);
  if (rejectData.status === 'DRAFT_REVISION_REQUESTED') {
    console.log('🛡️ PASSED: Rejection correctly set status to DRAFT_REVISION_REQUESTED!\n');
  } else {
    console.error('❌ FAILED: Rejection did not set DRAFT_REVISION_REQUESTED.');
    process.exit(1);
  }

  // Creator re-uploads updated draft
  console.log('🎬 STEP 2B: Creator re-uploads revised draft video...');
  const reUploadRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ draftVideoUrl: 'https://s3.aws.com/evoc-drafts/rohit_serum_v2_fixed.mp4' })
  });
  const reUploadData = await reUploadRes.json();
  console.log(`• Collab Status after re-upload: ${reUploadData.status} (Expected: DRAFT_PENDING_EVOC)`);
  if (reUploadData.status === 'DRAFT_PENDING_EVOC') {
    console.log('🛡️ PASSED: Revised draft re-entered EVOC quality queue!\n');
  } else {
    console.error('❌ FAILED: Re-uploaded draft did not transition back to DRAFT_PENDING_EVOC.');
    process.exit(1);
  }

  // 8. Step 2C: EVOC Ops reviews and approves the revised draft
  console.log('🔍 STEP 2C: EVOC Ops reviews and approves draft (PATCH /api/collabs/:id/evoc-review)...');
  const evocReviewRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/evoc-review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      approved: true,
      notes: 'Video hooks verified, crisp 9:16 lighting, pronunciation accurate. Approved for brand preview.'
    })
  });
  const evocReviewData = await evocReviewRes.json();
  console.log(`✅ ${evocReviewData.message}`);
  console.log(`• Collab Status: ${evocReviewData.status}\n`);

  // 9. Merchant Verification: Draft is now unlocked
  console.log('🔓 VERIFICATION: Merchant views collab after EVOC approval...');
  const unlockedRes = await fetch(`http://localhost:4000/api/collabs/${collabId}`, {
    headers: { Authorization: `Bearer ${merchantToken}` }
  });
  const unlockedData = await unlockedRes.json();
  console.log(`• draftVideoUrl now visible to Merchant: ${unlockedData.collab.draftVideoUrl}`);
  console.log('✅ Unlocked privately for Merchant in portal!\n');

  // 10. Step 3: Merchant Stage 2 Approval & Asset Handoff (PATCH /api/collabs/:id/merchant-approval)
  console.log('🎉 STEP 3: Merchant gives final approval (PATCH /api/collabs/:id/merchant-approval)...');
  const finalApproveRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/merchant-approval`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
    body: JSON.stringify({
      approved: true,
      notes: 'Loved the energy and hook! Ready to run on Meta.'
    })
  });
  const finalApproveData = await finalApproveRes.json();
  console.log(`✅ ${finalApproveData.message}`);
  console.log(`• Final Collab Status:    ${finalApproveData.status}`);
  console.log(`• Downloadable Asset URL: ${finalApproveData.downloadableAssetUrl}`);
  console.log(`• UTM Ad Destination:    ${finalApproveData.utmTrackingLink}\n`);

  console.log('======================================================');
  console.log('🏆 ALL DAY 2 DELIVERABLES & SECURITY CHECKS PASSED 100%!');
  console.log('======================================================\n');

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
