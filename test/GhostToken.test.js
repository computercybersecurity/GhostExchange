const { expectRevert } = require('@openzeppelin/test-helpers');
const GhostToken = artifacts.require('GhostToken');

contract('GhostToken', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.goex = await GhostToken.new({ from: alice });
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.goex.name();
        const symbol = await this.goex.symbol();
        const decimals = await this.goex.decimals();
        assert.equal(name.valueOf(), 'GhostToken');
        assert.equal(symbol.valueOf(), 'GOEX');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow owner to mint token', async () => {
        await this.goex.mint(alice, '100', { from: alice });
        await this.goex.mint(bob, '1000', { from: alice });
        await expectRevert(
            this.goex.mint(carol, '1000', { from: bob }),
            'Ownable: caller is not the owner',
        );
        const totalSupply = await this.goex.totalSupply();
        const aliceBal = await this.goex.balanceOf(alice);
        const bobBal = await this.goex.balanceOf(bob);
        const carolBal = await this.goex.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '100');
        assert.equal(bobBal.valueOf(), '1000');
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.goex.mint(alice, '100', { from: alice });
        await this.goex.mint(bob, '1000', { from: alice });
        await this.goex.transfer(carol, '10', { from: alice });
        await this.goex.transfer(carol, '100', { from: bob });
        const totalSupply = await this.goex.totalSupply();
        const aliceBal = await this.goex.balanceOf(alice);
        const bobBal = await this.goex.balanceOf(bob);
        const carolBal = await this.goex.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '90');
        assert.equal(bobBal.valueOf(), '900');
        assert.equal(carolBal.valueOf(), '110');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.goex.mint(alice, '100', { from: alice });
        await expectRevert(
            this.goex.transfer(carol, '110', { from: alice }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.goex.transfer(carol, '1', { from: bob }),
            'ERC20: transfer amount exceeds balance',
        );
    });
  });
