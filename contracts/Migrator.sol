pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./ghostswap/interfaces/IGhostswapPair.sol";
import "./ghostswap/interfaces/IGhostswapRouter01.sol";

interface IKingGhost {
    function depositFor(
        uint256 _pid,
        uint256 _amount,
        address _holder
    ) external;
}

contract Migrator {
    using SafeERC20 for IERC20;

    IGhostswapRouter01 public oldRouter;
    IGhostswapRouter01 public router;
    IKingGhost public kingGhost;

    constructor(
        IGhostswapRouter01 _oldRouter,
        IGhostswapRouter01 _router,
        IKingGhost _kingGhost
    ) public {
        oldRouter = _oldRouter;
        router = _router;
        kingGhost = _kingGhost;
    }

    // msg.sender should have approved 'liquidity' amount of LP token of 'tokenA' and 'tokenB'
    function migrate(
        IGhostswapPair oldPair,
        IGhostswapPair newPair,
        uint256 newPid,
        address user,
        uint256 liquidity
    ) external {
        // Remove existing liquidity from 'oldRouter'
        require(
            oldPair.transferFrom(msg.sender, address(this), liquidity),
            "LP transfer failed"
        );
        oldPair.approve(address(oldRouter), liquidity);
        IERC20 tokenA = IERC20(oldPair.token0());
        IERC20 tokenB = IERC20(oldPair.token1());
        (uint256 amountA, uint256 amountB) =
            oldRouter.removeLiquidity(
                address(tokenA),
                address(tokenB),
                liquidity,
                0,
                0,
                address(this),
                block.timestamp
            );

        // Approve max is ok because it's only to this contract and this contract has no other functionality
        // Also some ERC20 tokens will fail when approving a set amount twice, such as USDT. Must approve 0 first. This circumvests that issue.
        tokenA.approve(address(router), uint256(-1));
        tokenB.approve(address(router), uint256(-1));

        // Add liquidity to 'router'
        (uint256 pooledAmountA, uint256 pooledAmountB, ) =
            router.addLiquidity(
                address(tokenA),
                address(tokenB),
                amountA,
                amountB,
                0,
                0,
                address(this),
                block.timestamp
            );

        // Send remaining token balances to msg.sender
        // No safeMath used because pooledAmount must be <= amount
        tokenA.safeTransfer(user, amountA - pooledAmountA);
        tokenB.safeTransfer(user, amountB - pooledAmountB);
        uint256 newLpBalance = newPair.balanceOf(address(this));
        require(newLpBalance > 0, "Nothing migrated");
        newPair.approve(address(kingGhost), newLpBalance);
        kingGhost.depositFor(newPid, newLpBalance, user);
    }
}
