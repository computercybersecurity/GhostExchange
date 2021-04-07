const Migrator = artifacts.require('Migrator');

module.exports = async function (deployer) {
  const oldRouter = '0x9F4148684754BB2b634D848C5Dd09242674cBffc';
  const newRouter = '0x39A964779b616C62FAa855265802f478860817cC';
  const kingGhost = '0xe9F774308f73102e751c0Ae475969483234cCcD8';
  await deployer.deploy(Migrator, oldRouter, newRouter, kingGhost);
};
