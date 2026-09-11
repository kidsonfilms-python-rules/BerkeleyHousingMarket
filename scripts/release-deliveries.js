#!/usr/bin/env node
/**
 * Minimal confirmed-event worker for a single-instance deployment.
 * Run it as a separate process beside the Next server:
 *   DELIVERY_API_BASE=https://your-host DELIVERY_CALLBACK_SECRET=... node scripts/release-deliveries.js
 */
require("dotenv").config();
const { readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { ethers } = require("ethers");

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
};

const provider = new ethers.JsonRpcProvider(required("RPC_URL"));
const contract = new ethers.Contract(required("CONTRACT_ADDRESS"), ["event ReportPurchased(uint256 indexed reportId, address indexed buyer)"], provider);
const apiBase = required("DELIVERY_API_BASE").replace(/\/$/, "");
const secret = required("DELIVERY_CALLBACK_SECRET");
const confirmations = Number(process.env.DELIVERY_CONFIRMATIONS || 2);
const pollMs = Number(process.env.DELIVERY_POLL_INTERVAL_MS || 15_000);
const stateFile = path.join(process.cwd(), ".release-listener-state.json");

async function lastProcessedBlock() {
  try { return Number(JSON.parse(await readFile(stateFile, "utf8")).lastBlock); } catch { return Math.max(0, (await provider.getBlockNumber()) - confirmations); }
}

async function release(reportId) {
  const response = await fetch(`${apiBase}/api/deliveries/release`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify({ reportId: reportId.toString() })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `release callback failed (${response.status})`);
  console.log(`Released delivery for report ${reportId}: ${body.buyer}`);
}

async function poll() {
  const latestSafeBlock = (await provider.getBlockNumber()) - confirmations;
  let fromBlock = await lastProcessedBlock();
  if (latestSafeBlock <= fromBlock) return;
  const events = await contract.queryFilter(contract.filters.ReportPurchased(), fromBlock + 1, latestSafeBlock);
  for (const event of events) await release(event.args.reportId);
  await writeFile(stateFile, JSON.stringify({ lastBlock: latestSafeBlock }), "utf8");
}

(async () => {
  console.log(`Watching confirmed purchases for ${await contract.getAddress()} every ${pollMs / 1000}s.`);
  await poll();
  setInterval(() => poll().catch((error) => console.error("Delivery release poll failed:", error.message)), pollMs);
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
