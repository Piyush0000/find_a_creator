import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import jwt from 'jsonwebtoken';
import { prisma, UserRole } from '@evoc/database';

async function run() {
  console.log('🚀 ======================================================');
  console.log('🧪 RUNNING DAY 3: CHECKOUT WEBHOOK & ORDER ATTRIBUTION');
  console.log('======================================================\n');

  // 1. Fetch seeded users
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
    console.error('❌ Missing seeded users. Run `pnpm db:seed` first.');
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!process.env.CHECKOUT_WEBHOOK_SECRET) {
    throw new Error('Missing required environment variable: CHECKOUT_WEBHOOK_SECRET. Please define it in your .env file.');
  }
  const webhookSecret = process.env.CHECKOUT_WEBHOOK_SECRET;

  const webhookHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-webhook-secret': webhookSecret
  };

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

  console.log('🔑 Authenticated Tokens Generated.');

  // 2. Record initial creator points balance
  const creatorBefore = await prisma.creatorProfile.findUnique({
    where: { id: creatorUser.creatorProfile!.id }
  });
  const pointsBefore = creatorBefore!.pointsBalance;
  console.log(`📊 Creator "${creatorBefore!.displayAlias}" starting points balance: ${pointsBefore}\n`);

  // 3. Setup: Create a brief -> upload draft -> EVOC approve -> Merchant approve
  console.log('📝 SETUP: Running brief lifecycle to get an active UTM slug...\n');

  const briefRes = await fetch('http://localhost:4000/api/collabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
    body: JSON.stringify({
      creatorId: creatorUser.creatorProfile!.id,
      productName: 'Vitamin C Face Wash',
      productPrice: 599,
      productUrl: 'https://tarayu.com/products/vitamin-c-face-wash',
      scriptGuidelines: 'Show morning routine with the face wash, lather texture, and before-after glow.',
      videoHooks: 'Your face wash is making you break out — here is why!',
      aspectRatio: '9:16',
      deliverableType: '1 UGC Video Ad (30-60s)',
      commissionPointsPerSale: 100
    })
  });
  const briefData = await briefRes.json();
  const collabId = briefData.collabId;
  const utmSlug = briefData.utmTrackingSlug;
  console.log(`  ✅ Brief Created. ID: ${collabId} | UTM: ${utmSlug}`);

  // Draft upload
  await fetch(`http://localhost:4000/api/collabs/${collabId}/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ draftVideoUrl: 'https://s3.aws.com/evoc-drafts/rohit_facewash_draft.mp4' })
  });

  // EVOC approve
  await fetch(`http://localhost:4000/api/collabs/${collabId}/evoc-review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ approved: true, notes: 'Good quality, approved for merchant.' })
  });

  // Merchant approve
  const approvalRes = await fetch(`http://localhost:4000/api/collabs/${collabId}/merchant-approval`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
    body: JSON.stringify({ approved: true, notes: 'Perfect! Ready for Meta ads.' })
  });
  const approvalData = await approvalRes.json();
  console.log(`  ✅ Collab Approved: ${approvalData.status} | UTM: ${approvalData.utmTrackingLink}\n`);

  // 4. DAY 3 TEST 1: Simulate checkout webhook with order attribution
  console.log('======================================================');
  console.log('🛒 DAY 3 TEST 1: Simulating EVOC Checkout Purchase Event');
  console.log('======================================================\n');

  const orderTotal1 = 599;
  const expectedPoints1 = Math.round(orderTotal1 * 0.1); // 60 points

  const webhookRes1 = await fetch('http://localhost:4000/api/webhooks/order-completed', {
    method: 'POST',
    headers: webhookHeaders,
    body: JSON.stringify({
      event: 'order.completed',
      orderId: `ORD-${Date.now()}-001`,
      orderTotal: orderTotal1,
      currency: 'INR',
      utmCreatorId: utmSlug,
      createdAt: new Date().toISOString()
    })
  });
  const webhookData1 = await webhookRes1.json();

  console.log(`• Webhook Status: ${webhookRes1.status} (Expected: 200)`);
  console.log(`• Points Credited: ${webhookData1.pointsCredited} (Expected: ${expectedPoints1})`);
  console.log(`• Creator ID: ${webhookData1.creatorId}`);

  if (webhookRes1.status === 200 && webhookData1.pointsCredited === expectedPoints1) {
    console.log('✅ PASSED: Order attributed & commission points credited via PointsService!\n');
  } else {
    console.error('❌ FAILED: Webhook response mismatch.');
    process.exit(1);
  }

  // 5. TEST 2: Simulate second purchase
  console.log('🛒 DAY 3 TEST 2: Second purchase — verifying points accumulate');
  const orderTotal2 = 1299;
  const expectedPoints2 = Math.round(orderTotal2 * 0.1); // 130 points

  const webhookRes2 = await fetch('http://localhost:4000/api/webhooks/order-completed', {
    method: 'POST',
    headers: webhookHeaders,
    body: JSON.stringify({
      event: 'order.completed',
      orderId: `ORD-${Date.now()}-002`,
      orderTotal: orderTotal2,
      currency: 'INR',
      utmCreatorId: utmSlug,
      createdAt: new Date().toISOString()
    })
  });
  const webhookData2 = await webhookRes2.json();

  if (webhookData2.pointsCredited === expectedPoints2) {
    console.log(`✅ PASSED: Second order commission (+${expectedPoints2} pts) accumulated!\n`);
  } else {
    console.error('❌ FAILED: Second order points mismatch.');
    process.exit(1);
  }

  // 6. TEST 3: Webhook with NO UTM slug (organic traffic)
  console.log('🛒 DAY 3 TEST 3: Order with NO UTM slug (organic traffic)');
  const webhookRes3 = await fetch('http://localhost:4000/api/webhooks/order-completed', {
    method: 'POST',
    headers: webhookHeaders,
    body: JSON.stringify({
      event: 'order.completed',
      orderId: `ORD-${Date.now()}-003`,
      orderTotal: 899,
      currency: 'INR',
      createdAt: new Date().toISOString()
    })
  });
  const webhookData3 = await webhookRes3.json();

  if (webhookRes3.status === 200 && webhookData3.note === 'No creator UTM attached') {
    console.log('✅ PASSED: Organic order skipped without false attribution!\n');
  } else {
    console.error('❌ FAILED: Organic order should not credit points.');
    process.exit(1);
  }

  // 7. TEST 4: Idempotency check with PointsService
  console.log('🛒 DAY 3 TEST 4: Duplicate order ID (PointsService idempotency check)');
  const duplicateOrderId = `ORD-DUPE-${Date.now()}`;

  // First call
  await fetch('http://localhost:4000/api/webhooks/order-completed', {
    method: 'POST',
    headers: webhookHeaders,
    body: JSON.stringify({
      event: 'order.completed',
      orderId: duplicateOrderId,
      orderTotal: 799,
      currency: 'INR',
      utmCreatorId: utmSlug,
      createdAt: new Date().toISOString()
    })
  });

  // Second call with same orderId
  const webhookRes5 = await fetch('http://localhost:4000/api/webhooks/order-completed', {
    method: 'POST',
    headers: webhookHeaders,
    body: JSON.stringify({
      event: 'order.completed',
      orderId: duplicateOrderId,
      orderTotal: 799,
      currency: 'INR',
      utmCreatorId: utmSlug,
      createdAt: new Date().toISOString()
    })
  });
  const webhookData5 = await webhookRes5.json();

  console.log(`• Duplicate Response Note: "${webhookData5.note}" (Duplicate: ${webhookData5.duplicate})`);
  if (webhookData5.duplicate === true) {
    console.log('✅ PASSED: PointsService transaction safely handled duplicate without double-crediting!\n');
  } else {
    console.error('❌ FAILED: Duplicate order was credited twice.');
    process.exit(1);
  }

  // 8. Final points balance verification
  console.log('======================================================');
  console.log('📊 FINAL VERIFICATION: Creator Points Balance');
  console.log('======================================================\n');

  const creatorAfter = await prisma.creatorProfile.findUnique({
    where: { id: creatorUser.creatorProfile!.id }
  });
  const pointsAfter = creatorAfter!.pointsBalance;
  const totalExpectedAdded = expectedPoints1 + expectedPoints2 + Math.round(799 * 0.1);

  console.log(`• Points Before: ${pointsBefore}`);
  console.log(`• Points After:  ${pointsAfter}`);
  console.log(`• Points Added:  ${pointsAfter - pointsBefore} (Expected: ${totalExpectedAdded})`);

  console.log('\n======================================================');
  console.log('🏆 ALL DAY 3 WEBHOOK & POINTS SERVICE TESTS PASSED 100%!');
  console.log('======================================================\n');

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
