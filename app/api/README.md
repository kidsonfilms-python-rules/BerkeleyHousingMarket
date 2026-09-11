# Outta the Units API

Base URL: `https://outtatheunits.siddharthray.com/api/`

The agent-facing endpoints never custody a wallet or sign a transaction. An
agent uses the returned unsigned transaction request with its own wallet.

## Discovery

### `GET /api`

Returns the available public API endpoints.

### `GET /api/marketplace/reports`

Returns the configured contract, chain ID, and every on-chain report. Each
report includes its state, price, evidence commitment, ZK-verification status,
and a ready-to-sign `purchaseReport` transaction object.

## Agent purchase preparation

### `POST /api/agents/purchase`

Builds an unsigned purchase transaction for an available listing.

Request:

```json
{ "reportId": 0 }
```

Successful response:

```json
{
  "transaction": {
    "chainId": 11155111,
    "to": "0x…",
    "value": "10000000000000000",
    "data": "0x…"
  }
}
```

The agent must check the chain ID, then sign and submit this transaction with
its own wallet. The contract atomically records the buyer and locks the price
in escrow.

## Encrypted delivery transport

### `POST /api/deliveries`

Sellers upload an encrypted package after their listing exists on-chain. The
request includes the package plus a wallet signature for the exact upload
authorization message. The service verifies that signer is the report's
on-chain seller before storing the package.

### `GET /api/deliveries`

Buyers retrieve a package using `reportId`, `address`, `timestamp`, and
`signature` query parameters. The service verifies the signed request, checks
that the address is the report's on-chain buyer, and requires the report to be
in a deliverable state. Authorizations expire after five minutes.

The package is encrypted; the buyer verifies its ciphertext and key commitments
against the contract before decrypting locally and calling `confirmDelivery`.

## Purchase callback

### `POST /api/deliveries/release`

Configure a confirmed `ReportPurchased` event worker to call this endpoint:

```http
Authorization: Bearer $DELIVERY_CALLBACK_SECRET
Content-Type: application/json

{"reportId":"0"}
```

The callback re-checks the report on-chain and records the buyer eligible for
the package. It is idempotent: retries are safe. It never moves funds; payment
is released only by the buyer's on-chain `confirmDelivery` transaction.

## Required server environment

```env
RPC_URL=https://your-sepolia-rpc
CONTRACT_ADDRESS=0xYourV2Contract
DELIVERY_CALLBACK_SECRET=long-random-server-only-secret
```

Do not expose `DELIVERY_CALLBACK_SECRET`, private keys, or agent wallet keys
through `NEXT_PUBLIC_*` variables.
