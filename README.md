<img width="1206" height="478" alt="otu logo (1)" src="https://github.com/user-attachments/assets/2f22d5c2-3938-4d22-8228-1f01db155e59" /><br/>

# Outta the Units

Outta the Units is an on-chain escrow and provenance layer for private, property-specific Berkeley housing intelligence. A former tenant can sell an encrypted report about a unit without putting their lease, email, or other private evidence on-chain.

## What is implemented

`contracts/OuttaTheUnits.sol` provides:

- Report listings with a cryptographic commitment, price, seller truth bond, and delivery bond.
- Buyer payment held in contract escrow until the buyer verifies the delivered ciphertext and revealed-key commitment.
- Buyer-confirmed settlement and an automatic refund path after a missed delivery deadline.
- A challenge window for each delivered report.
- Staked arbitrator registration, a five-member panel selected at dispute creation, and commit-reveal voting.
- Majority dispute resolution, truth-bond slashing, and consensus-arbitrator rewards.
- Arbitrator stake withdrawal outside active panels, non-reveal penalties, seller outcome counters, and on-chain report corroboration.
- No admin wallet, privileged withdrawal, centralized verifier, or plaintext evidence storage.

The contract records hashes and payment state only. Report ciphertext and the decryption key are exchanged off-chain. The intended delivery flow is:

1. Seller enters a structured report locally, selects the private evidence file, and encrypts both with a random symmetric key.
2. Seller commits the evidence-file hash, report hash, ciphertext hash, and key hash through the listing and delivery transactions.
3. Buyer pays the exact report price into escrow.
4. Seller uploads the encrypted delivery package to the local API and shares its one-time access token with the buyer.
5. Buyer retrieves the package with the token, verifies both on-chain commitments, decrypts locally, and confirms delivery with the key preimage on-chain.

## Trust model and limitations

This prototype does not create an oracle for subjective truth. Evidence commitments prove that a later claim can be tied to committed private material; they do not prove that an arbitrary experience is objectively true. Corroboration, seller reputation, collateral, disputes, and eventually observable outcomes are separate confidence signals.

Panel selection uses block-derived randomness and exactly five registered arbitrators, but it is not a bias-resistant VRF-based selection scheme. A production deployment should replace this with Chainlink VRF or another externally verifiable randomness beacon. A colluding majority remains possible. Purchased information can also be copied after decryption, and package transport remains an external availability concern.

The repository now includes a concrete Groth16 claim circuit in `zk/claim.circom`. It proves that a private `(evidenceDigest, amount, salt)` tuple hashes to the report commitment and that the private amount equals the public claimed amount. The generated verifier is deployed by `OuttaTheUnits`, and sellers submit proofs through `verifyClaim`. Run `npm run zk:build` to regenerate the circuit artifacts and `npm run zk:smoke` to generate and verify a proof locally.

## Run locally

Requirements: Node.js 20 or newer.

```sh
npm install
npm test
npm run compile
```

The tests cover successful escrow settlement, missed-delivery refunds, and a commit-reveal dispute.

## Deploy to a public testnet

Sepolia is the default example below. Base Sepolia is also configured. Use a burner wallet and testnet ETH only.

1. Create a JSON-RPC endpoint at a provider such as Alchemy or Infura, and obtain Sepolia ETH from a faucet.
2. Copy the environment template and fill in the RPC URL and deployer private key:

```sh
cp .env.example .env
```

`DEPLOYER_PRIVATE_KEY` must never be committed. `.env` is ignored by git.

3. Compile and deploy:

```sh
npm install
npm run compile
npm run deploy:sepolia
```

The deploy script prints the contract address and Sepolia Etherscan URL. For Base Sepolia, set `BASE_SEPOLIA_RPC_URL` and run:

```sh
npm run deploy:base-sepolia
```

4. Verify the source on the explorer. The contract has no constructor arguments:

```sh
npx hardhat verify --network sepolia YOUR_CONTRACT_ADDRESS
```

The deployed address and explorer link should be added to this README and to the demo app configuration.

## Frontend

The Next.js app is the first screen of the product. It includes a dark Berkeley map workspace, address search, locked report metadata, provenance indicators, and a wallet purchase action wired to `purchaseReport`.

Create `.env.local` with the public Mapbox token and deployed contract address:

```sh
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_public_token
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

Get a Mapbox public token from the Mapbox account dashboard. The UI uses a styled map fallback when the token is absent. Start it with:

```sh
npm run dev
```

Then open `http://localhost:3000`. For production, use `npm run build && npm start` and set the same public environment variables in the hosting provider.

When `NEXT_PUBLIC_RPC_URL` and `NEXT_PUBLIC_CONTRACT_ADDRESS` are present, the frontend reads `nextReportId()` and each on-chain `reports(reportId)` record on load. The cards then show live price, seller, collateral, commitment, and lifecycle state. The purchase button signs `purchaseReport(reportId)` through the connected wallet.

## Testing CLI

After compiling and deploying, put the RPC endpoint, deployed contract address, and a testnet-only wallet key in `.env` using the fields in `.env.example`. Then run:

```sh
npm run cli -- info
npm run cli -- create 0.01 60
npm run cli -- report 0
```

The write commands use the configured wallet:

```sh
npm run cli -- buy 0
npm run cli -- deliver 0
npm run cli -- confirm 0
npm run cli -- register-arbitrator
```

`create` makes a sample listing with a 60-minute delivery deadline, a `0.03 ETH` truth bond, and a `0.005 ETH` delivery bond. `deliver` records sample hashes only; it does not send real ciphertext. The CLI prints transaction hashes and explorer links for Sepolia and Base Sepolia.

To populate the configured Sepolia deployment with six synthetic campus-area listings, run:

```sh
npm run seed:sepolia
```

The seeder is resumable and refuses to duplicate its marker dataset. The records are fictional demo data, not claims about real properties or landlords. If the target address is an older deployment without `associateReportProperty`, listings are still written but property association requires deploying the current contract.

## Contract workflow

The seller calls `createReport` with a report commitment, price, delivery deadline, challenge period, truth bond, and delivery bond. The seller sends both bonds with the transaction.

The buyer calls `purchaseReport(reportId)` with the exact price. The seller then calls `deliverReport(reportId, ciphertextHash, keyCommitment)`. A buyer who receives and verifies the ciphertext calls `confirmDelivery(reportId)`. If delivery misses its deadline, the buyer calls `claimRefund(reportId)`.

During the challenge period, the buyer can call `openDispute` once five arbitrators are registered. The contract selects five panel members, who commit `keccak256(abi.encode(sellerValid, salt))`, reveal the vote and salt, and must all reveal before anyone can call `resolveDispute`. A losing report sends 80% of the truth bond to the buyer and makes 20% available to majority arbitrators.

## Design decision

Buyers purchase encrypted, property-specific intelligence rather than public reviews. Sellers keep source evidence on their own devices, commit to it cryptographically, and stake collateral. Payment is held in on-chain escrow and released only after committed encrypted delivery.

## Remaining production work

The contract and UI now include ZK claim verification, stake accountability, corroboration, and an arbitrator console. The local Next.js API provides token-gated encrypted package transport for development; production should replace its filesystem store with durable encrypted P2P/IPFS transport. Panel selection still uses block-derived randomness and should be replaced with VRF, and all cryptography should be audited.
