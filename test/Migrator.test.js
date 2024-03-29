const { expectRevert, time } = require("@openzeppelin/test-helpers");
const GhostToken = artifacts.require("GhostToken");
const KingGhost = artifacts.require("KingGhost");
const MockERC20 = artifacts.require("MockERC20");
const GhostswapPair = artifacts.require("GhostswapPair");
const GhostswapFactory = artifacts.require("GhostswapFactory");
const GhostswapRouter = artifacts.require("MockGhostswapRouter02");
const Migrator = artifacts.require("Migrator");

contract("Migrator", ([alice, bob, dev, minter]) => {
  beforeEach(async () => {
    this.factory1 = await GhostswapFactory.new(alice, { from: alice });
    this.factory2 = await GhostswapFactory.new(alice, { from: alice });
    this.ghost = await GhostToken.new({ from: alice });
    this.wbnb = await MockERC20.new("WBNB", "WBNB", "100000000", {
      from: minter,
    });
    this.router1 = await GhostswapRouter.new(
      this.factory1.address,
      this.wbnb.address
    );
    this.router2 = await GhostswapRouter.new(
      this.factory2.address,
      this.wbnb.address
    );
    this.token = await MockERC20.new("TOKEN", "TOKEN", "100000000", {
      from: minter,
    });
    this.lp1 = await GhostswapPair.at(
      (await this.factory1.createPair(this.wbnb.address, this.token.address))
        .logs[0].args.pair
    );
    this.lp2 = await GhostswapPair.at(
      (await this.factory2.createPair(this.wbnb.address, this.token.address))
        .logs[0].args.pair
    );
    this.king = await KingGhost.new(
      this.ghost.address,
      dev,
      "1000",
      "0",
      "100000",
      { from: alice }
    );
    this.migrator = await Migrator.new(
      this.router1.address,
      this.router2.address,
      this.king.address
    );
    await this.ghost.transferOwnership(this.king.address, { from: alice });
    await this.king.add("100", this.lp1.address, { from: alice });
    await this.king.add("100", this.lp2.address, { from: alice });
  });

  it("should do the migration successfully", async () => {
    await this.token.transfer(this.lp1.address, "10000000", { from: minter });
    await this.wbnb.transfer(this.lp1.address, "500000", { from: minter });
    await this.lp1.mint(minter);
    assert.equal((await this.lp1.balanceOf(minter)).valueOf(), "2235067");
    await this.lp1.approve(this.king.address, "100000000000", { from: minter });
    await this.king.deposit("0", "2000000", { from: minter });
    assert.equal(
      (await this.lp1.balanceOf(this.king.address)).valueOf(),
      "2000000"
    );
    await this.king.setMigrator(this.migrator.address, { from: alice });
    await this.king.migrate(0, 1, { from: minter });
    assert.equal((await this.lp1.balanceOf(this.king.address)).valueOf(), "0");
    assert.equal(
      (await this.lp2.balanceOf(this.king.address)).valueOf(),
      "1998999"
    );
    await this.king.withdraw("1", "1998999", { from: minter });
    await this.lp2.transfer(this.lp2.address, "1998999", { from: minter });
    await this.lp2.burn(bob);
    assert.equal((await this.token.balanceOf(bob)).valueOf(), "8939802");
    assert.equal((await this.wbnb.balanceOf(bob)).valueOf(), "446989");
  });
});
