import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

import jwt from 'jsonwebtoken';
import { prisma } from '@evoc/database';

async function run() {
  console.log('🔍 Locating seeded Merchant and Creator in the database...');

  // 1. Fetch sample merchant
  const merchantUser = await prisma.user.findUnique({
    where: { email: 'founder@glowskincare.com' },
    include: { merchantProfile: true }
  });

  if (!merchantUser || !merchantUser.merchantProfile) {
    console.error('❌ Merchant user not found. Did you run `pnpm db:seed`?');
    process.exit(1);
  }

  // 2. Fetch sample creator
  const creatorUser = await prisma.user.findUnique({
    where: { email: 'rohit.creator@evoc.internal' },
    include: { creatorProfile: true }
  });

  if (!creatorUser || !creatorUser.creatorProfile) {
    console.error('❌ Creator user not found. Did you run `pnpm db:seed`?');
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_evoc_2026';

  // 3. Generate Merchant JWT
  const token = jwt.sign(
    {
      userId: merchantUser.id,
      email: merchantUser.email,
      role: merchantUser.role
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  console.log('\n======================================================');
  console.log('🔑 GENERATED MERCHANT JWT TOKEN:');
  console.log(token);
  console.log('======================================================\n');
  console.log(`Merchant Profile ID: ${merchantUser.merchantProfile.id}`);
  console.log(`Creator ID (Rohit):  ${creatorUser.creatorProfile.id}\n`);

  const briefPayload = {
    creatorId: creatorUser.creatorProfile.id,
    productName: 'Hydrating Face Serum',
    productLink: 'https://glowskincare.in/products/serum',
    productPrice: 1299,
    scriptGuidelines: 'Focus on morning skincare routine. Show texture on back of hand, then apply 3 drops to face. Highlight hyaluronic acid benefits.',
    videoHooks: 'Stop using serums that dry out your skin after 10 minutes!',
    aspectRatio: '9:16',
    deliverableType: '1 UGC Video Ad (30-60s)',
    commissionPointsPerSale: 130
  };

  console.log('📋 SAMPLE POSTMAN / CURL TEST PAYLOAD:');
  console.log(JSON.stringify(briefPayload, null, 2));

  console.log('\n🚀 READY-TO-RUN CURL COMMAND:');
  console.log(`curl -X POST http://localhost:4000/api/collabs \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '${JSON.stringify(briefPayload)}'`);
  console.log('======================================================\n');

  // 4. Attempt to test against running server if online
  try {
    const res = await fetch('http://localhost:4000/api/collabs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(briefPayload)
    });

    if (res.ok) {
      const data = await res.json();
      console.log('✅ TEST REQUEST SUCCESSFUL! Response from server:');
      console.log(data);
    } else {
      const errData = await res.text();
      console.log(`ℹ️ Server returned status ${res.status}: ${errData}`);
    }
  } catch {
    console.log('ℹ️ Server is not running on http://localhost:4000 yet. Start it with `pnpm dev` to test.');
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
