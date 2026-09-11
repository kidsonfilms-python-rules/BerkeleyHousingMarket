const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const bin = (name) => path.join(root, "node_modules", ".bin", name);
const build = path.join(root, "zk", "build");
const ptau = path.join(build, "powersoftau_final.ptau");
fs.mkdirSync(build, { recursive: true });

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit" });
}

if (!fs.existsSync(ptau)) {
  run(bin("snarkjs"), ["powersoftau", "new", "bn128", "12", path.join(build, "powersoftau_0000.ptau"), "-v"]);
  run(bin("snarkjs"), ["powersoftau", "contribute", path.join(build, "powersoftau_0000.ptau"), path.join(build, "powersoftau_0001.ptau"), "--name=local-contribution", "-e=outta-the-units-ptau-entropy"]);
  run(bin("snarkjs"), ["powersoftau", "prepare", "phase2", path.join(build, "powersoftau_0001.ptau"), ptau]);
}

run(bin("circom2"), ["zk/claim.circom", "--r1cs", "--wasm", "--sym", "-o", build]);
run(bin("snarkjs"), ["groth16", "setup", path.join(build, "claim.r1cs"), ptau, path.join(build, "claim_0000.zkey")]);
run(bin("snarkjs"), ["zkey", "contribute", path.join(build, "claim_0000.zkey"), path.join(build, "claim_final.zkey"), "--name=local-contribution", "-e=outta-the-units-local-entropy"]);
run(bin("snarkjs"), ["zkey", "export", "verificationkey", path.join(build, "claim_final.zkey"), path.join(build, "verification_key.json")]);
run(bin("snarkjs"), ["zkey", "export", "solidityverifier", path.join(build, "claim_final.zkey"), path.join(root, "contracts", "ClaimVerifier.sol")]);

console.log("ZK artifacts generated in zk/build and contracts/ClaimVerifier.sol");
