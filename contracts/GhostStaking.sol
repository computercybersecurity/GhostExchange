pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Stake Gomix token to earn Gomix. The longer you stay, the more Gomix you get.
//
// This contract handles swapping to and from xGomix, GhostToken's staking token.
contract GhostStaking is ERC20("GhostStaking", "xGOMIX"), ReentrancyGuard {
    using SafeMath for uint256;
    IERC20 public ghost;

    // Define the Gomix token contract
    constructor(IERC20 _ghost) public {
        ghost = _ghost;
    }

    // Deposit to GhostStaking. Pay some GOMIXs. Earn some shares.
    // Locks Gomix and mints xGomix
    function deposit(uint256 _amount) external nonReentrant {
        // Gets the amount of Gomix locked in the contract
        uint256 totalGomix = ghost.balanceOf(address(this));
        // Gets the amount of xGomix in existence
        uint256 totalShares = totalSupply();
        // If no xGomix exists, mint it 1:1 to the amount put in
        if (totalShares == 0 || totalGomix == 0) {
            _mint(msg.sender, _amount);
        }
        // Calculate and mint the amount of xGomix the Gomix is worth. The ratio will change overtime, as xGomix is burned/minted and Gomix deposited + gained from fees / withdrawn.
        else {
            uint256 what = _amount.mul(totalShares).div(totalGomix);
            _mint(msg.sender, what);
        }
        // Lock the Gomix in the contract
        require(
            ghost.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
    }

    // Withdraw from GhostStaking. Claim back your GOMIXs.
    // Unclocks the staked + gained Gomix and burns xGomix
    function withdraw(uint256 _share) external nonReentrant {
        // Gets the amount of xGomix in existence
        uint256 totalShares = totalSupply();
        // Calculates the amount of Gomix the xGomix is worth
        uint256 what =
            _share.mul(ghost.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, _share);
        require(ghost.transfer(msg.sender, what), "Transfer failed");
    }
}
