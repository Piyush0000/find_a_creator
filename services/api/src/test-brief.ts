import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import jwt from 'jsonwebtoken';
import { prisma } from '@evoc/database';

async function run() {
  console.log('🔍 Locating seeded Merchant and Creator in Supabase...');

  // 1. Fetch sample merchant
  const merchantUser = await prisma.user.findUnique({
    where: { email: 'founder@glowskincare.com' },
    include: { merchantProfile: true }
  });

  if (!merchantUser || !merchantUser.merchantProfile) {
    console.error('❌ Merchant user not found. Did you run `npx pnpm db:seed`?');
    process.exit(1);
  }

  // 2. Fetch sample creator
  const creatorUser = await prisma.user.findUnique({
    where: { email: 'rohit.creator@evoc.internal' },
    include: { creatorProfile: true }
  });

  if (!creatorUser || !creatorUser.creatorProfile) {
    console.error('❌ Creator user not found. Did you run `npx pnpm db:seed`?');
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

  console.log('📋 SAMPLE BRIEF PAYLOAD:');
  console.log(JSON.stringify(briefPayload, null, 2));

  console.log('\n🚀 SENDING TEST BRIEF TO http://localhost:4000/api/collabs ...');

  // 4. Send test request to running API server
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
      console.log('\n🎉 SUCCESS! Brief created in Supabase database:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\nDay 1 Brief Creation Goal is 100% COMPLETE! 🚀');
    } else {
      const errData = await res.text();
      console.log(`\n❌ Server returned status ${res.status}: ${errData}`);
    }
  } catch (err: any) {
    console.log(`\n⚠️ Could not reach server at http://localhost:4000: ${err.message}`);
    console.log('Ensure `npx pnpm --filter @evoc/api dev` is running in Terminal 1.');
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
