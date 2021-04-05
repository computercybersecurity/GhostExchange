const TimeLock = artifacts.require("TimeLock");
const KingGhost = artifacts.require("KingGhost");

module.exports = async function (deployer) {
  const admin = "";
  const delay = "172800";
  const kingGhost = await KingGhost.deployed();
  await deployer.deploy(TimeLock, admin, delay);
  const timelock = await TimeLock.deployed();
  await kingGhost.transferOwnership(timelock.address);
};
