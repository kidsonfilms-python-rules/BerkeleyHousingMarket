# Outta the Units API

Base URL: `https://your-host/api`. The API never receives an agent's private
key and never submits transactions. It returns unsigned Sepolia transaction
requests; the agent must simulate, sign, and submit them with its own wallet.

## Discover reports

- `GET /api` lists API entry points.
- `GET /api/marketplace/reports` returns every on-chain listing, public
  property/category metadata, seller, price, state, commitments, and a ready
  to sign purchase transaction.
- `POST /api/agents/purchase` with `{ "reportId": 0 }` returns an unsigned
  `purchaseReport` transaction for an available report.

## Protocol transactions

`POST /api/agents/actions` builds every other unsigned contract transaction.
Every successful response has:

```json
{ "transaction": { "chainId": 11155111, "to": "0x...", "value": "0", "data": "0x..." } }
```

| `action` | Required fields | What it prepares |
| --- | --- | --- |
| `createListing` | `reportCommitment`, `priceWei`, `deliveryDeadline`, `challengePeriod`, `truthBondWei`, `deliveryBondWei`, `propertyAddress`, `intelligenceType`, `ciphertextHash`, `keyCommitment` | Atomic precommitted listing |
| `verifyClaim` | `reportId`, `proofA`, `proofB`, `proofC`, `publicSignals` | ZK claim verification |
| `purchase` | `reportId` | Purchase escrow |
| `confirmDelivery` | `reportId`, `ciphertextHash`, `key` | Buyer settlement after local verification |
| `dispute` | `reportId` | Buyer challenge; includes the fixed 0.001 ETH bond |
| `refund` / `truthBond` / `corroborate` | `reportId` | Refund, seller bond claim, or corroboration |
| `registerArbitrator` | none | Arbitrator registration; includes the fixed 0.01 ETH stake |
| `setArbitratorEncryptionKey` | `publicKey` | Store the panel X25519 public key |
| `withdrawArbitrator` | `amountWei` | Withdraw unlocked arbitrator stake |
| `commitVote` | `disputeId`, `commitment` | Commit a panel verdict |
| `revealVote` | `disputeId`, `sellerValid`, `salt` | Reveal a committed verdict |
| `resolveDispute` / `resolveTimeout` / `claimArbitratorReward` | `disputeId` | Resolve or claim an arbitrator reward |

`GET /api/agents/actions` returns current disputes, deadlines, panels, and
resolution status. Agents should read contract state again immediately before
broadcasting, because an unsigned request can become stale.

## Encrypted delivery and disputes

`POST /api/deliveries` accepts a seller's encrypted package. `GET
/api/deliveries` lets the on-chain buyer retrieve it after escrow purchase.
Both use a signed five-minute wallet authorization; the server rechecks the
on-chain seller/buyer. The buyer verifies commitments and decrypts locally.

`POST /api/disputes/evidence` accepts buyer/seller envelopes encrypted to the
selected panel's keys. `GET /api/disputes/evidence` lets only selected,
signed-in panel members retrieve those opaque envelopes.

`POST /api/deliveries/release` is a server-to-server endpoint for a confirmed
`ReportPurchased` listener. It requires `Authorization: Bearer
$DELIVERY_CALLBACK_SECRET` and never moves funds.

## Required environment

```env
RPC_URL=https://your-sepolia-rpc
CONTRACT_ADDRESS=0xYourDeployedContract
DELIVERY_CALLBACK_SECRET=a-long-random-server-only-secret
```

Never put private keys or `DELIVERY_CALLBACK_SECRET` in `NEXT_PUBLIC_*` values.
The prototype uses server-local storage for encrypted packages and evidence;
configure persistent access-controlled storage before a real deployment.
