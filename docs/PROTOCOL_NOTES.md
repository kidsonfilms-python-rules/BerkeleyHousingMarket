# Outta the Units protocol notes

Outta the Units is a marketplace for private, property-specific Berkeley rental
intelligence. Current or former tenants can sell reports about deposit outcomes,
maintenance, lease terms, and living conditions without publishing their report
before a buyer pays into escrow.

## Listing and delivery

A seller enters a public property address, category, price, claim, and private
evidence file. The browser encrypts the report and evidence locally, then the
seller submits an atomic on-chain listing transaction that:

- stores the public address and category;
- stores a commitment to the private claim;
- precommits ciphertext and key hashes for delivery; and
- locks the seller's truth and delivery bonds.

After the listing transaction confirms, the browser uploads the encrypted
delivery package to the authenticated backend, then submits the ZK proof. The
proof proves consistency of the committed private inputs and claimed amount; it
does not prove a real-world housing claim is true.

When a different wallet purchases a precommitted listing, the exact price is
locked in escrow and the report immediately becomes `Delivered`. The contract
also starts the challenge period at that moment. The buyer signs a retrieval
request, the backend checks that address against the contract's buyer field,
and the browser verifies the stored ciphertext/key commitments before local
decryption. The app disables decryption unless the connected wallet is that
on-chain buyer.

The buyer must choose one of two paths during the challenge period:

- **Confirm delivery:** The buyer submits the ciphertext hash and key. The
  contract verifies both commitments, sends the price plus delivery bond to the
  seller, and marks the report `Settled`. Once the already-running challenge
  period ends, the seller can claim the truth bond.
- **Open a dispute:** The buyer stakes the fixed 0.001 ETH challenge bond and
  moves the report to `Disputed` before confirming delivery.

The fixed 60-minute missed-delivery refund is primarily for legacy listings
that are bought while still in `Purchased` state. New atomic/precommitted
listings become deliverable during purchase, so they normally cannot enter that
refund path.

## Disputes and arbitration

To open a dispute, the buyer must be within the challenge period and the
contract must have at least five registered arbitrator addresses. The contract
selects a five-wallet panel, locks 0.01 ETH of each selected wallet's stake,
and sets a five-minute commit phase followed by a five-minute reveal phase in
the demo deployment.

Arbitrators should register their X25519 public review key before selection.
The buyer and seller can then encrypt a separate private case-statement
envelope for every selected panel member. The backend verifies party/panel
authorization and stores only those encrypted envelopes; each selected panel
member decrypts its own envelope locally with its browser-stored private key.

Each selected arbitrator commits a hash of its verdict and salt, then reveals
the exact same verdict and salt after the commit deadline. Anyone may resolve
after the reveal deadline:

- If every panel member revealed, the majority determines whether the seller is
  valid. A seller-valid decision marks the report `Settled` and sends the price,
  both seller bonds, and the buyer's challenge bond to the seller.
- If the panel is incomplete, anyone uses the timeout resolver; the report is
  treated as invalid.
- An invalid outcome sends the buyer their price, 80% of the truth bond, and
  their challenge bond. The seller receives the delivery bond. The remaining
  truth bond funds eligible arbitrator rewards.

Non-revealing arbitrators lose 20% of the 0.01 ETH selected stake. Minority
arbitrators record a loss and receive no reward, but their stake is not
currently slashed. Winning revealed arbitrators can claim their share of the
reward pool.

## Trust score shown to buyers

The UI derives a score from all reports loaded from the configured contract for
the same seller address. It is an explainable display heuristic, not an
on-chain oracle:

```text
start at 50
+12 for each Settled report
+8 for each ZK-verified report
+3 for each displayed on-chain property corroboration, capped at +12
-15 for each Refunded report
-30 for each Invalid report
clamp to 0–100
```

The UI labels 75–100 as established history, 50–74 as new or mixed history,
and below 50 as a reason to review collateral and evidence carefully. It does
not include bond size, vote margin, time weighting, tenant identity, or
Sybil-resistance. Corroboration is wallet-based and should not be interpreted
as verified tenancy.

## Agent API

Agents can discover listings through `GET /api/marketplace/reports`, retrieve
dispute/panel state with `GET /api/agents/actions`, and request unsigned
transactions through `POST /api/agents/purchase` or `POST
/api/agents/actions`. Supported action requests cover listing creation, ZK
verification, purchase, confirmation, dispute/refund/bond claims,
corroboration, arbitrator registration/key management, voting, resolution, and
reward claims. Delivery and private-evidence endpoints require a short-lived
wallet signature and recheck the relevant on-chain role.

The API does not custody an agent wallet or submit a transaction for it. Full
request formats are in [the API README](../app/api/README.md).

## Important limitations

- This is paid early access, not permanent DRM. The buyer receives the key from
  authenticated backend delivery before settlement; once they confirm delivery,
  that key is public transaction calldata. Information can be copied after
  disclosure.
- The backend stores the delivery package—including the symmetric delivery key
  supplied by the seller—and private evidence envelopes. It is therefore a
  confidentiality and availability trust boundary, even though it cannot decide
  payment or dispute outcomes.
- The current contract has no seller timeout settlement if a buyer decrypts
  successfully but never confirms delivery.
- Panel selection uses the historical registered-arbitrator array; a wallet
  that withdrew can still be selected. Filtering to actively staked arbitrators
  requires a contract upgrade and redeployment.
- The ZK proof and commitments verify consistency, not the objective truth of
  a rental claim. Human arbitrators resolve challenged subjective claims.
