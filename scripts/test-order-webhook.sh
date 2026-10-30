#!/usr/bin/env bash
# ==============================================================================
# EVOC Checkout Webhook Simulator - Day 7 Suite
# Simulates external checkout webhook call for order completed event
# ==============================================================================

set -e

PORT=${API_PORT:-4000}
BASE_URL="http://localhost:$PORT"
ORDER_ID="ORD-$(date +%s)"
ORDER_TOTAL=1299
UTM_SLUG=${1:-"evoc_cr_demo"}

# Strict environment loading (Zero Fallback Policy)
if [ -z "$CHECKOUT_WEBHOOK_SECRET" ]; then
  if [ -f .env ]; then
    CHECKOUT_WEBHOOK_SECRET=$(grep -E '^CHECKOUT_WEBHOOK_SECRET=' .env | cut -d '=' -f2- | tr -d '"\r')
  elif [ -f ../../.env ]; then
    CHECKOUT_WEBHOOK_SECRET=$(grep -E '^CHECKOUT_WEBHOOK_SECRET=' ../../.env | cut -d '=' -f2- | tr -d '"\r')
  fi
fi

if [ -z "$CHECKOUT_WEBHOOK_SECRET" ]; then
  echo "❌ Error: CHECKOUT_WEBHOOK_SECRET environment variable is missing. Define it in your .env file."
  exit 1
fi

echo "🚀 Simulating EVOC Checkout Purchase Event..."
echo "• Endpoint:    $BASE_URL/api/webhooks/order-completed"
echo "• Order ID:    $ORDER_ID"
echo "• Order Total: ₹$ORDER_TOTAL"
echo "• UTM Slug:    $UTM_SLUG"
echo ""

curl -X POST "$BASE_URL/api/webhooks/order-completed" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $CHECKOUT_WEBHOOK_SECRET" \
  -d "{
    \"event\": \"order.completed\",
    \"orderId\": \"$ORDER_ID\",
    \"orderTotal\": $ORDER_TOTAL,
    \"currency\": \"INR\",
    \"utmCreatorId\": \"$UTM_SLUG\",
    \"createdAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
  }"

echo -e "\n\n✅ Webhook simulated successfully."
