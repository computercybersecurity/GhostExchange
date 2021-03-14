const { expectRevert, time } = require("@openzeppelin/test-helpers");
const ethers = require("ethers");
const GhostToken = artifacts.require("GhostToken");
const KingGhost = artifacts.require("KingGhost");
const Timelock = artifacts.require("Timelock");
const GovernorAlpha = artifacts.require("GovernorAlpha");
const MockERC20 = artifacts.require("MockERC20");
const BN = require("bn.js");

function encodeParameters(types, values) {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values);
}

contract("Governor", ([alice, minter, dev, owner]) => {
  const initialSupply = new BN("2000000000000000000000000000");

  it("should work", async () => {
    this.ghost = await GhostToken.new({ from: alice });
    await this.ghost.transfer(dev, "1000000000000000000000000000", {
      from: alice,
    });
    await this.ghost.delegate(dev, { from: dev });
    this.king = await KingGhost.new(this.ghost.address, dev, "100", "0", "0", {
      from: alice,
    });
    await this.ghost.transferOwnership(this.king.address, { from: alice });
    this.lp = await MockERC20.new("LPToken", "LP", "10000000000", {
      from: minter,
    });
    this.lp2 = await MockERC20.new("LPToken2", "LP2", "10000000000", {
      from: minter,
    });
    await this.king.add("100", this.lp.address, { from: alice });
    await this.lp.approve(this.king.address, "1000", { from: minter });
    await this.king.deposit(0, "100", { from: minter });
    // Perform another deposit to make sure some GOMIXs are minted in that 1 block.
    await this.king.deposit(0, "100", { from: minter });
    assert.equal(
      (await this.ghost.totalSupply()).sub(initialSupply).valueOf(),
      "110"
    );
    assert.equal((await this.ghost.balanceOf(minter)).valueOf(), "100");
    assert.equal(
      (await this.ghost.balanceOf(dev)).valueOf(),
      "1000000000000000000000000010"
    );
    // Transfer ownership to timelock contract
    this.timelock = await Timelock.new(alice, time.duration.days(2), {
      from: alice,
    });
    this.gov = await GovernorAlpha.new(
      this.timelock.address,
      this.ghost.address,
      alice,
      { from: alice }
    );
    await this.timelock.setPendingAdmin(this.gov.address, { from: alice });
    await this.gov.__acceptAdmin({ from: alice });
    await this.king.transferOwnership(this.timelock.address, { from: alice });
    await expectRevert(
      this.king.add("100", this.lp2.address, { from: alice }),
      "Ownable: caller is not the owner"
    );
    await expectRevert(
      this.gov.propose(
        [this.king.address],
        ["0"],
        ["add(uint256,address)"],
        [encodeParameters(["uint256", "address"], ["100", this.lp2.address])],
        "Add LP2",
        { from: alice }
      ),
      "GovernorAlpha::propose: proposer votes below proposal threshold"
    );
    await this.gov.propose(
      [this.king.address],
      ["0"],
      ["add(uint256,address)"],
      [encodeParameters(["uint256", "address"], ["100", this.lp2.address])],
      "Add LP2",
      { from: dev }
    );
    await time.advanceBlock();
    await this.gov.castVote("1", true, { from: dev });
    await expectRevert(
      this.gov.queue("1"),
      "GovernorAlpha::queue: proposal can only be queued if it is succeeded"
    );
    // const currentBlock = await time.latestBlock();
    console.log("Advancing 17280 blocks. Will take a while...");
    // await time.advanceBlockTo(currentBlock + 17280);
    for (let i = 0; i < 17280; ++i) {
      await time.advanceBlock();
    }
    await this.gov.queue("1");
    await expectRevert(
      this.gov.execute("1"),
      "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
    );
    await time.increase(time.duration.days(3));
    await this.gov.execute("1");
    assert.equal((await this.king.poolLength()).valueOf(), "2");
  });
});
