#!/usr/bin/env node
require("dotenv").config();
const { ethers } = require("ethers");

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
};
const api = required("API_BASE").replace(/\/$/, "") + "/api";
const provider = new ethers.JsonRpcProvider(required("RPC_URL"));
const seller = new ethers.Wallet(required("SELLER_PRIVATE_KEY"), provider);
const buyer = new ethers.Wallet(required("BUYER_PRIVATE_KEY"), provider);
const address = required("CONTRACT_ADDRESS");
const abi = [
  "function nextReportId() view returns (uint256)",
  "function createReport(bytes32,uint256,uint256,uint256,uint256,uint256) payable",
  "function associateReportProperty(uint256,bytes32)",
  "function setReportMetadata(uint256,string,string)",
  "function precommitDelivery(uint256,bytes32,bytes32)",
  "function purchaseReport(uint256) payable",
  "function confirmDelivery(uint256,bytes32,string)",
  "function reports(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bytes32,uint8,bool,bool,uint256)"
];
const contract = new ethers.Contract(address, abi, seller);
const auth = async (wallet, action, reportId) => {
  const timestamp = Date.now();
  const message = `Outta the Units delivery ${action} authorization\nReport ID: ${reportId}\nIssued at: ${timestamp}`;
  return { address: wallet.address, timestamp, signature: await wallet.signMessage(message) };
};
const request = async (label, url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json();
  console.log(`\n${label}: ${response.status}`, body);
  if (!response.ok) throw new Error(body.error || label);
  return body;
};
const sendWithRetry = async (label, send) => {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const tx = await send();
      console.log(`${label}: ${tx.hash}`);
      return await tx.wait();
    } catch (error) {
      lastError = error;
      const rateLimited = String(error.message).includes("in-flight transaction limit");
      if (!rateLimited || attempt === 5) throw error;
      const delay = attempt * 8_000;
      console.log(`${label} was rate-limited; retrying in ${delay / 1000}s (${attempt}/5)...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

(async () => {
  if (seller.address.toLowerCase() === buyer.address.toLowerCase()) throw new Error("SELLER_PRIVATE_KEY and BUYER_PRIVATE_KEY must be different wallets");
  const reportId = await contract.nextReportId();
  const key = `api-smoke-key-${Date.now()}`;
  const ciphertext = `api-smoke-ciphertext-${Date.now()}`;
  const ciphertextHash = ethers.keccak256(ethers.toUtf8Bytes(ciphertext));
  const keyCommitment = ethers.keccak256(ethers.toUtf8Bytes(key));
  const propertyAddress = `API protocol smoke listing #${reportId}`;
  const intelligenceType = "Protocol smoke test";
  const price = ethers.parseEther("0.0001");
  const truthBond = ethers.parseEther("0.0003");
  const deliveryBond = ethers.parseEther("0.0001");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  console.log(`Creating report ${reportId} as ${seller.address}; buying as ${buyer.address}`);
  await sendWithRetry("Create listing", () => contract.createReport(ethers.keccak256(ethers.toUtf8Bytes(`api-smoke-${Date.now()}`)), price, deadline, 3600, truthBond, deliveryBond, { value: truthBond + deliveryBond }));
  await sendWithRetry("Associate property", () => contract.associateReportProperty(reportId, ethers.keccak256(ethers.toUtf8Bytes(propertyAddress))));
  await sendWithRetry("Publish listing metadata", () => contract.setReportMetadata(reportId, propertyAddress, intelligenceType));
  const delivery = { reportId: reportId.toString(), ciphertext, iv: "", key, ciphertextHash, keyCommitment };
  const sellerAuth = await auth(seller, "upload", reportId);
  await request("Upload encrypted package", `${api}/deliveries`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...delivery, authorization: sellerAuth }) });
  await sendWithRetry("Precommit delivery", () => contract.precommitDelivery(reportId, ciphertextHash, keyCommitment));
  await sendWithRetry("Purchase listing", () => contract.connect(buyer).purchaseReport(reportId, { value: price }));
  const buyerAuth = await auth(buyer, "retrieve", reportId);
  await request("Retrieve delivery as buyer", `${api}/deliveries?${new URLSearchParams({ reportId: reportId.toString(), address: buyerAuth.address, timestamp: String(buyerAuth.timestamp), signature: buyerAuth.signature })}`);
  await sendWithRetry("Confirm delivery", () => contract.connect(buyer).confirmDelivery(reportId, ciphertextHash, key));
  console.log("\nSuccess: listing created, package uploaded, escrow purchased, package retrieved, and payment settled.");
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
