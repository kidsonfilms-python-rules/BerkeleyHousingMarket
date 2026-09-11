pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";

template EvidenceClaim() {
    signal input evidenceDigest;
    signal input amount;
    signal input salt;
    signal input claimedAmount;
    signal input commitment;

    claimedAmount === amount;

    component hash = Poseidon(3);
    hash.inputs[0] <== evidenceDigest;
    hash.inputs[1] <== amount;
    hash.inputs[2] <== salt;
    commitment === hash.out;
}

component main {public [commitment, claimedAmount]} = EvidenceClaim();
