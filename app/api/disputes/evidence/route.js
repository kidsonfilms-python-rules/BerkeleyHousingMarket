import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ethers } from "ethers";

export const runtime = "nodejs";
const store = path.join(process.cwd(), ".dispute-evidence-store");
const ABI = ["function disputes(uint256) view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool)", "function reports(uint256) view returns (address seller,address buyer,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bytes32,uint8,bool,bool,uint256)", "function panelMember(uint256,address) view returns (bool)", "function arbitratorEncryptionKey(address) view returns (string)"];
const message = (action, id, time) => `Outta the Units dispute evidence ${action}\nDispute ID: ${id}\nIssued at: ${time}`;
async function auth(action, id, address, timestamp, signature) {
  if (!ethers.isAddress(address) || Math.abs(Date.now() - Number(timestamp)) > 300000 || ethers.verifyMessage(message(action, id, Number(timestamp)), signature).toLowerCase() !== address.toLowerCase()) throw new Error("invalid wallet authorization");
  const rpc = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL; const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const contract = new ethers.Contract(contractAddress, ABI, new ethers.JsonRpcProvider(rpc)); const dispute = await contract.disputes(id); const report = await contract.reports(dispute[0]);
  return { contract, allowedParty: [report.seller, report.buyer].some((party) => party.toLowerCase() === address.toLowerCase()) };
}
export async function POST(request) {
  try { const body = await request.json(); const { allowedParty } = await auth("submit", body.disputeId, body.authorization?.address, body.authorization?.timestamp, body.authorization?.signature); if (!allowedParty || !body.encryptedPackage) throw new Error("only the buyer or seller may submit encrypted evidence"); await mkdir(store, { recursive: true }); const file = path.join(store, `${body.disputeId}.json`); let packages = []; try { packages = JSON.parse(await readFile(file, "utf8")); } catch {} packages.push({ side: body.side === "seller" ? "seller" : "buyer", encryptedPackage: body.encryptedPackage, submittedAt: Date.now() }); await writeFile(file, JSON.stringify(packages), "utf8"); return Response.json({ stored: true }); } catch (error) { return Response.json({ error: error.message }, { status: 403 }); }
}
export async function GET(request) {
  try { const p = new URL(request.url).searchParams; const { contract } = await auth("retrieve", p.get("disputeId"), p.get("address"), p.get("timestamp"), p.get("signature")); if (!await contract.panelMember(p.get("disputeId"), p.get("address"))) throw new Error("only selected arbitrators may retrieve evidence"); const packages = JSON.parse(await readFile(path.join(store, `${p.get("disputeId")}.json`), "utf8")); return Response.json({ packages }); } catch (error) { return Response.json({ error: error.code === "ENOENT" ? "no evidence submitted" : error.message }, { status: 403 }); }
}
