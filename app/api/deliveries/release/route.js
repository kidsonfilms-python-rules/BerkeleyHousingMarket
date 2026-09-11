import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ethers } from "ethers";

export const runtime = "nodejs";

const ABI = ["function reports(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bytes32,uint8,bool,bool,uint256)"];

// Configure a confirmed ReportPurchased webhook to call this endpoint. Replays are safe.
export async function POST(request) {
  if (!process.env.DELIVERY_CALLBACK_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.DELIVERY_CALLBACK_SECRET}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { reportId } = await request.json();
    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    const contractAddress = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const report = await new ethers.Contract(contractAddress, ABI, new ethers.JsonRpcProvider(rpcUrl)).reports(reportId);
    if (Number(report.state) < 2 || report.buyer === ethers.ZeroAddress) throw new Error("report is not deliverable");
    const file = path.join(process.cwd(), ".delivery-store", `${String(reportId)}.json`);
    const stored = JSON.parse(await readFile(file, "utf8"));
    await writeFile(file, JSON.stringify({ ...stored, releasedBuyer: report.buyer.toLowerCase() }), "utf8");
    return Response.json({ reportId: String(reportId), buyer: report.buyer, released: true });
  } catch (error) { return Response.json({ error: error.message || "release failed" }, { status: 422 }); }
}
