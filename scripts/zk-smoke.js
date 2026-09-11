const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

async function main() {
  const root = path.resolve(__dirname, "..");
  const build = path.join(root, "zk", "build");
  const poseidon = await buildPoseidon();
  const input = { evidenceDigest: "12345", amount: "3800", salt: "987654321" };
  input.claimedAmount = input.amount;
  input.commitment = poseidon.F.toObject(poseidon([input.evidenceDigest, input.amount, input.salt])).toString();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    path.join(build, "claim_js", "claim.wasm"),
    path.join(build, "claim_final.zkey")
  );
  const verified = await snarkjs.groth16.verify(
    JSON.parse(fs.readFileSync(path.join(build, "verification_key.json"))),
    publicSignals,
    proof
  );
  if (!verified) throw new Error("Groth16 proof verification failed");
  fs.mkdirSync(path.join(build, "proof-smoke"), { recursive: true });
  fs.writeFileSync(path.join(build, "proof-smoke", "input.json"), JSON.stringify(input, null, 2));
  fs.writeFileSync(path.join(build, "proof-smoke", "proof.json"), JSON.stringify(proof, null, 2));
  fs.writeFileSync(path.join(build, "proof-smoke", "public.json"), JSON.stringify(publicSignals, null, 2));
  console.log(`Valid Groth16 proof generated for commitment ${input.commitment}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
