pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./uniswapv2/interfaces/IUniswapV2Pair.sol";
import "./uniswapv2/interfaces/IUniswapV2Factory.sol";

interface IKingGhost {
    function depositFor(uint256 _pid, uint _amount, address _holder) external;
}

contract Migrator {
    address public king;
    address public oldFactory;
    IUniswapV2Factory public factory;
    uint256 public notBeforeBlock;
    uint256 public desiredLiquidity = uint256(-1);

    constructor(
        address _king,
        address _oldFactory,
        IUniswapV2Factory _factory,
        uint256 _notBeforeBlock
    ) public {
        king = _king;
        oldFactory = _oldFactory;
        factory = _factory;
        notBeforeBlock = _notBeforeBlock;
    }

    function migrate(IUniswapV2Pair orig, uint newPid, address user, uint amount) external {
        require(msg.sender == king, "not from king ghost");
        require(block.number >= notBeforeBlock, "too early to migrate");
        require(orig.factory() == oldFactory, "not from old factory");
        address token0 = orig.token0();
        address token1 = orig.token1();
        IUniswapV2Pair pair = IUniswapV2Pair(factory.getPair(token0, token1));
        if (pair == IUniswapV2Pair(address(0))) {
            pair = IUniswapV2Pair(factory.createPair(token0, token1));
        }
        orig.transferFrom(msg.sender, address(orig), amount);
        orig.burn(address(pair));
        pair.mint(address(this));

        pair.approve(king, pair.balanceOf(address(this)));
        IKingGhost(king).depositFor(newPid, pair.balanceOf(address(this)), user);
        uint token0Balance = IERC20(token0).balanceOf(address(this));
        uint token1Balance = IERC20(token1).balanceOf(address(this));
        if (token0Balance > 0) {
            IERC20(token0).transfer(user, token0Balance);
        }
        if (token1Balance > 0) {
            IERC20(token1).transfer(user, token1Balance);
        }
    }
}
