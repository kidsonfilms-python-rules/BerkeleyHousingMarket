#!/usr/bin/env bash
set -euo pipefail

# Curl smoke test for the HTTP portions of the Outta the Units protocol.
# Required: API_BASE, REPORT_ID. Supply signed authorizations to test delivery.
# Example: API_BASE=http://localhost:3000 REPORT_ID=0 bash scripts/test-api.sh

: "${API_BASE:?Set API_BASE, e.g. http://localhost:3000}"

if [[ -n "${SELLER_PRIVATE_KEY:-}" && -n "${BUYER_PRIVATE_KEY:-}" && -n "${RPC_URL:-}" && -n "${CONTRACT_ADDRESS:-}" ]]; then
  exec node "$(dirname "$0")/api-protocol-smoke.js"
fi

: "${REPORT_ID:?Set REPORT_ID for an existing on-chain report, or set SELLER_PRIVATE_KEY and BUYER_PRIVATE_KEY for a full run}"

api="${API_BASE%/}/api"

request() {
  local label="$1"
  shift
  printf '\n== %s ==\n' "$label"
  curl --silent --show-error --fail-with-body "$@"
  printf '\n'
}

request "API discovery" "$api"
request "Agent listing discovery" "$api/marketplace/reports"
request "Unsigned agent purchase transaction" \
  --request POST --header 'content-type: application/json' \
  --data "{\"reportId\":${REPORT_ID}}" \
  "$api/agents/purchase"

cat <<'EOF'

Next, use the preceding unsigned transaction with the buyer's own wallet.
Wait for its Sepolia confirmation before testing buyer retrieval. Curl cannot
sign or submit that wallet transaction safely on the agent's behalf.
EOF

# Seller package upload requires a seller signature over exactly:
# Outta the Units delivery upload authorization
# Report ID: REPORT_ID
# Issued at: SELLER_TIMESTAMP
if [[ -n "${SELLER_ADDRESS:-}" && -n "${SELLER_TIMESTAMP:-}" && -n "${SELLER_SIGNATURE:-}" && -n "${DELIVERY_PACKAGE_FILE:-}" ]]; then
  request "Seller encrypted-package upload" \
    --request POST --header 'content-type: application/json' \
    --data "$(jq --arg address "$SELLER_ADDRESS" --arg timestamp "$SELLER_TIMESTAMP" --arg signature "$SELLER_SIGNATURE" '. + {authorization: {address: $address, timestamp: ($timestamp | tonumber), signature: $signature}}' "$DELIVERY_PACKAGE_FILE")" \
    "$api/deliveries"
else
  echo "Skipping seller upload. Set SELLER_ADDRESS, SELLER_TIMESTAMP, SELLER_SIGNATURE, and DELIVERY_PACKAGE_FILE."
fi

# Buyer retrieval requires a buyer signature over exactly:
# Outta the Units delivery retrieve authorization
# Report ID: REPORT_ID
# Issued at: BUYER_TIMESTAMP
if [[ -n "${BUYER_ADDRESS:-}" && -n "${BUYER_TIMESTAMP:-}" && -n "${BUYER_SIGNATURE:-}" ]]; then
  request "Buyer encrypted-package retrieval" \
    --get --data-urlencode "reportId=$REPORT_ID" --data-urlencode "address=$BUYER_ADDRESS" \
    --data-urlencode "timestamp=$BUYER_TIMESTAMP" --data-urlencode "signature=$BUYER_SIGNATURE" \
    "$api/deliveries"
else
  echo "Skipping buyer retrieval. Set BUYER_ADDRESS, BUYER_TIMESTAMP, and BUYER_SIGNATURE after purchase confirmation."
fi

if [[ -n "${DELIVERY_CALLBACK_SECRET:-}" ]]; then
  request "Confirmed-purchase callback (idempotent)" \
    --request POST --header "authorization: Bearer $DELIVERY_CALLBACK_SECRET" \
    --header 'content-type: application/json' --data "{\"reportId\":\"$REPORT_ID\"}" \
    "$api/deliveries/release"
else
  echo "Skipping callback. Set DELIVERY_CALLBACK_SECRET to test the release worker endpoint."
fi
