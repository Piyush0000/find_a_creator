/**
 * Test WhatsApp Templates via WAPI (Live Verification Script)
 * Usage:
 *   pnpm --filter @evoc/api exec tsx ../../scripts/test-whatsapp-wapi.ts [PHONE_NUMBER] [TEMPLATE_NAME]
 * Example:
 *   pnpm --filter @evoc/api exec tsx ../../scripts/test-whatsapp-wapi.ts 919876543210 creator_brief_received
 */

import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const TOKEN = process.env.WAPI_TOKEN;
const VENDOR_UID = process.env.WAPI_VENDOR_UID;
const BASE_URL = (process.env.WAPI_BASE_URL || 'https://app.wapi.in.net/api').replace(/\/+$/, '');

if (!TOKEN || !VENDOR_UID) {
  console.error('❌ [CONFIG ERROR] Missing WAPI credentials in .env!');
  console.error('   Required: WAPI_TOKEN and WAPI_VENDOR_UID');
  process.exit(1);
}

function formatPhone(phone: string): string {
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) return `91${clean}`;
  return clean;
}

async function sendTemplate(
  phone: string,
  templateName: string,
  fields: Record<string, string>
) {
  const formattedPhone = formatPhone(phone);
  const url = `${BASE_URL}/${VENDOR_UID}/contact/send-template-message`;

  console.log(`\n======================================================`);
  console.log(`📲 Testing Template: '${templateName}'`);
  console.log(`📞 Recipient:        +${formattedPhone}`);
  console.log(`🌐 WAPI Endpoint:    ${url}`);
  console.log(`📦 Variables:        ${JSON.stringify(fields, null, 2)}`);
  console.log(`======================================================`);

  const payload = {
    phone_number: formattedPhone,
    template_name: templateName,
    template_language: 'en',
    ...fields
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const data: any = await res.json().catch(() => ({}));

    if (res.ok) {
      console.log(`\n🎉 SUCCESS! Message sent via WAPI.`);
      console.log(`   Status:   ${res.status} OK`);
      console.log(`   Log UID:  ${data?.log_uid || data?.messageId || 'ok'}`);
      console.log(`   Response:`, JSON.stringify(data));
      return true;
    } else {
      console.error(`\n❌ FAILED! WAPI returned HTTP ${res.status}`);
      console.error(`   Error:   `, data?.message || data?.error || data);
      return false;
    }
  } catch (err: any) {
    console.error(`\n💥 Network error:`, err.message);
    return false;
  }
}

async function main() {
  const targetPhone = process.argv[2] || process.env.TEST_WHATSAPP_PHONE;
  const targetTemplate = process.argv[3] || 'all';

  if (!targetPhone) {
    console.log(`\n⚠️  No phone number provided!`);
    console.log(`   Run with your 10-digit WhatsApp phone number:`);
    console.log(`   pnpm --filter @evoc/api exec tsx ../../scripts/test-whatsapp-wapi.ts 91XXXXXXXXXX [template_name]`);
    process.exit(0);
  }

  console.log(`🚀 Starting WAPI Live Test for: ${targetPhone}`);

  if (targetTemplate === 'all' || targetTemplate === 'creator_brief_received') {
    await sendTemplate(targetPhone, 'creator_brief_received', {
      field_1: 'Sai',
      field_2: 'Glow Skincare',
      field_3: 'Vitamin C Face Serum',
      field_4: '100 EVOC Points per sale'
    });
  }

  if (targetTemplate === 'all' || targetTemplate === 'draft_revision_alert') {
    await sendTemplate(targetPhone, 'draft_revision_alert', {
      field_1: 'Sai',
      field_2: 'Vitamin C Face Serum',
      field_3: 'Weak Opening Hook',
      field_4: 'Hook is too slow. Please deliver the first 3 seconds faster with brighter lighting.'
    });
  }

  if (targetTemplate === 'all' || targetTemplate === 'creator_sale_commission') {
    await sendTemplate(targetPhone, 'creator_sale_commission', {
      field_1: 'Vitamin C Face Serum',
      field_2: '150',
      field_3: '150',
      field_4: 'ORD-9842'
    });
  }
}

main();
