import { ethers } from "ethers";

export const runtime = "nodejs";
const ABI = [
  "function createReportWithMetadata(bytes32,uint256,uint256,uint256,uint256,uint256,string,string,bytes32,bytes32) payable",
  "function verifyClaim(uint256,uint256[2],uint256[2][2],uint256[2],uint256[2])", "function purchaseReport(uint256) payable",
  "function confirmDelivery(uint256,bytes32,string)", "function openDispute(uint256) payable", "function claimRefund(uint256)", "function claimTruthBond(uint256)",
  "function registerArbitrator() payable", "function withdrawArbitratorStake(uint256)", "function commitVote(uint256,bytes32)", "function revealVote(uint256,bool,bytes32)", "function resolveDispute(uint256)", "function resolveUnrevealedDispute(uint256)", "function claimArbitratorReward(uint256)",
  "function reports(uint256) view returns (address,address,uint256,uint256,uint256,uint256,uint256,uint256,bytes32,bytes32,bytes32,uint8,bool,bool,uint256)", "function nextDisputeId() view returns (uint256)", "function disputes(uint256) view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool)", "function getDisputePanel(uint256) view returns (address[])"
];
const int = (value, name) => { if (!/^\d+$/.test(String(value))) throw new Error(`${name} must be an integer`); return BigInt(value); };
const context = () => { const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL; const address = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS; const provider = new ethers.JsonRpcProvider(rpcUrl); return { address, provider, contract: new ethers.Contract(address, ABI, provider) }; };

export async function GET() {
  try { const { contract } = context(); const count = Number(await contract.nextDisputeId()); const disputes = await Promise.all(Array.from({ length: count }, async (_, id) => { const [d, panel] = await Promise.all([contract.disputes(id), contract.getDisputePanel(id)]); return { id, reportId: d[0].toString(), commitDeadline: d[1].toString(), revealDeadline: d[2].toString(), resolved: d[6], panel }; })); return Response.json({ disputes }); }
  catch (error) { return Response.json({ error: error.message }, { status: 502 }); }
}

export async function POST(request) {
  try {
    const b = await request.json(); const { contract, provider, address } = context(); let method, args, value = 0n;
    if (b.action === "createListing") { method = "createReportWithMetadata"; args = [b.reportCommitment, int(b.priceWei,"priceWei"), int(b.deliveryDeadline,"deliveryDeadline"), int(b.challengePeriod,"challengePeriod"), int(b.truthBondWei,"truthBondWei"), int(b.deliveryBondWei,"deliveryBondWei"), b.propertyAddress, b.intelligenceType, b.ciphertextHash, b.keyCommitment]; value = args[4] + args[5]; }
    else if (b.action === "verifyClaim") { method = "verifyClaim"; args = [int(b.reportId,"reportId"), b.proofA, b.proofB, b.proofC, b.publicSignals]; }
    else if (b.action === "purchase") { const r = await contract.reports(int(b.reportId,"reportId")); method = "purchaseReport"; args = [b.reportId]; value = r.price; }
    else { const map = { confirmDelivery:["confirmDelivery",[int(b.reportId,"reportId"),b.ciphertextHash,b.key]], dispute:["openDispute",[int(b.reportId,"reportId")]], refund:["claimRefund",[int(b.reportId,"reportId")]], truthBond:["claimTruthBond",[int(b.reportId,"reportId")]], registerArbitrator:["registerArbitrator",[]], withdrawArbitrator:["withdrawArbitratorStake",[int(b.amountWei,"amountWei")]], commitVote:["commitVote",[int(b.disputeId,"disputeId"),b.commitment]], revealVote:["revealVote",[int(b.disputeId,"disputeId"),Boolean(b.sellerValid),b.salt]], resolveDispute:["resolveDispute",[int(b.disputeId,"disputeId")]], resolveTimeout:["resolveUnrevealedDispute",[int(b.disputeId,"disputeId")]], claimArbitratorReward:["claimArbitratorReward",[int(b.disputeId,"disputeId")]] }; if (!map[b.action]) throw new Error("unsupported action"); [method,args] = map[b.action]; if (b.action === "dispute") value = ethers.parseEther("0.001"); if (b.action === "registerArbitrator") value = ethers.parseEther("0.01"); }
    return Response.json({ transaction: { chainId: Number((await provider.getNetwork()).chainId), to: address, value: value.toString(), data: contract.interface.encodeFunctionData(method,args) } });
  } catch (error) { return Response.json({ error: error.message || "could not build transaction" }, { status: 400 }); }
}
