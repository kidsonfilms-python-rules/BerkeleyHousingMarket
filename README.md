# Outta the Units

## Vertical

I've been spending the past few days looking at options for apartments next year (just moved into dorms btw) and I found a lack of quality tenant experiances in these places. Outta the Units (play on words with getting outta the projects) is a marketplace for private, property-specific Berkeley rental intelligence. Current and former tenants can sell information about deposit returns, maintenance history, lease clauses, and living conditions to prospective renters. Listings publish a property address, report category, price, collateral, and cryptographic commitments; the underlying report and supporting evidence remain encrypted until purchase.

## Trust assumptions

The protocol assumes the blockchain correctly holds escrow, records commitments, enforces deadlines, and resolves the contract’s stated outcomes. Sellers stake truth and delivery bonds, buyers can verify delivered ciphertext/key commitments locally, and disputes are decided through a staked commit-reveal random arbitrator panel. Evidence commitments and ZK claim verification establish that a seller committed to particular private material and amount; they do not prove that every subjective housing claim is objectively true.

## Biggest design decision

The marketplace uses on-chain escrow and precommitted encrypted delivery. A seller commits delivery hashes when creating a listing, so purchase atomically locks payment and moves the report into a deliverable state. The encrypted package is released only to the on-chain buyer through authenticated backend transport, while the buyer retains the ability to verify the package before releasing escrow payment.

## Important limitation

This is paid early access, not permanent DRM. The buyer cannot inspect the report before paying, but after delivery a buyer can copy it and share it to anyone they please. In the current settlement design, the key revealed to confirm delivery is public on-chain, so anyone who later obtains the ciphertext package could decrypt it. Permanent buyer-exclusive access would require buyer-specific encryption, proxy/threshold re-encryption, or a trusted key-release system.
