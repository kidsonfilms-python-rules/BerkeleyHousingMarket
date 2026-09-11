"use client";

import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import Image from "next/image";
import { AlertTriangle, ArrowLeft, ArrowUpRight, CircleHelp, CircleCheck, FilePenLine, LockKeyhole, MapPin, Search, ShieldCheck, Wallet, Zap } from "lucide-react";
import MapView from "./components/MapView";
import logo from "../assets/otu logo.png";

const CONTRACT_ABI = [
  "function reports(uint256) view returns (address seller, address buyer, uint256 price, uint256 truthBond, uint256 deliveryBond, uint256 deliveryDeadline, uint256 challengePeriod, uint256 challengeEndsAt, bytes32 reportCommitment, bytes32 ciphertextHash, bytes32 keyCommitment, uint8 state, bool truthBondClaimed, bool zkClaimVerified, uint256 claimedAmount)",
  "function nextReportId() view returns (uint256)",
  "function reportProperty(uint256) view returns (bytes32)",
  "function reportMetadata(uint256) view returns (string propertyAddress, string intelligenceType)",
  "function setReportMetadata(uint256 reportId, string propertyAddress, string intelligenceType)",
  "function purchaseReport(uint256 reportId) payable",
  "function claimRefund(uint256 reportId)",
  "function claimTruthBond(uint256 reportId)",
  "function createReport(bytes32 reportCommitment, uint256 price, uint256 deliveryDeadline, uint256 challengePeriod, uint256 truthBond, uint256 deliveryBond) payable returns (uint256 reportId)",
  "function createReportWithMetadata(bytes32 reportCommitment, uint256 price, uint256 deliveryDeadline, uint256 challengePeriod, uint256 truthBond, uint256 deliveryBond, string propertyAddress, string intelligenceType, bytes32 ciphertextHash, bytes32 keyCommitment) payable returns (uint256 reportId)",
  "function precommitDelivery(uint256 reportId, bytes32 ciphertextHash, bytes32 keyCommitment)",
  "function deliverReport(uint256 reportId, bytes32 ciphertextHash, bytes32 keyCommitment)",
  "function confirmDelivery(uint256 reportId, bytes32 deliveredCiphertextHash, string revealedKey)",
  "function verifyClaim(uint256 reportId, uint[2] proofA, uint[2][2] proofB, uint[2] proofC, uint[2] publicSignals)",
  "function associateReportProperty(uint256 reportId, bytes32 propertyId)",
  "function corroborateReport(uint256 reportId)",
  "function registerArbitrator() payable",
  "function withdrawArbitratorStake(uint256 amount)",
  "function arbitratorStake(address) view returns (uint256)",
  "function arbitratorWins(address) view returns (uint256)",
  "function arbitratorLosses(address) view returns (uint256)",
  "function openDispute(uint256 reportId) payable returns (uint256)",
  "function getDisputePanel(uint256 disputeId) view returns (address[])",
  "function commitVote(uint256 disputeId, bytes32 commitment)",
  "function revealVote(uint256 disputeId, bool sellerValid, bytes32 salt)",
  "function resolveDispute(uint256 disputeId)",
  "function resolveUnrevealedDispute(uint256 disputeId)",
  "function claimArbitratorReward(uint256 disputeId)",
  "event ReportPurchased(uint256 indexed reportId, address indexed buyer)"
];

const demoReports = [
  { id: 0, title: "Security deposit history", description: "Deductions, disputes, and what came back after move-out.", price: "$10", eth: "0.01", reports: "3 reports", corroboration: "2 corroborated", level: "Strong evidence", commitment: "0x91e0...a72c" },
  { id: 1, title: "Maintenance reality", description: "Response times, recurring issues, and repair quality.", price: "$8", eth: "0.008", reports: "4 reports", corroboration: "3 corroborated", level: "Strong evidence", commitment: "0x5bd4...18ef" },
  { id: 2, title: "Lease clauses", description: "The fine print that did not make it into the listing.", price: "$6", eth: "0.006", reports: "2 reports", corroboration: "1 corroborated", level: "Evidence committed", commitment: "0xa18f...42b0" }
];

const demoProperties = [
  { id: "telegraph", address: "2301 Telegraph Ave", neighborhood: "Northside · Berkeley", beds: "1 bed / 1 bath", rent: "$2,300", reports: 3, freshness: "31 days ago", reportIds: [0, 1, 2], coordinates: [-122.2585, 37.8688], fallbackPosition: { left: "47%", top: "46%" } },
  { id: "shattuck", address: "1842 Shattuck Ave", neighborhood: "Downtown · Berkeley", beds: "2 bed / 1 bath", rent: "$2,850", reports: 5, freshness: "12 days ago", reportIds: [0, 1], coordinates: [-122.2682, 37.8716], fallbackPosition: { left: "34%", top: "39%" } },
  { id: "sacramento", address: "1015 Sacramento St", neighborhood: "West Berkeley", beds: "Studio", rent: "$1,975", reports: 2, freshness: "8 days ago", reportIds: [1, 2], coordinates: [-122.2873, 37.8812], fallbackPosition: { left: "61%", top: "57%" } }
];

const seededCampusProperties = [
  { id: "hearst-euclid", address: "Hearst Avenue / Euclid Avenue", neighborhood: "Northside · Berkeley", beds: "Campus-area listing", rent: "On-chain", reports: 1, freshness: "Live on Sepolia", reportIds: [0], coordinates: [-122.2571, 37.8752], fallbackPosition: { left: "43%", top: "31%" } },
  { id: "bancroft-college", address: "Bancroft Way / College Avenue", neighborhood: "Southside · Berkeley", beds: "Campus-area listing", rent: "On-chain", reports: 1, freshness: "Live on Sepolia", reportIds: [1], coordinates: [-122.2548, 37.8671], fallbackPosition: { left: "48%", top: "55%" } },
  { id: "shattuck-dwight", address: "Shattuck Avenue / Dwight Way", neighborhood: "Downtown · Berkeley", beds: "Campus-area listing", rent: "On-chain", reports: 1, freshness: "Live on Sepolia", reportIds: [2], coordinates: [-122.2688, 37.8659], fallbackPosition: { left: "29%", top: "54%" } },
  { id: "telegraph-derby", address: "Telegraph Avenue / Derby Street", neighborhood: "Southside · Berkeley", beds: "Campus-area listing", rent: "On-chain", reports: 1, freshness: "Live on Sepolia", reportIds: [3], coordinates: [-122.2574, 37.8634], fallbackPosition: { left: "52%", top: "64%" } },
  { id: "oxford-rose", address: "Oxford Street / Rose Street", neighborhood: "North Berkeley · Berkeley", beds: "Campus-area listing", rent: "On-chain", reports: 1, freshness: "Live on Sepolia", reportIds: [4], coordinates: [-122.2663, 37.8761], fallbackPosition: { left: "34%", top: "26%" } },
  { id: "mlk-cedar", address: "Martin Luther King Jr Way / Cedar Street", neighborhood: "West Berkeley · Berkeley", beds: "Campus-area listing", rent: "On-chain", reports: 1, freshness: "Live on Sepolia", reportIds: [5], coordinates: [-122.2761, 37.8774], fallbackPosition: { left: "22%", top: "28%" } }
];

const SELLER_TRUTH_BOND_ETH = "0.03";
const SELLER_DELIVERY_BOND_ETH = "0.005";
const PROTOCOL_FEE_ETH = "0";
const DELIVERY_VAULT_PREFIX = "outta-the-units:delivery:";
const DELIVERY_WINDOW_MINUTES = 60;
const DELIVERY_AUTH_MAX_AGE_MS = 5 * 60 * 1000;

function shorten(value) { return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "Not connected"; }
function reportTemplate(id) { return demoReports[id % demoReports.length]; }
function formatSeller(value) { return value === ethers.ZeroAddress ? "Pending seller" : shorten(value); }
function formatPrice(value) { return `${ethers.formatEther(value)} ETH`; }
function hashText(value) { return ethers.keccak256(ethers.toUtf8Bytes(value.trim())); }
function deliveryAuthorizationMessage(action, reportId, timestamp) { return `Outta the Units delivery ${action} authorization\nReport ID: ${reportId}\nIssued at: ${timestamp}`; }
async function geocodeListingAddress(address) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token?.startsWith("pk.") || !address || address.startsWith("Property ")) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${address}, Berkeley, CA`)}.json?access_token=${token}&country=us&proximity=-122.2682,37.8716&types=address,place,neighborhood`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const feature = (await response.json()).features?.[0];
  if (!feature?.center) return null;
  const context = [feature, ...(feature.context || [])];
  const neighborhood = context.find((item) => /^(neighborhood|locality|place)\./.test(item.id || ""))?.text || "Berkeley";
  return { coordinates: feature.center, neighborhood: `${neighborhood} · Berkeley, CA` };
}
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
function bytesToField(bytes) { return BigInt(ethers.keccak256(bytes)) % FIELD_MODULUS; }
function encodeBase64(bytes) {
  const data = new Uint8Array(bytes);
  const chunkSize = 0x8000;
  let binary = "";

  // A file can contain far more bytes than JavaScript permits as arguments to
  // String.fromCharCode. Encode bounded slices so private evidence files do
  // not overflow the call stack before encryption.
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}
function decodeBase64(value) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function readDeliveryVault() {
  if (typeof window === "undefined") return [];
  return Object.keys(localStorage).filter((key) => key.startsWith(DELIVERY_VAULT_PREFIX)).map((key) => JSON.parse(localStorage.getItem(key))).filter(Boolean);
}
async function encryptPrivateReport(report, evidenceFile) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const evidence = evidenceFile ? {
    name: evidenceFile.name,
    type: evidenceFile.type,
    data: encodeBase64(await evidenceFile.arrayBuffer())
  } : null;
  const plaintext = encoder.encode(JSON.stringify({ ...report, evidence }));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const ciphertextBase64 = encodeBase64(ciphertext);
  const ivBase64 = encodeBase64(iv);
  const keyBase64 = encodeBase64(rawKey);
  return {
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    key: keyBase64,
    ciphertextHash: hashText(ciphertextBase64),
    keyCommitment: hashText(keyBase64)
  };
}
async function decryptPrivateReport(delivery) {
  const key = await crypto.subtle.importKey("raw", decodeBase64(delivery.key), { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(delivery.iv) }, key, decodeBase64(delivery.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}
async function createClaimProof(evidenceDigest, amount, salt) {
  const snarkjs = await import("snarkjs");
  const { poseidon3 } = await import("poseidon-lite/poseidon3");
  const commitment = poseidon3([evidenceDigest, amount, salt]).toString();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    { evidenceDigest: evidenceDigest.toString(), amount: amount.toString(), salt: salt.toString(), claimedAmount: amount.toString(), commitment },
    "/zk/claim.wasm",
    "/zk/claim_final.zkey"
  );
  return {
    proofA: [proof.pi_a[0], proof.pi_a[1]],
    proofB: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    proofC: [proof.pi_c[0], proof.pi_c[1]],
    publicSignals
  };
}

export default function Home() {
  const [reports, setReports] = useState(demoReports);
  const [properties, setProperties] = useState(demoProperties);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [arbitratorOpen, setArbitratorOpen] = useState(false);
  const [arbitratorStats, setArbitratorStats] = useState(null);
  const [disputeForm, setDisputeForm] = useState({ id: "", vote: "true", salt: "" });
  const [sellerForm, setSellerForm] = useState({ property: "2301 Telegraph Ave", type: "Security deposit history", price: "0.01", deadline: "60", intelligence: "", evidence: "", evidenceFile: null, claimedAmount: "3800" });
  const [vaultItems, setVaultItems] = useState([]);
  const [decryptedReport, setDecryptedReport] = useState(null);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [deliveryToken, setDeliveryToken] = useState("");
  const [deliveryTokenInput, setDeliveryTokenInput] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [backend, setBackend] = useState({ state: "checking", message: "Checking contract connection..." });
  const defaultHeadline = "No more dorms?\nFind your spot.";
  const [headlineText, setHeadlineText] = useState(defaultHeadline);
  const headlineRef = useRef(defaultHeadline);
  const headlineInitialized = useRef(false);
  const publishInFlightRef = useRef(false);

  useEffect(() => {
    setVaultItems(readDeliveryVault());
  }, []);

  useEffect(() => {
    const target = selectedProperty ? `${selectedProperty.address}\n${selectedProperty.neighborhood}` : defaultHeadline;
    if (!headlineInitialized.current) {
      headlineInitialized.current = true;
      return;
    }
    const startingText = headlineRef.current;
    const eraseDuration = Math.min(360, Math.max(140, startingText.length * 7));
    const pauseDuration = 55;
    const typeDuration = Math.min(560, Math.max(180, target.length * 10));
    const startedAt = performance.now();
    let cancelled = false;
    let frame;
    const completionTimer = setTimeout(() => {
      if (cancelled) return;
      headlineRef.current = target;
      setHeadlineText(target);
    }, eraseDuration + pauseDuration + typeDuration + 80);

    const animate = (now) => {
      if (cancelled) return;
      const elapsed = now - startedAt;
      let working = "";

      if (elapsed < eraseDuration) {
        const progress = elapsed / eraseDuration;
        const remaining = Math.ceil(startingText.length * (1 - progress));
        working = startingText.slice(0, remaining);
      } else if (elapsed >= eraseDuration + pauseDuration) {
        const progress = Math.min(1, (elapsed - eraseDuration - pauseDuration) / typeDuration);
        const typed = Math.floor(target.length * progress);
        working = target.slice(0, typed);
      }

      headlineRef.current = working;
      setHeadlineText(working);
      if (elapsed >= eraseDuration + pauseDuration + typeDuration) {
        headlineRef.current = target;
        setHeadlineText(target);
        return;
      }
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(completionTimer);
    };
  }, [selectedProperty]);

  useEffect(() => {
    async function loadOnchainReports() {
      const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
      if (!address || address.includes("YOUR_") || !rpcUrl || rpcUrl.includes("YOUR_")) {
        setBackend({ state: "warning", message: "Backend not connected: showing demo metadata. Add the public RPC URL and contract address." });
        return;
      }
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(address, CONTRACT_ABI, provider);
        const count = Number(await contract.nextReportId());
        if (!count) {
          setReports([]);
          setProperties([]);
          setBackend({ state: "connected", message: "Contract connected. No reports are listed yet." });
          return;
        }
        const liveReports = await Promise.all(Array.from({ length: count }, async (_, id) => {
          const [report, propertyId] = await Promise.all([contract.reports(id), contract.reportProperty(id)]);
          let metadata = ["", ""];
          try { metadata = await contract.reportMetadata(id); } catch { /* legacy contract */ }
          return { report, propertyId, propertyAddress: metadata[0], intelligenceType: metadata[1] };
        }));
        const normalized = liveReports.map(({ report, propertyId, propertyAddress, intelligenceType }, id) => ({
          id,
          title: intelligenceType || "Encrypted tenant report",
          description: "Private property intelligence. Inspect its on-chain provenance before purchase.",
          address: propertyAddress || (propertyId === ethers.ZeroHash ? "Property commitment pending" : `Property ${shorten(propertyId)}`),
          neighborhood: "On-chain property commitment",
          beds: "Private listing",
          rent: "On-chain",
          freshness: "On-chain",
          reportIds: [id],
          coordinates: [-122.2682 + ((id % 5) - 2) * 0.004, 37.8716 + ((Math.floor(id / 5) % 5) - 2) * 0.003],
          fallbackPosition: { left: `${35 + (id % 5) * 8}%`, top: `${35 + (Math.floor(id / 5) % 5) * 7}%` },
          priceLabel: formatPrice(report.price),
          reports: "1 on-chain report",
          corroboration: report.zkClaimVerified ? "ZK claim verified" : "Commitment recorded",
          level: report.zkClaimVerified ? "ZK verified" : "Evidence committed",
          price: formatPrice(report.price),
          eth: ethers.formatEther(report.price),
          seller: formatSeller(report.seller),
          sellerAddress: report.seller,
          stake: `${ethers.formatEther(report.truthBond + report.deliveryBond)} ETH`,
          commitment: report.reportCommitment,
          buyer: report.buyer,
          ciphertextHash: report.ciphertextHash,
          keyCommitment: report.keyCommitment,
          zkClaimVerified: report.zkClaimVerified,
          claimedAmount: report.claimedAmount,
          propertyCommitment: propertyId,
          state: ["Listed", "Purchased", "Delivered", "Settled", "Disputed", "Invalid", "Refunded"][Number(report.state)]
        }));
        const geocoded = await Promise.all(normalized.map(async (report) => {
          try {
            const location = await geocodeListingAddress(report.address);
            return location ? { ...report, ...location } : report;
          } catch { return report; }
        }));
        setReports(geocoded);
        setProperties(geocoded.map((report) => ({ id: `report-${report.id}`, address: report.address, neighborhood: report.neighborhood, beds: report.beds, rent: report.rent, reports: 1, freshness: report.freshness, reportIds: [report.id], coordinates: report.coordinates, fallbackPosition: report.fallbackPosition })));
        setBackend({ state: "connected", message: `Live contract connected: ${count} report${count === 1 ? "" : "s"} loaded.` });
      } catch (error) {
        setBackend({ state: "warning", message: `Backend unavailable: showing demo metadata. ${error.shortMessage || "Check the RPC URL and contract address."}` });
      }
    }
    loadOnchainReports();
  }, [reloadNonce]);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Install a wallet such as MetaMask to continue.");
      return;
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0]);
    setStatus("Wallet connected. Reports remain locked until escrow is confirmed.");
  }

  async function loadArbitratorStats() {
    if (!account || !process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) return;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    const [stake, wins, losses] = await Promise.all([contract.arbitratorStake(account), contract.arbitratorWins(account), contract.arbitratorLosses(account)]);
    setArbitratorStats({ stake: ethers.formatEther(stake), wins: wins.toString(), losses: losses.toString() });
  }

  async function runArbitratorAction(action) {
    if (!account) { await connectWallet(); return; }
    if (!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) { setStatus("Connect the deployed contract before using arbitration."); return; }
    setBusy(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      if (action === "register") await (await contract.registerArbitrator({ value: ethers.parseEther("0.01") })).wait();
      if (action === "withdraw") await (await contract.withdrawArbitratorStake(ethers.parseEther("0.01"))).wait();
      if (action === "commit") {
        if (!disputeForm.salt) throw new Error("Enter a salt before committing.");
        const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bool", "bytes32"], [disputeForm.vote === "true", disputeForm.salt]));
        await (await contract.commitVote(disputeForm.id, commitment)).wait();
      }
      if (action === "reveal") await (await contract.revealVote(disputeForm.id, disputeForm.vote === "true", disputeForm.salt)).wait();
      if (action === "resolve") await (await contract.resolveDispute(disputeForm.id)).wait();
      if (action === "resolve-timeout") await (await contract.resolveUnrevealedDispute(disputeForm.id)).wait();
      if (action === "reward") await (await contract.claimArbitratorReward(disputeForm.id)).wait();
      await loadArbitratorStats();
      setStatus("Arbitrator transaction confirmed.");
    } catch (error) { setStatus(error.shortMessage || error.message || "Arbitrator transaction failed."); }
    finally { setBusy(false); }
  }

  async function purchaseReport() {
    if (!account) { await connectWallet(); return; }
    if (!activeReport) return;
    if (!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS) {
      setStatus("Add NEXT_PUBLIC_CONTRACT_ADDRESS to .env.local before purchasing.");
      return;
    }
    setBusy(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) throw new Error("Switch your wallet to Sepolia before purchasing.");
      if (activeReport.sellerAddress?.toLowerCase() === account.toLowerCase()) {
        throw new Error("This wallet owns this seeded listing. Connect a different Sepolia wallet to buy it.");
      }
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.purchaseReport(activeReport.id, { value: ethers.parseEther(activeReport.eth) });
      setStatus(`Escrow submitted: ${tx.hash.slice(0, 10)}... Waiting for confirmation.`);
      await tx.wait();
      await fetchDeliveryPackage(activeReport.id);
      setReloadNonce((value) => value + 1);
    } catch (error) {
      setStatus(error.shortMessage || error.message || "Transaction cancelled.");
    } finally { setBusy(false); }
  }

  function updateSellerField(event) {
    const value = event.target.name === "evidenceFile" ? event.target.files?.[0] || null : event.target.value;
    setSellerForm((current) => ({ ...current, [event.target.name]: value }));
  }

  const evidenceCommitment = sellerForm.evidenceFile ? "Hash generated from selected evidence file on publish" : "Select the private evidence file to commit";
  const reportCommitment = sellerForm.intelligence.trim() && sellerForm.evidenceFile
    ? "Generated from claim and evidence-file hash on publish"
    : "Complete the claim and select evidence to generate";

  async function submitReport(event) {
    event.preventDefault();
    if (publishInFlightRef.current) return;
    if (!account) { await connectWallet(); return; }
    const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!address || address.includes("YOUR_")) {
      setStatus("Add NEXT_PUBLIC_CONTRACT_ADDRESS before publishing a report.");
      return;
    }
    publishInFlightRef.current = true;
    setBusy(true);
    try {
        if (!sellerForm.evidenceFile) {
          setStatus("Select the private evidence file before publishing.");
          return;
        }
        const evidenceBytes = new Uint8Array(await sellerForm.evidenceFile.arrayBuffer());
        const evidenceCommitment = ethers.keccak256(evidenceBytes);
        const claimedAmount = BigInt(sellerForm.claimedAmount);
        const salt = BigInt(`0x${crypto.getRandomValues(new Uint8Array(16)).reduce((value, byte) => value + byte.toString(16).padStart(2, "0"), "")}`);
        const proof = await createClaimProof(bytesToField(evidenceBytes), claimedAmount, salt);
        const privateReport = { property: sellerForm.property.trim(), type: sellerForm.type, intelligence: sellerForm.intelligence.trim(), evidenceContext: sellerForm.evidence.trim(), evidenceCommitment, claimedAmount: claimedAmount.toString() };
        const encrypted = await encryptPrivateReport(privateReport, sellerForm.evidenceFile);
        const commitment = ethers.zeroPadValue(ethers.toBeHex(proof.publicSignals[1]), 32);
      const deliveryDeadline = Math.floor(Date.now() / 1000) + DELIVERY_WINDOW_MINUTES * 60;
      const challengePeriod = 7 * 24 * 60 * 60;
      const price = ethers.parseEther(sellerForm.price);
      const truthBond = ethers.parseEther(SELLER_TRUTH_BOND_ETH);
      const deliveryBond = ethers.parseEther(SELLER_DELIVERY_BOND_ETH);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(address, CONTRACT_ABI, signer);
      const tx = await contract.createReportWithMetadata(commitment, price, deliveryDeadline, challengePeriod, truthBond, deliveryBond, sellerForm.property.trim(), sellerForm.type, encrypted.ciphertextHash, encrypted.keyCommitment, { value: truthBond + deliveryBond });
      setStatus(`Listing submitted: ${tx.hash.slice(0, 10)}... Waiting for confirmation.`);
      const receipt = await tx.wait();
      const listedLog = receipt.logs.map((log) => {
        try { return contract.interface.parseLog(log); } catch { return null; }
      }).find((log) => log?.name === "ReportListed");
      const reportId = listedLog?.args?.reportId?.toString() || (await contract.nextReportId() - 1n).toString();
      const delivery = { reportId, ...encrypted, reportCommitment: commitment, zkProof: proof, property: sellerForm.property, type: sellerForm.type, delivered: false, precommitted: false };
      // Upload only after public discovery metadata is committed. Delivery and
      // proof failures can no longer leave a listing with anonymous dummy data.
      if (!await uploadDeliveryPackage(delivery, true)) throw new Error("Could not preload the encrypted delivery package.");
      await (await contract.verifyClaim(reportId, proof.proofA, proof.proofB, proof.proofC, proof.publicSignals)).wait();
      try {
        localStorage.setItem(`${DELIVERY_VAULT_PREFIX}${reportId}`, JSON.stringify({ ...delivery, delivered: true, precommitted: true }));
        setVaultItems(readDeliveryVault());
      } catch {
        // The server copy is authoritative for delivery; localStorage has a
        // small quota and is only a seller convenience cache.
      }
      setStatus("Report listed with a preloaded encrypted package. Delivery becomes available automatically after escrow.");
    } catch (error) {
      setStatus(`Listing may already be on-chain. Do not republish. ${error.shortMessage || error.message || "Check the seller vault and transaction history."}`);
    } finally {
      publishInFlightRef.current = false;
      setBusy(false);
    }
  }

  async function deliverVaultItem(item) {
    if (!account) { await connectWallet(); return; }
    const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!address || address.includes("YOUR_")) {
      setStatus("Add NEXT_PUBLIC_CONTRACT_ADDRESS before delivering a report.");
      return;
    }
    setBusy(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(address, CONTRACT_ABI, signer);
      const tx = await contract.deliverReport(item.reportId, item.ciphertextHash, item.keyCommitment);
      setStatus(`Delivery commitment submitted: ${tx.hash.slice(0, 10)}...`);
      await tx.wait();
      const delivered = { ...item, delivered: true };
      localStorage.setItem(`${DELIVERY_VAULT_PREFIX}${item.reportId}`, JSON.stringify(delivered));
      setVaultItems(readDeliveryVault());
      setReloadNonce((value) => value + 1);
      setStatus("Encrypted delivery committed. The buyer can now retrieve and verify it.");
    } catch (error) {
      setStatus(error.shortMessage || error.message || "Delivery transaction cancelled.");
    } finally { setBusy(false); }
  }

  async function decryptSelectedReport() {
    if (!activeReport) return;
    let delivery = JSON.parse(localStorage.getItem(`${DELIVERY_VAULT_PREFIX}${activeReport.id}`) || "null");
    if (!delivery) {
      const retrieved = await fetchDeliveryPackage(activeReport.id);
      if (!retrieved) return;
      delivery = JSON.parse(localStorage.getItem(`${DELIVERY_VAULT_PREFIX}${activeReport.id}`) || "null");
      if (!delivery) { setStatus("Encrypted delivery is not available yet."); return; }
    }
    try {
      if (activeReport.ciphertextHash && delivery.ciphertextHash !== activeReport.ciphertextHash) throw new Error("Ciphertext commitment does not match the on-chain report.");
      if (activeReport.keyCommitment && delivery.keyCommitment !== activeReport.keyCommitment) throw new Error("Key commitment does not match the on-chain report.");
      setDecryptedReport(await decryptPrivateReport(delivery));
      setActiveDelivery(delivery);
      setStatus("Report decrypted locally. Verify the commitment before confirming delivery.");
    } catch (error) {
      setStatus(error.message || "Could not decrypt this delivery.");
    }
  }

  async function confirmReportDelivery() {
    if (!account) { await connectWallet(); return; }
    if (!activeReport) return;
    setBusy(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      if (!activeDelivery) {
        setStatus("Decrypt and verify the imported delivery package first.");
        return;
      }
      const tx = await contract.confirmDelivery(activeReport.id, activeDelivery.ciphertextHash, activeDelivery.key);
      setStatus(`Settlement submitted: ${tx.hash.slice(0, 10)}...`);
      await tx.wait();
      setReloadNonce((value) => value + 1);
      setStatus("Delivery confirmed and escrow payment released to the seller.");
    } catch (error) {
      setStatus(error.shortMessage || error.message || "Settlement transaction cancelled.");
    } finally { setBusy(false); }
  }

  async function runReportAction(action) {
    if (!account || !activeReport) { await connectWallet(); return; }
    setBusy(true);
    try {
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = action === "dispute"
        ? await contract.openDispute(activeReport.id, { value: ethers.parseEther("0.001") })
        : action === "refund"
          ? await contract.claimRefund(activeReport.id)
          : await contract.claimTruthBond(activeReport.id);
      await tx.wait();
      setReloadNonce((value) => value + 1);
      setStatus(action === "dispute" ? "Dispute opened; selected arbitrators can now commit votes." : action === "refund" ? "Refund claimed on-chain." : "Truth bond claimed on-chain.");
    } catch (error) { setStatus(error.shortMessage || error.message || "Protocol action failed."); }
    finally { setBusy(false); }
  }

  function downloadDeliveryPackage(item) {
    const blob = new Blob([JSON.stringify(item)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `outta-the-units-report-${item.reportId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deliveryAuthorization(action, reportId) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const timestamp = Date.now();
    return { address, timestamp, signature: await signer.signMessage(deliveryAuthorizationMessage(action, reportId, timestamp)) };
  }

  async function uploadDeliveryPackage(item, automatic = false) {
    try {
      const authorization = await deliveryAuthorization("upload", item.reportId);
      const response = await fetch("/api/deliveries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...item, authorization }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");
      setDeliveryToken(result.token);
      setStatus(automatic ? "Encrypted package preloaded for automatic release." : "Encrypted package uploaded.");
      return true;
    } catch (error) { setStatus(error.message || "Could not upload package."); return false; }
  }

  async function fetchDeliveryPackage(reportId = activeReport?.id) {
    if (reportId === undefined) return false;
    try {
      const authorization = await deliveryAuthorization("retrieve", reportId);
      const response = await fetch(`/api/deliveries?${new URLSearchParams({ reportId: String(reportId), address: authorization.address, timestamp: String(authorization.timestamp), signature: authorization.signature })}`);
      const delivery = await response.json();
      if (!response.ok) throw new Error(delivery.error || "Download failed");
      localStorage.setItem(`${DELIVERY_VAULT_PREFIX}${delivery.reportId}`, JSON.stringify(delivery));
      setVaultItems(readDeliveryVault());
      setStatus("Encrypted delivery retrieved. Verify it against the on-chain commitments before decrypting.");
      return true;
    } catch (error) { setStatus(error.message || "Could not fetch package."); return false; }
  }

  function importDeliveryPackage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const delivery = JSON.parse(reader.result);
        if (!delivery.reportId || !delivery.ciphertext || !delivery.key || !delivery.ciphertextHash || !delivery.keyCommitment) throw new Error("Invalid delivery package");
        localStorage.setItem(`${DELIVERY_VAULT_PREFIX}${delivery.reportId}`, JSON.stringify(delivery));
        setVaultItems(readDeliveryVault());
        setStatus("Encrypted delivery imported. The package will be checked against the on-chain commitments before decryption.");
      } catch (error) {
        setStatus(error.message || "Could not import delivery package.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  const filteredReports = reports.filter((item) => item.title.toLowerCase().includes(search.toLowerCase()));
  const selectedReports = selectedProperty
    ? selectedProperty.reportIds.map((id) => reports.find((report) => report.id === id)).filter(Boolean)
    : [];
  const activeReport = selectedReport ? reports.find((report) => report.id === selectedReport.id) || selectedReport : selectedReports[0];

  function selectProperty(property) {
    setSelectedProperty(property);
    setSelectedReport(reports.find((report) => report.id === property.reportIds[0]) || reports[0]);
    setStatus("");
  }

  function clearSelection() {
    setSelectedProperty(null);
    setSelectedReport(null);
    setStatus("");
  }

  function openSeller() {
    setSelectedProperty(null);
    setSelectedReport(null);
    setSellerOpen(true);
    setStatus("");
  }

  function openArbitrator() {
    setSellerOpen(false);
    setSelectedProperty(null);
    setSelectedReport(null);
    setArbitratorOpen(true);
    loadArbitratorStats();
    setStatus("");
  }

  function closeSeller() {
    setSellerOpen(false);
    setStatus("");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><Image className="brand-logo" src={logo} alt="Outta the Units" priority /></div>
        <div className="top-actions">
          <span className="network"><span className="network-dot" /> Sepolia testnet</span>
          <button className="sell-button" onClick={openSeller}><FilePenLine size={14} /> Sell intelligence</button>
          <button className="sell-button" onClick={openArbitrator}><ShieldCheck size={14} /> Arbitrate</button>
          <button className={`wallet ${account ? "connected" : ""}`} onClick={connectWallet}>
            <Wallet size={14} /> {account ? shorten(account) : "Connect wallet"}
          </button>
        </div>
      </header>
      <div className="main">
        <section className="map-stage">
          <MapView locations={properties} selectedId={selectedProperty?.id} onSelect={selectProperty} />
          <div className="map-top">
            <div><div className="eyebrow">Private intelligence / Berkeley, CA</div><h1 className="map-title">{headlineText.split("\n").map((line, index) => <span className="headline-line" key={`${line}-${index}`}>{line || "\u00a0"}</span>)}</h1></div>
            <label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search an address or neighborhood" /></label>
          </div>
        </section>
        <aside className={`side-panel ${selectedProperty ? "details-open" : ""} ${sellerOpen ? "seller-open" : ""}`}>
          {backend.state !== "connected" && <div className={`backend-banner ${backend.state}`} role="status">
            {backend.state === "connected" ? <CircleCheck size={14} /> : <AlertTriangle size={14} />}
            <span>{backend.message}</span>
          </div>}
          {sellerOpen ? <div className="seller-view">
            <button className="back-button" onClick={closeSeller}><ArrowLeft size={14} /> Back to nearby places</button>
            <div className="panel-kicker"><span><span className="pulse" /> Seller workspace</span><span>PRIVATE BY DEFAULT</span></div>
            <h2 className="property-name">Sell what you know.</h2>
            <p className="seller-intro">Turn a lived experience into property-specific intelligence. Your evidence stays on your device; only its commitment is published.</p>
            <form className="seller-form" onSubmit={submitReport}>
              <label>Property address<input name="property" value={sellerForm.property} onChange={updateSellerField} placeholder="2301 Telegraph Ave" required /></label>
              <label>Intelligence type<select name="type" value={sellerForm.type} onChange={updateSellerField}><option>Security deposit history</option><option>Maintenance reality</option><option>Lease clauses</option><option>Living conditions</option></select></label>
              <label>Actual intelligence<textarea name="intelligence" value={sellerForm.intelligence} onChange={updateSellerField} placeholder="What happened? Include concrete dates, amounts, conditions, and outcomes." rows="5" required /></label>
              <label>Evidence context<textarea name="evidence" value={sellerForm.evidence} onChange={updateSellerField} placeholder="Describe the private evidence you hold, such as a lease, statement, or correspondence." rows="3" required /></label>
              <label>Private evidence file<input name="evidenceFile" type="file" onChange={updateSellerField} required /></label>
              <label>Claimed amount<input name="claimedAmount" type="number" min="0" step="1" value={sellerForm.claimedAmount} onChange={updateSellerField} required /></label>
              <div className="form-row"><label>Price / ETH<input name="price" type="number" min="0.0001" step="0.0001" value={sellerForm.price} onChange={updateSellerField} required /></label><label>Delivery window<span className="meta-value">60 min · automatic</span></label></div>
              <div className="commitment-preview"><div><span className="meta-label">Evidence commitment</span><span className="commitment">{evidenceCommitment}</span></div><div><span className="meta-label">Report commitment</span><span className="commitment">{reportCommitment}</span></div></div>
              <div className="seller-note"><LockKeyhole size={14} /><span>Evidence is hashed locally. Never paste leases, emails, names, or plaintext source documents into a public transaction.</span></div>
              <div className="seller-costs"><div><span>Listing price</span><strong>{sellerForm.price || "0"} ETH</strong></div><div><span>Truth bond</span><strong>{SELLER_TRUTH_BOND_ETH} ETH</strong></div><div><span>Delivery bond</span><strong>{SELLER_DELIVERY_BOND_ETH} ETH</strong></div><div><span>Protocol fee</span><strong>{PROTOCOL_FEE_ETH} ETH</strong></div><div className="seller-total"><span>Required now</span><strong>{(Number(sellerForm.price || 0) + Number(SELLER_TRUTH_BOND_ETH) + Number(SELLER_DELIVERY_BOND_ETH) + Number(PROTOCOL_FEE_ETH)).toFixed(4)} ETH</strong></div></div>
              <button className="primary-button" type="submit" disabled={busy}>{busy ? "Publishing listing..." : account ? "Publish committed listing" : "Connect wallet to publish"}<ArrowUpRight size={14} /></button>
              {status && <div className="status"><Zap size={11} /> {status}</div>}
            </form>
            {vaultItems.length > 0 && <div className="seller-vault"><div className="section-head"><h3 className="section-title">Encrypted delivery packages</h3><span className="section-count">{vaultItems.length} LOCAL</span></div>{vaultItems.map((item) => <div className="vault-item" key={item.reportId}><div><span className="meta-label">Report #{item.reportId}</span><strong>{item.property}</strong><span>{item.type} · {item.delivered ? "Committed" : "Waiting for purchase"}</span></div><button className="vault-action" onClick={() => uploadDeliveryPackage(item)}>Upload + token</button><button className="vault-action" onClick={() => downloadDeliveryPackage(item)}>Export</button><button className="vault-action" disabled={busy || item.delivered} onClick={() => deliverVaultItem(item)}>{item.delivered ? "Delivered" : "Commit delivery"}</button></div>)}{deliveryToken && <div className="status">Buyer token: {deliveryToken}</div>}</div>}
          </div> : arbitratorOpen ? <div className="seller-view">
            <button className="back-button" onClick={() => setArbitratorOpen(false)}><ArrowLeft size={14} /> Back to nearby places</button>
            <div className="panel-kicker"><span><span className="pulse" /> Arbitrator console</span><span>STAKED WORK</span></div>
            <h2 className="property-name">Resolve fairly.</h2>
            <p className="seller-intro">Stake to join dispute panels, commit privately, reveal later, and earn only when your vote agrees with the majority.</p>
            <div className="detail-grid"><div><span className="meta-label">Your stake</span><span className="meta-value">{arbitratorStats?.stake || "0"} ETH</span></div><div><span className="meta-label">Majority votes</span><span className="meta-value">{arbitratorStats?.wins || "0"}</span></div><div><span className="meta-label">Minority / missed</span><span className="meta-value">{arbitratorStats?.losses || "0"}</span></div></div>
            <div className="seller-costs"><button className="primary-button" disabled={busy} onClick={() => runArbitratorAction("register")}>Stake 0.01 ETH</button><button className="vault-action" disabled={busy} onClick={() => runArbitratorAction("withdraw")}>Withdraw 0.01 ETH</button></div>
            <div className="seller-form"><label>Dispute ID<input value={disputeForm.id} onChange={(event) => setDisputeForm((current) => ({ ...current, id: event.target.value }))} placeholder="0" /></label><label>Vote<select value={disputeForm.vote} onChange={(event) => setDisputeForm((current) => ({ ...current, vote: event.target.value }))}><option value="true">Seller valid</option><option value="false">Seller invalid</option></select></label><label>Vote salt<input value={disputeForm.salt} onChange={(event) => setDisputeForm((current) => ({ ...current, salt: event.target.value }))} placeholder="0x... bytes32" /></label><div className="seller-costs"><button className="vault-action" disabled={busy} onClick={() => runArbitratorAction("commit")}>Commit vote</button><button className="vault-action" disabled={busy} onClick={() => runArbitratorAction("reveal")}>Reveal vote</button><button className="vault-action" disabled={busy} onClick={() => runArbitratorAction("resolve")}>Resolve panel</button><button className="vault-action" disabled={busy} onClick={() => runArbitratorAction("resolve-timeout")}>Resolve missed votes</button><button className="vault-action" disabled={busy} onClick={() => runArbitratorAction("reward")}>Claim reward</button></div></div>
            {status && <div className="status"><Zap size={11} /> {status}</div>}
          </div> : !selectedProperty ? <div className="discovery-view">
            <div className="panel-kicker"><span><span className="pulse" /> Near your location</span><span>BERKELEY, CA</span></div>
            <h2 className="property-name">Find your next place.</h2>
            <div className="property-meta"><MapPin size={11} /> {properties.length} {backend.state === "connected" ? "live Sepolia listings" : "spots with tenant intelligence nearby"}</div>
            <div className="rule" />
            <div className="section-head"><h3 className="section-title">{backend.state === "connected" ? "Live campus listings" : "Places near you"}</h3><span className="section-count">{properties.length} SPOTS</span></div>
            {properties.length > 0 ? <div className="place-list">{properties.map((property) => <button key={property.id} className="place-card" onClick={() => selectProperty(property)}><div className="place-card-top"><div><span className="place-neighborhood">{property.neighborhood}</span><h4>{property.address}</h4></div><ArrowUpRight size={15} /></div><div className="place-card-meta"><span>{property.beds}</span><strong>{property.rent}{property.rent === "On-chain" ? "" : <small> / mo</small>}</strong></div><div className="place-card-foot"><span><ShieldCheck size={11} /> {property.reports} {backend.state === "connected" ? "on-chain report" : "reports"}</span><span>{property.freshness}</span></div></button>)}</div> : <div className="locked-content"><LockKeyhole size={19} color="#bdc7ff" /><p>No listings have been written to this contract yet.</p></div>}
          </div> : <div className="details-view">
            <button className="back-button" onClick={clearSelection}><ArrowLeft size={14} /> All nearby places</button>
            <div className="panel-kicker"><span><span className="pulse" /> Property selected</span><span>UNIT 04</span></div>
            <h2 className="property-name">{selectedProperty.address}</h2>
            <div className="property-meta">{selectedProperty.neighborhood.toUpperCase()} · {selectedProperty.beds.toUpperCase()}</div>
            <div className="rent-row"><span className="rent">{selectedProperty.rent}</span><span className="rent-note">asking / month</span></div>
            <div className="rule" />
            <div className="section-head"><h3 className="section-title">Available intelligence</h3><span className="section-count">{String(selectedReports.length).padStart(2, "0")} LISTINGS</span></div>
            {selectedReports.filter((item) => item.title.toLowerCase().includes(search.toLowerCase())).map((item) => <button key={item.id} className={`intel-card ${activeReport?.id === item.id ? "selected" : ""}`} onClick={() => setSelectedReport(item)}><div className="card-top"><h4 className="card-title">{item.title}</h4><span className="card-price">{item.price}</span></div><p className="card-sub">{item.description}</p><div className="card-bottom"><span className="badge"><ShieldCheck size={11} /> {item.level}</span><span className="corroboration">{item.reports} · {item.corroboration}</span></div></button>)}
            {activeReport?.state === "Delivered" && activeReport.buyer?.toLowerCase() === account.toLowerCase() && <button className="vault-action" disabled={busy} onClick={() => runReportAction("dispute")}>Open dispute · stake 0.001 ETH</button>}
            {activeReport?.state === "Purchased" && activeReport.buyer?.toLowerCase() === account.toLowerCase() && <button className="vault-action" disabled={busy} onClick={() => runReportAction("refund")}>Claim missed-delivery refund</button>}
            {activeReport?.state === "Settled" && activeReport.sellerAddress?.toLowerCase() === account.toLowerCase() && <button className="vault-action" disabled={busy} onClick={() => runReportAction("truth")}>Claim truth bond</button>}
            {activeReport && <div className="detail-panel"><div className="detail-head"><div><h3 className="detail-title">{activeReport.title}</h3><span className="detail-id">REPORT #{String(activeReport.id + 17).padStart(4, "0")}</span></div><LockKeyhole className="lock-icon" size={16} /></div><div className="locked-content"><LockKeyhole size={19} color="#bdc7ff" /><p>The report contents stay encrypted until payment settles. You can inspect its provenance, not the private experience.</p></div><div className="detail-grid"><div><span className="meta-label">Seller</span><span className="meta-value">{activeReport.seller || "0x7c...e91a"}</span></div><div><span className="meta-label">Created</span><span className="meta-value">31 days ago</span></div><div><span className="meta-label">Seller stake</span><span className="meta-value">{activeReport.stake || "0.035 ETH"}</span></div><div><span className="meta-label">On-chain state</span><span className="meta-value">{activeReport.state || "Listed"}</span></div></div><div className="detail-grid"><div style={{ gridColumn: "1 / -1" }}><span className="meta-label">Evidence commitment</span><span className="commitment">{activeReport.commitment}</span></div></div><button className="vault-action" disabled={busy || !account} onClick={async () => { try { const provider = new ethers.BrowserProvider(window.ethereum); const signer = await provider.getSigner(); const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, CONTRACT_ABI, signer); await (await contract.corroborateReport(activeReport.id)).wait(); setStatus("Corroboration recorded on-chain."); } catch (error) { setStatus(error.shortMessage || error.message || "Could not corroborate report."); } }}>Corroborate this report</button>{activeReport.state === "Delivered" || activeReport.state === "Settled" ? <button className="primary-button" disabled={busy} onClick={decryptSelectedReport}>Decrypt and verify package locally<LockKeyhole size={14} /></button> : <button className="primary-button" disabled={busy} onClick={purchaseReport}>{busy ? "Confirming escrow..." : account ? `Buy encrypted report · ${activeReport.price}` : "Connect wallet to purchase"}<ArrowUpRight size={14} /></button>}{decryptedReport && <div className="decrypted-report"><span className="meta-label">Decrypted locally</span><strong>{decryptedReport.type}</strong><p>{decryptedReport.intelligence}</p><small>Evidence and delivery commitments matched before decryption.</small>{activeReport.state === "Delivered" && <button className="vault-action" disabled={busy} onClick={confirmReportDelivery}>Confirm delivery and release escrow</button>}</div>}{status && <div className="status"><Zap size={11} /> {status}</div>}</div>}
          </div>}
          <p className="disclaimer"><CircleHelp size={11} style={{ verticalAlign: "-2px" }} /> Information is sourced from current and former tenants. Evidence-backed does not mean objectively complete. Purchased reports can be copied after disclosure.</p>
        </aside>
      </div>
    </main>
  );
}
