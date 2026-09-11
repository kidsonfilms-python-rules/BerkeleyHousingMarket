import { ethers } from "ethers";

export const runtime = "nodejs";
const ABI = ["function reports(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bytes32,uint8,bool,bool,uint256)", "function purchaseReport(uint256) payable"];

export async function POST(request) {
  try {
    const { reportId } = await request.json();
    if (reportId === undefined || reportId === null || !/^\d+$/.test(String(reportId))) return Response.json({ error: "reportId must be a non-negative integer" }, { status: 400 });
    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    const address = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!rpcUrl || !address) throw new Error("marketplace contract is not configured");
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, ABI, provider);
    const report = await contract.reports(reportId);
    if (Number(report.state) !== 0) return Response.json({ error: "report is not available" }, { status: 409 });
    return Response.json({ transaction: { chainId: Number((await provider.getNetwork()).chainId), to: address, value: report.price.toString(), data: contract.interface.encodeFunctionData("purchaseReport", [reportId]) } });
  } catch (error) { return Response.json({ error: error.message || "could not build purchase transaction" }, { status: 502 }); }
}
