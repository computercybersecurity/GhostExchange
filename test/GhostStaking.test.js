const { expectRevert } = require('@openzeppelin/test-helpers');
const GhostToken = artifacts.require('GhostToken');
const GhostStaking = artifacts.require('GhostStaking');

contract('GhostStaking', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.goex = await GhostToken.new({ from: alice });
        this.xGoex = await GhostStaking.new(this.goex.address, { from: alice });
        this.goex.mint(alice, '100', { from: alice });
        this.goex.mint(bob, '100', { from: alice });
        this.goex.mint(carol, '100', { from: alice });
    });

    it('should not allow enter if not enough approve', async () => {
        await expectRevert(
            this.xGoex.enter('100', { from: alice }),
            'ERC20: transfer amount exceeds allowance',
        );
        await this.goex.approve(this.xGoex.address, '50', { from: alice });
        await expectRevert(
            this.xGoex.enter('100', { from: alice }),
            'ERC20: transfer amount exceeds allowance',
        );
        await this.goex.approve(this.xGoex.address, '100', { from: alice });
        await this.xGoex.enter('100', { from: alice });
        assert.equal((await this.xGoex.balanceOf(alice)).valueOf(), '100');
    });

    it('should not allow withraw more than what you have', async () => {
        await this.goex.approve(this.xGoex.address, '100', { from: alice });
        await this.xGoex.enter('100', { from: alice });
        await expectRevert(
            this.xGoex.leave('200', { from: alice }),
            'ERC20: burn amount exceeds balance',
        );
    });

    it('should work with more than one participant', async () => {
        await this.goex.approve(this.xGoex.address, '100', { from: alice });
        await this.goex.approve(this.xGoex.address, '100', { from: bob });
        // Alice enters and gets 20 shares. Bob enters and gets 10 shares.
        await this.xGoex.enter('20', { from: alice });
        await this.xGoex.enter('10', { from: bob });
        assert.equal((await this.xGoex.balanceOf(alice)).valueOf(), '20');
        assert.equal((await this.xGoex.balanceOf(bob)).valueOf(), '10');
        assert.equal((await this.goex.balanceOf(this.xGoex.address)).valueOf(), '30');
        // GhostStaking get 20 more GOEXs from an external source.
        await this.goex.transfer(this.xGoex.address, '20', { from: carol });
        // Alice deposits 10 more GOEXs. She should receive 10*30/50 = 6 shares.
        await this.xGoex.enter('10', { from: alice });
        assert.equal((await this.xGoex.balanceOf(alice)).valueOf(), '26');
        assert.equal((await this.xGoex.balanceOf(bob)).valueOf(), '10');
        // Bob withdraws 5 shares. He should receive 5*60/36 = 8 shares
        await this.xGoex.leave('5', { from: bob });
        assert.equal((await this.xGoex.balanceOf(alice)).valueOf(), '26');
        assert.equal((await this.xGoex.balanceOf(bob)).valueOf(), '5');
        assert.equal((await this.goex.balanceOf(this.xGoex.address)).valueOf(), '52');
        assert.equal((await this.goex.balanceOf(alice)).valueOf(), '70');
        assert.equal((await this.goex.balanceOf(bob)).valueOf(), '98');
    });
});
