const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DAY = 24 * 60 * 60;

async function createReport(contract, seller, overrides = {}) {
  const price = overrides.price ?? ethers.parseEther("0.01");
  const deliveryBond = overrides.deliveryBond ?? ethers.parseEther("0.005");
  const truthBond = overrides.truthBond ?? ethers.parseEther("0.03");
  const latest = await ethers.provider.getBlock("latest");
  const deadline = overrides.deadline ?? latest.timestamp + 3600;
  const commitment = overrides.commitment ?? ethers.keccak256(ethers.toUtf8Bytes("private report"));

  await contract.connect(seller).createReport(
    commitment,
    price,
    deadline,
    7 * DAY,
    truthBond,
    deliveryBond,
    { value: truthBond + deliveryBond }
  );

  return { price, deadline, truthBond, deliveryBond, commitment };
}

describe("OuttaTheUnits", function () {
  async function deployed() {
    const [seller, buyer, ...arbitrators] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("OuttaTheUnits");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();
    return { contract, seller, buyer, arbitrators };
  }

  it("escrows payment, records delivery commitments, and settles", async function () {
    const { contract, seller, buyer } = await deployed();
    const report = await createReport(contract, seller);

    await contract.connect(buyer).purchaseReport(0, { value: report.price });
    const ciphertextHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));
    const key = "key";
    await contract.connect(seller).deliverReport(0, ciphertextHash, ethers.keccak256(ethers.toUtf8Bytes(key)));
    expect((await contract.reports(0)).state).to.equal(2n);

    await contract.connect(buyer).confirmDelivery(0, ciphertextHash, key);
    expect((await contract.reports(0)).state).to.equal(3n);

    await ethers.provider.send("evm_increaseTime", [7 * DAY + 1]);
    await ethers.provider.send("evm_mine");
    await contract.connect(seller).claimTruthBond(0);
    expect((await contract.reports(0)).truthBondClaimed).to.equal(true);
  });

  it("atomically makes a precommitted package deliverable when purchased", async function () {
    const { contract, seller, buyer } = await deployed();
    const report = await createReport(contract, seller);
    const ciphertextHash = ethers.keccak256(ethers.toUtf8Bytes("preloaded ciphertext"));
    const keyCommitment = ethers.keccak256(ethers.toUtf8Bytes("preloaded key"));
    await contract.connect(seller).precommitDelivery(0, ciphertextHash, keyCommitment);
    await contract.connect(buyer).purchaseReport(0, { value: report.price });
    const stored = await contract.reports(0);
    expect(stored.state).to.equal(2n);
    expect(stored.ciphertextHash).to.equal(ciphertextHash);
  });

  it("refunds the buyer and forfeits only the delivery bond after a missed deadline", async function () {
    const { contract, seller, buyer } = await deployed();
    const latest = await ethers.provider.getBlock("latest");
    const report = await createReport(contract, seller, { deadline: latest.timestamp + 2 });

    await contract.connect(buyer).purchaseReport(0, { value: report.price });
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine");
    await contract.connect(buyer).claimRefund(0);

    expect((await contract.reports(0)).state).to.equal(6n);
  });

  it("rejects settlement when the delivered key does not match its commitment", async function () {
    const { contract, seller, buyer } = await deployed();
    const report = await createReport(contract, seller);
    const ciphertextHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));

    await contract.connect(buyer).purchaseReport(0, { value: report.price });
    await contract.connect(seller).deliverReport(0, ciphertextHash, ethers.keccak256(ethers.toUtf8Bytes("key")));

    await expect(contract.connect(buyer).confirmDelivery(0, ciphertextHash, "tampered-key"))
      .to.be.revertedWith("key mismatch");
  });

  it("accepts a valid Groth16 evidence claim and records its public amount", async function () {
    const { contract, seller } = await deployed();
    const build = path.join(__dirname, "..", "zk", "build");
    const proof = JSON.parse(fs.readFileSync(path.join(build, "proof-smoke", "proof.json")));
    const publicSignals = JSON.parse(fs.readFileSync(path.join(build, "proof-smoke", "public.json")));
    const commitment = ethers.zeroPadValue(ethers.toBeHex(publicSignals[1]), 32);
    const report = await createReport(contract, seller, { commitment });
    const proofA = [proof.pi_a[0], proof.pi_a[1]];
    const proofB = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
    const proofC = [proof.pi_c[0], proof.pi_c[1]];

    await contract.connect(seller).verifyClaim(0, proofA, proofB, proofC, publicSignals);
    const stored = await contract.reports(0);
    expect(stored.zkClaimVerified).to.equal(true);
    expect(stored.claimedAmount).to.equal(BigInt(publicSignals[0]));
  });

  it("records independent property corroboration and protects arbitrator stake", async function () {
    const { contract, seller, buyer, arbitrators } = await deployed();
    await createReport(contract, seller);
    const propertyId = ethers.keccak256(ethers.toUtf8Bytes("2301 Telegraph Ave"));
    await contract.connect(seller).associateReportProperty(0, propertyId);
    await contract.connect(buyer).corroborateReport(0);

    expect(await contract.propertyReportCount(propertyId)).to.equal(1n);
    expect(await contract.propertyCorroborationCount(propertyId)).to.equal(1n);

    await contract.connect(arbitrators[0]).registerArbitrator({ value: ethers.parseEther("0.01") });
    await expect(contract.connect(arbitrators[0]).withdrawArbitratorStake(ethers.parseEther("0.01")))
      .to.not.be.reverted;
  });

  it("supports permissionless arbitrator commit-reveal resolution", async function () {
    const { contract, seller, buyer, arbitrators } = await deployed();
    const report = await createReport(contract, seller);
    await contract.connect(buyer).purchaseReport(0, { value: report.price });
    const ciphertextHash = ethers.keccak256(ethers.toUtf8Bytes("ciphertext"));
    const key = "key";
    await contract.connect(seller).deliverReport(0, ciphertextHash, ethers.keccak256(ethers.toUtf8Bytes(key)));

    for (const arbitrator of arbitrators.slice(0, 5)) {
      await contract.connect(arbitrator).registerArbitrator({ value: ethers.parseEther("0.01") });
    }
    await contract.connect(buyer).openDispute(0, { value: ethers.parseEther("0.001") });
    const panel = await contract.getDisputePanel(0);
    const salts = [];
    for (const panelMember of panel) {
      const arbitrator = arbitrators.find((candidate) => candidate.address === panelMember);
      const salt = ethers.keccak256(ethers.toUtf8Bytes(`salt-${panelMember}`));
      salts.push({ arbitrator, salt });
      const encodedVote = ethers.AbiCoder.defaultAbiCoder().encode(["bool", "bytes32"], [true, salt]);
      await contract.connect(arbitrator).commitVote(0, ethers.keccak256(encodedVote));
    }

    await ethers.provider.send("evm_increaseTime", [DAY + 1]);
    await ethers.provider.send("evm_mine");
    for (const { arbitrator, salt } of salts) {
      await contract.connect(arbitrator).revealVote(0, true, salt);
    }
    await ethers.provider.send("evm_increaseTime", [DAY + 1]);
    await ethers.provider.send("evm_mine");
    await contract.resolveDispute(0);

    expect((await contract.reports(0)).state).to.equal(3n);
  });
});
