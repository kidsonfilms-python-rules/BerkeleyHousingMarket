#!/usr/bin/env node

require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "OuttaTheUnits.sol", "OuttaTheUnits.json");
const SEED_MARKER = "outta-the-units:sepolia-campus-demo:v1";
const DAY = 24 * 60 * 60;

const entries = [
  {
    address: "Hearst Avenue / Euclid Avenue",
    neighborhood: "Northside · Berkeley",
    type: "Security deposit history",
    claim: "Synthetic demo claim: a deposit statement was returned within the stated lease timeline after ordinary move-out deductions.",
    evidence: "Synthetic demo evidence bundle: lease excerpt, itemized statement, and dated move-out correspondence.",
    price: "0.004",
    amount: "1800"
  },
  {
    address: "Bancroft Way / College Avenue",
    neighborhood: "Southside · Berkeley",
    type: "Maintenance reality",
    claim: "Synthetic demo claim: a recurring plumbing issue received an initial response within two business days and a follow-up repair visit.",
    evidence: "Synthetic demo evidence bundle: maintenance request timeline and redacted service appointment notes.",
    price: "0.0035",
    amount: "2"
  },
  {
    address: "Shattuck Avenue / Dwight Way",
    neighborhood: "Downtown · Berkeley",
    type: "Lease clauses",
    claim: "Synthetic demo claim: the lease describes a separate utility allocation and a written notice period for renewal changes.",
    evidence: "Synthetic demo evidence bundle: selected lease clauses and a redacted renewal notice.",
    price: "0.005",
    amount: "30"
  },
  {
    address: "Telegraph Avenue / Derby Street",
    neighborhood: "Southside · Berkeley",
    type: "Living conditions",
    claim: "Synthetic demo claim: a furnished unit near campus had recurring evening noise during the academic term.",
    evidence: "Synthetic demo evidence bundle: dated private observation log and building communication excerpt.",
    price: "0.003",
    amount: "4"
  },
  {
    address: "Oxford Street / Rose Street",
    neighborhood: "North Berkeley · Berkeley",
    type: "Security deposit history",
    claim: "Synthetic demo claim: ordinary cleaning deductions were listed separately from a returned deposit balance.",
    evidence: "Synthetic demo evidence bundle: move-out checklist, deposit statement, and redacted payment record.",
    price: "0.0045",
    amount: "1250"
  },
  {
    address: "Martin Luther King Jr Way / Cedar Street",
    neighborhood: "West Berkeley · Berkeley",
    type: "Maintenance reality",
    claim: "Synthetic demo claim: a heating request was acknowledged during a winter week and closed after a parts replacement.",
    evidence: "Synthetic demo evidence bundle: dated service requests and redacted repair invoice.",
    price: "0.0035",
    amount: "3"
  }
];

function required(name) {
  const value = process.env[name];
  if (!value || value.includes("YOUR_")) throw new Error(`Missing configured ${name}`);
  return value;
}

function explorer(txHash) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

async function main() {
  if (!fs.existsSync(artifactPath)) throw new Error("Contract artifact missing. Run npm run compile first.");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const provider = new ethers.JsonRpcProvider(required("SEPOLIA_RPC_URL"));
  const signer = new ethers.Wallet(required("DEPLOYER_PRIVATE_KEY"), provider);
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) throw new Error(`Expected Sepolia (11155111), got chain ${network.chainId}`);

  const address = required("CONTRACT_ADDRESS");
  const contract = new ethers.Contract(address, artifact.abi, signer);
  const legacyReader = new ethers.Contract(address, [
    "function reports(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bytes32,uint8,bool)"
  ], provider);
  const code = await provider.getCode(address);
  if (code === "0x") throw new Error(`No contract deployed at ${address}`);

  const existing = Number(await contract.nextReportId());
  const existingCommitments = new Set();
  for (let reportId = 0; reportId < existing; reportId++) {
    const report = await legacyReader.reports(reportId);
    existingCommitments.add(report[8]);
  }
  console.log(`Network: Sepolia (${network.chainId})`);
  console.log(`Contract: ${address}`);
  console.log(`Seeder wallet: ${signer.address}`);
  console.log(`Existing reports: ${existing}`);

  const latest = await provider.getBlock("latest");
  const deadline = Number(latest.timestamp) + 30 * DAY;
  const challengePeriod = 7 * DAY;
  const truthBond = ethers.parseEther("0.003");
  const deliveryBond = ethers.parseEther("0.001");
  const seedCommitment = ethers.keccak256(ethers.toUtf8Bytes(SEED_MARKER));
  if (existingCommitments.has(seedCommitment) && entries.every((entry, index) => existingCommitments.has(index === 0 ? seedCommitment : ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ marker: SEED_MARKER, ...entry })))))) {
    console.log("Seed marker already present; refusing to duplicate the campus demo dataset.");
    return;
  }

  const balance = await provider.getBalance(signer.address);
  const requiredFunds = ethers.parseEther("0.03");
  if (balance < requiredFunds) throw new Error(`Seeder wallet needs at least 0.03 ETH plus gas; balance is ${ethers.formatEther(balance)} ETH`);

  console.log(`Writing ${entries.length} synthetic campus-area listings...`);
  let associationUnavailable = false;
  for (const [index, entry] of entries.entries()) {
    const propertyId = ethers.keccak256(ethers.toUtf8Bytes(entry.address));
    const payload = JSON.stringify({ marker: SEED_MARKER, ...entry });
    const commitment = index === 0 ? seedCommitment : ethers.keccak256(ethers.toUtf8Bytes(payload));
    if (existingCommitments.has(commitment)) {
      console.log(`Skipping existing seeded entry: ${entry.address}`);
      continue;
    }
    const createTx = await contract.createReport(
      commitment,
      ethers.parseEther(entry.price),
      deadline,
      challengePeriod,
      truthBond,
      deliveryBond,
      { value: truthBond + deliveryBond }
    );
    const receipt = await createTx.wait();
    const event = receipt.logs.map((log) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    }).find((log) => log?.name === "ReportListed");
    const reportId = event?.args?.reportId?.toString();
    if (reportId === undefined) throw new Error(`Could not parse report ID from ${createTx.hash}`);
    let propertyTx = null;
    let metadataTx = null;
    if (!associationUnavailable) {
      try {
        propertyTx = await contract.associateReportProperty(reportId, propertyId);
        await propertyTx.wait();
        metadataTx = await contract.setReportMetadata(reportId, entry.address, entry.type);
        await metadataTx.wait();
      } catch (error) {
        associationUnavailable = true;
        console.log(`  Property association unavailable on this deployed contract; listing was still written. (${error.shortMessage || "legacy deployment"})`);
      }
    }
    console.log(`#${reportId} ${entry.address} | ${entry.type} | ${ethers.formatEther(ethers.parseEther(entry.price))} ETH`);
    console.log(`  listing: ${explorer(createTx.hash)}`);
    if (propertyTx) console.log(`  property: ${explorer(propertyTx.hash)}`);
    if (metadataTx) console.log(`  metadata: ${explorer(metadataTx.hash)}`);
  }
  if (associationUnavailable) console.log("Note: redeploy the current contract before using on-chain property association and corroboration.");
  console.log("Done. These are synthetic demo records, not claims about real properties or landlords.");
}

main().catch((error) => {
  console.error(`Seed failed: ${error.shortMessage || error.message}`);
  process.exitCode = 1;
});
