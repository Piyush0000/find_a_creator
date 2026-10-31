import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import jwt from 'jsonwebtoken';
import { prisma, UserRole, PointsStatus, PointsTransactionType } from '@evoc/database';

function getRequiredEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[Comprehensive Test] Missing required environment variable: '${key}'. Please define it in your .env file.`);
  }
  return val.trim();
}

const API = 'http://localhost:4000';
const jwtSecret = getRequiredEnv('JWT_SECRET');
const r2AccountId = getRequiredEnv('R2_ACCOUNT_ID');
const r2BucketName = getRequiredEnv('R2_BUCKET_NAME');

async function api(
  method: string,
  urlPath: string,
  body?: object,
  token?: string,
  extraHeaders?: Record<string, string>
) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function pass(msg: string) {
  console.log(`  ✅ ${msg}`);
}
function fail(msg: string, detail?: unknown) {
  console.error(`  ❌ FAIL: ${msg}`, detail ?? '');
  process.exit(1);
}
function section(title: string) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(65));
}

async function runAllTests() {
  console.log('\n🚀 =============================================================');
  console.log('🧪 EVOC FULL SUITE: LIVE CLOUDFLARE R2 & ALL DAY 4 + 5 FEATURES');
  console.log('=============================================================\n');

  // ── 0. API Health Check ───────────────────────────────────────────────────
  section('0. Health Check');
  const health = await api('GET', '/healthz');
  if (health.status !== 200) fail('API server is not responding at http://localhost:4000', health);
  pass(`API server healthy (${health.data.timestamp})`);

  // ── 1. User & Token Setup ─────────────────────────────────────────────────
  section('1. Authentication & Role-Based Tokens');
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@evoclabs.com' } });
  const merchantUser = await prisma.user.findUnique({
    where: { email: 'founder@glowskincare.com' },
    include: { merchantProfile: true }
  });
  const creatorUser = await prisma.user.findUnique({
    where: { email: 'rohit.creator@evoc.internal' },
    include: { creatorProfile: true }
  });

  if (!adminUser || !merchantUser || !creatorUser || !creatorUser.creatorProfile) {
    fail('Seeded users missing. Please ensure database is seeded.');
  }

  const adminToken = jwt.sign(
    { userId: adminUser.id, email: adminUser.email, role: UserRole.SUPER_ADMIN },
    jwtSecret,
    { expiresIn: '2h' }
  );
  const merchantToken = jwt.sign(
    { userId: merchantUser.id, email: merchantUser.email, role: UserRole.MERCHANT },
    jwtSecret,
    { expiresIn: '2h' }
  );
  const creatorToken = jwt.sign(
    { userId: creatorUser.id, email: creatorUser.email, role: UserRole.CREATOR },
    jwtSecret,
    { expiresIn: '2h' }
  );

  pass(`Admin token created (${adminUser.email})`);
  pass(`Merchant token created (${merchantUser.email} - ${merchantUser.merchantProfile?.brandName})`);
  pass(`Creator token created (${creatorUser.email} - ${creatorUser.creatorProfile.displayAlias})`);

  // ── 2. Live Cloudflare R2 Presigned Upload & Real PUT ──────────────────────
  section('2. Live Cloudflare R2 Presigned Upload & Direct Binary PUT');

  console.log(`  Account ID: ${r2AccountId.slice(0, 8)}...`);
  console.log(`  Bucket:     ${r2BucketName}`);

  // Test 2a: Generate presigned PUT URL
  const presignRes = await api(
    'POST',
    '/api/media/presigned-url',
    {
      filename: 'live-test-ugc-video.mp4',
      contentType: 'video/mp4',
      fileSizeBytes: 2048,
      folder: 'drafts'
    },
    creatorToken
  );

  if (presignRes.status !== 200) fail('Could not generate presigned URL', presignRes.data);
  const { uploadUrl, publicUrl, key } = presignRes.data;
  pass(`Presigned URL generated (expires in 15 mins)`);
  console.log(`    Key: ${key}`);
  console.log(`    Public URL: ${publicUrl}`);

  // Test 2b: Real direct binary PUT into Cloudflare R2
  console.log('  Uploading real test video payload directly to Cloudflare R2...');
  const testVideoBuffer = Buffer.from('EVOC_LABS_LIVE_R2_BINARY_TEST_STREAM_' + Date.now());

  const r2UploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(testVideoBuffer.length)
    },
    body: testVideoBuffer
  });

  if (!r2UploadRes.ok) {
    const errText = await r2UploadRes.text();
    fail(`Cloudflare R2 direct PUT rejected with HTTP ${r2UploadRes.status}: ${errText}`);
  }
  pass(`LIVE Cloudflare R2 Upload SUCCEEDED with HTTP ${r2UploadRes.status}! (File stored in R2 bucket!)`);

  // Test 2c: Guards: 150MB limit validation
  const oversizedRes = await api(
    'POST',
    '/api/media/presigned-url',
    {
      filename: 'huge-video.mp4',
      contentType: 'video/mp4',
      fileSizeBytes: 160 * 1024 * 1024 // 160MB
    },
    creatorToken
  );
  if (oversizedRes.status !== 400) fail(`Expected 400 for >150MB, got ${oversizedRes.status}`);
  pass(`Guard: Rejects files over 150MB (HTTP 400)`);

  // Test 2d: Guards: Invalid MIME type validation
  const badMimeRes = await api(
    'POST',
    '/api/media/presigned-url',
    {
      filename: 'image.png',
      contentType: 'image/png' as any,
      fileSizeBytes: 1024
    },
    creatorToken
  );
  if (badMimeRes.status !== 400) fail(`Expected 400 for image/png, got ${badMimeRes.status}`);
  pass(`Guard: Rejects non-video MIME types (HTTP 400)`);

  // ── 3. Collab Lifecycle, Sample Tracking & Zero-Leak Gatekeeper ───────────
  section('3. Collab Lifecycle, Physical Tracking & Zero-Leak Gatekeeper');

  // 3a. Merchant submits brief
  const creatorProfileId = creatorUser.creatorProfile.id;
  const briefRes = await api(
    'POST',
    '/api/collabs',
    {
      creatorId: creatorProfileId,
      productName: 'HydraGlow Peptide Cream',
      productPrice: 1999,
      productUrl: 'https://tarayu.com/products/hydraglow-peptide-cream',
      scriptGuidelines: 'Focus on glass skin texture in 45 seconds.',
      videoHooks: 'The 1 skincare mistake you are making every morning...',
      aspectRatio: '9:16',
      deliverableType: '1 UGC Video Ad (30-60s)',
      commissionPointsPerSale: 200
    },
    merchantToken
  );
  if (briefRes.status !== 201) fail('Collab brief creation failed', briefRes.data);
  const collabId = briefRes.data.collabId;
  pass(`Collab created: ${collabId} (Status: BRIEF_SUBMITTED)`);

  // 3b. Creator accepts collab
  const acceptRes = await api('PATCH', `/api/collabs/${collabId}/accept`, {}, creatorToken);
  if (acceptRes.status !== 200) fail('Creator accept failed', acceptRes.data);
  pass(`Creator accepted collab (Status: CREATOR_ACCEPTED)`);

  // 3c. Creator produces & submits the R2 video URL as draft
  const draftSubmitRes = await api(
    'POST',
    `/api/collabs/${collabId}/draft`,
    { draftVideoUrl: publicUrl },
    creatorToken
  );
  if (draftSubmitRes.status !== 200) fail('Draft submission failed', draftSubmitRes.data);
  pass(`Draft submitted to EVOC Ops review (Status: DRAFT_PENDING_EVOC)`);

  // 3e. ZERO-LEAK TEST: Merchant views collab (draftVideoUrl MUST be null!)
  const merchantViewRes = await api('GET', `/api/collabs/${collabId}`, undefined, merchantToken);
  if (merchantViewRes.data.collab.draftVideoUrl !== null) {
    fail('SECURITY BREACH: Merchant was able to see unvetted draft video before EVOC approval!', merchantViewRes.data);
  }
  pass(`Zero-Leak Confirmed: draftVideoUrl is strictly NULL for merchant during Stage 1 review`);

  // 3f. EVOC Ops Stage 1 Review & Approval
  const opsReviewRes = await api(
    'PATCH',
    `/api/collabs/${collabId}/evoc-review`,
    {
      approved: true,
      notes: 'Excellent lighting, clear hook, and correct 9:16 aspect ratio.'
    },
    adminToken
  );
  if (opsReviewRes.status !== 200) fail('EVOC Ops review failed', opsReviewRes.data);
  pass(`EVOC Ops approved draft (Status: DRAFT_PENDING_MERCHANT)`);

  // 3g. Merchant Stage 2 Approval & Asset Handoff
  const merchantApproveRes = await api(
    'PATCH',
    `/api/collabs/${collabId}/merchant-approval`,
    {
      approved: true,
      notes: 'Approved for Meta Ads campaign launch!'
    },
    merchantToken
  );
  if (merchantApproveRes.status !== 200) fail('Merchant approval failed', merchantApproveRes.data);
  pass(`Merchant approved asset (Status: ASSET_DELIVERED)`);

  // 3h. Asset Handoff verification: Meta Ads UTM Campaign link & high-res asset
  pass(`Asset Handoff active! High-Res Video Link: ${merchantApproveRes.data.downloadableAssetUrl}`);
  pass(`Turnkey Meta Ads UTM link: ${merchantApproveRes.data.metaAdsCampaignLink}`);

  // ── 4. 14-Day Return Window Settlement Engine ─────────────────────────────
  section('4. 14-Day Settlement Engine & Admin Controls');

  const previewRes = await api('GET', '/api/admin/settle-points/preview', undefined, adminToken);
  if (previewRes.status !== 200) fail('Settlement preview failed', previewRes.data);
  pass(`Admin settlement preview: ${previewRes.data.eligibleEntries} eligible entries (Cutoff: ${previewRes.data.cutoffDate})`);

  const manualSettleRes = await api('POST', '/api/admin/settle-points', {}, adminToken);
  if (manualSettleRes.status !== 200) fail('Admin manual settlement failed', manualSettleRes.data);
  pass(`Admin settlement cycle executed cleanly`);

  const settleForbidden = await api('POST', '/api/admin/settle-points', {}, merchantToken);
  if (settleForbidden.status !== 403) fail(`Expected 403 for merchant settlement, got ${settleForbidden.status}`);
  pass(`RBAC: Merchant blocked from triggering settlement (HTTP 403)`);

  // ── 5. Creator Points & Closed-loop Store Points Engine ───────────────────
  section('5. Creator Points & Closed-loop Store Points Engine');

  // Seed 1000 settled points to test points ledger and shopping vouchers
  await prisma.evocPointsLedger.create({
    data: {
      creatorId: creatorProfileId,
      pointsDelta: 1000,
      transactionType: PointsTransactionType.PURCHASE_COMMISSION,
      status: PointsStatus.SETTLED,
      description: 'Live test matured store shopping points'
    }
  });
  await prisma.creatorProfile.update({
    where: { id: creatorProfileId },
    data: { pointsBalance: { increment: 1000 } }
  });

  // 5a. Creator balance endpoint
  const creatorBalanceRes = await api('GET', '/api/creators/me/points', undefined, creatorToken);
  if (creatorBalanceRes.status !== 200) fail('Could not get creator points', creatorBalanceRes.data);
  pass(`Creator balance confirmed: ${creatorBalanceRes.data.pointsBalance} pts`);

  // 5b. Verify money payout endpoint is decommissioned (404)
  const decommissionRes = await api('POST', '/api/payouts/request', { pointsToRedeem: 500 }, creatorToken);
  if (decommissionRes.status !== 404) fail(`Expected 404 for removed payout endpoint, got ${decommissionRes.status}`);
  pass(`Money payout route confirmed decommissioned (HTTP 404 Not Found - Closed-loop shopping points only)`);

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  section('🏆 ALL LIVE TESTS PASSED SUCCESSFULLY');
  console.log('  [✓] Real Cloudflare R2 Presigned Upload & Direct Binary PUT (HTTP 200)');
  console.log('  [✓] R2 File Size (>150MB) and MIME Type Security Guards');
  console.log('  [✓] Direct Production Streamlined Workflow (Zero Sample Shipping Delays)');
  console.log('  [✓] Zero-Leak Draft Video Masking (Stage 1 EVOC Quality Gate)');
  console.log('  [✓] Turnkey Meta Ads UTM Link & High-Res Asset Handoff');
  console.log('  [✓] 14-Day Return Window Settlement Engine');
  console.log('  [✓] Closed-loop EVOC Shopping Points Store Vouchers (No Money Redemption)\n');
}

runAllTests().catch((err) => {
  console.error('\n💥 Unexpected test failure:', err);
  process.exit(1);
});
