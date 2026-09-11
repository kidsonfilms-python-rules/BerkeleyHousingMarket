const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const factory = await hre.ethers.getContractFactory("OuttaTheUnits");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`OuttaTheUnits: ${address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Explorer: ${explorerUrl(hre.network.name, address)}`);
}

function explorerUrl(network, address) {
  if (network === "sepolia") return `https://sepolia.etherscan.io/address/${address}`;
  if (network === "baseSepolia") return `https://sepolia.basescan.org/address/${address}`;
  return "local network";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
