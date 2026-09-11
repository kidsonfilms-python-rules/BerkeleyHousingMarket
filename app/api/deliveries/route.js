import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ethers } from "ethers";

export const runtime = "nodejs";

const storePath = path.join(process.cwd(), ".delivery-store");
const AUTH_MAX_AGE_MS = 5 * 60 * 1000;
const ABI = ["function reports(uint256) view returns (address seller,address buyer,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bytes32,uint8,bool,bool,uint256)"];

function packagePath(reportId) {
  return path.join(storePath, `${String(reportId)}.json`);
}

function message(action, reportId, timestamp) { return `Outta the Units delivery ${action} authorization\nReport ID: ${reportId}\nIssued at: ${timestamp}`; }
async function authorize(action, reportId, address, timestamp, signature, role) {
  const issuedAt = Number(timestamp);
  if (!ethers.isAddress(address) || !Number.isSafeInteger(issuedAt) || Math.abs(Date.now() - issuedAt) > AUTH_MAX_AGE_MS) throw new Error("invalid or expired wallet authorization");
  if (ethers.verifyMessage(message(action, reportId, issuedAt), signature).toLowerCase() !== address.toLowerCase()) throw new Error("invalid wallet signature");
  const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!rpcUrl || !contractAddress) throw new Error("delivery service contract is not configured");
  const report = await new ethers.Contract(contractAddress, ABI, new ethers.JsonRpcProvider(rpcUrl)).reports(reportId);
  const owner = role === "seller" ? report.seller : report.buyer;
  if (owner.toLowerCase() !== address.toLowerCase()) throw new Error(`only the on-chain ${role} is authorized`);
  if (role === "buyer" && Number(report.state) < 2) throw new Error("delivery is not yet available");
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body?.reportId === undefined || body?.reportId === null || !body?.ciphertext || !body?.key || !body?.ciphertextHash || !body?.keyCommitment) return Response.json({ error: "invalid encrypted delivery package" }, { status: 400 });
    await authorize("upload", body.reportId, body.authorization?.address, body.authorization?.timestamp, body.authorization?.signature, "seller");
    const token = randomBytes(24).toString("hex");
    await mkdir(storePath, { recursive: true });
    await writeFile(packagePath(body.reportId), JSON.stringify({ token, package: body }), "utf8");
    return Response.json({ reportId: String(body.reportId), token });
  } catch (error) {
    return Response.json({ error: error.message || "delivery upload rejected" }, { status: 403 });
  }
}

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const reportId = params.get("reportId");
  if (!reportId) return Response.json({ error: "reportId is required" }, { status: 400 });
  try {
    await authorize("retrieve", reportId, params.get("address"), params.get("timestamp"), params.get("signature"), "buyer");
    const stored = JSON.parse(await readFile(packagePath(reportId), "utf8"));
    if (stored.releasedBuyer && stored.releasedBuyer !== params.get("address")?.toLowerCase()) throw new Error("package is released to a different buyer");
    return Response.json(stored.package);
  } catch (error) {
    return Response.json({ error: error.code === "ENOENT" ? "delivery package not found" : error.message || "delivery unavailable" }, { status: error.code === "ENOENT" ? 404 : 403 });
  }
}
