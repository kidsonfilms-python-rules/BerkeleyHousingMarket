import { ethers } from "ethers";

export const runtime = "nodejs";

const ABI = [
  "function nextReportId() view returns (uint256)",
  "function reports(uint256) view returns (address seller,address buyer,uint256 price,uint256 truthBond,uint256 deliveryBond,uint256 deliveryDeadline,uint256 challengePeriod,uint256 challengeEndsAt,bytes32 reportCommitment,bytes32 ciphertextHash,bytes32 keyCommitment,uint8 state,bool truthBondClaimed,bool zkClaimVerified,uint256 claimedAmount)",
  "function reportMetadata(uint256) view returns (string propertyAddress, string intelligenceType)",
  "function purchaseReport(uint256 reportId) payable"
];

export async function GET() {
  const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  const address = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!rpcUrl || !address) return Response.json({ error: "marketplace contract is not configured" }, { status: 503 });
  try {
    const contract = new ethers.Contract(address, ABI, new ethers.JsonRpcProvider(rpcUrl));
    const count = Number(await contract.nextReportId());
    const reports = await Promise.all(Array.from({ length: count }, async (_, id) => {
      const report = await contract.reports(id);
      let metadata = ["", ""];
      let metadataReadError = null;
      try { metadata = await contract.reportMetadata(id); } catch (error) { metadataReadError = error.shortMessage || error.message || "metadata read failed"; }
      return { id, propertyAddress: metadata[0] || null, intelligenceType: metadata[1] || null, metadataReadError, seller: report.seller, buyer: report.buyer, priceWei: report.price.toString(), priceEth: ethers.formatEther(report.price), deliveryDeadline: Number(report.deliveryDeadline), state: Number(report.state), commitment: report.reportCommitment, zkClaimVerified: report.zkClaimVerified, purchase: { to: address, value: report.price.toString(), data: contract.interface.encodeFunctionData("purchaseReport", [id]) } };
    }));
    return Response.json({ chainId: Number((await contract.runner.provider.getNetwork()).chainId), contract: address, reports });
  } catch (error) { return Response.json({ error: error.message || "marketplace unavailable" }, { status: 502 }); }
}
