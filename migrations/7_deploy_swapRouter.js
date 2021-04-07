const GhostswapFactory = artifacts.require('GhostswapFactory');
const GhostswapRouter02 = artifacts.require('GhostswapRouter02');

module.exports = async function (deployer) {
  const ghostswapFactory = await GhostswapFactory.deployed();
  const wBNB = '0x094616f0bdfb0b526bd735bf66eca0ad254ca81f';
  await deployer.deploy(GhostswapRouter02, ghostswapFactory.address, wBNB);
};
