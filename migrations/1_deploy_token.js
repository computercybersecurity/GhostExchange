const GhostToken = artifacts.require("GhostToken");

module.exports = async function (deployer) {
  await deployer.deploy(GhostToken);
};
