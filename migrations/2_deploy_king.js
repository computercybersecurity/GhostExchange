const GhostToken = artifacts.require('GhostToken');
const KingGhost = artifacts.require('KingGhost');

module.exports = async function (deployer) {
  const ghostTokenInstance = await GhostToken.deployed();
  const devAddr = '0x2b202054e0790ed175c26795c5C85b184146f426';
  const ghostPerBlock = '1000000000000000000000000';
  const startBlock = '7774121';
  const bonusEndBlock = '7784121';

  await deployer.deploy(
    KingGhost,
    ghostTokenInstance.address,
    devAddr,
    ghostPerBlock,
    startBlock,
    bonusEndBlock,
  );
  const kingGhost = await KingGhost.deployed();
  await ghostTokenInstance.transferOwnership(kingGhost.address);
};
