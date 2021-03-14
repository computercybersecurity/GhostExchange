const GhostToken = artifacts.require("GhostToken");
const KingGhost = artifacts.require("KingGhost");

module.exports = async function (deployer) {
  const ghostTokenInstance = await GhostToken.deployed();
  const devAddr = "0x856381382bab5FD4a7b361Dc9FCDD3840E9991B6";
  const ghostPerBlock = "100000000000000000000";
  const startBlock = "6878257";
  const bonusEndBlock = "6879257";
  await deployer.deploy(
    KingGhost,
    ghostTokenInstance.address,
    devAddr,
    ghostPerBlock,
    startBlock,
    bonusEndBlock
  );
  const kingGhost = await KingGhost.deployed();
  await ghostTokenInstance.transferOwnership(kingGhost.address);
};
