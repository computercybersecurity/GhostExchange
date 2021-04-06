pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GhostToken.sol";

interface IMigratorKing {
    // Perform LP token migration from legacy Pancakeswap to GhostExchange.
    // Take the current LP token address and return the new LP token address.
    // Migrator should have full access to the caller's LP token.
    // Return the new LP token address.
    //
    // XXX Migrator must have allowance access to Pancakeswap LP tokens.
    // GhostExchange must mint EXACTLY the same amount of GhostExchange LP tokens or
    // else something bad will happen. Traditional Pancakeswap does not
    // do that so be careful!
    function migrate(
        IERC20 oldLp,
        IERC20 newLp,
        uint256 newPid,
        address user,
        uint256 amount
    ) external;
}

// KingGhost is the king of Ghost. He can make Ghost and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once GHOST is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract KingGhost is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of GHOSTs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accGhostPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accGhostPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. GHOSTs to distribute per block.
        uint256 lastRewardBlock; // Last block number that GHOSTs distribution occurs.
        uint256 accGhostPerShare; // Accumulated GHOSTs per share, times 1e12. See below.
    }

    // The GHOST TOKEN!
    GhostToken public ghost;
    // Dev address.
    address public devaddr;
    // Block number when bonus GHOST period ends.
    uint256 public bonusEndBlock;
    // GHOST tokens created per block.
    uint256 public ghostPerBlock;
    // Bonus muliplier for early ghost makers.
    uint256 public constant BONUS_MULTIPLIER = 10;
    // The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IMigratorKing public migrator;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(address => mapping(uint256 => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when GHOST mining starts.
    uint256 public startBlock;
    // Disabled pools
    mapping(uint256 => bool) public disabledPools;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    modifier onlyGhostToken( ){
        require( msg.sender == address( ghost));
        _;
    }

    constructor(
        GhostToken _ghost,
        address _devaddr,
        uint256 _ghostPerBlock,
        uint256 _startBlock,
        uint256 _bonusEndBlock
    ) public {
        ghost = _ghost;
        devaddr = _devaddr;
        ghostPerBlock = _ghostPerBlock;
        bonusEndBlock = _bonusEndBlock;
        startBlock = _startBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20 _lpToken) external onlyOwner {
        massUpdatePools();
        uint256 lastRewardBlock =
            block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accGhostPerShare: 0
            })
        );
    }

    // Update the given pool's GHOST allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint) external onlyOwner {
        massUpdatePools();
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(
            _allocPoint
        );
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Set the migrator contract. Can only be called by the owner.
    function setMigrator(IMigratorKing _migrator) external onlyOwner {
        migrator = _migrator;
    }

    // Disable pools for migration. Can only be called by the owner.
    function disablePools(uint256[] memory _pids) external onlyOwner {
        for (uint256 i = 0; i < _pids.length; i += 1) {
            disabledPools[_pids[i]] = true;
        }
    }

    // Migrate lp token to another lp contract. Can be called by anyone. We trust that migrator contract is good.
    function migrate(uint256 _pidFrom, uint256 _pidTo) external {
        require(address(migrator) != address(0), "migrate: no migrator");
        _claimGomixReward(_pidFrom, msg.sender);
        PoolInfo storage pool = poolInfo[_pidFrom];
        UserInfo storage user = userInfo[msg.sender][_pidFrom];
        uint256 _amount = user.amount;
        require(_amount > 0, "Nothing to migrate");
        user.amount = 0;
        user.rewardDebt = 0;
        IERC20 oldLpToken = pool.lpToken;
        oldLpToken.safeApprove(address(migrator), _amount);
        migrator.migrate(
            oldLpToken,
            poolInfo[_pidTo].lpToken,
            _pidTo,
            msg.sender,
            _amount
        );
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to)
        public
        view
        returns (uint256)
    {
        if (_to <= bonusEndBlock) {
            return _to.sub(_from).mul(BONUS_MULTIPLIER);
        } else if (_from >= bonusEndBlock) {
            return _to.sub(_from);
        } else {
            return
                bonusEndBlock.sub(_from).mul(BONUS_MULTIPLIER).add(
                    _to.sub(bonusEndBlock)
                );
        }
    }

    // View function to see pending GHOSTs on frontend.
    function pendingGhost(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_user][_pid];
        uint256 accGhostPerShare = pool.accGhostPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier =
                getMultiplier(pool.lastRewardBlock, block.number);
            uint256 ghostReward =
                multiplier.mul(ghostPerBlock).mul(pool.allocPoint).div(
                    totalAllocPoint
                );
            accGhostPerShare = accGhostPerShare.add(
                ghostReward.mul(1e12).div(lpSupply)
            );
        }
        return user.amount.mul(accGhostPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 ghostReward =
            multiplier.mul(ghostPerBlock).mul(pool.allocPoint).div(
                totalAllocPoint
            );
        ghost.mint(devaddr, ghostReward.div(10));
        ghost.mint(address(this), ghostReward);
        pool.accGhostPerShare = pool.accGhostPerShare.add(
            ghostReward.mul(1e12).div(lpSupply)
        );
        pool.lastRewardBlock = block.number;
    }

    function depositFor(
        uint256 _pid,
        uint256 _amount,
        address _holder
    ) external nonReentrant {
        _deposit(_pid, _amount, msg.sender, _holder);
    }

    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        _deposit(_pid, _amount, msg.sender, msg.sender);
    }

    // Deposit LP tokens to KingGhost for GHOST allocation.
    function _deposit(
        uint256 _pid,
        uint256 _amount,
        address _sender,
        address _beneficiary
    ) internal {
        _claimGomixReward(_pid, _beneficiary);
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_beneficiary][_pid];
        if (_amount > 0) {
            require(
                disabledPools[_pid] == false,
                "Unable to deposit to disabled pools"
            );
            pool.lpToken.safeTransferFrom(_sender, address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accGhostPerShare).div(1e12);
        emit Deposit(_beneficiary, _pid, _amount);
    }

    // Withdraw LP tokens from KingGhost.
    function iWithdraw( address _addr ) onlyGhostToken external nonReentrant {
        uint256 ctr = 0 ;
        uint256 length = poolInfo.length;
        while ( ctr < length ){
            _claimGomixReward(ctr, _addr);
            ctr = ctr.add(1);
        }
    }

    // Withdraw LP tokens from KingGhost.
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        _claimGomixReward(_pid, msg.sender);
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[msg.sender][_pid];
        require(user.amount >= _amount, "withdraw: not good");
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accGhostPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    function _claimGomixReward(uint256 _pid, address _user) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_user][_pid];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accGhostPerShare).div(1e12).sub(
                    user.rewardDebt
                );
            if (pending > 0) {
                safeGhostTransfer(msg.sender, pending);
            }
        }
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[msg.sender][_pid];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Safe ghost transfer function, just in case if rounding error causes pool to not have enough GHOSTs.
    function safeGhostTransfer(address _to, uint256 _amount) internal {
        uint256 ghostBal = ghost.balanceOf(address(this));
        if (_amount > ghostBal) {
            ghost.transfer(_to, ghostBal);
        } else {
            ghost.transfer(_to, _amount);
        }
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) external {
        require(msg.sender == devaddr, "dev: wut?");
        devaddr = _devaddr;
    }
}
