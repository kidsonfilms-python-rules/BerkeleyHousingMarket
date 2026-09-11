#!/usr/bin/env node

require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const states = ["Listed", "Purchased", "Delivered", "Settled", "Disputed", "Invalid", "Refunded"];
const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "OuttaTheUnits.sol", "OuttaTheUnits.json");

function usage() {
  console.log(`Outta the Units test CLI

Environment:
  RPC_URL=...                 JSON-RPC endpoint
  CONTRACT_ADDRESS=0x...      deployed OuttaTheUnits address
  PRIVATE_KEY=0x...           wallet used for write commands

Commands:
  info                              Show network, wallet, and contract counters
  report <id>                       Show report metadata
  create [priceEth] [deadlineMin]  Create a sample report listing
  buy <id>                         Purchase a listed report
  deliver <id>                     Record sample ciphertext/key commitments
  confirm <id>                     Confirm delivered report
  refund <id>                      Claim a missed-delivery refund
  register-arbitrator              Stake the minimum arbitrator amount

Examples:
  npm run cli -- info
  npm run cli -- create 0.01 60
  npm run cli -- report 0
  npm run cli -- buy 0
  npm run cli -- deliver 0
  npm run cli -- confirm 0
`);
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to .env`);
  return value;
}

function loadContract() {
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Contract artifact missing. Run npm run compile first.");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(required("RPC_URL"));
  const address = required("CONTRACT_ADDRESS");
  const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  const signer = privateKey ? new ethers.Wallet(privateKey, provider) : null;
  const contract = new ethers.Contract(address, artifact.abi, signer || provider);
  return { contract, provider, signer };
}

function requireSigner(signer) {
  if (!signer) throw new Error("This command writes to the chain. Set PRIVATE_KEY in .env.");
  return signer;
}

function short(value) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function printReceipt(receipt) {
  console.log(`Transaction: ${receipt.hash}`);
  console.log(`Block: ${receipt.blockNumber}`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }

  const { contract, provider, signer } = loadContract();
  const network = await provider.getNetwork();
  console.log(`Network: ${network.name} (${network.chainId})`);

  if (command === "info") {
    console.log(`Contract: ${contract.target}`);
    console.log(`Next report ID: ${await contract.nextReportId()}`);
    console.log(`Next dispute ID: ${await contract.nextDisputeId()}`);
    if (signer) {
      console.log(`Wallet: ${signer.address}`);
      console.log(`Balance: ${ethers.formatEther(await provider.getBalance(signer.address))} ETH`);
    }
    return;
  }

  if (command === "report") {
    const id = requireId(args[0]);
    const report = await contract.reports(id);
    console.log(JSON.stringify({
      id,
      seller: report.seller,
      buyer: report.buyer,
      priceEth: ethers.formatEther(report.price),
      truthBondEth: ethers.formatEther(report.truthBond),
      deliveryBondEth: ethers.formatEther(report.deliveryBond),
      deliveryDeadline: new Date(Number(report.deliveryDeadline) * 1000).toISOString(),
      challengeEndsAt: report.challengeEndsAt === 0n ? null : new Date(Number(report.challengeEndsAt) * 1000).toISOString(),
      reportCommitment: report.reportCommitment,
      ciphertextHash: report.ciphertextHash,
      keyCommitment: report.keyCommitment,
      state: states[Number(report.state)],
      truthBondClaimed: report.truthBondClaimed
    }, null, 2));
    return;
  }

  requireSigner(signer);

  if (command === "create") {
    const price = ethers.parseEther(args[0] || "0.01");
    const deadlineMinutes = Number(args[1] || 60);
    const latest = await provider.getBlock("latest");
    const commitment = ethers.keccak256(ethers.toUtf8Bytes(`sample private report ${Date.now()}`));
    const deadline = Number(latest.timestamp) + deadlineMinutes * 60;
    const challengePeriod = 7 * 24 * 60 * 60;
    const truthBond = ethers.parseEther("0.03");
    const deliveryBond = ethers.parseEther("0.005");
    console.log("Creating sample listing...");
    const tx = await contract.createReport(
      commitment,
      price,
      deadline,
      challengePeriod,
      truthBond,
      deliveryBond,
      { value: truthBond + deliveryBond }
    );
    const receipt = await tx.wait();
    printReceipt(receipt);
    console.log("Sample report commitment:", commitment);
    return;
  }

  const id = requireId(args[0]);
  let tx;
  if (command === "buy") {
    const report = await contract.reports(id);
    console.log(`Purchasing report ${id} for ${ethers.formatEther(report.price)} ETH...`);
    tx = await contract.purchaseReport(id, { value: report.price });
  } else if (command === "deliver") {
    const ciphertextHash = ethers.keccak256(ethers.toUtf8Bytes(`sample ciphertext ${id}`));
    const keyCommitment = ethers.keccak256(ethers.toUtf8Bytes(`sample key ${id}`));
    console.log(`Recording delivery commitments for report ${id}...`);
    tx = await contract.deliverReport(id, ciphertextHash, keyCommitment);
    console.log("Ciphertext hash:", ciphertextHash);
    console.log("Key commitment:", keyCommitment);
  } else if (command === "confirm") {
    console.log(`Confirming delivery for report ${id}...`);
    tx = await contract.confirmDelivery(id);
  } else if (command === "refund") {
    console.log(`Claiming refund for report ${id}...`);
    tx = await contract.claimRefund(id);
  } else if (command === "register-arbitrator") {
    const minimumStake = await contract.MIN_ARBITRATOR_STAKE();
    console.log(`Registering arbitrator with ${ethers.formatEther(minimumStake)} ETH...`);
    tx = await contract.registerArbitrator({ value: minimumStake });
  } else {
    usage();
    process.exitCode = 1;
    return;
  }

  const receipt = await tx.wait();
  printReceipt(receipt);
  console.log(`Explorer: ${explorerUrl(network.chainId, contract.target, receipt.hash)}`);
}

function requireId(value) {
  if (value === undefined || !/^\d+$/.test(value)) throw new Error("Provide a numeric report ID.");
  return BigInt(value);
}

function explorerUrl(chainId, address, txHash) {
  if (chainId === 11155111n) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (chainId === 84532n) return `https://sepolia.basescan.org/tx/${txHash}`;
  return `No explorer configured for chain ${chainId}: ${address}`;
}

main().catch((error) => {
  console.error(`Error: ${error.shortMessage || error.message}`);
  process.exitCode = 1;
});
