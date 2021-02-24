const { expectRevert, time } = require("@openzeppelin/test-helpers");
const ethers = require("ethers");
const GhostToken = artifacts.require("GhostToken");
const KingGhost = artifacts.require("KingGhost");
const MockERC20 = artifacts.require("MockERC20");
const Timelock = artifacts.require("Timelock");

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

contract("Timelock", ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    this.ghost = await GhostToken.new({ from: alice });
    this.timelock = await Timelock.new(bob, "259200", { from: alice });
  });

  it("should not allow non-owner to do operation", async () => {
    await this.ghost.transferOwnership(this.timelock.address, { from: alice });
    await expectRevert(
      this.ghost.transferOwnership(carol, { from: alice }),
      "Ownable: caller is not the owner"
    );
    await expectRevert(
      this.ghost.transferOwnership(carol, { from: bob }),
      "Ownable: caller is not the owner"
    );
    await expectRevert(
      this.timelock.queueTransaction(
        this.ghost.address,
        "0",
        "transferOwnership(address)",
        encodeParameters(["address"], [carol]),
        (await time.latest()).add(time.duration.days(4)),
        { from: alice }
      ),
      "Timelock::queueTransaction: Call must come from admin."
    );
  });

  it("should do the timelock thing", async () => {
    await this.ghost.transferOwnership(this.timelock.address, { from: alice });
    const eta = (await time.latest()).add(time.duration.days(4));
    await this.timelock.queueTransaction(
      this.ghost.address,
      "0",
      "transferOwnership(address)",
      encodeParameters(["address"], [carol]),
      eta,
      { from: bob }
    );
    await time.increase(time.duration.days(1));
    await expectRevert(
      this.timelock.executeTransaction(
        this.ghost.address,
        "0",
        "transferOwnership(address)",
        encodeParameters(["address"], [carol]),
        eta,
        { from: bob }
      ),
      "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
    );
    await time.increase(time.duration.days(4));
    await this.timelock.executeTransaction(
      this.ghost.address,
      "0",
      "transferOwnership(address)",
      encodeParameters(["address"], [carol]),
      eta,
      { from: bob }
    );
    assert.equal((await this.ghost.owner()).valueOf(), carol);
  });

  it("should also work with KingGhost", async () => {
    this.lp1 = await MockERC20.new("LPToken", "LP", "10000000000", {
      from: minter,
    });
    this.lp2 = await MockERC20.new("LPToken", "LP", "10000000000", {
      from: minter,
    });
    this.king = await KingGhost.new(
      this.ghost.address,
      dev,
      "1000",
      "0",
      "1000",
      { from: alice }
    );
    await this.ghost.transferOwnership(this.king.address, { from: alice });
    await this.king.add("100", this.lp1.address);
    await this.king.transferOwnership(this.timelock.address, { from: alice });
    const eta = (await time.latest()).add(time.duration.days(4));
    await this.timelock.queueTransaction(
      this.king.address,
      "0",
      "set(uint256,uint256)",
      encodeParameters(["uint256", "uint256"], ["0", "200"]),
      eta,
      { from: bob }
    );
    await this.timelock.queueTransaction(
      this.king.address,
      "0",
      "add(uint256,address)",
      encodeParameters(["uint256", "address"], ["100", this.lp2.address]),
      eta,
      { from: bob }
    );
    await time.increase(time.duration.days(4));
    await this.timelock.executeTransaction(
      this.king.address,
      "0",
      "set(uint256,uint256)",
      encodeParameters(["uint256", "uint256"], ["0", "200"]),
      eta,
      { from: bob }
    );
    await this.timelock.executeTransaction(
      this.king.address,
      "0",
      "add(uint256,address)",
      encodeParameters(["uint256", "address"], ["100", this.lp2.address]),
      eta,
      { from: bob }
    );
    assert.equal((await this.king.poolInfo("0")).valueOf().allocPoint, "200");
    assert.equal((await this.king.totalAllocPoint()).valueOf(), "300");
    assert.equal((await this.king.poolLength()).valueOf(), "2");
  });
});
