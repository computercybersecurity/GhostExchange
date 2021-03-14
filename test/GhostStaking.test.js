const { expectRevert } = require("@openzeppelin/test-helpers");
const GhostToken = artifacts.require("GhostToken");
const GhostStaking = artifacts.require("GhostStaking");

contract("GhostStaking", ([alice, bob, carol, owner]) => {
  beforeEach(async () => {
    this.ghost = await GhostToken.new({ from: owner });
    this.xGomix = await GhostStaking.new(this.ghost.address, { from: owner });
    this.ghost.mint(alice, "100", { from: owner });
    this.ghost.mint(bob, "100", { from: owner });
    this.ghost.mint(carol, "100", { from: owner });
  });

  it("should not allow enter if not enough approve", async () => {
    await expectRevert(
      this.xGomix.enter("100", { from: alice }),
      "ERC20: transfer amount exceeds allowance"
    );
    await this.ghost.approve(this.xGomix.address, "50", { from: alice });
    await expectRevert(
      this.xGomix.enter("100", { from: alice }),
      "ERC20: transfer amount exceeds allowance"
    );
    await this.ghost.approve(this.xGomix.address, "100", { from: alice });
    await this.xGomix.enter("100", { from: alice });
    assert.equal((await this.xGomix.balanceOf(alice)).valueOf(), "100");
  });

  it("should not allow withraw more than what you have", async () => {
    await this.ghost.approve(this.xGomix.address, "100", { from: alice });
    await this.xGomix.enter("100", { from: alice });
    await expectRevert(
      this.xGomix.leave("200", { from: alice }),
      "ERC20: burn amount exceeds balance"
    );
  });

  it("should work with more than one participant", async () => {
    await this.ghost.approve(this.xGomix.address, "100", { from: alice });
    await this.ghost.approve(this.xGomix.address, "100", { from: bob });
    // Alice enters and gets 20 shares. Bob enters and gets 10 shares.
    await this.xGomix.enter("20", { from: alice });
    await this.xGomix.enter("10", { from: bob });
    assert.equal((await this.xGomix.balanceOf(alice)).valueOf(), "20");
    assert.equal((await this.xGomix.balanceOf(bob)).valueOf(), "10");
    assert.equal(
      (await this.ghost.balanceOf(this.xGomix.address)).valueOf(),
      "30"
    );
    // GhostStaking get 20 more GOMIXs from an external source.
    await this.ghost.transfer(this.xGomix.address, "20", { from: carol });
    // Alice deposits 10 more GOMIXs. She should receive 10*30/50 = 6 shares.
    await this.xGomix.enter("10", { from: alice });
    assert.equal((await this.xGomix.balanceOf(alice)).valueOf(), "26");
    assert.equal((await this.xGomix.balanceOf(bob)).valueOf(), "10");
    // Bob withdraws 5 shares. He should receive 5*60/36 = 8 shares
    await this.xGomix.leave("5", { from: bob });
    assert.equal((await this.xGomix.balanceOf(alice)).valueOf(), "26");
    assert.equal((await this.xGomix.balanceOf(bob)).valueOf(), "5");
    assert.equal(
      (await this.ghost.balanceOf(this.xGomix.address)).valueOf(),
      "52"
    );
    assert.equal((await this.ghost.balanceOf(alice)).valueOf(), "70");
    assert.equal((await this.ghost.balanceOf(bob)).valueOf(), "98");
  });
});
