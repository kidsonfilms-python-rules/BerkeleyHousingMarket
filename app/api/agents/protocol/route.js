import { ethers } from "ethers";

export const runtime = "nodejs";
const ABI = ["function reports(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bytes32,uint8,bool,bool,uint256)", "function openDispute(uint256) payable", "function claimRefund(uint256)", "function claimTruthBond(uint256)"];

export async function POST(request) {
  try {
    const { action, reportId } = await request.json();
    if (!/^(dispute|refund|truthBond)$/.test(action || "") || !/^\d+$/.test(String(reportId))) return Response.json({ error: "action and numeric reportId are required" }, { status: 400 });
    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
    const address = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, ABI, provider);
    const report = await contract.reports(reportId);
    const method = action === "dispute" ? "openDispute" : action === "refund" ? "claimRefund" : "claimTruthBond";
    return Response.json({ transaction: { chainId: Number((await provider.getNetwork()).chainId), to: address, value: action === "dispute" ? ethers.parseEther("0.001").toString() : "0", data: contract.interface.encodeFunctionData(method, [reportId]) }, reportState: Number(report.state) });
  } catch (error) { return Response.json({ error: error.message || "could not build protocol transaction" }, { status: 502 }); }
}
