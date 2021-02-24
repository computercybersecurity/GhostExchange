pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

// GhostStaking is the coolest bar in town. You come in with some Goex, and leave with more! The longer you stay, the more Goex you get.
//
// This contract handles swapping to and from xGoex, GhostToken's staking token.
contract GhostStaking is ERC20("GhostStaking", "xGOEX"){
    using SafeMath for uint256;
    IERC20 public goex;

    // Define the Goex token contract
    constructor(IERC20 _goex) public {
        goex = _goex;
    }

    // Enter the bar. Pay some GOEXs. Earn some shares.
    // Locks Goex and mints xGoex
    function enter(uint256 _amount) public {
        // Gets the amount of Goex locked in the contract
        uint256 totalGoex = goex.balanceOf(address(this));
        // Gets the amount of xGoex in existence
        uint256 totalShares = totalSupply();
        // If no xGoex exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalGoex == 0) {
            _mint(msg.sender, _amount);
        } 
        // Calculate and mint the amount of xGoex the Goex is worth. The ratio will change overtime, as xGoex is burned/minted and Goex deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalShares).div(totalGoex);
            _mint(msg.sender, what);
        }
        // Lock the Goex in the contract
        goex.transferFrom(msg.sender, address(this), _amount);
    }

    // Leave the bar. Claim back your GOEXs.
    // Unclocks the staked + gained Goex and burns xGoex
    function leave(uint256 _share) public {
        // Gets the amount of xGoex in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of Goex the xGoex is worth
        uint256 what = _share.mul(goex.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        goex.transfer(msg.sender, what);
    }
}