# Outta the Units

## Vertical

I've been spending the past few days looking at options for apartments next year (just moved into dorms btw) and I found a lack of quality tenant experiances in these places. Outta the Units (play on words with getting outta the projects) is a marketplace for private, property-specific Berkeley rental intelligence. Current and former tenants can sell information about deposit returns, maintenance history, lease clauses, and living conditions to prospective renters. Listings publish a property address, report category, price, collateral, and cryptographic commitments; the underlying report and supporting evidence remain encrypted until purchase. Anyone can buy this information, from prospective renters trying to sus out their options to even competing landlords looking at what people think about their competition (and they are more likeley to agenticly buy this info).

## Trust assumptions

The protocol assumes the blockchain correctly holds escrow, records commitments, enforces deadlines, and resolves the contract’s stated outcomes. Sellers stake truth and delivery bonds, buyers can verify delivered ciphertext/key commitments locally, and disputes are decided through a staked commit-reveal arbitrator panel. Evidence commitments and ZK claim verification establish that a seller committed to particular private material and amount; they do not prove that every potentially subjective housing claim (fully subjective claims are discouraged) is objectively true. During a dispute, either party may submit private evidence encrypted to the selected panel; the backend cannot decide the outcome or move funds.

## Biggest design decision

The marketplace uses on-chain escrow and precommitted encrypted delivery. A seller commits delivery hashes when creating a listing, so purchase atomically locks payment and moves the report into a deliverable state. The encrypted package is released only to the on-chain buyer through authenticated backend transport, while the buyer retains the ability to verify the package before releasing escrow payment.

## Important limitation

Many of the most meaningful rental claims cannot be objectively verified quickly. A deposit outcome may only be clear after move-out, a maintenance pattern can take months to establish, and a landlord response may depend on facts outside the protocol. Outta the Units can verify that a seller committed to evidence and delivered the promised encrypted package, but it cannot immediately verify that every real-world claim is true. Bonds, corroboration, disputes, and later reputation outcomes reduce this risk; they do not eliminate it. It is also paid early access rather than permanent DRM: a buyer can copy a report after disclosure.
