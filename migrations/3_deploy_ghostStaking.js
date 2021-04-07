const GhostStaking = artifacts.require('GhostStaking');
const GhostToken = artifacts.require('GhostToken');

module.exports = async function (deployer) {
  const ghostTokenInstance = await GhostToken.deployed();
  await deployer.deploy(GhostStaking, ghostTokenInstance.address);
};
