const { expectRevert } = require("@openzeppelin/test-helpers");
const GhostToken = artifacts.require("GhostToken");
const BN = require("bn.js");

contract("GhostToken", ([alice, bob, carol, owner]) => {
  const initialSupply = new BN("2000000000000000000000000000");

  beforeEach(async () => {
    this.ghost = await GhostToken.new({ from: owner });
  });

  it("should have correct name and symbol and decimal", async () => {
    const name = await this.ghost.name();
    const symbol = await this.ghost.symbol();
    const decimals = await this.ghost.decimals();
    const totalSupply = await this.ghost.totalSupply();
    assert.equal(name.valueOf(), "GhostMixer");
    assert.equal(symbol.valueOf(), "GOMIX");
    assert.equal(decimals.valueOf(), "18");
    assert.equal(totalSupply.toString(), initialSupply.toString());
  });

  it("should only allow owner to mint token", async () => {
    await this.ghost.mint(alice, "100", { from: owner });
    await this.ghost.mint(bob, "1000", { from: owner });
    await expectRevert(
      this.ghost.mint(carol, "1000", { from: bob }),
      "Ownable: caller is not the owner"
    );
    const totalSupply = await this.ghost.totalSupply();
    const aliceBal = await this.ghost.balanceOf(alice);
    const bobBal = await this.ghost.balanceOf(bob);
    const carolBal = await this.ghost.balanceOf(carol);
    assert.equal(totalSupply.sub(initialSupply).valueOf(), "1100");
    assert.equal(aliceBal.valueOf(), "100");
    assert.equal(bobBal.valueOf(), "1000");
    assert.equal(carolBal.valueOf(), "0");
  });

  it("should supply token transfers properly", async () => {
    await this.ghost.mint(alice, "100", { from: owner });
    await this.ghost.mint(bob, "1000", { from: owner });
    await this.ghost.transfer(carol, "10", { from: alice });
    await this.ghost.transfer(carol, "100", { from: bob });
    const totalSupply = await this.ghost.totalSupply();
    const aliceBal = await this.ghost.balanceOf(alice);
    const bobBal = await this.ghost.balanceOf(bob);
    const carolBal = await this.ghost.balanceOf(carol);
    assert.equal(totalSupply.sub(initialSupply).valueOf(), "1100");
    assert.equal(aliceBal.valueOf(), "90");
    assert.equal(bobBal.valueOf(), "900");
    assert.equal(carolBal.valueOf(), "110");
  });

  it("should fail if you try to do bad transfers", async () => {
    await this.ghost.mint(alice, "100", { from: owner });
    await expectRevert(
      this.ghost.transfer(carol, "110", { from: alice }),
      "ERC20: transfer amount exceeds balance"
    );
    await expectRevert(
      this.ghost.transfer(carol, "1", { from: bob }),
      "ERC20: transfer amount exceeds balance"
    );
  });
});
