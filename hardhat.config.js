require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true
    }
  },
  networks: {
    ...(process.env.SEPOLIA_RPC_URL && privateKey
      ? {
          sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            accounts: [privateKey],
            chainId: 11155111
          }
        }
      : {}),
    ...(process.env.BASE_SEPOLIA_RPC_URL && privateKey
      ? {
          baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC_URL,
            accounts: [privateKey],
            chainId: 84532
          }
        }
      : {})
  }
};
