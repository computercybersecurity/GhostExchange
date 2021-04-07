const TimeLock = artifacts.require('TimeLock');
const KingGhost = artifacts.require('KingGhost');

module.exports = async function (deployer) {
  const admin = '0x2b202054e0790ed175c26795c5C85b184146f426';
  const delay = '86400';
  const kingGhost = await KingGhost.deployed();
  await deployer.deploy(TimeLock, admin, delay);
  const timelock = await TimeLock.deployed();
  await kingGhost.transferOwnership(timelock.address);
};
