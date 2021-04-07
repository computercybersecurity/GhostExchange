const GhostswapFactory = artifacts.require('GhostswapFactory');

module.exports = async function (deployer) {
  const admin = '0x856381382bab5FD4a7b361Dc9FCDD3840E9991B6';
  await deployer.deploy(GhostswapFactory, admin);
};
