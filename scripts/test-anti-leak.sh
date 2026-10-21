#!/usr/bin/env bash

# EVOC Labs — Anti-Leak Security Engine Verification Test
# Tests 100% rejection of off-platform PII leaks in briefs

BASE_URL="http://localhost:4000"
echo "🛡️ Starting Anti-Leak Security Engine Tests against $BASE_URL..."

# 1. Login as Merchant to obtain Bearer Token
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"founder@glowskincare.com","password":"Password123!"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to authenticate as Merchant. Ensure the server and database are running."
  exit 1
fi
echo "✅ Authenticated as Merchant successfully."

# 2. Fetch sample Creator ID
CREATORS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/creators")
CREATOR_ID=$(echo "$CREATORS_RESPONSE" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4)

if [ -z "$CREATOR_ID" ]; then
  echo "❌ No creator found to target brief."
  exit 1
fi
echo "✅ Target Creator ID: $CREATOR_ID"

# 3. TEST 1: Phone number & Circumvention Leak Attempt (Should FAIL with 400)
echo ""
echo "--- TEST 1: Leak attempt with phone number ('call me on 9876543210') ---"
RESPONSE_CODE=$(curl -s -o /tmp/leak_test1.json -w "%{http_code}" -X POST "$BASE_URL/api/collabs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "creatorId": "'"$CREATOR_ID"'",
    "productName": "Glow Hydration Serum",
    "productLink": "https://glowskincare.in/products/serum",
    "productPrice": 799,
    "scriptGuidelines": "Please introduce the product and call me on 9876543210 to negotiate direct cash payment.",
    "videoHooks": "Are you tired of dry skin? Try this now!",
    "aspectRatio": "9:16",
    "deliverableType": "1 UGC Video Ad (30-60s)",
    "commissionPointsPerSale": 100
  }')

echo "HTTP Status: $RESPONSE_CODE"
cat /tmp/leak_test1.json
echo ""

if [ "$RESPONSE_CODE" -eq 400 ]; then
  echo "✅ TEST 1 PASSED: Leak attempt was strictly REJECTED with 400 Bad Request."
else
  echo "❌ TEST 1 FAILED: Expected 400 Bad Request, got $RESPONSE_CODE."
  exit 1
fi

# 4. TEST 2: Email & Instagram Handle Leak Attempt (Should FAIL with 400)
echo ""
echo "--- TEST 2: Leak attempt with email & Instagram handle ---"
RESPONSE_CODE=$(curl -s -o /tmp/leak_test2.json -w "%{http_code}" -X POST "$BASE_URL/api/collabs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "creatorId": "'"$CREATOR_ID"'",
    "productName": "Glow Hydration Serum",
    "productLink": "https://glowskincare.in/products/serum",
    "productPrice": 799,
    "scriptGuidelines": "Send draft directly to founder@glowskincare.com or dm on ig @glow_founder for offline deal.",
    "videoHooks": "This serum changed my skincare routine forever!",
    "aspectRatio": "9:16",
    "deliverableType": "1 UGC Video Ad (30-60s)",
    "commissionPointsPerSale": 100
  }')

echo "HTTP Status: $RESPONSE_CODE"
cat /tmp/leak_test2.json
echo ""

if [ "$RESPONSE_CODE" -eq 400 ]; then
  echo "✅ TEST 2 PASSED: Email & Instagram leak strictly REJECTED with 400 Bad Request."
else
  echo "❌ TEST 2 FAILED: Expected 400 Bad Request, got $RESPONSE_CODE."
  exit 1
fi

# 5. TEST 3: Clean Ad Brief (Should PASS with 201 Created)
echo ""
echo "--- TEST 3: Clean Ad Brief with zero contact leaks ---"
RESPONSE_CODE=$(curl -s -o /tmp/clean_test.json -w "%{http_code}" -X POST "$BASE_URL/api/collabs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "creatorId": "'"$CREATOR_ID"'",
    "productName": "Glow Hydration Serum",
    "productLink": "https://glowskincare.in/products/serum",
    "productPrice": 799,
    "scriptGuidelines": "Focus purely on product texture, 3-step application routine, and before/after skin glow results.",
    "videoHooks": "Watch my dry skin transform in just 30 seconds!",
    "aspectRatio": "9:16",
    "deliverableType": "1 UGC Video Ad (30-60s)",
    "commissionPointsPerSale": 100
  }')

echo "HTTP Status: $RESPONSE_CODE"
cat /tmp/clean_test.json
echo ""

if [ "$RESPONSE_CODE" -eq 201 ]; then
  echo "✅ TEST 3 PASSED: Clean brief PASSED with 201 Created."
else
  echo "❌ TEST 3 FAILED: Expected 201 Created, got $RESPONSE_CODE."
  exit 1
fi

echo ""
echo "🎉 ALL ANTI-LEAK SECURITY TESTS PASSED (100% REJECTION RATE VERIFIED)!"
